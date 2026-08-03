const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

function loadWorkerInternals() {
    const workerPath = path.join(__dirname, 'feedback-worker.js');
    const source = fs
        .readFileSync(workerPath, 'utf8')
        .replace('export default {', 'const worker = {');

    return new Function(`
        ${source}
        return {
            extractArcaPostsFromList,
            fetchText,
            fetchArcaPostDetail,
            buildArcaListFallbackDetail,
            collectEmptyArcaResourceDescriptions,
            buildResourceLinkDescriptionBackfill,
            getGitHubFile,
            putGitHubFile,
            buildResourceLinksUpdate,
            buildResourceUpdateResultMessage,
            buildResourceComponents,
            createResourceProposalMessage,
            getSeenArcaPostIds,
            scanArcaFeedPage,
            processPendingArcaPosts,
            getArcaFeedStateKey,
            compareArcaPostIds,
            parseResourceDecision,
            processResourceDecision,
            normalizeResourceSelection,
            ensureResourceLinksPendingBranch,
            ensureResourceLinksPullRequest,
            editDiscordMessage,
            processQueuedResourceUpdate,
            recoverStaleResourceProposals,
            extractGiftCodesFromDiscordMessage,
            getDiscordMessageText,
            extractGiftCodeExpiry,
            buildGiftCodeLinksUpdate,
            buildGiftCodePublishedMessage,
            getGiftCodeDaysRemaining,
            getCronHealth,
            handleCronWatchdog
        };
    `)();
}

const {
    extractArcaPostsFromList,
    fetchText,
    fetchArcaPostDetail,
    buildArcaListFallbackDetail,
    collectEmptyArcaResourceDescriptions,
    buildResourceLinkDescriptionBackfill,
    getGitHubFile,
    putGitHubFile,
    buildResourceLinksUpdate,
    buildResourceUpdateResultMessage,
    buildResourceComponents,
    createResourceProposalMessage,
    getSeenArcaPostIds,
    scanArcaFeedPage,
    processPendingArcaPosts,
    getArcaFeedStateKey,
    compareArcaPostIds,
    parseResourceDecision,
    processResourceDecision,
    normalizeResourceSelection,
    ensureResourceLinksPendingBranch,
    ensureResourceLinksPullRequest,
    editDiscordMessage,
    processQueuedResourceUpdate,
    recoverStaleResourceProposals,
    extractGiftCodesFromDiscordMessage,
    getDiscordMessageText,
    extractGiftCodeExpiry,
    buildGiftCodeLinksUpdate,
    buildGiftCodePublishedMessage,
    getGiftCodeDaysRemaining,
    getCronHealth,
    handleCronWatchdog
} = loadWorkerInternals();
const listUrl = 'https://arca.live/b/forgettingeve?category=%EC%A0%95%EB%B3%B4';

test('크론 완료 heartbeat가 기준 시간보다 오래되면 비정상으로 판단한다', () => {
    const now = new Date('2026-08-02T13:30:00.000Z');
    const healthy = getCronHealth('2026-08-02T13:20:00.000Z', now, 15 * 60 * 1000);
    const stale = getCronHealth('2026-08-02T13:10:00.000Z', now, 15 * 60 * 1000);
    assert.equal(healthy.healthy, true);
    assert.equal(stale.healthy, false);
    assert.equal(stale.ageMinutes, 20);
});

test('watchdog는 같은 장애에 Discord 경고를 한 번만 보낸다', async () => {
    const originalFetch = global.fetch;
    const messages = [];
    let watchdogState = null;
    global.fetch = async (url, options) => {
        messages.push(JSON.parse(options.body).content);
        return Response.json({ id: 'watchdog-message' });
    };
    const env = {
        WATCHDOG_TOKEN: 'secret',
        DISCORD_BOT_TOKEN: 'bot',
        DISCORD_CHANNEL_ID: 'channel',
        RESOURCE_LINK_STATE: {
            async get(key) {
                if (key === 'cron:heartbeat:completed:v1') return { timestamp: '2020-01-01T00:00:00.000Z' };
                if (key === 'cron:watchdog-state:v1') return watchdogState;
                return null;
            },
            async put(key, value) {
                if (key === 'cron:watchdog-state:v1') watchdogState = JSON.parse(value);
            }
        }
    };
    const request = new Request('https://worker.test/cron-watchdog', {
        method: 'POST',
        headers: { Authorization: 'Bearer secret' }
    });
    try {
        const first = await handleCronWatchdog(request, env, {});
        const second = await handleCronWatchdog(request, env, {});
        assert.equal(first.status, 503);
        assert.equal(second.status, 503);
        assert.equal(messages.length, 1);
        assert.equal(watchdogState.alertActive, true);
    } finally {
        global.fetch = originalFetch;
    }
});

test('Arca 목록 요청은 응답이 멈추면 제한 시간 후 중단한다', async () => {
    const originalFetch = global.fetch;
    global.fetch = async (url, options) => new Promise((resolve, reject) => {
        options.signal.addEventListener('abort', () => reject(options.signal.reason), { once: true });
    });
    try {
        await assert.rejects(() => fetchText('https://arca.live/test', 5), error => {
            assert.equal(error.name, 'TimeoutError');
            return true;
        });
    } finally {
        global.fetch = originalFetch;
    }
});

test('Arca 대기 글은 오래된 글 ID부터 정렬한다', () => {
    const ids = ['300', '100', '200'].sort(compareArcaPostIds);
    assert.deepEqual(ids, ['100', '200', '300']);
});

test('탭별 체크포인트를 만날 때까지 다음 페이지를 이어 읽는다', async () => {
    const originalFetch = global.fetch;
    const writes = [];
    const feedStateKey = getArcaFeedStateKey(listUrl);
    global.fetch = async url => {
        assert.match(String(url), /[?&]p=2(?:&|$)/);
        return new Response(`
            <div class="list-table table">
                <a class="vrow column" href="/b/forgettingeve/180?p=2">
                    <span class="vcol col-id">180</span>
                    <span class="vcol col-title"><span class="title">새 글</span></span>
                </a>
                <a class="vrow column" href="/b/forgettingeve/90?p=2">
                    <span class="vcol col-id">90</span>
                    <span class="vcol col-title"><span class="title">체크포인트 이전 글</span></span>
                </a>
            </div>
        `, { status: 200 });
    };

    try {
        const result = await scanArcaFeedPage({
            RESOURCE_LINK_STATE: {
                async get(key) {
                    assert.equal(key, feedStateKey);
                    return {
                        checkpointId: '100',
                        scan: {
                            targetHighWatermarkId: '200',
                            nextPage: 2,
                            startedAt: '2026-07-31T00:00:00.000Z'
                        }
                    };
                },
                async put(key, value) {
                    writes.push({ key, value: JSON.parse(value) });
                }
            }
        }, listUrl, 2, new Set(), new Set());

        assert.equal(result.pageNumber, 2);
        assert.equal(result.reachedBoundary, true);
        assert.equal(result.checkpointId, '200');
        assert.equal(writes[0].key, 'arca:pending:180');
        assert.equal(writes[1].key, feedStateKey);
        assert.equal(writes[1].value.checkpointId, '200');
        assert.equal(writes[1].value.scan, null);
    } finally {
        global.fetch = originalFetch;
    }
});

test('이미 전송한 Arca 글 ID는 KV 목록 한 번으로 읽는다', async () => {
    const calls = [];
    const ids = await getSeenArcaPostIds({
        RESOURCE_LINK_STATE: {
            async list(options) {
                calls.push(options);
                return {
                    keys: [{ name: 'arca:seen:100' }, { name: 'arca:seen:200' }],
                    list_complete: true
                };
            }
        }
    });

    assert.deepEqual([...ids], ['100', '200']);
    assert.equal(calls.length, 1);
    assert.equal(calls[0].prefix, 'arca:seen:');
    assert.equal(calls[0].limit, 1000);
});

test('Discord 제보 상태는 메시지 ID를 포함해 KV에 한 번만 저장한다', async () => {
    const originalFetch = global.fetch;
    const writes = [];
    const fetches = [];
    global.fetch = async (url, options = {}) => {
        fetches.push({ url: String(url), options });
        return Response.json({ id: 'discord-message-id' });
    };

    try {
        const result = await createResourceProposalMessage({
            DISCORD_CHANNEL_ID: 'channel-id',
            DISCORD_BOT_TOKEN: 'bot-token',
            RESOURCE_LINK_STATE: {
                async put(key, value) {
                    writes.push({ key, value: JSON.parse(value) });
                }
            }
        }, {
            link: {
                url: 'https://arca.live/b/forgettingeve/100',
                title: '테스트 글',
                desc: '',
                image: ''
            },
            targets: [],
            sourceTab: '정보',
            submittedBy: 'arca-monitor'
        });

        assert.equal(fetches.length, 1);
        assert.equal(writes.length, 1);
        assert.equal(writes[0].value.discordMessageId, 'discord-message-id');
        assert.equal(result.proposalState.discordMessageId, 'discord-message-id');
    } finally {
        global.fetch = originalFetch;
    }
});

test('Arca 대기열은 오래된 글부터 Discord로 전송한다', async () => {
    const originalFetch = global.fetch;
    const sentTitles = [];
    const deletedKeys = [];
    const posts = Object.fromEntries(['100', '200', '300'].map(id => [
        `arca:pending:${id}`,
        {
            id,
            url: `https://arca.live/b/forgettingeve/${id}`,
            title: `글 ${id}`,
            image: '',
            sourceTab: '정보',
            sourceListUrl: listUrl,
            discoveredAt: '2026-07-31T00:00:00.000Z'
        }
    ]));
    global.fetch = async (url, options = {}) => {
        const requestUrl = String(url);
        if (requestUrl.startsWith('https://arca.live/')) {
            const id = requestUrl.match(/\/(\d+)$/)?.[1];
            return new Response(`
                <meta property="og:title" content="글 ${id}">
                <meta property="og:description" content="설명 ${id}">
                <meta property="og:url" content="${requestUrl}">
            `, { status: 200 });
        }
        const payload = JSON.parse(options.body);
        sentTitles.push(payload.embeds[0].title);
        return Response.json({ id: `discord-${sentTitles.length}` });
    };

    try {
        const result = await processPendingArcaPosts({
            DISCORD_CHANNEL_ID: 'channel-id',
            DISCORD_BOT_TOKEN: 'bot-token',
            RESOURCE_LINK_STATE: {
                async list() {
                    return {
                        keys: [
                            { name: 'arca:pending:300' },
                            { name: 'arca:pending:100' },
                            { name: 'arca:pending:200' }
                        ],
                        list_complete: true
                    };
                },
                async get(key) {
                    return posts[key];
                },
                async put() {
                },
                async delete(key) {
                    deletedKeys.push(key);
                }
            }
        }, new Set(), 2);

        assert.equal(result.proposed, 2);
        assert.deepEqual(sentTitles, ['글 100', '글 200']);
        assert.deepEqual(deletedKeys, ['arca:pending:100', 'arca:pending:200']);
    } finally {
        global.fetch = originalFetch;
    }
});

test('제보 상태 저장 실패 시 보낸 Discord 메시지를 삭제한다', async () => {
    const originalFetch = global.fetch;
    const methods = [];
    global.fetch = async (url, options = {}) => {
        methods.push(options.method || 'GET');
        if (options.method === 'DELETE') return new Response(null, { status: 204 });
        return Response.json({ id: 'orphan-message-id' });
    };

    try {
        await assert.rejects(() => createResourceProposalMessage({
            DISCORD_CHANNEL_ID: 'channel-id',
            DISCORD_BOT_TOKEN: 'bot-token',
            RESOURCE_LINK_STATE: {
                async put() {
                    throw new Error('KV write failed');
                }
            }
        }, {
            link: {
                url: 'https://arca.live/b/forgettingeve/100',
                title: '테스트 글',
                desc: '',
                image: ''
            },
            targets: [],
            sourceTab: '정보',
            submittedBy: 'arca-monitor'
        }), /KV write failed/);

        assert.deepEqual(methods, ['POST', 'DELETE']);
    } finally {
        global.fetch = originalFetch;
    }
});

test('전달된 Discord 메시지 스냅샷에서 기프트 코드를 읽는다', () => {
    const message = {
        id: 'forwarded-gift-code',
        content: '',
        timestamp: '2026-07-30T03:52:00.000Z',
        message_snapshots: [{
            message: {
                content: [
                    'Redemption Code: UJDP-SYWT-JNGZ',
                    'Gift Contents: Silver ×500, Pure Core ×5',
                    'Valid until: <t:1786636740:F>'
                ].join('\n'),
                embeds: []
            }
        }]
    };

    assert.match(getDiscordMessageText(message), /UJDP-SYWT-JNGZ/);
    assert.equal(extractGiftCodeExpiry(getDiscordMessageText(message), message.timestamp), '2026-08-14');
    assert.deepEqual(extractGiftCodesFromDiscordMessage(message), [{
        title: 'UJDP-SYWT-JNGZ',
        desc: '은심 500개, 무구의 은핵 5개',
        expiry: '2026-08-14'
    }]);
});

test('새 기프트 코드는 무기한 코드 다음에서 만료일 오름차순으로 정렬한다', () => {
    const content = JSON.stringify({
        categories: {
            code: {
                links: [
                    { title: 'PERMANENT', desc: '상시', expiry: null },
                    { title: 'EARLY', desc: '먼저', expiry: '2026-08-07' },
                    { title: 'LATE', desc: '나중', expiry: '2026-08-17' }
                ]
            }
        }
    }, null, 2);

    const result = buildGiftCodeLinksUpdate(content, {
        title: 'MIDDLE',
        desc: '중간',
        expiry: '2026-08-14'
    });
    const links = JSON.parse(result.content).categories.code.links;

    assert.equal(result.added, true);
    assert.deepEqual(links.map(link => link.title), ['PERMANENT', 'EARLY', 'MIDDLE', 'LATE']);
});

test('사이트 반영 완료 메시지는 한국 날짜 기준 남은 일수를 표시한다', () => {
    const now = new Date('2026-07-30T05:00:00.000Z');
    const code = {
        title: 'UJDP-SYWT-JNGZ',
        desc: '은심 500개, 무구의 은핵 5개',
        expiry: '2026-08-14'
    };

    assert.equal(getGiftCodeDaysRemaining(code.expiry, now), 15);
    assert.equal(
        buildGiftCodePublishedMessage(code, now),
        'UJDP-SYWT-JNGZ | 은심 500개, 무구의 은핵 5개, 15일 남음'
    );
});

test('정보 탭 고정 공지는 새 정보글로 수집하지 않는다', () => {
    const html = `
        <div class="list-table table">
            <a class="vrow column notice notice-board"
               href="/b/forgettingeve/100?category=%EC%A0%95%EB%B3%B4&amp;p=1">
                <span class="vcol col-title">공지 채널 공지사항</span>
            </a>
            <a class="vrow column"
               href="/b/forgettingeve/200?category=%EC%A0%95%EB%B3%B4&amp;p=1">
                <span class="vcol col-id">768</span>
                <span class="vcol col-title">
                    <span class="badge">정보</span>
                    <span class="title">모든 각성체 세팅 정리</span>
                    <span class="info"><span class="comment-count">[34]</span></span>
                </span>
                <span class="vcol col-author">작성자</span>
            </a>
        </div>
    `;

    const posts = extractArcaPostsFromList(html, listUrl);

    assert.deepEqual(posts, [{
        id: '200',
        url: 'https://arca.live/b/forgettingeve/200',
        title: '모든 각성체 세팅 정리',
        image: '',
        sourceTab: '정보'
    }]);
});

test('게시글 목록 밖의 동일 게시글 링크는 중복 수집하지 않는다', () => {
    const html = `
        <a href="/b/forgettingeve/200?mode=best">인기글 바로가기</a>
        <a class="vrow column" href="/b/forgettingeve/200">
            <span class="vcol col-title">실제 정보글</span>
        </a>
    `;

    const posts = extractArcaPostsFromList(html, listUrl);

    assert.equal(posts.length, 1);
    assert.equal(posts[0].title, '실제 정보글');
});

test('목록에 있는 썸네일 주소를 상세 페이지 대체 이미지로 읽는다', () => {
    const html = `
        <a class="vrow column" href="/b/forgettingeve/250">
            <span class="vcol col-title"><span class="title">이미지 정보글</span></span>
            <div class="vrow-preview">
                <img loading="lazy" src="//ac-p3.namu.la/example.jpg?type=list" alt="">
            </div>
        </a>
    `;

    const [post] = extractArcaPostsFromList(html, listUrl);

    assert.equal(post.image, 'https://ac-p3.namu.la/example.jpg?type=list');
});

test('상세 페이지가 계속 요청 제한되면 상세 조회가 실패로 끝난다', async () => {
    const originalFetch = global.fetch;
    global.fetch = async () => new Response('rate limited', { status: 429 });

    try {
        await assert.rejects(() => fetchArcaPostDetail({
            id: '300',
            url: 'https://arca.live/b/forgettingeve/300',
            title: '목록에서 읽은 정보글',
            image: '//ac-p3.namu.la/fallback.jpg?type=list',
            sourceTab: '정보'
        }, listUrl), /Fetch failed: 429/);
    } finally {
        global.fetch = originalFetch;
    }
});

test('상세 페이지 요청 제한은 재시도 후 설명을 수집한다', async () => {
    const originalFetch = global.fetch;
    let attempts = 0;
    global.fetch = async () => {
        attempts += 1;
        if (attempts < 3) return new Response('rate limited', { status: 429 });
        return new Response(`
            <meta property="og:title" content="재시도 성공 - 망각전야 채널">
            <meta property="og:description" content="원문 설명">
            <meta property="og:image" content="https://example.com/image.jpg">
        `);
    };

    try {
        const detail = await fetchArcaPostDetail({
            id: '301',
            url: 'https://arca.live/b/forgettingeve/301',
            title: '목록 제목',
            image: '',
            sourceTab: '정보'
        }, listUrl);
        assert.equal(attempts, 3);
        assert.equal(detail.title, '재시도 성공');
        assert.equal(detail.desc, '원문 설명');
    } finally {
        global.fetch = originalFetch;
    }
});

test('상세 페이지를 읽지 못해도 목록 정보로 링크를 먼저 제안한다', () => {
    const detail = buildArcaListFallbackDetail({
        id: '302',
        url: 'https://arca.live/b/forgettingeve/302',
        title: '목록에서 읽은 제목',
        image: '//ac-p3.namu.la/fallback.jpg?type=list',
        sourceTab: '정보'
    }, listUrl);

    assert.deepEqual(detail, {
        url: 'https://arca.live/b/forgettingeve/302',
        title: '목록에서 읽은 제목',
        desc: '',
        image: 'https://ac-p3.namu.la/fallback.jpg?type=list',
        sourceTab: '정보'
    });
});

test('빈 Arca 설명을 찾아 같은 URL의 모든 등록 위치에 나중에 채운다', () => {
    const url = 'https://arca.live/b/forgettingeve/303';
    const source = JSON.stringify({
        categories: {
            newbie: { links: [{ url, title: '테스트', desc: '' }] }
        },
        characters: {
            saya: [{ url, title: '테스트', desc: '' }],
            lotan: [{ url: 'https://example.com/other', title: '다른 글', desc: '' }]
        }
    }, null, 2);

    assert.deepEqual(collectEmptyArcaResourceDescriptions(source), [{
        url,
        title: '테스트',
        image: ''
    }]);

    const result = buildResourceLinkDescriptionBackfill(source, url, '나중에 수집한 설명');
    const updated = JSON.parse(result.content);
    assert.equal(result.updated, 2);
    assert.equal(updated.categories.newbie.links[0].desc, '나중에 수집한 설명');
    assert.equal(updated.characters.saya[0].desc, '나중에 수집한 설명');
    assert.equal(updated.characters.lotan[0].desc, '');
});

test('GitHub Contents API가 대용량 파일 내용을 생략하면 immutable blob SHA로 다시 읽는다', async () => {
    const originalFetch = global.fetch;
    const calls = [];
    global.fetch = async (url, options = {}) => {
        calls.push(String(url));
        if (calls.length === 1) {
            return Response.json({
                sha: 'large-file-sha',
                content: '',
                encoding: 'none',
                download_url: 'https://raw.githubusercontent.com/example/resource_links.json'
            });
        }
        assert.equal(options.headers.Accept, 'application/vnd.github.raw+json');
        return new Response('{"categories":{},"characters":{}}');
    };

    try {
        const file = await getGitHubFile({
            GITHUB_OWNER: 'example',
            GITHUB_REPO: 'repo',
            GITHUB_TOKEN: 'test-token'
        }, 'data/resource_links.json', 'resource-links/pending');

        assert.equal(file.sha, 'large-file-sha');
        assert.equal(file.content, '{"categories":{},"characters":{}}');
        assert.equal(calls.length, 2);
        assert.equal(calls[1], 'https://api.github.com/repos/example/repo/git/blobs/large-file-sha');
    } finally {
        global.fetch = originalFetch;
    }
});

test('대용량 파일은 base64 변환 없이 Git Data API로 커밋한다', async () => {
    const originalFetch = global.fetch;
    const calls = [];
    global.fetch = async (url, options = {}) => {
        calls.push({ url: String(url), method: options.method, body: options.body && JSON.parse(options.body) });
        const requestUrl = String(url);
        if (requestUrl.includes('/git/ref/heads/resource-links/pending')) {
            return Response.json({ object: { sha: 'parent-sha' } });
        }
        if (requestUrl.endsWith('/git/commits/parent-sha')) {
            return Response.json({ tree: { sha: 'tree-sha' } });
        }
        if (requestUrl.endsWith('/git/blobs')) return Response.json({ sha: 'blob-sha' });
        if (requestUrl.endsWith('/git/trees')) return Response.json({ sha: 'new-tree-sha' });
        if (requestUrl.endsWith('/git/commits')) return Response.json({ sha: 'new-commit-sha' });
        if (requestUrl.includes('/git/refs/heads/resource-links/pending')) {
            return Response.json({ object: { sha: 'new-commit-sha' } });
        }
        throw new Error(`unexpected request: ${options.method || 'GET'} ${requestUrl}`);
    };

    try {
        const result = await putGitHubFile({
            GITHUB_OWNER: 'example',
            GITHUB_REPO: 'repo',
            GITHUB_TOKEN: 'test-token'
        }, 'data/resource_links.json', {
            message: 'Update resource links',
            content: '{"categories":{}}',
            branch: 'resource-links/pending'
        });

        const blobCall = calls.find(call => call.url.endsWith('/git/blobs'));
        assert.equal(blobCall.method, 'POST');
        assert.deepEqual(blobCall.body, { content: '{"categories":{}}', encoding: 'utf-8' });
        assert.equal(result.commit.sha, 'new-commit-sha');
    } finally {
        global.fetch = originalFetch;
    }
});

test('resource_links에 없는 캐릭터 대상은 새 배열을 만들어 링크를 추가한다', () => {
    const source = JSON.stringify({
        categories: {},
        characters: {
            lotan: []
        }
    }, null, 2);
    const link = {
        url: 'https://arca.live/b/forgettingeve/178103784',
        title: '침탄 대체 명륜을 찾아봄',
        desc: ''
    };

    const result = buildResourceLinksUpdate(source, link, ['character:lotan_cetarchon']);
    const updated = JSON.parse(result.content);

    assert.deepEqual(result.added, [{ type: 'character', id: 'lotan_cetarchon' }]);
    assert.deepEqual(result.missing, []);
    assert.deepEqual(updated.characters.lotan_cetarchon, [link]);
});

test('링크를 반복 추가해도 배열 들여쓰기가 누적되지 않는다', () => {
    const source = JSON.stringify({
        categories: {
            weekly_yungjae: { title: '진행중인 융재금구 팁', links: [] }
        },
        characters: {}
    }, null, 2);
    const target = ['category:weekly_yungjae'];
    const first = buildResourceLinksUpdate(source, {
        url: 'https://example.com/one', title: '첫 글', desc: ''
    }, target);
    const second = buildResourceLinksUpdate(first.content, {
        url: 'https://example.com/two', title: '둘째 글', desc: ''
    }, target);
    const leadingSpaces = second.content.split('\n').map(line => line.match(/^ */)[0].length);

    assert.ok(Math.max(...leadingSpaces) <= 12);
    assert.equal(JSON.parse(second.content).categories.weekly_yungjae.links.length, 2);
});

test('누락 대상만 있을 때 PR 업데이트 완료라고 안내하지 않는다', () => {
    const message = buildResourceUpdateResultMessage({
        added: [],
        skipped: [],
        missing: [{ type: 'category', id: 'unknown' }],
        prUrl: 'no open PR'
    });

    assert.match(message, /^resource_links 업데이트 실패:/);
    assert.doesNotMatch(message, /PR 업데이트 완료/);
    assert.doesNotMatch(message, /PR: no open PR/);
});

test('중복된 캐릭터 키가 있으면 잘못된 배열에 쓰지 않고 중단한다', () => {
    const source = `{
        "categories": {},
        "characters": {
            "lotan_cetarchon": [],
            "lotan_cetarchon": [{"url":"https://example.com/existing","title":"기존 글","desc":""}]
        }
    }`;

    assert.throws(() => buildResourceLinksUpdate(source, {
        url: 'https://example.com/new',
        title: '새 글',
        desc: ''
    }, ['character:lotan_cetarchon']), /중복 캐릭터 키/);
});

test('선택 반영 버튼은 화면에 표시된 선택 상태 revision을 포함한다', () => {
    const proposalId = 'a'.repeat(32);
    const selection = normalizeResourceSelection({
        targets: ['character:lotan_cetarchon'],
        activeRelems: 'chaos',
        revision: '1234abcd'
    });
    const [actionRow] = buildResourceComponents(proposalId, false, selection);
    const approveSelected = actionRow.components.find(component => component.label === '선택 반영');
    const decision = parseResourceDecision({
        data: { custom_id: approveSelected.custom_id }
    });

    assert.equal(approveSelected.custom_id, `rl:approve-selected:${proposalId}:1234abcd`);
    assert.equal(decision.selectionRevision, '1234abcd');
});

test('보류 상태에서는 보류 해제만 활성화한다', () => {
    const proposalId = 'b'.repeat(32);
    const components = buildResourceComponents(
        proposalId,
        false,
        normalizeResourceSelection({
            targets: ['character:lotan_cetarchon'],
            activeRelems: 'chaos',
            revision: '1234abcd'
        }),
        'held'
    );
    const actionButtons = components[0].components;
    const unhold = actionButtons.find(component => component.label === '보류 해제');
    const decision = parseResourceDecision({
        data: { custom_id: unhold.custom_id }
    });

    assert.equal(actionButtons.length, 5);
    assert.ok(actionButtons.filter(component => component !== unhold).every(component => component.disabled));
    assert.equal(unhold.disabled, false);
    assert.equal(unhold.custom_id, `rl:unhold:${proposalId}`);
    assert.deepEqual(decision, {
        action: 'unhold',
        proposalId,
        selectionRevision: null,
        targets: []
    });
    assert.ok(components.slice(1).every(row => row.components.every(component => component.disabled)));
});

test('보류 해제는 기존 선택을 유지하고 pending 상태로 되돌린다', async () => {
    const proposalId = 'c'.repeat(32);
    const originalFetch = global.fetch;
    const writes = [];
    const messageUpdates = [];
    const state = {
        id: proposalId,
        status: 'held',
        handledBy: 'holder',
        proposal: {
            link: { url: 'https://example.com/post', title: '글', desc: '' },
            targets: []
        },
        selection: {
            targets: [{ type: 'character', id: 'lotan_cetarchon' }],
            activeRelems: 'chaos',
            revision: '1234abcd'
        }
    };
    const env = {
        DISCORD_APPLICATION_ID: 'application-id',
        RESOURCE_LINK_STATE: {
            async get() {
                return state;
            },
            async put(key, value) {
                writes.push({ key, value: JSON.parse(value) });
            }
        }
    };
    const interaction = {
        token: 'interaction-token',
        member: { user: { id: 'user-id', username: 'tester' } },
        message: { id: 'message-id' }
    };

    global.fetch = async (url, options = {}) => {
        messageUpdates.push({ url: String(url), body: JSON.parse(options.body) });
        return Response.json({ id: 'message-id' });
    };

    try {
        await processResourceDecision(env, interaction, {
            action: 'unhold',
            proposalId,
            selectionRevision: null,
            targets: []
        });

        assert.equal(writes.length, 1);
        assert.equal(writes[0].value.status, 'pending');
        assert.equal(writes[0].value.unheldBy, 'tester (user-id)');
        assert.deepEqual(writes[0].value.selection.targets, [
            { type: 'character', id: 'lotan_cetarchon' }
        ]);
        assert.equal(messageUpdates.length, 1);
        assert.match(messageUpdates[0].body.content, /보류가 해제되었습니다/);
        assert.equal(
            messageUpdates[0].body.components[0].components.some(component => component.label === '보류 해제'),
            false
        );
        assert.ok(messageUpdates[0].body.components.flatMap(row => row.components).every(component => !component.disabled));
    } finally {
        global.fetch = originalFetch;
    }
});

test('실제 resource_links에는 침식 로탄 키가 하나만 있고 필수 링크가 중복 없이 보존된다', () => {
    const source = fs.readFileSync(path.join(__dirname, '..', 'data', 'resource_links.json'), 'utf8');
    const occurrences = source.match(/"lotan_cetarchon"\s*:/g) || [];
    const links = JSON.parse(source).characters.lotan_cetarchon;
    const urls = links.map(link => link.url);

    assert.equal(occurrences.length, 1);
    assert.equal(new Set(urls).size, urls.length);
    assert.ok(urls.includes('https://arca.live/b/forgettingeve/178113456'));
    assert.ok(urls.includes('https://arca.live/b/forgettingeve/178103784'));
});

test('닫힌 PR의 pending 브랜치에 새 링크가 없으면 main으로 안전하게 재설정한다', async () => {
    const originalFetch = global.fetch;
    const updates = [];
    const content = Buffer.from(JSON.stringify({ categories: {}, characters: {} }), 'utf8').toString('base64');

    global.fetch = async (url, options = {}) => {
        const requestUrl = String(url);
        if (requestUrl.includes('/pulls?')) return Response.json([]);
        if (requestUrl.includes('/git/ref/heads/resource-links/pending')) {
            return Response.json({ object: { sha: 'pending-sha' } });
        }
        if (requestUrl.includes('/git/ref/heads/main')) {
            return Response.json({ object: { sha: 'main-sha' } });
        }
        if (requestUrl.includes('/contents/') && requestUrl.includes('ref=main')) {
            return Response.json({ sha: 'main-file-sha', content, encoding: 'base64' });
        }
        if (requestUrl.includes('/contents/') && requestUrl.includes('ref=resource-links%2Fpending')) {
            return Response.json({ sha: 'pending-file-sha', content, encoding: 'base64' });
        }
        if (requestUrl.includes('/git/refs/heads/resource-links/pending') && options.method === 'PATCH') {
            updates.push(JSON.parse(options.body));
            return Response.json({ object: { sha: 'main-sha' } });
        }
        throw new Error(`unexpected request: ${options.method || 'GET'} ${requestUrl}`);
    };

    try {
        const result = await ensureResourceLinksPendingBranch({
            GITHUB_OWNER: 'example',
            GITHUB_REPO: 'repo',
            GITHUB_TOKEN: 'test-token'
        });

        assert.equal(result.object.sha, 'main-sha');
        assert.deepEqual(updates, [{ sha: 'main-sha', force: true }]);
    } finally {
        global.fetch = originalFetch;
    }
});

test('PR 생성 중 이미 main에 병합되어 커밋 차이가 없으면 경쟁 상태로 처리한다', async () => {
    const originalFetch = global.fetch;
    global.fetch = async (url, options = {}) => {
        const requestUrl = String(url);
        if (requestUrl.includes('/pulls?')) return Response.json([]);
        if (requestUrl.endsWith('/pulls') && options.method === 'POST') {
            return Response.json({
                message: 'Validation Failed',
                errors: [{
                    resource: 'PullRequest',
                    code: 'custom',
                    message: 'No commits between main and resource-links/pending'
                }]
            }, { status: 422 });
        }
        throw new Error(`unexpected request: ${options.method || 'GET'} ${requestUrl}`);
    };

    try {
        const result = await ensureResourceLinksPullRequest({
            GITHUB_OWNER: 'example',
            GITHUB_REPO: 'repo',
            GITHUB_TOKEN: 'test-token',
            GITHUB_BASE_BRANCH: 'main'
        });
        assert.equal(result, null);
    } finally {
        global.fetch = originalFetch;
    }
});

test('pending 변경 확인 중 PR 차이가 사라지면 최신 main으로 재설정한다', async () => {
    const originalFetch = global.fetch;
    const updates = [];
    const baseContent = Buffer.from(JSON.stringify({
        categories: { weekly_yungjae: { links: [] } },
        characters: {}
    }), 'utf8').toString('base64');
    const pendingContent = Buffer.from(JSON.stringify({
        categories: { weekly_yungjae: { links: [{ url: 'https://example.com/new', title: 'new' }] } },
        characters: {}
    }), 'utf8').toString('base64');

    global.fetch = async (url, options = {}) => {
        const requestUrl = String(url);
        if (requestUrl.includes('/pulls?')) return Response.json([]);
        if (requestUrl.endsWith('/pulls') && options.method === 'POST') {
            return Response.json({
                message: 'Validation Failed',
                errors: [{ message: 'No commits between main and resource-links/pending' }]
            }, { status: 422 });
        }
        if (requestUrl.includes('/git/ref/heads/resource-links/pending')) {
            return Response.json({ object: { sha: 'pending-sha' } });
        }
        if (requestUrl.includes('/git/ref/heads/main')) {
            return Response.json({ object: { sha: 'main-sha' } });
        }
        if (requestUrl.includes('/contents/') && requestUrl.includes('ref=main')) {
            return Response.json({ sha: 'main-file-sha', content: baseContent, encoding: 'base64' });
        }
        if (requestUrl.includes('/contents/') && requestUrl.includes('ref=resource-links%2Fpending')) {
            return Response.json({ sha: 'pending-file-sha', content: pendingContent, encoding: 'base64' });
        }
        if (requestUrl.includes('/git/refs/heads/resource-links/pending') && options.method === 'PATCH') {
            updates.push(JSON.parse(options.body));
            return Response.json({ object: { sha: 'main-sha' } });
        }
        throw new Error(`unexpected request: ${options.method || 'GET'} ${requestUrl}`);
    };

    try {
        const result = await ensureResourceLinksPendingBranch({
            GITHUB_OWNER: 'example',
            GITHUB_REPO: 'repo',
            GITHUB_TOKEN: 'test-token',
            GITHUB_BASE_BRANCH: 'main'
        });
        assert.equal(result.object.sha, 'main-sha');
        assert.deepEqual(updates, [{ sha: 'main-sha', force: true }]);
    } finally {
        global.fetch = originalFetch;
    }
});

test('컴포넌트 메시지는 channel_id가 없어도 interaction webhook으로 수정한다', async () => {
    const originalFetch = global.fetch;
    const calls = [];
    global.fetch = async (url, options = {}) => {
        calls.push({ url: String(url), options });
        return Response.json({ id: 'message-id', content: '이미 처리된 제보입니다.' });
    };

    try {
        const result = await editDiscordMessage({
            DISCORD_APPLICATION_ID: 'application-id'
        }, {
            token: 'interaction-token',
            message: { id: 'message-id' }
        }, {
            content: '이미 처리된 제보입니다.',
            components: []
        });

        assert.equal(result.content, '이미 처리된 제보입니다.');
        assert.equal(calls.length, 1);
        assert.equal(
            calls[0].url,
            'https://discord.com/api/v10/webhooks/application-id/interaction-token/messages/@original'
        );
        assert.deepEqual(JSON.parse(calls[0].options.body), {
            allowed_mentions: { parse: [] },
            content: '이미 처리된 제보입니다.',
            components: []
        });
    } finally {
        global.fetch = originalFetch;
    }
});

test('오래 멈춘 processing 제보는 Queue에 다시 넣는다', async () => {
    const proposalId = 'b'.repeat(32);
    const state = {
        id: proposalId,
        status: 'processing',
        processingStartedAt: '2020-01-01T00:00:00.000Z',
        discordMessageId: 'message-id',
        handledBy: 'tester',
        proposal: {
            link: { url: 'https://example.com/post', title: '글', desc: '' },
            targets: []
        },
        selection: {
            targets: ['category:weekly_yungjae'],
            activeRelems: 'chaos',
            revision: 'abcd1234'
        }
    };
    const queued = [];
    const writes = [];
    const env = {
        DISCORD_CHANNEL_ID: 'channel-id',
        RESOURCE_LINK_STATE: {
            async list(options) {
                assert.equal(options.limit, 5);
                return { keys: [{ name: `resource-link:proposal:${proposalId}` }], list_complete: true };
            },
            async get(key) {
                if (key === 'resource-link:recovery-cursor:v1') return null;
                return state;
            },
            async put(key, value) {
                writes.push({ key, value: JSON.parse(value) });
            },
            async delete() {
            }
        },
        RESOURCE_LINK_QUEUE: {
            async send(job) {
                queued.push(job);
            }
        }
    };

    await recoverStaleResourceProposals(env);

    assert.equal(queued.length, 1);
    assert.deepEqual({ ...queued[0], processingToken: undefined }, {
        proposalId,
        targets: [{ type: 'category', id: 'weekly_yungjae' }],
        channelId: 'channel-id',
        messageId: 'message-id',
        handledBy: 'tester',
        processingToken: undefined
    });
    assert.match(queued[0].processingToken, /^[a-f0-9]{32}$/);
    assert.equal(writes.length, 1);
    assert.equal(writes[0].value.status, 'processing');
    assert.equal(writes[0].value.recoveryCount, 1);
    assert.equal(writes[0].value.processingToken, queued[0].processingToken);
});

test('stale 제보 복구는 한 번에 제한된 수만 읽고 다음 cursor를 저장한다', async () => {
    const stateReads = [];
    const cursorWrites = [];
    const keys = Array.from({ length: 5 }, (_, index) => ({
        name: `resource-link:proposal:${String(index).padStart(32, 'a')}`
    }));
    const env = {
        RESOURCE_LINK_STATE: {
            async list(options) {
                assert.deepEqual(options, {
                    prefix: 'resource-link:proposal:',
                    limit: 5
                });
                return {
                    keys,
                    list_complete: false,
                    cursor: 'next-page-cursor'
                };
            },
            async get(key) {
                if (key === 'resource-link:recovery-cursor:v1') return null;
                stateReads.push(key);
                return { status: 'completed' };
            },
            async put(key, value) {
                cursorWrites.push({ key, value });
            },
            async delete() {
                throw new Error('cursor를 삭제하면 안 됩니다.');
            }
        },
        RESOURCE_LINK_QUEUE: {
            async send() {
                throw new Error('완료된 제보를 다시 Queue에 넣으면 안 됩니다.');
            }
        }
    };

    await recoverStaleResourceProposals(env);

    assert.equal(stateReads.length, 5);
    assert.deepEqual(cursorWrites, [{
        key: 'resource-link:recovery-cursor:v1',
        value: 'next-page-cursor'
    }]);
});

test('잘못된 Queue 작업은 GitHub를 건드리지 않고 완료 처리한다', async () => {
    let acknowledged = false;
    await processQueuedResourceUpdate({}, {
        body: { proposalId: 'invalid' },
        ack() { acknowledged = true; }
    });
    assert.equal(acknowledged, true);
});

test('다른 처리 토큰의 중복 Queue 작업은 상태를 덮어쓰지 않는다', async () => {
    let ackCount = 0;
    const env = {
        RESOURCE_LINK_STATE: {
            async get() {
                return {
                    id: 'd'.repeat(32),
                    status: 'processing',
                    processingToken: 'owner-token',
                    proposal: { link: { url: 'https://example.com', title: '글', desc: '' } },
                    selection: { targets: [{ type: 'category', id: 'weekly_yungjae' }] }
                };
            },
            async put() {
                throw new Error('중복 작업은 상태를 쓰면 안 됩니다');
            }
        }
    };
    const message = {
        body: {
            proposalId: 'd'.repeat(32),
            processingToken: 'stale-token'
        },
        ack() {
            ackCount += 1;
        }
    };

    await processQueuedResourceUpdate(env, message);
    assert.equal(ackCount, 1);
});
