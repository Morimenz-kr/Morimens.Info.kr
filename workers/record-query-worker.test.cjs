const test = require('node:test');
const assert = require('node:assert/strict');
const load = () => import('./record-query-worker.mjs');
const env = () => ({ RECORD_QUERY_ORIGIN: 'https://private-query.example', RECORD_QUERY_TOKEN: 'x'.repeat(32),
    RECORD_ALLOWED_ORIGINS: 'https://fansite.example',
    RECORD_RATE_LIMIT: { idFromName: value => value, get: () => ({ fetch: async () => new Response('{}', { status: 200 }) }) } });
const request = (path, headers = {}, method = 'GET') => new Request('https://records.example' + path, { method,
    headers: { 'CF-Connecting-IP': '192.0.2.1', ...headers } });
test('public relay refuses unconfigured services, writes, arbitrary paths and unapproved origins', async () => {
    const { createRecordWorker } = await load(); const worker = createRecordWorker(() => { throw Error('must-not-fetch'); });
    assert.equal((await worker.fetch(request('/api/profile/1'), {})).status, 503);
    assert.equal((await worker.fetch(request('/api/profile/1', {}, 'POST'), env())).status, 405);
    assert.equal((await worker.fetch(request('/raw-auth'), env())).status, 404);
    assert.equal((await worker.fetch(request('/api/profile/1', { Origin: 'https://evil.example' }), env())).status, 403);
});
test('public relay authenticates only upstream and strips private errors and envelope fields', async () => {
    const { createRecordWorker } = await load(); let calls = 0;
    const worker = createRecordWorker(async (url, options) => {
        calls++; assert.equal(url.origin, 'https://private-query.example');
        assert.equal(options.headers['X-Morimens-Relay'], 'x'.repeat(32));
        assert.equal(options.redirect, 'error');
        return new Response(JSON.stringify({ ok: true, source: 'game-server', data: { uid: 1 }, raw: 'must-not-leak', token: 'must-not-leak' }));
    });
    const response = await worker.fetch(request('/api/profile/1', { Origin: 'https://fansite.example' }), env());
    const result = await response.json(); assert.equal(result.data.uid, 1); assert.equal(calls, 1);
    assert.equal(result.raw, undefined); assert.equal(result.token, undefined);
    assert.equal(response.headers.get('Access-Control-Allow-Origin'), 'https://fansite.example');
    const failed = createRecordWorker(async () => new Response(JSON.stringify({ error: 'private-exception-with-secret', raw: 'must-not-leak' }), { status: 500 }));
    assert.deepEqual(await (await failed.fetch(request('/api/profile/1'), env())).json(), { error: 'query-failed', data: null });
});
test('rate limiter atomically rejects the eleventh request in a minute', async () => {
    const { RecordRateLimit } = await load(); const values = new Map();
    const storage = { get: async key => values.get(key), put: async (key, value) => values.set(key, value), transaction: async run => run(storage) };
    const limiter = new RecordRateLimit({ storage });
    for (let count = 0; count < 10; count++) assert.equal((await limiter.fetch()).status, 200);
    assert.equal((await limiter.fetch()).status, 429);
});
test('rate limiter outage fails closed without calling the game host', async () => {
    const { createRecordWorker } = await load();
    const config = env(); config.RECORD_RATE_LIMIT.get = () => ({ fetch: async () => { throw Error('private-failure'); } });
    const worker = createRecordWorker(() => { throw Error('must-not-fetch'); });
    const response = await worker.fetch(request('/api/profile/1'), config);
    assert.equal(response.status, 503); assert.equal((await response.json()).error, 'query-service-unavailable');
});
test('upstream redirects, malformed JSON and oversized replies expose no original body', async () => {
    const { createRecordWorker } = await load();
    for (const response of [new Response('secret-not-json'), new Response('{}', { headers: { 'Content-Length': String(13 * 1024 * 1024) } })]) {
        const worker = createRecordWorker(async () => response);
        const result = await worker.fetch(request('/api/profile/1'), env());
        assert.equal(result.status, 503); assert.ok(!(await result.text()).includes('secret-not-json'));
    }
    const worker = createRecordWorker(async () => { throw Error('redirect-to-private-secret'); });
    assert.equal((await worker.fetch(request('/api/profile/1'), env())).status, 503);
});
test('hourly quota persists across minutes and resets in the next hour', async () => {
    const { RecordRateLimit } = await load(); const values = new Map();
    const storage = { get: async key => values.get(key), put: async (key, value) => values.set(key, value), transaction: async run => run(storage) };
    const limiter = new RecordRateLimit({ storage }), originalNow = Date.now; let now = 0;
    Date.now = () => now;
    try {
        for (let minute = 0; minute < 6; minute++) {
            now = minute * 60000;
            for (let count = 0; count < 10; count++) assert.equal((await limiter.fetch()).status, 200);
        }
        now = 6 * 60000; assert.equal((await limiter.fetch()).status, 429);
        now = 3600000; assert.equal((await limiter.fetch()).status, 200);
    } finally { Date.now = originalNow; }
});
