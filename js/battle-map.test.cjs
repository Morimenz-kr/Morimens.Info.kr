const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'..'),maps=JSON.parse(fs.readFileSync(path.join(root,'data/story/maps.json'))),index=JSON.parse(fs.readFileSync(path.join(root,'data/story/index.json')));const context=vm.createContext({window:{}});vm.runInContext(fs.readFileSync(path.join(__dirname,'battle-map.js'),'utf8'),context);
test('전투가 있는 스토리 315개에서 지도 위치와 전투 참조를 빠짐없이 제공한다',()=>{
 assert.equal(Object.keys(maps.stages).length,315);
 for(const row of index.stages.filter(s=>s.combatCount>0)){
  const map=maps.stages[row.id],stage=JSON.parse(fs.readFileSync(path.join(root,'data/story/stages',row.id+'.json')));assert(map);if(row.arc==='망각편')assert.equal(map.type,'hex');
  const expected=new Set(stage.encounters.map(e=>e.battleId)),actual=new Set();let start=false;
  for(const layout of map.layouts){const positions=new Set();for(const node of layout.nodes){assert(Number.isFinite(node.row)&&Number.isFinite(node.column));const position=node.row+':'+node.column;assert(!positions.has(position));positions.add(position);if(node.isStart||node.kind==='start')start=true;for(const id of node.battleIds||node.battleId&&[node.battleId]||[]){assert(expected.has(id));actual.add(id);}if(node.icon)assert(fs.existsSync(path.join(root,'images/dzone/map/node-'+node.icon+'.webp')));}}
  assert(start,'missing start '+row.id);assert.deepEqual(actual,expected,'missing battles '+row.id);
 }
});

test('공명 트리의 분기·합류·모든 레벨과 9장의 계승을 보존한다',()=>{
 assert.equal(Object.keys(maps.resonance).length,15);
 const node=(chapter,id)=>maps.resonance[chapter].nodes.find(n=>n.id===id);
 assert.deepEqual(node('망각편:1',17595).preIds,[17594]);
 assert.deepEqual(node('망각편:1',17572).preIds,[17595]);
 assert.deepEqual(node('망각편:1',17590).preIds,[17572]);
 assert.deepEqual(node('망각편:1',17594).levels.map(n=>n.level),[1,2,3]);
 assert.match(node('망각편:1',17594).levels[2].description,/30/);
 const inherited=maps.resonance['망각편:9'].nodes.filter(n=>n.inherited);
 assert.equal(inherited.length,maps.resonance['망각편:8'].nodes.length);
 for(const tree of Object.values(maps.resonance))for(const n of tree.nodes){
  for(const id of n.preIds){const pre=tree.nodes.find(n=>n.id===id);assert(pre);assert(pre.depth<n.depth);}
  assert(n.levels.length);for(const level of n.levels)assert.doesNotMatch(level.description,/\{skill:|\[(?:Arg|DescArg|StateArg)\d+\]|[\u4e00-\u9fff]/);
 }
 const card=maps.mechanics[18429].cards[0];assert.equal(card.cost,1);assert.match(card.description,/30/);assert(card.traits.includes('소모'));
 const fruit=maps.mechanics[149067].cards;assert.equal(fruit.length,7);assert(fruit.find(c=>c.requires===148526));
 assert(fruit.find(c=>c.id===148024).effects.some(e=>/50% 감소/.test(e.description)));
 assert(!fruit.find(c=>c.id===148531).effects.some(e=>/50% 감소/.test(e.description)));
});
test('융재금구와 스토리는 동일 지도 렌더러와 클릭 동작을 재사용한다',()=>{
 for(const file of['dzone-info.js','story-info.js']){const source=fs.readFileSync(path.join(__dirname,file),'utf8');assert.match(source,/window.BattleMap.render/);assert.match(source,/window.BattleMap.activate/);assert.doesNotMatch(source,/dzone-map-node-surface/);}
 const render=context.window.BattleMap.render,layout=maps.stages[8126].layouts[0];const html=render(layout,{escapeHtml:String,title:'스테이지 지도',id:'test',simplifySingleCombat:false});assert.match(html,/스테이지 지도/);assert.equal((html.match(/data-map-battle=/g)||[]).length,3);
 const single={nodes:[{row:1,column:1,kind:'normal',label:'일반 노드'},{row:1,column:2,kind:'combat',label:'전투',battleId:1}]};assert.equal((render(single,{escapeHtml:String}).match(/dzone-map-node-surface/g)||[]).length,1);assert.equal((render(single,{escapeHtml:String,simplifySingleCombat:false}).match(/dzone-map-node-surface/g)||[]).length,2);
});

test('장별 특수 기믹은 실제 노드 종류와 연결되고 원문 자리표시자를 노출하지 않는다',()=>{
 assert.equal(Object.keys(maps.mechanics).length,14);assert.equal(Object.keys(maps.chapters).length,15);
 for(const row of index.stages.filter(s=>s.combatCount>0)){
  const chapter=maps.chapters[row.arc+':'+row.chapter];assert(chapter.length);
  for(const id of chapter){const mechanic=maps.mechanics[id];assert(mechanic.name&&mechanic.description);assert(mechanic.sources.some(s=>s.type==='Cmd'));assert.doesNotMatch(mechanic.description,/\{skill:|\[(?:Arg|DescArg|StateArg)\d+\]|GetResonanceLevel|[\u4e00-\u9fff]/);}
  for(const node of maps.stages[row.id].layouts.flatMap(l=>l.nodes))if(node.mechanicId){assert(chapter.includes(node.mechanicId));assert.equal(node.label,maps.mechanics[node.mechanicId].name);assert.equal(node.detailId,'story-rule-mechanic-'+node.mechanicId);}
 }
 assert.deepEqual(maps.chapters['망각편:8'],maps.chapters['망각편:9']);assert.match(maps.mechanics[18405].description,/행동력 소모를 1 감소/);assert.match(maps.mechanics[80599].description,/사용 후 소모/);
});
