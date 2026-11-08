const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
function worker(fetch = () => { throw Error('Unexpected upstream request'); }) {
    const context = {URL, Response, TextDecoder, fetch};
    vm.runInNewContext(fs.readFileSync(require.resolve('./roster-pages-worker.mjs'), 'utf8').replace('export default', 'globalThis.worker ='), context);
    return context.worker;
}
const origin = 'https://morimens-roster.pages.dev';
const request = (body, options = {}) => new Request(origin + '/api/feedback', {method:'POST', headers:{'Content-Type':'application/json', Origin:origin}, body, ...options});
test('roster assets retain Pages asset routing', async () => {
    const result = await worker().fetch(new Request(origin + '/images/card.webp'), {ASSETS:{fetch:async r => new Response(new URL(r.url).pathname)}});
    assert.equal(await result.text(), '/images/card.webp');
});
test('feedback rejects unsupported methods, foreign origins and content types', async () => {
    const handler = worker();
    assert.equal((await handler.fetch(new Request(origin + '/api/feedback'))).status, 405);
    assert.equal((await handler.fetch(request('{}', {headers:{Origin:'https://example.com','Content-Type':'application/json'}}))).status, 403);
    assert.equal((await handler.fetch(request('{}', {headers:{'Content-Type':'text/plain'}}))).status, 415);
});
test('feedback rejects malformed, empty and oversized payloads without forwarding', async () => {
    const handler = worker();
    for (const payload of ['{', 'null', '[]', '{}', '{"message":" "}']) assert.equal((await handler.fetch(request(payload))).status, 400);
    assert.equal((await handler.fetch(request(JSON.stringify({message:'a'.repeat(32769)})))).status, 413);
});
test('feedback forwards original page context and preserves upstream failure status', async () => {
    const payload = JSON.stringify({message:'제보 내용', reporter:'익명', sourceUrl:origin, pageTitle:'보유 현황'});
    const handler = worker(async (url, init) => {
        assert.equal(url, '__FEEDBACK_ENDPOINT__');
        assert.equal(init.method, 'POST');
        assert.equal(init.headers.Origin, 'https://morimenz-kr.github.io');
        assert.equal(init.body, payload);
        return new Response('{"error":"rate limited"}', {status:429, headers:{'Content-Type':'application/json'}});
    });
    const response = await handler.fetch(request(payload));
    assert.equal(response.status, 429);
    assert.equal(response.headers.get('Cache-Control'), 'no-store');
    assert.deepEqual(await response.json(), {error:'rate limited'});
});
test('feedback connection failure returns a retryable error', async () => {
    const response = await worker(async () => { throw Error('offline'); }).fetch(request('{"message":"제보"}'));
    assert.equal(response.status, 502);
});
