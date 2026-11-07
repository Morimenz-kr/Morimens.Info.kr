const test = require('node:test'), assert = require('node:assert/strict');
const I = require('./record-integration.js'), F = require('./record-features.js'), S = require('./record-build-share.js');
const links = { characters: [{siteId:'one',clientId:1},{siteId:'two',clientId:2},{siteId:'three',clientId:3},{siteId:'four',clientId:4}], wheels:[{siteId:'w',clientId:5}],keys:[{siteId:'k',clientId:6},{siteId:'k',clientId:7}] };
function storage(value) { const values = new Map(value ? [[I.INVENTORY_KEY,JSON.stringify(value)]] : []); return { getItem: key=>values.get(key)??null,setItem:(key,val)=>values.set(key,val),removeItem:key=>values.delete(key) }; }
test('owned inventory joins exact IDs, exposes missing mappings and never guesses names',()=>{
 const data=I.ownedFilters(storage({characters:['one','unknown'],wheels:['w'],characterBreakthroughs:{one:7}}),links,{wheels:true,growth:true,allowBorrowed:true});
 assert.deepEqual(data.filters,{ownedCharacters:['1'],allowBorrowed:true,ownedPotency:{1:7},ownedWheels:['5']});assert.equal(data.unresolved.length,1);
 assert.throws(()=>I.ownedFilters(storage(),links));assert.throws(()=>I.ownedFilters(storage({characters:['one'],wheels:[]}),links,{growth:true}));
});
test('owned filters preserve empty inventory and unknown gear, with explicitly borrowed support',()=>{
 const row={battleUuid:'00000000-0000-0000-0000-000000000001',playerId:1,timestamp:1,awakeners:[{tid:1,potencyLevel:7,assistPlayerId:0,weaponSlots:[{weaponUid:10},{weaponUid:11}]}],items:{10:{tid:5},11:{tid:5}}};
 assert.equal(F.searchClears([row],{ownedCharacters:[]}).total,0);
 assert.equal(F.searchClears([row],{ownedCharacters:['1'],ownedPotency:{1:6}}).total,0);
 assert.equal(F.searchClears([row],{ownedCharacters:['1'],ownedWheels:['5']}).total,1);
 assert.equal(F.searchClears([{...row,items:{}}],{ownedWheels:['5']}).total,0);
 assert.equal(F.searchClears([{...row,awakeners:[{...row.awakeners[0],assistPlayerId:99}]}],{ownedCharacters:[],allowBorrowed:true}).total,1);
 const filters=F.normalizedFilters({ownedCharacters:[],ownedWheels:['5'],ownedPotency:{1:7},allowBorrowed:true});assert.deepEqual(F.filtersFromQuery(F.filtersToQuery(filters)),filters);
});
test('party handoff validates every site ID, expires and never writes existing party storage',()=>{
 const s=storage(),party={chars:['one','two','three','four'],wheels:Array.from({length:4},()=>['w',null]),key:'k',supportIdx:-1};
 assert.equal(I.stageHandoff(s,party,links),'party_builder.html?import=record');assert.deepEqual(I.readHandoff(s,links),party);assert.equal(s.getItem('morimens_v2_pages'),null);
 assert.throws(()=>I.readHandoff(s,links,Date.now()+3600001));assert.throws(()=>I.stageHandoff(s,{...party,chars:['one','one','three','four']},links));
});
test('simulation links carry JSON in fragment only and reject untrusted URL protocols',()=>{
 const payload={kind:'scarecrow-record-build',schemaVersion:1,members:[{},{},{},{}]};const url=new URL(I.simulationUrl('https://morimens-scarecrow.pages.dev/',payload));
 assert.equal(url.search,'');assert.deepEqual(JSON.parse(decodeURIComponent(url.hash.slice(14))),payload);assert.throws(()=>I.simulationUrl('javascript:alert(1)',payload));
});
test('share model hides identities by default and preserves separate card and wheel progression',()=>{
 const party={kind:'historical-game-build',keeperLevel:83,members:[{name:'예시',level:60,potencyLevel:7,cards:[{level:6},{level:3}],wheels:[{item:{name:'명륜',enhanceLevel:2}}],covenants:[]}]};
 assert.equal(S.model(party,{identity:{name:'PRIVATE',uid:100}}).identity,null);
 assert.equal(S.model(party,{hideIdentity:false,identity:{name:'PRIVATE',uid:100}}).identity.uid,'100');assert.ok(S.model(party).members[0].lines.includes('카드 6 / 3'));
 assert.deepEqual(S.wrappedLines({measureText:text=>({width:text.length*10})},'가나다라',20),['가나','다라']);
});
