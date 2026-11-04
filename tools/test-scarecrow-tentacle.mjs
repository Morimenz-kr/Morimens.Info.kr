import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {gunzipSync} from 'node:zlib';
import {ScarecrowEngine} from '../js/scarecrow/engine.mjs';
import {makeLiveDamageInput} from '../js/scarecrow/live-damage-input.mjs';
import {tentacleCapacity} from '../js/scarecrow/tentacle-state.mjs';

test('Capacity sums native pools without double-counting a missing permanent pool',()=>{
 assert.equal(tentacleCapacity({battle_max_tentacle_count:5}),5);
 assert.equal(tentacleCapacity({permanent_max_tentacle_count:6,battle_max_tentacle_count:2,bout_max_tentacle_count:1}),9);
 assert.equal(tentacleCapacity({permanent_max_tentacle_count:0}),0);
 assert.equal(tentacleCapacity({}),5);
});

test('Tentacle snapshot supports raised capacity and independent temporary counts in the real engine',async()=>{
 const read=async name=>JSON.parse(await readFile(new URL('../scarecrow/runtime/'+name,import.meta.url),'utf8'));
 const catalog=await read('catalog.json'),data=await read('live-data.json'),engine=new ScarecrowEngine();
 await engine.initialize(gunzipSync(await readFile(new URL('../scarecrow/runtime/engine.scpack.gz',import.meta.url))));
 const people=[15563,15564,15566,15575].map(id=>structuredClone(data.people.find(p=>p.id===id)));
 for(const p of people)Object.assign(p,{level:60,potency:0,sign:0,training:0,inherent:0,trinkets:[],gear1:'미장착',gear2:'미장착',contract:'미장착'});
 const state={keeperId:0,enemies:[{tid:72151,hp:100000,maxHp:100000}],tentacleLimit:10,tentacles:6,tempTentacles:20};
 const build=()=>makeLiveDamageInput({catalog,call:(k,v)=>engine.run(k,v),state,people,person:people[0],card:people[0].cards[0]});
 const built=await build(),preview=await engine.run('calculator',{...built.input,actions:[]});
 assert.equal(preview.initial.realmProperties.permanent_max_tentacle_count,10);
 assert.equal(preview.initial.realmProperties.permanent_tentacle_count,6);
 assert.equal(preview.initial.realmProperties.bout_tentacle_count,20);
 state.tentacles=11;await assert.rejects(build,/상한/);
 state.tentacles=1.5;await assert.rejects(build,/정수/);
});
