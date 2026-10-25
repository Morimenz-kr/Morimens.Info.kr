const test = require('node:test');
const assert = require('node:assert/strict');
const storage = () => { const map = new Map(); return { getItem: k => map.get(k) || null, setItem: (k, v) => map.set(k, v), removeItem: k => map.delete(k) }; };
const member = id => ({ characterId: id, enlightenment: 3, borrowed: false, wheels: [{ id: `${id}_wheel`, level: 10 }], covenant: { completion: 70, parts: Array.from({ length: 6 }, (_, i) => ({ slot: i + 1, setId: 'shared_set', main: { id: 'atk', label: '공격력', value: 10, unit: '%' }, subs: [] })) } });
const row = (wave, prefix) => ({ wave, difficulty: '7', count: 2, members: [1, 2, 3, 4].map(i => member(`${prefix}${i}`)) });
test('다섯 구역의 각성체·명륜 중복을 막고 비밀계약 재사용과 90% 미만 기록을 허용한다', async () => {
    const { putPlan, readPlan, conflicts, removePlan } = await import('./usage-plan.mjs');
    const store = storage();
    for (let i = 1; i <= 5; i++) putPlan(row(i, `zone${i}_`), 71, 1234, store);
    assert.equal(Object.keys(readPlan(store).zones).length, 5);
    const clash = row(2, 'other'); clash.members[0].wheels = [{ id: 'zone1_1_wheel', level: 10 }];
    assert.deepEqual(conflicts(clash, readPlan(store), 71), [{ kind: 'wheel', id: 'zone1_1_wheel', wave: 1 }]);
    assert.throws(() => putPlan(clash, 71, 1234, store), /겹칩니다/);
    clash.members[0] = member('zone1_1');
    assert.ok(conflicts(clash, readPlan(store), 71).some(c => c.kind === 'character'));
    assert.throws(() => putPlan(row(1, 'newseason'), 72, 1234, store), /다른 기수/);
    for (let i = 1; i <= 5; i++) removePlan(i, store);
    assert.equal(readPlan(store), null);
});
test('미공개 장비와 파티 내 중복 명륜을 저장하지 않고 손상된 저장값을 무시한다', async () => {
    const { putPlan, readPlan } = await import('./usage-plan.mjs'); const store = storage();
    const missing = row(1, 'a'); missing.members[0].wheels = null;
    assert.throws(() => putPlan(missing, 71, 1234, store), /공개/);
    const duplicate = row(1, 'a'); duplicate.members[1].wheels = duplicate.members[0].wheels;
    assert.throws(() => putPlan(duplicate, 71, 1234, store), /중복/);
    assert.equal(readPlan({ getItem: () => '{broken' }), null);
});
test('편성기 전달과 원본 링크는 네 명의 명륜·계약·옵션과 구역·난이도를 유지한다', async () => {
    const { builderTeam, settingsHref, recordKey } = await import('./usage-plan.mjs');
    const original = row(4, 'a'); const saved = { row: original, collectedAt: 1234 };
    const team = builderTeam(saved);
    assert.deepEqual(team.chars, original.members.map(m => m.characterId));
    assert.deepEqual(team.wheels, original.members.map(m => m.wheels.map(w => w.id)));
    assert.deepEqual(team.usageSource, saved);
    const url = new URL(settingsHref(original, 71), 'https://example.com');
    assert.equal(url.searchParams.get('wave'), '4'); assert.equal(url.searchParams.get('difficulty'), '7');
    assert.equal(url.searchParams.get('period'), '71'); assert.equal(url.searchParams.get('team'), 'a1|a2|a3|a4');
    assert.equal(url.searchParams.get('record'), recordKey(original)); assert.equal(url.hash, '#usage');
});
