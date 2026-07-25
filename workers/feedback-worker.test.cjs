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
        return { extractArcaPostsFromList, fetchArcaPostDetail, getGitHubFile };
    `)();
}

const { extractArcaPostsFromList, fetchArcaPostDetail, getGitHubFile } = loadWorkerInternals();
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

test('GitHub Contents API가 대용량 파일 내용을 생략하면 원문 URL로 다시 읽는다', async () => {
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
        return new Response('{"categories":{},"characters":{}}', { status: 200 });
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
        assert.equal(calls[1], 'https://raw.githubusercontent.com/example/resource_links.json');
    } finally {
        global.fetch = originalFetch;
    }
});
