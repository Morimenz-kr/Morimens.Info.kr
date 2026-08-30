const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const archive = JSON.parse(fs.readFileSync(path.join(__dirname, '../data/dzone_season67.json'), 'utf8'));
const unresolved = /\[(?:[A-Za-z]+:)?(?:Arg|DescArg|StateArg)\d+\]|\[Layer\]|현재 (?:상태|상황)에 따라/;
const monsters = data => data.waves.flatMap(w => w.alerts.flatMap(a => [...a.monsters, ...(a.summonedMonsters || [])]));

test('67기 모든 난이도의 표시 설명에 미해결 수치나 모호한 대체 문구가 없다', () => {
    for (const monster of monsters(archive)) {
        for (const skill of Object.values(monster.resolvedSkills || {})) assert.doesNotMatch(skill.description, unresolved);
        for (const state of monster.resolvedStates || []) {
            if (state.visible) assert.doesNotMatch(state.description, unresolved);
        }
    }
});

test('67기 8개 행동의 5개 난이도 수치를 저장된 식으로 재현한다', async () => {
    const { resolveStoredSkillValues } = await import('./build-dzone-site-data.mjs');
    const input = structuredClone(archive);
    let restored = 0;
    for (const wave of input.waves) {
        for (const alert of wave.alerts) {
            for (const monster of alert.monsters) {
                const definition = wave.monsters.find(m => m.tid === monster.tid);
                for (const [id, skill] of Object.entries(monster.resolvedSkills)) {
                    if (!skill.args.some(a => a.value?.dynamic)) continue;
                    skill.description = definition.skills.find(s => String(s.id) === id).descriptionTemplate;
                    for (const arg of skill.args) if (arg.value?.dynamic) arg.value = null;
                    restored++;
                }
            }
        }
    }
    assert.equal(restored, 40);
    assert.deepEqual(resolveStoredSkillValues(input), archive);
    assert.deepEqual(resolveStoredSkillValues(structuredClone(archive)), archive);
});

test('67기 피해·재생력 기본값은 각 난이도의 공격력·체력으로 계산한다', () => {
    for (const monster of monsters(archive)) {
        const skills = monster.resolvedSkills || {};
        if (skills['22345']) assert.equal(skills['22345'].args[0].value.display, Math.ceil(monster.attack * 1.5));
        if (skills['36044']) assert.equal(skills['36044'].args[1].value.display, Math.ceil(monster.hp * 0.04));
        if (skills['98126']) assert.equal(skills['98126'].args[0].value.display, Math.ceil(monster.attack * 2));
        if (skills['126448']) {
            assert.equal(skills['126448'].args[0].value.display, Math.ceil(monster.attack * 0.5));
            assert.match(skills['126448'].description, /청록색 불씨가 없는 상태/);
            assert.match(skills['126448'].description, /1스택당 1회 피해에 공격력의 2%/);
            assert.equal(skills['126452'].args[2].value.display, 1);
            assert.match(skills['126452'].description, /손패 1장을 버릴 때마다 추가로 1회/);
        }
    }
});

test('사멸의 푸른 불꽃은 피해와 중독의 서로 다른 원본 계수를 유지한다', () => {
    for (const monster of monsters(archive)) {
        const skill = monster.resolvedSkills?.['126447'];
        if (!skill) continue;
        assert.equal(skill.args[0].value.display, Math.ceil(monster.attack * 0.35));
        assert.equal(skill.args[3].value.display, Math.ceil(monster.attack * 0.3 * 3 * 0.1));
        assert.doesNotMatch(skill.description, /피해량의 10%/);
        assert.match(skill.description, /중독 기본 [\d,]+스택/);
    }
});

test('알 수 없는 식은 임의의 숫자로 대체하지 않는다', async () => {
    const { resolveStoredSkillValues } = await import('./build-dzone-site-data.mjs');
    const input = { waves: [{ alerts: [{ monsters: [{ attack: 100, resolvedSkills: {
        1: { description: '[Damage:Arg1] 피해', args: [{ expression: 'Unknown()', value: null }] }
    } }] }] }] };
    assert.deepEqual(resolveStoredSkillValues(structuredClone(input)), input);
});
