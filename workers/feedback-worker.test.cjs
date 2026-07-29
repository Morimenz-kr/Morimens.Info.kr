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
            fetchArcaPostDetail,
            getGitHubFile,
            putGitHubFile,
            buildResourceLinksUpdate,
            buildResourceUpdateResultMessage,
            buildResourceComponents,
            parseResourceDecision,
            normalizeResourceSelection,
            ensureResourceLinksPendingBranch,
            editDiscordMessage,
            processQueuedResourceUpdate,
            recoverStaleResourceProposals
        };
    `)();
}

const {
    extractArcaPostsFromList,
    fetchArcaPostDetail,
    getGitHubFile,
    putGitHubFile,
    buildResourceLinksUpdate,
    buildResourceUpdateResultMessage,
    buildResourceComponents,
    parseResourceDecision,
    normalizeResourceSelection,
    ensureResourceLinksPendingBranch,
    editDiscordMessage,
    processQueuedResourceUpdate,
    recoverStaleResourceProposals
} = loadWorkerInternals();
const listUrl = 'https://arca.live/b/forgettingeve?category=%EC%A0%95%EB%B3%B4';

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

test('상세 페이지가 계속 요청 제한되면 빈 설명 제안을 만들지 않고 다음 실행으로 미룬다', async () => {
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
            async list() {
                return { keys: [{ name: `resource-link:proposal:${proposalId}` }], list_complete: true };
            },
            async get() {
                return state;
            },
            async put(key, value) {
                writes.push({ key, value: JSON.parse(value) });
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
    assert.deepEqual(queued[0], {
        proposalId,
        targets: [{ type: 'category', id: 'weekly_yungjae' }],
        channelId: 'channel-id',
        messageId: 'message-id',
        handledBy: 'tester'
    });
    assert.equal(writes.length, 1);
    assert.equal(writes[0].value.status, 'processing');
    assert.equal(writes[0].value.recoveryCount, 1);
});

test('잘못된 Queue 작업은 GitHub를 건드리지 않고 완료 처리한다', async () => {
    let acknowledged = false;
    await processQueuedResourceUpdate({}, {
        body: { proposalId: 'invalid' },
        ack() { acknowledged = true; }
    });
    assert.equal(acknowledged, true);
});
