const test = require('node:test');
const assert = require('node:assert/strict');
const bucket = (wave, difficulty, count, gearCount = count) => ({ wave, difficulty, count, gearCount });
const team = (members, buckets) => ({ members: members.split(''), buckets });
const fixture = () => ({ schemaVersion: 1, period: 73, collectedAt: 1234, coverage: 'sample', source: 'test', teams: [
    team('abcd', [bucket(1, '7', 10), bucket(2, '6', 2)]),
    team('abce', [bucket(1, '7', 3), bucket(2, '6', 2), bucket(1, '6', 100)]),
    team('abcg', [bucket(1, '7', 7, 0)]),
    team('abcx', [bucket(3, '7', 200)]),
    team('abxy', [bucket(1, '7', 300)])
] });
test('one Awakener snapshot aggregates weighted stage buckets without multiplying perspectives', async () => {
    const { indexUsageTeams, findClearTeams } = await import('./dzone-clear-model.mjs');
    const { selectRows } = await import('./character-usage-model.mjs');
    const members = 'abcd'.split('').map(characterId => ({ characterId, wheels: [], covenant: {} }));
    const rows = [{ wave: 1, difficulty: '7', count: 3, members }, { wave: 1, difficulty: '7', count: 5, members: [...members].reverse() }, { wave: 2, difficulty: '6', count: 2, members }];
    const index = indexUsageTeams(rows); assert.equal(index.teams.length, 1); assert.equal(findClearTeams(index).total, 10);
    assert.deepEqual(index.teams[0].buckets, [bucket(1, '7', 8), bucket(2, '6', 2)]);
    assert.equal(selectRows({ rows, characterId: 'a' }, { owned: new Set('abc') }).length, 0);
    assert.equal(selectRows({ rows, characterId: 'a' }, { owned: new Set('abcd') }).length, 3);
    assert.equal(selectRows({ rows: [{ ...rows[0], members: members.slice(0, 3) }], characterId: 'a' }, { owned: new Set('abcd') }).length, 0, 'an incomplete team cannot prove four-member ownership');
});
test('owned filter is strict for four members, including an empty roster and combined constraints', async () => {
    const { normalizeClearIndex, findClearTeams } = await import('./dzone-clear-model.mjs'); const data = normalizeClearIndex(fixture());
    assert.equal(findClearTeams(data).total, 624);
    assert.equal(findClearTeams(data, { owned: new Set() }).total, 0);
    assert.deepEqual(findClearTeams(data, { owned: new Set('abcd') }).teams.map(t => t.key), ['a|b|c|d']);
    const found = findClearTeams(data, { owned: new Set('abcde'), include: ['a'], exclude: ['d'], wave: '1', difficulty: '7' });
    assert.equal(found.total, 3); assert.deepEqual(found.teams[0].members, ['a', 'b', 'c', 'e']);
    assert.equal(findClearTeams(data, { owned: new Set('abc'), include: ['d'] }).total, 0);
});
test('alternatives keep three members and use only overlapping wave and difficulty evidence', async () => {
    const { normalizeClearIndex, findClearTeams, findClearAlternatives } = await import('./dzone-clear-model.mjs'); const data = normalizeClearIndex(fixture());
    const base = findClearTeams(data, { include: [...'abcd'] }).teams[0];
    const result = findClearAlternatives(data, base);
    assert.deepEqual(result.map(t => [t.removed, t.added, t.count]), [['d', 'g', 7], ['d', 'e', 5]]);
    assert.equal(result[0].gearCount, 0, 'unpublished equipment does not fabricate a build or remove an actual clear');
    const stageBase = findClearTeams(data, { include: [...'abcd'], wave: 1, difficulty: '7' }).teams[0];
    assert.equal(findClearAlternatives(data, stageBase).find(t => t.added === 'e').count, 3);
});
test('alternatives preserve ownership and pinned include/exclude constraints and link to the actual replacement team', async () => {
    const { normalizeClearIndex, findClearTeams, findClearAlternatives, clearSettingsHref } = await import('./dzone-clear-model.mjs'); const data = normalizeClearIndex(fixture());
    const base = findClearTeams(data, { include: [...'abcd'] }).teams[0];
    assert.equal(findClearAlternatives(data, base, { include: [...'abcd'] }).length, 0);
    assert.equal(findClearAlternatives(data, base, { owned: new Set('abcd') }).length, 0);
    const result = findClearAlternatives(data, base, { owned: new Set('abcdeg'), exclude: ['g'], include: ['b'] });
    assert.equal(result.length, 1); assert.equal(result[0].added, 'e');
    const url = new URL(clearSettingsHref(result[0], 73, result[0].buckets[0]), 'https://example.test');
    assert.equal(url.searchParams.get('team'), 'a|b|c|e'); assert.equal(url.searchParams.get('wave'), '1'); assert.equal(url.searchParams.get('difficulty'), '7');
});
