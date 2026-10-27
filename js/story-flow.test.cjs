const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const flow = require('./story-flow.js');
const stages = fs.readdirSync(path.join(__dirname, '../data/story/stages')).map(f => JSON.parse(fs.readFileSync(path.join(__dirname, '../data/story/stages', f))));

test('초기 목록과 반복 목록 경계를 넘어 동일한 순서일 때만 처음부터 반복으로 합친다', () => {
    assert.deepEqual(flow.initialAndLoop(['A'], ['B', 'C', 'A']), {initial: [], loop: ['A', 'B', 'C']});
    assert.deepEqual(flow.initialAndLoop(['A'], ['B', 'C', 'A', 'B', 'C']), {initial: ['A'], loop: ['B', 'C', 'A', 'B', 'C']});
    assert.deepEqual(flow.initialAndLoop(['A', 'B', 'C'], ['A', 'B', 'C']), {initial: [], loop: ['A', 'B', 'C']});
});

test('유한 구간의 반복 횟수와 남은 행동을 보존한다', () => {
    for (const ids of [['A','B','A','B','A'], ['A','A','B','C','A','B','C'], ['A','B','A','B','A','B']]) {
        const expanded = flow.blocks(ids).flatMap(b => Array.from({length: b.count}, () => b.ids).flat());
        assert.deepEqual(expanded, ids);
    }
});

test('모든 스토리의 초기·기본 반복을 압축해도 원본 행동 순서가 같다', () => {
    let checked = 0;
    for (const stage of stages) for (const monster of Object.values(stage.monsters)) {
        const initial = monster.patterns.find(p => p.id === 'opening')?.skillIds || [];
        const cycle = monster.patterns.find(p => p.id === 'cycle-1')?.skillIds || [];
        if (!cycle.length) continue;
        const actual = flow.initialAndLoop(initial, cycle);
        const n = initial.length + cycle.length * 3;
        const originalAt = i => i < initial.length ? initial[i] : cycle[(i - initial.length) % cycle.length];
        const displayAt = i => i < actual.initial.length ? actual.initial[i] : actual.loop[(i - actual.initial.length) % actual.loop.length];
        for (let i = 0; i < n; i++) assert.equal(displayAt(i), originalAt(i), `${stage.id}:${monster.tid}:${i}`);
        checked++;
    }
    assert(checked > 1000);
});

test('자폭 후에는 응시·모독과 반복을 표시하지 않는다', () => {
    const bee = stages.find(s => s.id === 58979).monsters[59750];
    const sections = flow.build(bee);
    assert.deepEqual(sections.flatMap(s => s.ids), [60025, 60026, 60027]);
    assert.equal(sections.at(-1).end, 'death');
    assert(!sections.some(s => s.loop));
    const later = flow.build({patterns:[{id:'opening',skillIds:[1]}],skills:[{id:2,actionEnd:'death'}],turnOverrides:[{firstTurn:2,skillId:2},{firstTurn:3,skillId:3,persistent:true}]});
    assert.deepEqual(later.flatMap(s=>s.ids),[1,2]);
});

test('페이즈 전환의 의도 교체와 다음 커서를 보존한다', () => {
    const m = stages.find(s => s.id === 7814).monsters[14064];
    const sections = flow.build(m).filter(s => s.cycle === 2);
    const ids = m.patterns.find(p => p.id === 'cycle-2').skillIds;
    const executed = [sections[0].ids[0], ...Array.from({length:3},()=>sections[1].ids).flat()].slice(0,30);
    assert.deepEqual(executed,[4228,...ids.slice(1),...ids,...ids].slice(0,30));
    assert.equal(sections.at(-1).loop, true);
    assert.equal(ids[0], ids[1]); // Preserve source duplication instead of deleting by name.
});

test('지적된 상태·피해·실드와 소환 관계가 데이터에 연결된다', () => {
    const skill = (stage, tid, id) => stages.find(s => s.id === stage).stats[tid].resolvedSkills[id].richDescription;
    assert.match(skill(118137, 118019, 118094), /<kw_[a-f0-9]+:피의 서약>/);
    assert.match(skill(118130, 118030, 118103), /<kw_[a-f0-9]+:피의 서약>/);
    assert.match(skill(48047, 49483, 49493), /<kw_[a-f0-9]+:기도>/);
    assert.equal((skill(118139, 118025, 118083).match(/현재 HP의 50%/g) || []).length, 1);
    assert.match(skill(118139, 118025, 118109), /잃은 HP 비율/);
    assert.doesNotMatch(skill(118139, 118025, 118109), /PlayerRole|÷|점 피해/);
    assert.match(skill(90666, 96656, 54458), /<amount_shield:468pt>/);
    assert.doesNotMatch(skill(125644, 13970, 4226), /스킬 강화|턴 종료/);
    const fish = stages.find(s => s.id === 118149);
    const state = fish.stats[120308].resolvedStates.find(s => s.id === 120312);
    for (const name of ['오혈의 어왕', '부패의 어왕', '저주의 어왕']) assert(state.description.includes(name));
    assert.doesNotMatch(state.description, /예비/);
});
