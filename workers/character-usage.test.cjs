const test = require('node:test');
const assert = require('node:assert/strict');
function fixture() {
    return { schemaVersion: 1, characterId: 'xu', period: 71, collectedAt: 1700000000, coverage: 'sample', source: 'test', rows: [] };
}
function storage() { const values = new Map(); return { get: async (k, type) => values.has(k) ? type === 'json' ? JSON.parse(values.get(k)) : type === 'stream' ? new Response(values.get(k)).body : values.get(k) : null, put: async (k, v) => values.set(k, v) }; }
test('authenticated replacement and historical season GET, with clean public fields', async () => {
    const { handleCharacterUsage } = await import('./character-usage.mjs');
    const env = { RESOURCE_LINK_STATE: storage(), DZONE_INGEST_TOKEN: 'test-token' };
    const url = 'https://test/api/dzone/character/xu/usage';
    const post = body => handleCharacterUsage(new Request(url, { method: 'POST', headers: { Authorization: 'Bearer test-token' }, body: JSON.stringify(body) }), env, 'xu');
    assert.equal((await handleCharacterUsage(new Request(url), env, 'xu')).status, 404);
    assert.equal((await post({ ...fixture(), uid: 'private' })).status, 200);
    assert.equal((await post({ ...fixture(), collectedAt: 1699999999 })).status, 409);
    assert.equal((await post({ ...fixture(), period: 70 })).status, 200);
    const latest = await (await handleCharacterUsage(new Request(url), env, 'xu')).json();
    assert.deepEqual(latest.periods, [71, 70]);
    assert.equal(latest.data.period, 71); assert.equal(latest.data.uid, undefined);
    const older = await (await handleCharacterUsage(new Request(url + '?period=70'), env, 'xu')).json(); assert.equal(older.data.period, 70);
    assert.equal((await handleCharacterUsage(new Request(url + '?period=abc'), env, 'xu')).status, 400);
});
test('unauthorized, malformed, oversize and unavailable requests do not write', async () => {
    const { handleCharacterUsage } = await import('./character-usage.mjs');
    const env = { RESOURCE_LINK_STATE: storage(), DZONE_INGEST_TOKEN: 'test-token' };
    const url = 'https://test/api/dzone/character/xu/usage';
    const req = (body, token = 'test-token') => new Request(url, { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body });
    assert.equal((await handleCharacterUsage(req('{}', 'wrong'), env, 'xu')).status, 401);
    assert.equal((await handleCharacterUsage(req('{'), env, 'xu')).status, 400);
    assert.equal((await handleCharacterUsage(req('x'.repeat(24000001)), env, 'xu')).status, 413);
    assert.equal((await handleCharacterUsage(req(JSON.stringify({ ...fixture(), characterId: 'lily' })), env, 'xu')).status, 400);
    assert.equal((await handleCharacterUsage(new Request(url), {}, 'xu')).status, 503);
    assert.equal((await handleCharacterUsage(new Request(url, { method: 'OPTIONS' }), env, 'xu')).status, 204);
});
test('QA reader only accesses isolated keys and rejects all writes', async () => {
    const { default: preview } = await import('./character-usage-preview.mjs');
    const keys = [];
    const env = { RESOURCE_LINK_STATE: { get: async key => { keys.push(key); return null; } } };
    const url = 'https://test/api/dzone/character/xu/usage';
    assert.equal((await preview.fetch(new Request(url), env)).status, 404);
    assert.ok(keys.length > 0 && keys.every(key => key.startsWith('character-usage-qa:')));
    assert.equal((await preview.fetch(new Request(url, { method: 'POST', body: '{}' }), env)).status, 405);
    assert.equal((await preview.fetch(new Request('https://test/other'), env)).status, 404);
});
