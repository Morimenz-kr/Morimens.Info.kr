const test=require('node:test'),assert=require('node:assert/strict');
const rates=require('../data/covenant_roll_rates.json');
const model=import('./covenant-target.mjs').then(m=>{m.setCovenantRollRates(rates);return m;});
const sub=(option,level)=>({option,level,locked:false});
test('같은 옵션의 느슨한 목표가 엄격한 목표의 일치 슬롯을 빼앗지 않는다',async()=>{
 const m=await model,goals=[{option:'critRate',level:1},{option:'critRate',level:8}];
 assert.equal(m.covenantGoalsMet([sub('critRate',8),sub('critRate',1),sub('damageAmp',1)],goals),true);
 assert.equal(m.covenantGoalsMet([sub('critRate',8),sub('damageAmp',1),sub('damageAmp',1)],goals),false);
 const match=m.matchCovenantGoals([sub('critRate',8),sub('damageAmp',1),sub('damageAmp',1)],goals);
 assert.deepEqual(match,[{goalIndex:1,substatIndex:0}]);
});
test('6부위의 800개 추첨 구간이 원본 옵션·레벨 가중치와 정확히 일치한다',async()=>{
 const m=await model;
 assert.deepEqual(rates.levels.map(r=>r.weight),[23,20,17,14,11,8,5,2]);
 for(const position of rates.positions){
  const counts=new Map();assert.ok(position.attributes.every(r=>r.weight===1));
  for(let attribute=0;attribute<8;attribute++)for(let ticket=0;ticket<100;ticket++){
   let calls=0;const random=()=>calls++%2===0?(attribute+.5)/8:(ticket+.5)/100;
   const r=m.rollCovenantTowardGoals([sub('damageAmp',1)],[{option:'critRate',level:8}],{position:position.position,random});
   const s=r.substats[0],key=s.option+':'+s.level;counts.set(key,(counts.get(key)||0)+1);assert.equal(r.lockedCount,0);
  }
  assert.equal(counts.size,64);
  for(const attribute of position.attributes)for(const level of rates.levels)assert.equal(counts.get(attribute.option+':'+level.level),level.weight);
 }
 const r=m.rollCovenantTowardGoals([sub('critDamage',8),sub('damageAmp',8),sub('domainMastery',8)],[{option:'critRate',level:8}],{random:()=>.99});
 assert.equal(m.covenantGoalsMet(r.substats,[{option:'critRate',level:8}]),false);
});
test('일치하는 희귀 목표를 최대 두 개만 잠그고 나머지 행만 다시 추첨한다',async()=>{
 const m=await model,current=[sub('critRate',8),sub('critRate',1),sub('damageAmp',5)],goals=[{option:'critRate',level:1},{option:'critRate',level:8},{option:'domainMastery',level:8}];
 let calls=0;const r=m.rollCovenantTowardGoals(current,goals,{random:()=>{calls++;return .99;}});
 assert.equal(r.lockedCount,2);assert.equal(calls,2);assert.deepEqual(r.substats.slice(0,2),current.slice(0,2));assert.deepEqual(current[2],sub('damageAmp',5));
});
test('Lv.8 한 목표의 평균 전사 횟수는 독립 기하분포와 일치한다',async()=>{
 const m=await model;let seed=972341;
 const random=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);
 const goals=[{option:'critRate',level:8}];let sum=0;const runs=3000;
 for(let i=0;i<runs;i++){let current=Array.from({length:3},()=>sub('damageAmp',1)),attempts=0;while(!m.covenantGoalsMet(current,goals)){current=m.rollCovenantTowardGoals(current,goals,{random}).substats;attempts++;assert.ok(attempts<10000);}sum+=attempts;}
 const expected=1/(1-Math.pow(399/400,3));assert.ok(Math.abs(sum/runs-expected)<10,`${sum/runs} vs ${expected}`);
});
test('중복 Lv.8 목표 셋은 독립 Markov 기대 횟수와 일치한다',async()=>{
 const m=await model,p=1/400,expected2=400,p0=(1-p)**2,p1=2*p*(1-p),expected1=(1+p1*expected2)/(1-p0),q0=(1-p)**3,q1=3*p*(1-p)**2,q2=3*p*p*(1-p),expected0=(1+q1*expected1+q2*expected2)/(1-q0);
 let seed=43211;const random=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);const goals=Array.from({length:3},()=>({option:'critRate',level:8}));let sum=0,runs=2000;
 for(let i=0;i<runs;i++){let current=Array.from({length:3},()=>sub('damageAmp',1)),attempts=0;while(!m.covenantGoalsMet(current,goals)){current=m.rollCovenantTowardGoals(current,goals,{random}).substats;attempts++;assert.ok(attempts<10000);}sum+=attempts;}
 assert.ok(Math.abs(sum/runs-expected0)<30,`${sum/runs} vs ${expected0}`);
});
test('전사 잠금 보존과 비용은 같은 원본 자료를 사용한다',async()=>{
 const m=await model,parts=[{...sub('critRate',8),locked:true},{...sub('none',1),locked:true},sub('domainMastery',1)];
 const result=m.rerollCovenantSubstats(parts,{position:6,random:()=>.99});
 assert.deepEqual(result[0],parts[0]);assert.equal(result[1].level,8);assert.notEqual(result[1].option,'none');assert.equal(result[1].locked,false);
 assert.deepEqual(m.covenantRerollCost(0),{gold:7500,seals:3,fragments:0,quills:0});
 assert.equal(m.covenantRerollCost(1).fragments,20);assert.equal(m.covenantRerollCost(1,'quill').quills,1);assert.equal(m.covenantRerollCost(2).quills,10);
 assert.throws(()=>m.covenantRerollCost(3),/잠금/);
});
test('확률 자료가 없거나 잘못되면 균등 추첨으로 대체하지 않는다',async()=>{
 const fresh=await import('./covenant-target.mjs?unconfigured');
 assert.throws(()=>fresh.rerollCovenantSubstats([sub('critRate',1)]),/먼저/);
 const m=await model,bad=structuredClone(rates);bad.levels[0].weight=0;
 assert.throws(()=>m.setCovenantRollRates(bad),/확률/);
 assert.throws(()=>m.rerollCovenantSubstats([],{position:7}),/부위/);
});
