import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {gunzipSync} from 'node:zlib';
import {selectedKeeper,makeLiveDamageInput} from '../js/scarecrow/live-damage-input.mjs';
import {ScarecrowEngine} from '../js/scarecrow/engine.mjs';
const json=async path=>JSON.parse(await readFile(new URL('../'+path,import.meta.url),'utf8'));
const catalog=await json('scarecrow/runtime/catalog.json');
test('Explicit unequipped key overrides a stale saved name',()=>{
 assert.equal(selectedKeeper(catalog,{keeperId:0,keeperName:catalog.keepers[0].name}),undefined);
 assert.equal(selectedKeeper(catalog,{}),undefined);
});
test('Every supported key resolves by stable ID despite translated name differences',async()=>{
 const map=await json('scarecrow/runtime/site-key-map.json');let count=0;
 for(const record of Object.values(map)){const keeper=catalog.keepers.find(k=>k.id===record.clientItemId);if(!keeper)continue;assert.equal(selectedKeeper(catalog,{keeperId:record.clientItemId,keeperName:'different translation'}),keeper);count++;}
 assert.equal(count,catalog.keepers.length);
});
test('Legacy named saves remain readable, unknown selections fail instead of substituting',()=>{
 const first=catalog.keepers[0];assert.equal(selectedKeeper(catalog,{keeperName:first.name}),first);
 assert.throws(()=>selectedKeeper(catalog,{keeperId:-1,keeperName:first.name}),/다시 선택/);
 assert.throws(()=>selectedKeeper(catalog,{keeperName:'missing'}),/다시 선택/);
});
test('Real res160 engine accepts no key and the selected key; no-key actions are rejected',async()=>{
 const data=await json('scarecrow/runtime/live-data.json'),engine=new ScarecrowEngine();
 await engine.initialize(gunzipSync(await readFile(new URL('../scarecrow/runtime/engine.scpack.gz',import.meta.url))));
 const cache=new Map(),call=async(kind,value)=>{const key=kind+JSON.stringify(value);if(!cache.has(key))cache.set(key,engine.run(kind,value));return structuredClone(await cache.get(key));};
 const people=['폴룩스','카티구라','오지에','판디아'].map(name=>structuredClone(data.people.find(p=>p.name===name)));
 for(const p of people)Object.assign(p,{level:60,potency:0,sign:0,training:0,inherent:0,trinkets:[],gear1:'미장착',gear2:'미장착',contract:'미장착'});
 const state={accountLevel:60,chapter:'성신편',keeperId:0,keeperName:catalog.keepers[0].name,enemies:[{hp:6733,maxHp:8189},{hp:12140,maxHp:12140}]};
 const build=()=>makeLiveDamageInput({catalog,call,state,people,person:people[0],card:people[0].cards[0]});
 for(const id of [0,catalog.keepers[1].id,0]){
  state.keeperId=id;const {input}=await build();assert.equal(input.init.keeperSkill,id||undefined);assert.deepEqual(input.init.unlockedKeeperSkillItems,id?[id]:[]);
  const result=await engine.run('calculator',input);assert.equal(result.damage.complete,true);assert.ok(result.steps.every(s=>s.accepted));
 }
 state.keyAction='은열쇠 각성';await assert.rejects(build,/장착한 뒤/);
});
