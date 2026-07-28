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
            buildResourceLinksUpdate,
            buildResourceUpdateResultMessage,
            buildResourceComponents,
            parseResourceDecision,
            normalizeResourceSelection,
            ensureResourceLinksPendingBranch,
            editDiscordMessage
        };
    `)();
}

const {
    extractArcaPostsFromList,
    fetchArcaPostDetail,
    getGitHubFile,
    buildResourceLinksUpdate,
    buildResourceUpdateResultMessage,
    buildResourceComponents,
    parseResourceDecision,
    normalizeResourceSelection,
    ensureResourceLinksPendingBranch,
    editDiscordMessage
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

test('상세 페이지가 요청 제한되면 목록 데이터로 제안을 계속 만든다', async () => {
    const originalFetch = global.fetch;
    global.fetch = async () => new Response('rate limited', { status: 429 });

    try {
        const detail = await fetchArcaPostDetail({
            id: '300',
            url: 'https://arca.live/b/forgettingeve/300',
            title: '목록에서 읽은 정보글',
            image: '//ac-p3.namu.la/fallback.jpg?type=list',
            sourceTab: '정보'
        }, listUrl);

        assert.deepEqual(detail, {
            url: 'https://arca.live/b/forgettingeve/300',
            title: '목록에서 읽은 정보글',
            desc: '',
            image: 'https://ac-p3.namu.la/fallback.jpg?type=list',
            sourceTab: '정보'
        });
    } finally {
        global.fetch = originalFetch;
    }
});

test('GitHub Contents API가 대용량 파일 내용을 생략하면 immutable blob SHA로 다시 읽는다', async () => {
    const originalFetch = global.fetch;
    const calls = [];
    global.fetch = async url => {
        calls.push(String(url));
        if (calls.length === 1) {
            return Response.json({
                sha: 'large-file-sha',
                content: '',
                encoding: 'none',
                download_url: 'https://raw.githubusercontent.com/example/resource_links.json'
            });
        }
        return Response.json({
            sha: 'large-file-sha',
            encoding: 'base64',
            content: Buffer.from('{"categories":{},"characters":{}}', 'utf8').toString('base64')
        });
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

test('실제 resource_links에는 침식 로탄 키가 하나만 있고 대기 링크도 보존된다', () => {
    const source = fs.readFileSync(path.join(__dirname, '..', 'data', 'resource_links.json'), 'utf8');
    const occurrences = source.match(/"lotan_cetarchon"\s*:/g) || [];
    const links = JSON.parse(source).characters.lotan_cetarchon;

    assert.equal(occurrences.length, 1);
    assert.deepEqual(links.map(link => link.url), [
        'https://arca.live/b/forgettingeve/178113456',
        'https://arca.live/b/forgettingeve/178103784'
    ]);
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
