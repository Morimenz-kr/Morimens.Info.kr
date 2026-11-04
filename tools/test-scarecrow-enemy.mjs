import test from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';import {gunzipSync} from 'node:zlib';
import {resolveDzoneEnemy,validateEnemies} from '../js/scarecrow/enemy-loadout.mjs';import {makeLiveDamageInput} from '../js/scarecrow/live-damage-input.mjs';import {ScarecrowEngine} from '../js/scarecrow/engine.mjs';
const read=async p=>JSON.parse(await readFile(new URL('../'+p,import.meta.url),'utf8'));
const seasons=await Promise.all([68,69,70,71,72].map(p=>read('data/dzone_season'+p+'.json')));
test('D-Zone selection resolves stable IDs across all archived/current stat records',()=>{
 let count=0;for(const d of seasons)for(const w of d.waves)for(const a of w.alerts)for(const m of a.monsters){const e=resolveDzoneEnemy(d,{period:d.period,wave:w.wave,alert:a.alert,tid:m.tid});assert.equal(e.tid,m.tid);assert.equal(e.base.maxHp,m.hp);assert.equal(e.attack,m.attack);assert.equal(e.defense,m.defense);count++;}assert.equal(count,1108);
 const d=seasons.at(-1);assert.throws(()=>resolveDzoneEnemy(d,{period:68,wave:1,alert:1,tid:14111}),/기수/);assert.throws(()=>resolveDzoneEnemy(d,{period:72,wave:1,alert:1,tid:-1}),/능력치/);
});
test('Enemy count is explicit, never an extra fallback monster',()=>{
 assert.throws(()=>validateEnemies([]),/1~7/);assert.throws(()=>validateEnemies(Array(8).fill({tid:14111})),/1~7/);assert.throws(()=>validateEnemies([{tid:0}]),/다시 선택/);validateEnemies(Array(7).fill({tid:14111}));
});
test('All 136 D-Zone enemy IDs initialize with their real passive states in res160',async()=>{
 const catalog=await read('scarecrow/runtime/catalog.json'),data=await read('scarecrow/runtime/live-data.json'),engine=new ScarecrowEngine();await engine.initialize(gunzipSync(await readFile(new URL('../scarecrow/runtime/engine.scpack.gz',import.meta.url))));
 const people=['폴룩스','카티구라','오지에','판디아'].map(name=>structuredClone(data.people.find(p=>p.name===name)));for(const p of people)Object.assign(p,{level:60,potency:0,sign:0,training:0,inherent:0,trinkets:[],gear1:'미장착',gear2:'미장착',contract:'미장착'});
 const cache=new Map(),call=async(k,v)=>{const key=k+JSON.stringify(v);if(!cache.has(key))cache.set(key,engine.run(k,v));return structuredClone(await cache.get(key));};
 const seen=new Set();for(const d of seasons)for(const w of d.waves)for(const a of w.alerts)for(const m of a.monsters){if(seen.has(m.tid))continue;seen.add(m.tid);const e=resolveDzoneEnemy(d,{period:d.period,wave:w.wave,alert:a.alert,tid:m.tid});const {input}=await makeLiveDamageInput({catalog,call,state:{keeperId:0,enemies:[e]},people,person:people[0],card:people[0].cards[0]});const out=await engine.run('calculator',{...input,actions:[]}),roles=out.initial.roles.filter(r=>r.camp===2);assert.ok(roles.some(r=>r.tid===m.tid),String(m.tid));assert.equal(input.init.coverMonsters.Monster2,undefined);assert.equal(out.enemyInitialization[0].atk,e.base.attack);assert.equal(out.enemyInitialization[0].def,e.base.defense);assert.equal(out.enemyInitialization[0].level,e.level);if(m.tid===60096)assert.ok(roles.find(r=>r.tid===60096).states.some(s=>s.stateId===60430),'Boss original 음표 율령 passive');}
 assert.equal(seen.size,136);
 const d=seasons.at(-1),e=resolveDzoneEnemy(d,{period:72,wave:1,alert:1,tid:14111});const {input}=await makeLiveDamageInput({catalog,call,state:{keeperId:0,enemies:Array(7).fill(e)},people,person:people[0],card:people[0].cards[0]});const out=await engine.run('calculator',{...input,actions:[]});assert.equal(out.initial.roles.filter(r=>r.camp===2&&r.tid===14111).length,7);
});
