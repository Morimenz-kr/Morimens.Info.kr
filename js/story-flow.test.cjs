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
    const entry=m.phaseTransitions.find(p=>p.phaseIndex===2).phaseSkillIds[0];
    const executed = [entry,...sections.filter(s=>!s.loop).flatMap(s=>s.ids),...Array.from({length:3},()=>sections.find(s=>s.loop).ids).flat()].slice(0,30);
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

test('같은 종류의 무작위 소환 후보는 수치 차이를 보존하며 한 카드로 합친다',()=>{
 const stage=stages.find(s=>s.id===125663),refs=stage.monsters[130469].linkedSummons.filter(r=>r.choiceGroup===stage.monsters[130469].linkedSummons[0].choiceGroup);
 assert.equal(flow.combineVariants(stage,refs,130469).length,3);
 const changed=structuredClone(stage);changed.summonedMonsters.find(s=>s.tid===refs[1].tid&&s.parentTid===130469).hp++;
 assert.equal(flow.combineVariants(changed,refs,130469)[1].stats.hp,stage.summonedMonsters.find(s=>s.tid===refs[1].tid&&s.parentTid===130469).hp+1);
 assert.deepEqual(flow.partitionVariants(changed,refs,130469).map(rows=>rows.length),[3]);
 changed.monsters[refs[1].tid].skills[0].descriptionTemplate+=' 다른 효과';
 assert.deepEqual(flow.partitionVariants(changed,refs,130469).map(rows=>rows.length),[2,1]);
});
test('전체 스토리의 소환 패턴 통합은 후보와 실제 행동 순서를 보존한다',()=>{
 let groups=0,merged=0;
 for(const stage of stages)for(const m of Object.values(stage.monsters)){
  const choices=new Map();for(const ref of m.linkedSummons||[])if(ref.choiceGroup){const rows=choices.get(ref.choiceGroup)||[];rows.push(ref);choices.set(ref.choiceGroup,rows);}
  for(const refs of choices.values()){groups++;const buckets=flow.partitionVariants(stage,refs,m.tid);assert.deepEqual(buckets.flat().map(r=>r.tid).sort(),refs.map(r=>r.tid).sort());for(const rows of buckets)if(rows.length>1){merged++;const variants=flow.combineVariants(stage,rows,m.tid,{subset:true});assert.equal(variants.length,rows.length);for(let i=0;i<rows.length;i++)assert.deepEqual(variants[i].monster.patterns,stage.monsters[rows[i].tid].patterns);}}
 }
 assert(groups>=94);assert(merged>=20);
});
test('연속된 단일 행동은 범위로 표시하고 턴 전환 뒤에도 실제 턴 번호를 사용한다',()=>{
 const m={patterns:[{id:'opening',skillIds:[1,2,3,1]},{id:'cycle-1',skillIds:[1,2,3,1]}],skills:[],turnOverrides:[{firstTurn:6,skillId:4,persistent:true}]};const sections=flow.build(m);assert.deepEqual(flow.rows(sections[0]).map(r=>r.labels),[['1'],['2'],['3'],['4~5']]);assert.equal(flow.rows(sections[0]).at(-1).groupRepeat,false);assert.equal(flow.rows(sections[1])[0].labels[0],'6~');
 const timed=flow.build({...m,turnOverrides:[{firstTurn:8,skillId:4,persistent:false},{firstTurn:9,skillId:5,persistent:true}]});assert.equal(flow.rows(timed[1])[0].labels[0],'8');assert.equal(flow.rows(timed[2])[0].labels[0],'9~');
 assert.equal(flow.rows({ids:[1,2,1,2]})[0].groupRepeat,true);
});
test('원본에서 확인된 무작위 의도는 고정 반복 순서로 표시하지 않는다',()=>{
 const group={skillIds:[2,3,4,1],description:'턴 종료 후 무작위',commandId:10};const m={patterns:[{id:'opening',skillIds:[1,2,3,4]},{id:'cycle-1',skillIds:[1,2,3,4]}],skills:[],randomActionGroups:[group]};const sections=flow.build(m);assert.equal(sections.length,1);assert.equal(sections[0].loop,false);assert.equal(sections[0].random,group);assert.deepEqual(sections[0].ids,group.skillIds);
});

test('체력 전환 행동을 경계로 분리하고 전환 후 일회 구간과 반복 구간을 구분한다',()=>{
 const monster={skills:[{id:30,name:'전환 기술'}],healthTransitions:[{skillId:30,addedBars:2,maxHpMultiplier:2.5}],storyTransitions:[{sourceSkillId:60,cycleIndex:2}],patterns:[{id:'opening',skillIds:[10,20,10,20,30]},{id:'cycle-1',skillIds:[40,50,60]},{id:'cycle-2',skillIds:[50,60,50,60]}]};
 const rows=flow.build(monster);
 assert.deepEqual(rows.map(s=>s.label),['전환 전','전환 기술','전환 후 · 시작 행동','전환 후 · 반복 행동']);
 assert.deepEqual(rows.flatMap(s=>s.ids),[10,20,10,20,30,40,50,60,50,60]);
 assert.equal(rows[1].startTurn,5);assert.equal(rows[2].loop,false);assert.equal(rows[3].loop,true);
 const actual=stages.find(s=>s.id===118130).monsters[118028],actualRows=flow.build(actual);
 assert.equal(actualRows[1].healthTransition.addedBars,3);assert.equal(actualRows[1].healthTransition.maxHpMultiplier,3.5);
 assert.equal(actualRows.filter(s=>s.ids.includes(119313)).length,1);
});
