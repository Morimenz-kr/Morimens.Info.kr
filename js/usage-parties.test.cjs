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
