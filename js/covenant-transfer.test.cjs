const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const definition = JSON.parse(fs.readFileSync(path.join(__dirname, '../data/covenant_editor.json'), 'utf8'));
const transfer = import('./covenant-transfer.mjs');
const models = Promise.all([import('./covenant-simulator-model.mjs'), import('./covenant-equipment.mjs'), import('./covenant-stats.mjs')]);

function owner() {
    return {
        contractSlots: Array.from({length: 6}, (_, index) => Object.values(definition.setIds)[index < 3 ? 0 : 1]),
        contractBound: true,
        trinkets: definition.metadata.slots.map((slot, index) => ({
            position: index + 1, main: slot.main[0], quality: 'Orange', level: index * 2,
            bound: false, sub: [{id: 18159, value: 1.6}, {id: 18105, value: .3}, {id: 18126, value: 2}]
        })),
        level: 60, privateAccount: 'must-not-transfer', simulationHistory: [1, 2]
    };
}

test('시뮬레이터와 ScareCrow 사이에서 혼합 세트·부위·귀속·수치가 왕복한다', async () => {
    const {encodeCovenantSetting, decodeCovenantSetting} = await transfer;
    const [model, equipment, stats] = await models;
    const original = owner();
    const decoded = decodeCovenantSetting(encodeCovenantSetting(original, definition, definition.metadata), definition, definition.metadata);
    const simulator = original.trinkets.map(() => ({substats: [{locked: true}, {locked: false}, {locked: true}], goals: [{enabled: true, option: 'critRate', level: 8}]}));
    const parts = model.applyEditorEquipment(decoded, simulator);
    const returned = model.simulatorEquipment(parts, {bound: decoded.contractBound});
    assert.deepEqual(decodeCovenantSetting(encodeCovenantSetting(returned, definition, definition.metadata), definition, definition.metadata), decoded);
    assert.deepEqual(equipment.covenantAttributeTotals(definition, returned), equipment.covenantAttributeTotals(definition, original));
    assert.equal(stats.covenantCompletion(equipment.equippedCovenantParts(definition, returned)), stats.covenantCompletion(equipment.equippedCovenantParts(definition, original)));
    assert.deepEqual(parts[0].goals, simulator[0].goals);
    assert.deepEqual(parts[0].substats.map(s => s.locked), [true, false, true]);
});

test('공유에는 장비 정보만 포함하고 캐릭터 성장·계정·계산 이력은 포함하지 않는다', async () => {
    const {encodeCovenantSetting} = await transfer;
    const source = owner(), before = structuredClone(source);
    const encoded = encodeCovenantSetting(source, definition, definition.metadata);
    assert.deepEqual(Object.keys(JSON.parse(encoded).equipment).sort(), ['contractBound', 'contractSlots', 'trinkets']);
    assert.doesNotMatch(encoded, /must-not-transfer|privateAccount|simulationHistory/);
    assert.deepEqual(source, before);
});

test('빈 부위·미설정 옵션과 미귀속을 보존한다', async () => {
    const {encodeCovenantSetting, decodeCovenantSetting} = await transfer;
    const source = owner(); source.contractBound = false; source.contractSlots[2] = 0;
    source.trinkets[1].main = 0; source.trinkets[1].sub = [];
    const result = decodeCovenantSetting(encodeCovenantSetting(source, definition, definition.metadata), definition, definition.metadata);
    assert.equal(result.contractSlots[2], 0); assert.equal(result.contractBound, false);
    assert.equal(result.trinkets[1].main, 0); assert.deepEqual(result.trinkets[1].sub, []);
});

test('다른 버전·손상·과대 입력과 잘못된 세팅은 적용 전에 거절한다', async () => {
    const {encodeCovenantSetting, decodeCovenantSetting, covenantTransferLimit} = await transfer;
    const valid = JSON.parse(encodeCovenantSetting(owner(), definition, definition.metadata));
    const bad = [null, {}, {...valid, version: 2}, {...valid, schema: 'party'}];
    for (const mutate of [
        e => delete e.contractSlots,
        e => e.contractSlots.pop(),
        e => e.contractSlots[0] = 999999999,
        e => e.contractSlots[0] = definition.suits.find(s => !Object.values(definition.setIds).includes(s.id)).id,
        e => e.contractBound = 'true',
        e => e.trinkets.push(e.trinkets[0]),
        e => e.trinkets[1].position = 1,
        e => e.trinkets[0].position = 0,
        e => e.trinkets[0].main = 999999,
        e => e.trinkets[0].quality = 'Purple',
        e => e.trinkets[0].level = 13,
        e => e.trinkets[0].sub[0].value = .17,
        e => e.trinkets[0].sub[0].value = 1e100,
        e => e.trinkets[0].sub[0].id = 999999,
        e => e.trinkets[0].sub.push(e.trinkets[0].sub[0])
    ]) { const payload = structuredClone(valid); mutate(payload.equipment); bad.push(payload); }
    for (const payload of bad) assert.throws(() => decodeCovenantSetting(JSON.stringify(payload), definition, definition.metadata));
    assert.throws(() => decodeCovenantSetting('{', definition, definition.metadata));
    assert.throws(() => decodeCovenantSetting(' '.repeat(covenantTransferLimit + 1), definition, definition.metadata));
});
