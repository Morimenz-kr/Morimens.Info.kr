const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const { create } = require('./record-catalog-client.js');
const client = create({ fetch: async (url, options) => {
    assert.equal(options.credentials, 'omit'); assert.equal(options.method, 'GET');
    assert.match(url, /^\/data\/[a-z_]+\.json$/);
    return { ok: true, json: async () => JSON.parse(await fs.readFile(path.join(__dirname, '..', url), 'utf8')) };
} });
test('static feature queries need no Steam host and preserve full catalog scope', async () => {
    const relics = await client.relics(); assert.equal(relics.data.variantCount, 651); assert.equal(relics.data.canonicalCount, 418);
    const avatar = await client.profileCosmetics({ q: '90860' }); assert.equal(avatar.data.entries[0].name, '모략 진행 중');
    assert.equal(avatar.data.entries[0].image, 'images/profile/avatar-90860.png');
    assert.ok((await client.seasons('railway')).data.seasons.length > 0);
    const rules = await client.eventTimeRules({ type: 'DurationHourAfterTrigger' }); assert.equal(rules.data.total, 167);
    assert.equal((await client.event(59841)).data.status, 'unknown');
});
test('static client rejects wrong provenance and invalid pagination', async () => {
    const forged = create({ fetch: async () => ({ ok: true, json: async () => ({ source: 'game-server', schemaVersion: 1 }) }) });
    await assert.rejects(forged.relics(), /검증되지/);
    await assert.rejects(client.profileCosmetics({ limit: 101 }), /Invalid page/);
    await assert.rejects(client.profileCosmetics({ kind: 'bad' }), /Invalid cosmetics/);
});
test('public static projections include no player identities, transport envelopes or credentials', async () => {
    const forbidden = /^(?:uid|playerId|steamTicket|authToken|Authorization|password|rawResponse|protocolConfig)$/i;
    function inspect(value) {
        if (!value || typeof value !== 'object') return;
        for (const [key, entry] of Object.entries(value)) { assert.ok(!forbidden.test(key), key); inspect(entry); }
    }
    for (const name of ['relic_library', 'event_library', 'profile_cosmetic_library', 'record_seasons']) {
        const value = JSON.parse(await fs.readFile(path.join(__dirname, '..', 'data', name + '.json'), 'utf8'));
        assert.equal(value.source, 'client-config'); inspect(value);
    }
});
test('every published non-null profile and relic image resolves to a real local asset', async () => {
    const cosmetics = JSON.parse(await fs.readFile(path.join(__dirname, '..', 'data/profile_cosmetic_library.json'), 'utf8'));
    const relics = JSON.parse(await fs.readFile(path.join(__dirname, '..', 'data/relic_library.json'), 'utf8'));
    for (const row of [...Object.values(cosmetics.avatars), ...Object.values(cosmetics.frames), ...relics.relics]) if (row.image) {
        assert.match(row.image, /^images\/(?:profile|dzone\/relic)\/[a-z0-9_-]+\.(?:png|webp)$/);
        await fs.access(path.join(__dirname, '..', row.image));
    }
});
