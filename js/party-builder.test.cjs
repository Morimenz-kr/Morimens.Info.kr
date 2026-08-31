const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const root = path.join(__dirname, '..');
const rules = JSON.parse(fs.readFileSync(path.join(root, 'data', 'party_builder_rules.json'), 'utf8'));
const source = fs.readFileSync(path.join(__dirname, 'party_builder.js'), 'utf8');

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
