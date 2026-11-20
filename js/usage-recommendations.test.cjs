const test = require('node:test');
const assert = require('node:assert/strict');
const member = (characterId, wheel = 'w', value = 10) => ({ characterId, enlightenment: 0, borrowed: false, wheels: [{ id: wheel, level: 3 }], covenant: { completion: 91, parts: Array.from({ length: 6 }, (_, i) => ({ slot: i + 1, setId: 'set', main: { id: 'atk', label: '공격', value: value + i, unit: '%' }, subs: [] })) } });
const row = (ids, count, wheel, value) => ({ wave: 1, difficulty: '7', count, members: ids.split('').map(id => member(id, wheel, value)) });
test('an observed build with an owned party precedes a more frequent unusable build', async () => {
    const { recommendBuilds } = await import('./usage-recommendations.mjs');
    const rows = [row('abxy', 100, 'popular', 40), row('abcd', 2, 'owned', 10)], before = JSON.stringify(rows);
    const result = recommendBuilds(rows, 'a', new Set('abcd'));
    assert.equal(JSON.parse(result[0].key)[0], 'owned'); assert.equal(result[0].count, 2);
    assert.deepEqual(result[0].ownedTeams[0].rows, [rows[1]]);
    assert.equal(JSON.parse(recommendBuilds(rows, 'a', new Set())[0].key)[0], 'popular');
    assert.equal(JSON.stringify(rows), before);
});
test('example options come from one actual member and keep their original values and stage', async () => {
    const { recommendBuilds } = await import('./usage-recommendations.mjs');
    const rows = [row('abcd', 2, 'w', 10), row('abce', 8, 'w', 30)]; rows[1].wave = 3;
    const [build] = recommendBuilds(rows, 'a', new Set('abcd'));
    assert.strictEqual(build.example, rows[0]); assert.strictEqual(build.member, rows[0].members[0]);
    assert.deepEqual(build.member.covenant.parts.map(p => p.main.value), [10,11,12,13,14,15]);
    assert.equal(build.count, 10); assert.equal(build.ownedTeams.length, 1);
});
test('unknown equipment and incomplete ownership never create a suggested party', async () => {
    const { recommendBuilds } = await import('./usage-recommendations.mjs');
    const missing = row('abcd', 100, 'unknown', 5); missing.members[0].wheels = null;
    const rows = [missing, row('abcd', 2, 'known', 10)];
    const result = recommendBuilds(rows, 'a', new Set('abc'));
    assert.equal(result.length, 1); assert.equal(result[0].ownedTeams.length, 0);
    assert.equal(recommendBuilds([], 'a', new Set()).length, 0);
});
