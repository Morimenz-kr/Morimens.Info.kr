import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {gunzipSync} from 'node:zlib';
import {effectPresentation,effectSnapshot} from '../js/scarecrow/effect-presentation.mjs';
import {ScarecrowEngine} from '../js/scarecrow/engine.mjs';
import {makeLiveDamageInput} from '../js/scarecrow/live-damage-input.mjs';

test('Effect ownership survives another character/card being selected',async()=>{
 const read=async name=>JSON.parse(await readFile(new URL('../scarecrow/runtime/'+name,import.meta.url),'utf8'));
 const catalog=await read('catalog.json'),data=await read('live-data.json'),engine=new ScarecrowEngine();
 await engine.initialize(gunzipSync(await readFile(new URL('../scarecrow/runtime/engine.scpack.gz',import.meta.url))));
 const people=[15563,15564,15582,15589].map(id=>Object.assign(structuredClone(data.people.find(p=>p.id===id)),{level:60,potency:0,sign:0,training:0,inherent:0,trinkets:[],gear1:'미장착',gear2:'미장착',contract:'미장착'}));
 const state={keeperId:0,crit:'자동',enemies:[{tid:72151,hp:100000,maxHp:100000}],customStates:[
  {sourceTid:15563,id:121365,ownerTid:15563,layers:25},
  {sourceTid:15563,id:132707,ownerTid:15563,layers:10},
  {sourceTid:15563,id:3580,ownerTid:15563,layers:3},
  {sourceTid:15582,id:53115,ownerTid:15582,layers:1}
 ]};
 const build=()=>makeLiveDamageInput({catalog,call:(k,v)=>engine.run(k,v),state,people,person:people[1],card:people[1].cards[0]});
 const {input}=await build();assert.equal(input.damage.critical,undefined,'probability mode keeps the native critical roll');
 for(const id of [121365,132707]){const effect=input.damage.states.find(s=>s.id===id);assert.equal(effect.owner,'target');assert.equal(effect.targetIndex,0);assert.equal(effect.ownerTid,undefined);assert.equal(effect.casterTid,15563);}
 assert.equal(input.damage.states.find(s=>s.id===3580).owner,'team');
 assert.equal(input.damage.states.find(s=>s.id===53115).ownerTid,15582,'Miriam remains the receiver while Golia acts');
 const preview=await engine.run('calculator',{...input,actions:[]});
 const enemy=preview.initial.roles.find(r=>r.camp===2);assert.ok(enemy.states.some(s=>s.stateId===121365&&s.layer===25));assert.ok(enemy.states.some(s=>s.stateId===132707&&s.layer===10));
 state.crit='치명';assert.equal((await build()).input.damage.critical,true);
});

test('The two tentacle vulnerabilities have distinct sources and retain enemy indices',()=>{
 const a=effectPresentation({id:121365,scope:'context'}),b=effectPresentation({id:132707,scope:'context'});
 assert.notEqual(a.source,b.source);assert.equal(a.placement,'target');assert.equal(b.placement,'target');
 assert.equal(effectSnapshot({id:132707,sourceTid:15563,targetIndex:1,layers:20}).targetIndex,1);
});
