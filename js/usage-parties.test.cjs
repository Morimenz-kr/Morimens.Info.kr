const test = require('node:test');
const assert = require('node:assert/strict');
const member = (id, wheel='w', value=10) => ({characterId:id,enlightenment:0,borrowed:false,wheels:[{id:wheel,level:15}],covenant:{completion:95,parts:Array.from({length:6},(_,i)=>({slot:i+1,setId:'set',main:{id:'atk',label:'공격',value,unit:'%'},subs:[]}))}});
const row = (ids,count,wheel='w',wave=1,difficulty='6') => ({wave,difficulty,count,members:ids.split('').map(id=>member(id,wheel))});
test('representatives rank parties before their gear and retain the most observed joint build in each exact team',async()=>{
 const {recommendParties}=await import('./usage-recommendations.mjs');
 const rows=[row('abcd',8,'common'),row('abcd',4,'other'),row('aefg',10,'other')], original=JSON.stringify(rows);
 const result=recommendParties(rows,'a');assert.equal(result.parties[0].key,'a|b|c|d');assert.equal(result.parties[0].count,12);assert.equal(result.parties[0].build.count,8);assert.equal(JSON.parse(result.parties[0].build.key)[0],'common');assert.ok(result.parties[0].rows.includes(result.parties[0].example));assert.equal(JSON.stringify(rows),original);
});
test('near duplicates collapse only with the same three members and actual overlapping stage evidence',async()=>{
 const {recommendParties}=await import('./usage-recommendations.mjs');
 const result=recommendParties([row('abcd',20),row('abce',15),row('abcf',14,'w',2),row('abef',12),row('axyz',1)],'a');
 assert.deepEqual(result.parties.map(p=>p.key),['a|b|c|d','a|b|c|f','a|b|e|f']);assert.equal(result.totalTeams,5);
});
test('rare records remain explicitly sparse when no supported party exists and unknown gear never creates a build',async()=>{
 const {recommendParties}=await import('./usage-recommendations.mjs');
 const sparse=recommendParties([row('abcd',1)],'a');assert.equal(sparse.sparse,true);assert.equal(sparse.parties[0].sparse,true);
 const unknown=row('abcd',20);unknown.members[0].wheels=null;assert.equal(recommendParties([unknown],'a').parties.length,0);
});

test('party clear totals and gear-confirmed totals have separate denominators',async()=>{
 const {recommendParties}=await import('./usage-recommendations.mjs');
 const unknown=row('abcd',100);unknown.members[0].covenant=null;
 const known=row('abcd',8,'verified');const party=recommendParties([unknown,known],'a').parties[0];
 assert.equal(party.count,108);assert.equal(party.equipmentCount,8);assert.equal(party.build.count,8);assert.strictEqual(party.example,known);
});

test('contract adoption excludes missing contracts, keeps all parties and counts substat presence once per weighted clear',async()=>{
 const {covenantStatistics}=await import('./usage-recommendations.mjs');
 const a=row('abcd',4), b=row('aefg',6), low=row('abcd',5), unknown=row('abcd',100);
 const sub={id:'damage',label:'伤害',unit:'%',value:2};
 a.members[0].covenant.parts[0].subs=[sub,{...sub,value:3}];
 a.members[0].covenant.parts[1].subs=[sub];
 low.members[0].covenant.completion=89;unknown.members[0].covenant=null;
 const before=JSON.stringify([a,b,low,unknown]);const groups=covenantStatistics([a,b,low,unknown],'a');
 assert.equal(groups.length,1);assert.equal(groups[0].count,15);assert.equal(groups[0].rate,1);
 assert.equal(groups[0].options.total,10);assert.equal(groups[0].options.subs[0].count,4);assert.equal(groups[0].options.subs[0].rate,.4);
 assert.equal(groups[0].options.slots[0].subs[0].rate,.4);assert.equal(groups[0].options.slots[1].subs[0].rate,.4);
 assert.equal(groups[0].options.slots[2].subs.length,0);assert.equal(JSON.stringify([a,b,low,unknown]),before);
 assert.equal('mean' in groups[0].options.slots[0].main[0],false);
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
