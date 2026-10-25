const test = require('node:test');
const assert = require('node:assert/strict');
const load = () => import('./character-usage-model.mjs');
test('confirmed empty and single-wheel builds remain distinct from unknown equipment', async () => {
    const { normalizeUsage, wheelKey, targetMember, selectRows, sampleCount } = await load();
    const f = fixture();
    f.rows[0].members[0].wheels = [];
    f.rows[1].members[0].wheels = [{ id: 'w1', level: 0 }];
    const data = normalizeUsage(f);
    assert.equal(wheelKey(targetMember(data.rows[0], 'xu')), '__unequipped__');
    assert.equal(wheelKey(targetMember(data.rows[1], 'xu')), 'w1');
    assert.equal(wheelKey({ wheels: null }), '');
    assert.equal(sampleCount(selectRows(data, { wheels: '__unequipped__' })), 3);
});
test('compact full-season snapshots preserve exact options and share repeated loadouts', async () => {
    const { normalizeUsage, compactUsage, optionStats, sampleCount } = await load();
    const data = normalizeUsage(fixture());
    data.rows.push({ ...data.rows[0], wave: 3 });
    const packed = compactUsage(data);
    assert.equal(packed.schemaVersion, 2);
    assert.equal(packed.members.length, 4);
    const decoded = normalizeUsage(packed);
    assert.deepEqual(decoded, data);
    assert.equal(decoded.rows[0].members[1], decoded.rows[2].members[1]);
    assert.deepEqual(optionStats(decoded.rows, 'xu'), optionStats(data.rows, 'xu'));
    assert.equal(sampleCount(normalizeUsage({ ...packed, rows: Array.from({ length: 3000 }, () => packed.rows[0]) }).rows), 9000);
    assert.throws(() => normalizeUsage({ ...packed, rows: [[1, '7', 1, [999]]] }), /reference/);
    assert.throws(() => normalizeUsage({ ...packed, rows: [[1, '7', 1, [0, 0]]] }), /Duplicate/);
    assert.throws(() => normalizeUsage({ ...packed, attributes: [['crit', 'crit', 'bad']] }), /attribute/);
});
const option = (id = 'crit', value = 20) => ({ id, label: id, value, unit: '%' });
function member(characterId, completion = 90) {
    return { characterId, enlightenment: 0, borrowed: false, wheels: [{ id: 'w1', level: 15 }, { id: 'w2', level: 3 }], covenant: { completion, parts: Array.from({ length: 6 }, (_, i) => ({ slot: i + 1, setId: 'c1', main: option(), subs: [option('damage', 5)] })) } };
}
function fixture() {
    return { schemaVersion: 1, characterId: 'xu', period: 71, collectedAt: 1700000000, coverage: 'sample', source: 'test', rows: [
        { wave: 1, difficulty: '7', count: 3, members: [member('xu'), member('saya')] },
        { wave: 2, difficulty: '6', count: 7, members: [member('xu', 89), member('lily')] }
    ] };
}
test('joint filters keep actual team, wheel pair and contract linked with correct denominators', async () => {
    const { normalizeUsage, selectRows, distribution, teamKey, sampleCount } = await load();
    const data = normalizeUsage(fixture());
    const teams = distribution(data.rows, teamKey);
    assert.equal(teams[0].rate, .7);
    assert.equal(sampleCount(selectRows(data, { team: teams[0].key, wave: '1' })), 0);
    assert.equal(sampleCount(selectRows(data, { team: teams[0].key, wave: '2', difficulty: '6', enlightenment: '0' })), 7);
    assert.equal(sampleCount(selectRows(data, { wheels: 'w1|w2', covenant: 'c1:6', noBorrowed: true })), 10);
});
test('90% inclusive boundary, weighted option counts and incomplete contracts', async () => {
    const { normalizeUsage, optionStats } = await load();
    const data = normalizeUsage(fixture());
    const stats = optionStats(data.rows, 'xu');
    assert.equal(stats.total, 3);
    assert.equal(stats.slots[0].main[0].count, 3);
    assert.equal(stats.slots[0].subs[0].rate, 1);
    data.rows[1].members.find(m => m.characterId === 'xu').covenant.completion = 100;
    data.rows[1].members.find(m => m.characterId === 'xu').covenant.parts[0].main.value = 40;
    assert.equal(optionStats(data.rows, 'xu').slots[0].main[0].mean, 34);
    data.rows.forEach(r => r.members.find(m => m.characterId === 'xu').covenant = null);
    assert.equal(optionStats(data.rows, 'xu').total, 0);
});
test('unknown equipment remains missing rather than borrowed from manual recommendations', async () => {
    const { normalizeUsage, distribution, wheelKey, targetMember } = await load();
    const f = fixture(); f.rows[0].members[0].wheels = null;
    const data = normalizeUsage(f);
    const groups = distribution(data.rows, r => wheelKey(targetMember(r, 'xu')));
    assert.equal(groups[0].rate, .7);
});
test('allowlist removes raw, account and replay fields at every depth', async () => {
    const { normalizeUsage } = await load();
    const f = fixture(); f.token = 'SECRET'; f.rows[0].uid = 'SECRET'; f.rows[0].members[0].raw = 'SECRET';
    assert.ok(!JSON.stringify(normalizeUsage(f)).includes('SECRET'));
});
test('reject invalid shape, duplicate slots, impossible values and missing target', async () => {
    const { normalizeUsage } = await load();
    for (const mutate of [f => f.rows[0].count = -1, f => f.rows[0].members[0].covenant.completion = 101,
        f => f.rows[0].members[0].covenant.parts[1].slot = 1, f => f.rows[0].members[0].covenant.parts[0].main.value = NaN,
        f => f.rows[0].members[0].characterId = 'absent', f => f.rows[0].wave = 6, f => f.rows[0].members[0].borrowed = 'false']) {
        const f = fixture(); mutate(f); assert.throws(() => normalizeUsage(f));
    }
});
module.exports = { fixture };
test('real client can repeat substat lines: retain rolls, count presence once and sum amounts', async () => {
    const { normalizeUsage, optionStats } = await load();
    const f = fixture(); f.rows[0].members[0].covenant.parts[0].subs = [option('damage', 5), option('damage', 3)];
    const data = normalizeUsage(f);
    assert.equal(data.rows[0].members.find(m => m.characterId === 'xu').covenant.parts[0].subs.length, 2);
    const s = optionStats(data.rows, 'xu').slots[0].subs[0];
    assert.equal(s.count, 3); assert.equal(s.rate, 1); assert.equal(s.mean, 8);
});
test('native growth and current difficulty labels do not turn advanced potential into ordinary dupes', async () => {
    const { enlightenmentLabel, difficultyLabel } = await load();
    assert.equal(enlightenmentLabel(3), '3돌');
    assert.equal(enlightenmentLabel(8), '잠재력 8단계');
    assert.equal(difficultyLabel('4'), 'S');
});
test('catalog IDs remain authoritative regardless of translated display names', async () => {
    const { normalizeUsage, validateUsageCatalog } = await load();
    const data = normalizeUsage(fixture());
    const catalog = { manifest: ['xu', 'saya', 'lily'].map(id => ({ id, name: 'renamed' })), wheels: ['w1', 'w2'].map(english_name => ({ english_name })), covenants: [{ english_name: 'c1' }] };
    assert.equal(validateUsageCatalog(data, catalog), data);
    assert.throws(() => validateUsageCatalog(data, { ...catalog, wheels: [] }), /Unknown wheel/);
    assert.throws(() => validateUsageCatalog(data, { ...catalog, covenants: [] }), /Unknown covenant/);
    assert.throws(() => validateUsageCatalog(data, { ...catalog, manifest: [] }), /Unknown character/);
});
