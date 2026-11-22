const test = require('node:test');
const assert = require('node:assert/strict');
const member = (id, wheel='w', value=10) => ({characterId:id,enlightenment:0,borrowed:false,wheels:[{id:wheel,level:15}],covenant:{completion:95,parts:Array.from({length:6},(_,i)=>({slot:i+1,setId:'set',main:{id:'atk',label:'공격',value,unit:'%'},subs:[]}))}});
const row = (ids,count,wheel='w',wave=1,difficulty='6') => ({wave,difficulty,count,members:ids.split('').map(id=>member(id,wheel))});
test('core ranks by weighted clears and each fourth member uses the same core denominator', async () => {
 const {recommendParties}=await import('./usage-recommendations.mjs');
 const unknown=row('abcd',10);
 unknown.members[0].covenant=null;
 const rows=[row('abcd',20),unknown,row('abce',15,'w',2),row('axyz',40),row('bcde',50)];
 const before=JSON.stringify(rows);
 const [core, standalone]=recommendParties(rows,'a');
 assert.deepEqual(core.members,['a','b','c']);
 assert.deepEqual(core.candidates,[
  {key:'a|b|c|d',id:'d',count:30,rate:30/45},
  {key:'a|b|c|e',id:'e',count:15,rate:15/45}
 ]);
 assert.equal(core.count,45);
 assert.equal(standalone.candidates[0].key,'a|x|y|z');
 assert.equal(standalone.candidates[0].rate,1);
 assert.equal(JSON.stringify(rows),before);
});

test('one observed team yields one card and missing or incomplete lineups do not create choices', async () => {
 const {recommendParties}=await import('./usage-recommendations.mjs');
 const rows=[row('abcd',1),row('abc',20),row('abbc',10),row('bcde',2)];
 const cores=recommendParties(rows,'a');
 assert.equal(cores.length,1);
 assert.equal(cores[0].count,1);
 assert.equal(cores[0].candidates[0].id,'d');
 assert.deepEqual(recommendParties(rows,'z'),[]);
});

test('contract adoption excludes missing contracts and counts each rolled substat line from qualified records',async()=>{
 const {covenantStatistics}=await import('./usage-recommendations.mjs');
 const a=row('abcd',4), b=row('aefg',6), low=row('abcd',5), unknown=row('abcd',100);
 const sub={id:'damage',label:'伤害',unit:'%',value:2};
 a.members[0].covenant.parts[0].subs=[sub,{...sub,value:3}];
 a.members[0].covenant.parts[1].subs=[sub];
 low.members[0].covenant.completion=89;unknown.members[0].covenant=null;
 const before=JSON.stringify([a,b,low,unknown]);const groups=covenantStatistics([a,b,low,unknown],'a');
 assert.equal(groups.length,1);assert.equal(groups[0].count,15);assert.equal(groups[0].rate,1);
 assert.equal(groups[0].options.total,10);assert.equal(groups[0].options.subs[0].count,12);assert.equal(groups[0].options.subs[0].rate,1);
 assert.equal(groups[0].options.slots[0].subs[0].count,8);assert.equal(groups[0].options.slots[1].subs[0].count,4);
 assert.equal(groups[0].options.slots[2].subs.length,0);assert.equal(JSON.stringify([a,b,low,unknown]),before);
 assert.equal('mean' in groups[0].options.slots[0].main[0],false);
});

test('rounding distributes tenths so overall and per-slot substat shares sum to 100%',async()=>{
 const {covenantStatistics}=await import('./usage-recommendations.mjs');
 const record=row('abcd',4);
 record.members[0].covenant.parts[0].subs=['attack','critical','damage'].map(id=>({id,label:id,unit:'%',value:2}));
 const {subs,slots}=covenantStatistics([record],'a')[0].options;
 for(const list of [subs,slots[0].subs]) {
  assert.deepEqual(list.map(stat=>stat.percentTenths),[334,333,333]);
  assert.equal(list.reduce((sum,stat)=>sum+stat.percentTenths,0),1000);
 }
});

test('different contracts have their own denominators and missing wheels do not become recommended pairs',async()=>{
 const {covenantStatistics}=await import('./usage-recommendations.mjs');
 const a=row('abcd',3), b=row('abcd',7,'different');
 b.members[0].covenant.parts.forEach(p=>p.setId='other');b.members[0].wheels=null;
 const [first,second]=covenantStatistics([a,b],'a');
 assert.equal(first.rate,.7);assert.equal(second.rate,.3);assert.equal(first.options.total,7);assert.equal(second.options.total,3);
 assert.deepEqual(first.wheelPairs,[]);assert.deepEqual(second.wheelPairs[0].ids,['w']);
});

test('the displayed wheels are an observed pair rather than the two most popular individual wheels',async()=>{
 const {covenantStatistics}=await import('./usage-recommendations.mjs');
 const rows=[['ab',10],['ac',9],['bc',9],['de',11]].map(([pair,count])=>{
  const r=row('axyz',count);r.members[0].wheels=pair.split('').map(id=>({id,level:15}));return r;
 });
 assert.deepEqual(covenantStatistics(rows,'a')[0].wheels,['d','e']);
});

test('unknown completion never becomes option evidence or zero-percent advice',async()=>{
 const {covenantStatistics}=await import('./usage-recommendations.mjs');
 const r=row('abcd',100);r.members[0].covenant.completion=null;
 const [group]=covenantStatistics([r],'a');
 assert.equal(group.count,100);assert.equal(group.rate,1);assert.equal(group.options.total,0);
 assert.deepEqual(group.options.subs,[]);assert.ok(group.options.slots.every(s=>!s.main.length && !s.subs.length));
});
