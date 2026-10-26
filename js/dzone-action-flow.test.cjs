const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, 'dzone-info.js'), 'utf8');
function context() {
    const ctx = vm.createContext({
        escapeHtml: String, dynamicMarkup: () => '',
        skillById: (monster, id) => monster.skills.find(skill => skill.id === id),
        INTENT_ICON_IDS: { Intent_Unknown: '0' }
    });
    vm.runInContext(source.slice(source.indexOf('    function sameSequence('), source.indexOf('    function renderConditionalActions(')), ctx);
    return ctx;
}

test('완전하게 이어지는 반복 주기만 시작 구간에서 분리한다', () => {
    const ctx = context();
    const split = (opening, cycle) => Array.from(ctx.openingBeforeCycle({skillIds:opening}, {skillIds:cycle}).skillIds);
    assert.deepEqual(split([9,1,2,3], [1,2,3]), [9]);
    assert.deepEqual(split([9,1,2,3,1,2,3], [1,2,3,1,2,3]), [9]);
    assert.deepEqual(split([1,2,3], [1,2,3]), []);
    assert.deepEqual(split([9,1,2], [1,2,3]), [9,1,2]);
    assert.deepEqual(Array.from(ctx.shortestRepeatingSequence([1,2,1])), [1,2,1]);
});

test('현재 및 모든 보관 기수의 구간 표시를 바꿔도 300개 이상 연속 행동이 원본과 같다', () => {
    const ctx = context();
    const directory = path.join(__dirname, '../data');
    let definitions = 0;
    for (const file of fs.readdirSync(directory).filter(file => /^dzone_(?:current|season\d+)\.json$/.test(file))) {
        const data = JSON.parse(fs.readFileSync(path.join(directory, file)));
        for (const wave of data.waves) for (const monster of [...wave.monsters, ...(wave.summonDefinitions || [])]) {
            for (const pattern of monster.patterns.filter(pattern => /^cycle-/.test(pattern.id) && pattern.skillIds.length)) {
                const unit = pattern.repeatSkillIds || ctx.shortestRepeatingSequence(pattern.skillIds);
                for (let index = 0; index < pattern.skillIds.length * 10 + 300; index++) {
                    assert.equal(unit[index % unit.length], pattern.skillIds[index % pattern.skillIds.length], `${file} ${monster.tid} ${pattern.id} ${index}`);
                }
            }
            const opening = monster.patterns.find(pattern => pattern.id === 'opening');
            const cycle = monster.patterns.find(pattern => pattern.id === 'cycle-1');
            if (!opening || !cycle?.skillIds.length) continue;
            const before = JSON.stringify(monster.patterns);
            const displayed = ctx.openingBeforeCycle(opening, cycle);
            const unit = cycle.repeatSkillIds || ctx.shortestRepeatingSequence(cycle.skillIds);
            for (let turn = 1; turn <= opening.skillIds.length + cycle.skillIds.length * 10 + 300; turn++) {
                const original = ctx.skillAtTurn(opening, cycle, turn);
                const shown = turn <= displayed.skillIds.length ? displayed.skillIds[turn - 1] : unit[(turn - displayed.skillIds.length - 1) % unit.length];
                assert.equal(shown, original, `${file} ${wave.wave}파 ${monster.tid} ${turn}번째 행동`);
            }
            assert.equal(JSON.stringify(monster.patterns), before);
            definitions++;
        }
    }
    assert.ok(definitions >= 200);
});

test('72기 정직 선생·겸손 여사·수련은 시작 1개와 반복 3개로 렌더링한다', () => {
    const ctx = context();
    const data = JSON.parse(fs.readFileSync(path.join(__dirname, '../data/dzone_current.json')));
    const wave = data.waves.find(wave => wave.wave === 5);
    for (const tid of [60009, 60006, 14039]) {
        const monster = wave.monsters.find(monster => monster.tid === tid);
        const stats = wave.alerts[0].monsters.find(monster => monster.tid === tid);
        const html = ctx.renderActionFlow(monster, stats);
        const phases = [...html.matchAll(/<section class="flow-phase">([\s\S]*?)<\/section>/g)];
        assert.equal(phases.length, tid === 14039 ? 3 : 2);
        assert.match(phases[0][1], /전투 시작/);
        assert.equal((phases[0][1].match(/class="action-step"/g) || []).length, 1);
        assert.match(phases[1][1], tid === 14039 ? /1페이즈/ : /반복 행동/);
        assert.equal((phases[1][1].match(/class="action-step"/g) || []).length, 3);
        assert.deepEqual(monster.patterns.find(pattern => pattern.id === 'opening').skillIds.length, 4);
        if (tid === 14039) {
            assert.match(phases[2][1], /2페이즈/);
            assert.equal((phases[2][1].match(/class="action-step"/g) || []).length, 3);
            assert.equal(monster.patterns.find(pattern => pattern.id === 'cycle-2').skillIds.length, 18);
        }
    }
});
