const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
test('preview exposes anonymous schema fields and rejects mismatched snapshot identity', async () => {
    const { publicSnapshot } = await import('./serve-dzone-preview.mjs');
    const { normalizeUsage } = await import('../js/character-usage-model.mjs');
    const data = { schemaVersion: 1, characterId: 'a', period: 73, collectedAt: 1234, coverage: 'sample', source: 'test', raw: 'PRIVATE', rows: [{ wave: 1, difficulty: '7', count: 1, uid: 'PRIVATE', members: [{ characterId: 'a', enlightenment: 0, borrowed: false, wheels: null, covenant: null, token: 'PRIVATE' }] }] };
    const result = publicSnapshot({ data, raw: 'PRIVATE' }, 73, 'a');
    assert.ok(!result.includes('PRIVATE'));
    assert.equal(normalizeUsage(JSON.parse(result).data).rows.length, 1);
    assert.throws(() => publicSnapshot({ data }, 74, 'a'), /identity/);
    assert.throws(() => publicSnapshot({ data }, 73, 'b'), /identity/);
});
test('preview serves pages and subpaths but keeps private files and arbitrary generated files inaccessible', async () => {
    const { createPreviewServer } = await import('./serve-dzone-preview.mjs');
    const server = createPreviewServer(); await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const base = `http://127.0.0.1:${server.address().port}`;
    const status = url => new Promise((resolve, reject) => http.get(base + url, response => { response.resume(); response.on('end', () => resolve(response.statusCode)); }).on('error', reject));
    try {
        for (const url of ['/links.html', '/Morimens.Info.kr/links.html']) assert.equal(await status(url), 200);
        for (const url of ['/.generated/dzone-recommendations/73/teams.json', '/tools/serve-dzone-preview.mjs', '/data/dzone-meta/73/diagnostics.json', '/js/account-store.test.cjs', '/config/..%5c..%5cAGENTS.md']) assert.equal(await status(url), 404, url);
    } finally { await new Promise(resolve => server.close(resolve)); }
});
