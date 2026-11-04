import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {gunzipSync} from 'node:zlib';
import {FLAME_SOURCE_TID,hasFlameSource,flameOverride} from '../js/scarecrow/character-conditions.mjs';
import {makeLiveDamageInput} from '../js/scarecrow/live-damage-input.mjs';
import {ScarecrowEngine} from '../js/scarecrow/engine.mjs';

test('Flame controls depend on Catigura stable ID, including another ally acting',()=>{
 assert.equal(hasFlameSource([{id:15563},{id:15564},{id:15576}]),false);
 assert.equal(hasFlameSource([{id:77913,name:'different translation'},{id:15563}]),true);
 assert.equal(flameOverride([{id:15563}],'3단계'),undefined);
 assert.equal(flameOverride([{id:77913}],'자동'),undefined);
 for(const [choice,value]of [['없음',0],['1단계',1],['2단계',2],['3단계',3]])assert.equal(flameOverride([{id:77913}],choice),value);
 assert.throws(()=>flameOverride([{id:77913}],'4단계'),/활염/);
});

test('A saved flame override cannot reach the engine after Catigura leaves the party',async()=>{
 const read=async name=>JSON.parse(await readFile(new URL('../scarecrow/runtime/'+name,import.meta.url),'utf8'));
 const catalog=await read('catalog.json'),data=await read('live-data.json'),engine=new ScarecrowEngine();
 await engine.initialize(gunzipSync(await readFile(new URL('../scarecrow/runtime/engine.scpack.gz',import.meta.url))));
 const person=id=>{const p=structuredClone(data.people.find(p=>p.id===id));Object.assign(p,{level:60,potency:0,sign:0,training:0,inherent:0,trinkets:[],gear1:'미장착',gear2:'미장착',contract:'미장착'});return p;};
 assert.equal(data.people.find(p=>p.id===FLAME_SOURCE_TID).name,'카티구라');
 const people=[15563,15564,15566,15575].map(person),state={keeperId:0,enemies:[{tid:72151,hp:100000,maxHp:100000}],flame:'3단계'};
 const build=()=>makeLiveDamageInput({catalog,call:(k,v)=>engine.run(k,v),state,people,person:people[0],card:people[0].cards[0]});
 assert.equal((await build()).input.damage.flame,undefined);
 people[3]=person(77913);assert.equal((await build()).input.damage.flame,3,'Catigura may grant flame to an ally card');
 people[3]=person(15575);const removed=await build();assert.equal(removed.input.damage.flame,undefined);
 const preview=await engine.run('calculator',{...removed.input,actions:[]});
 assert.ok(preview.initial.cards.every(c=>!(c.states||[]).some(s=>[98466,98470,98468].includes(s.stateId))));
});
