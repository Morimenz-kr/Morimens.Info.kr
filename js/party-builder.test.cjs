const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const root = path.join(__dirname, '..');
const rules = JSON.parse(fs.readFileSync(path.join(root, 'data', 'party_builder_rules.json'), 'utf8'));
const source = fs.readFileSync(path.join(__dirname, 'party_builder.js'), 'utf8');
const chars = JSON.parse(fs.readFileSync(path.join(root, 'data/character_manifest.json'), 'utf8'));
const keys = JSON.parse(fs.readFileSync(path.join(root, 'data/silverkey_list.json'), 'utf8'));

function keyContext(leaderId, keyList = keys) {
    const team = { chars: [leaderId, 'caraboo'], key: null };
    const calls = { saves: 0, renders: 0, closed: [], alerts: [] };
    const context = vm.createContext({
        DB: { chars, keys: keyList },
        allPages: [{ teams: [team] }], currentPageIdx: 0, currentTeamIdx: 0,
        editingCharIdx: 1,
        openSystemAlert: (...args) => calls.alerts.push(args),
        renderAll: () => calls.renders++,
        saveAllData: silent => { assert.equal(silent, true); calls.saves++; },
        closeModal: id => calls.closed.push(id)
    });
    vm.runInContext(source.slice(source.indexOf('function normalizeDedicatedTarget(')), context);
    vm.runInContext(source.slice(source.indexOf('function equipDedicatedKey('), source.indexOf('function setupKeySearchEvents(')), context);
    return { context, team, calls };
}

test('무셰트 전용 은열쇠를 리더 기준으로 장착·저장하고 모달을 닫는다', () => {
    const { context, team, calls } = keyContext('mouchette');
    context.equipDedicatedKey();
    assert.equal(team.key, 'key_from_fog');
    assert.equal(calls.saves, 1);
    assert.equal(calls.renders, 1);
    assert.deepEqual(calls.closed, ['modal-key']);
    assert.deepEqual(calls.alerts, []);
});

test('전용 은열쇠는 표시명·태그 순서보다 명시적 소유자 ID를 우선한다', () => {
    const { context, team } = keyContext('mouchette', [
        { english_name: 'wrong-owner', tags: ['무셰트'], owner_character_ids: ['caraboo'] },
        { english_name: 'legacy-name', tags: ['무셰트'] },
        { english_name: 'stable-owner', tags: ['카드 추가', '모샤'], owner_character_ids: ['mouchette'] }
    ]);
    context.equipDedicatedKey();
    assert.equal(team.key, 'stable-owner');
});

test('기존 태그 기반 전용 은열쇠 장착도 유지한다', () => {
    for (const key of keys) {
        const owner = key.owner_character_ids?.[0];
        const character = owner ? chars.find(char => char.id === owner)
            : chars.find(char => (key.Tag || key.tags || [])[0] === char.name);
        if (!character) continue;
        const { context, team } = keyContext(character.id, [key]);
        context.equipDedicatedKey();
        assert.equal(team.key, key.english_name, character.name);
    }
});

test('리더가 없거나 전용 은열쇠가 없으면 저장하지 않는다', () => {
    for (const [leader, keyList] of [[null, keys], ['mouchette', []]]) {
        const { context, team, calls } = keyContext(leader, keyList);
        context.equipDedicatedKey();
        assert.equal(team.key, null);
        assert.equal(calls.saves, 0);
        assert.equal(calls.alerts.length, 1);
    }
});

test('원본·회귀 라모나는 같은 편성에서 함께 사용할 수 없다', () => {
    assert.ok(rules.exclusive_groups.some(group => (
        group.includes('ramona') && group.includes('ramona_timeworn')
    )));
});

test('원본·침식 로탄은 같은 편성에서 함께 사용할 수 있다', () => {
    assert.equal(rules.exclusive_groups.some(group => (
        group.includes('lotan') && group.includes('lotan_cetarchon')
    )), false);
    assert.doesNotMatch(source, /\["lotan",\s*"lotan_cetarchon"\]/);
});

test('무셰트 전용 SSR·SR은 별칭 설정 없이도 각각 장착하고 저장한다', () => {
    const team = { chars: ['mouchette'], wheels: [[null, null]] };
    let saves = 0;
    let renders = 0;
    const context = vm.createContext({
        DB: {
            chars: JSON.parse(fs.readFileSync(path.join(root, 'data/character_manifest.json'), 'utf8')),
            wheels: JSON.parse(fs.readFileSync(path.join(root, 'data/wheel_list.json'), 'utf8'))
        },
        PARTY_BUILDER_RULES: { dedicated_wheel_aliases: {} },
        allPages: [{ teams: [team] }], currentPageIdx: 0, currentTeamIdx: 0,
        editingCharIdx: 0, selectedWheelSlotIdx: 1,
        openSystemAlert: (...args) => assert.fail(args.join(' ')),
        renderAll: () => { renders++; }, renderWheelModalUI: () => { renders++; },
        saveAllData: silent => { assert.equal(silent, true); saves++; }
    });
    vm.runInContext(source.slice(source.indexOf('function normalizeDedicatedTarget(')), context);
    context.equipDedicatedWheel('SSR');
    assert.equal(team.wheels[0][0], 'wheel_doomsday_rampage');
    assert.equal(context.selectedWheelSlotIdx, 0);
    context.equipDedicatedWheel('SR');
    assert.deepEqual(team.wheels[0], ['wheel_doomsday_rampage', 'wheel_light_of_intellect']);
    assert.equal(context.selectedWheelSlotIdx, 1);
    assert.equal(saves, 2);
    assert.equal(renders, 4);
});
