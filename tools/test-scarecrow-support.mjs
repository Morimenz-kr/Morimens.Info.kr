import test from 'node:test';import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';import {gunzipSync} from 'node:zlib';
import {ScarecrowEngine} from '../js/scarecrow/engine.mjs';
import {makeLiveDamageInput} from '../js/scarecrow/live-damage-input.mjs';
import {nativeCardDescription} from '../js/scarecrow/card-description.mjs';
const read=async p=>JSON.parse(await readFile(new URL('../'+p,import.meta.url),'utf8'));
const catalog=await read('scarecrow/runtime/catalog.json'),data=await read('.generated/scarecrow/site/live-data.json'),descriptions=await read('data/scarecrow_card_descriptions.json');
const engine=new ScarecrowEngine();await engine.initialize(gunzipSync(await readFile(new URL('../scarecrow/runtime/engine.scpack.gz',import.meta.url))));
const cache=new Map(),call=async(kind,value)=>{const key=kind+JSON.stringify(value);if(!cache.has(key))cache.set(key,engine.run(kind,value));return structuredClone(await cache.get(key));};
function party(owner){const preferred=['tulu','ogier','vortice','pandia'].map(id=>data.people.find(p=>p.id===catalog.characters.find(c=>c.manifestId===id).id));return [owner,...preferred.filter(p=>p.id!==owner.id)].slice(0,4).map(p=>Object.assign(structuredClone(p),{level:60,potency:0,sign:0,training:0,inherent:0,trinkets:[],gear1:'미장착',gear2:'미장착',contract:'미장착'}));}
const state=()=>({keeperId:0,accountLevel:60,chapter:'성신편',energy:100,enemies:[{tid:72151,hp:10000000,maxHp:10000000}]});
test('All 84 previously unbound cards and nine Vivian skills use original ID text and native display values',async()=>{
 assert.equal(Object.keys(descriptions.cards).length,93);const failures=[];let checked=0;
 for(const record of Object.values(descriptions.cards)){
  const owner=data.people.find(p=>[...p.cards,...p.generated].some(c=>c.id===record.skillId));assert.ok(owner,'Owner '+record.skillId);
  const people=party(owner),card=[...people[0].cards,...people[0].generated].find(c=>c.id===record.skillId);
  try{assert.ok(!card.name.startsWith('생성 카드 '));const {input}=await makeLiveDamageInput({catalog,call,state:state(),people,person:people[0],card});input.actions=[];input.damage.preparing=true;
   const result=await engine.run('calculator',input),text=nativeCardDescription(card,0,result.initial.cardDescription);
   assert.ok(text?.length,'Missing text');assert.doesNotMatch(text,/\[(?:\w+:)?Arg\d+\]|[\u4e00-\u9fff]|<[^>]+>/);checked++;
  }catch(e){failures.push({id:record.skillId,name:record.name,error:e.message});}
 }
 assert.deepEqual(failures,[]);assert.equal(checked,93);
});
test('All six former unsupported entries resolve; new weapon growth and native state initialization work',async()=>{
 const info=await read('.generated/scarecrow/site/build-info.json');assert.deepEqual(info.unsupported,{characters:[],wheels:[],keys:[]});
 const owner=data.people.find(p=>p.id===151844);assert.ok(owner);assert.deepEqual(catalog.characters.find(c=>c.id===151844).skills,[152500,152506,152505,152501,152584,152503]);
 for(const id of [152952,151737,151763])for(const stage of [0,3,15]){
  const w=catalog.weapons.find(w=>w.id===id);assert.ok(w);const people=party(owner);Object.assign(people[0],{gearId1:id,gear1:w.name,stack1:Math.min(stage,3),refine1:Math.max(0,stage-3)});
  const {input,builds}=await makeLiveDamageInput({catalog,call,state:state(),people,person:people[0],card:people[0].cards[0]});assert.ok(builds[0].states.some(s=>s.id===w.state));
  const result=await engine.run('calculator',input);assert.ok(result.steps.every(s=>s.accepted));
 }
 for(const id of [148671,151695]){
  // Vivian activates the native primordial Chaos action, which replaces keeper use.
  const people=party(data.people.find(p=>p.id===catalog.characters.find(c=>c.manifestId==='murphy').id));const {input}=await makeLiveDamageInput({catalog,call,state:{...state(),keeperId:id,keyAction:'지령 사용',key:100,keyCapacity:2000},people,person:people[0],card:people[0].cards[0]});
  const result=await engine.run('calculator',input);assert.ok(result.steps[0].accepted,JSON.stringify({key:id,actions:result.initial.playerActions,properties:result.initial.realmProperties}));
 }
});
test('Native descriptions follow growth and potency in the original command',async()=>{
 const owner=data.people.find(p=>p.id===151844);
 for(const potency of [0,3,15])for(const level of [1,6]){
  const people=party(owner);Object.assign(people[0],{level:90,potency});
  const card=people[0].cards.find(c=>c.id===152584);card.level=level;
  const {input}=await makeLiveDamageInput({catalog,call,state:state(),people,person:people[0],card});input.actions=[];input.damage.preparing=true;
  const result=await engine.run('calculator',input);assert.match(nativeCardDescription(card,potency,result.initial.cardDescription),/힘|회복|피해/);
 }
});
test('Native translation never fabricates missing arguments and respects stages, Lua argument tables and float values',()=>{
 const card={nativeDescription:{texts:{},description:{0:'회복 [Arg1]',3:'회복 [Arg2]'}}};
 assert.equal(nativeCardDescription(card,0),null);assert.equal(nativeCardDescription(card,3,{args:[1,7]}),'회복 7');
 assert.equal(nativeCardDescription(card,0,{args:{1:0.6,n:2}}),'회복 0.6');
});
