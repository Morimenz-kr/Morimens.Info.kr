import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {gunzipSync} from 'node:zlib';
import {covenantCompletion,covenantMainValue,covenantLevelLimits,covenantEquivalency,covenantSubValue,covenantSubLevel,validateCovenantParts} from '../js/scarecrow/covenant-stats.mjs';
import {makeLiveDamageInput} from '../js/scarecrow/live-damage-input.mjs';
import {ScarecrowEngine} from '../js/scarecrow/engine.mjs';
test('Full completion aggregates unrounded scores across six pieces',()=>{
 const piece={main:18159,level:12,sub:[{id:18159,value:1.6},{id:18105,value:2.4},{id:18126,value:4}]};
 assert.equal(covenantCompletion([piece]),16.6);assert.equal(covenantCompletion(Array(6).fill(piece)),100);
 assert.equal(covenantCompletion([]),0);assert.equal(covenantCompletion([{main:0,level:0,sub:[]}]),0);
});
test('Binding changes main attributes but never completion; sub values use native equivalency',()=>{
 const p={main:18105,level:12,sub:[{id:18142,value:1.6}]};
 assert.equal(covenantCompletion([p]),10.6);assert.equal(covenantMainValue(p),6);
 p.bound=true;assert.equal(covenantMainValue(p),9);assert.equal(covenantCompletion([p]),10.6);
 assert.deepEqual(covenantLevelLimits,{Orange:12,Purple:9,Blue:6});
 for(const [id,eq]of Object.entries(covenantEquivalency))assert.equal(covenantCompletion([{main:Number(id),level:12,sub:[{id:Number(id),value:eq*4}]}]),10.6);
});
test('Original res160 build applies the persisted bound flag through the real adapter',async()=>{
 const json=async p=>JSON.parse(await readFile(new URL('../scarecrow/runtime/'+p,import.meta.url),'utf8'));
 const catalog=await json('catalog.json'),data=await json('live-data.json'),engine=new ScarecrowEngine();
 await engine.initialize(gunzipSync(await readFile(new URL('../scarecrow/runtime/engine.scpack.gz',import.meta.url))));
 const people=['폴룩스','카티구라','오지에','판디아'].map(name=>structuredClone(data.people.find(p=>p.name===name)));
 for(const p of people)Object.assign(p,{level:60,potency:0,sign:0,training:0,inherent:0,trinkets:[],gear1:'미장착',gear2:'미장착',contract:'미장착'});
 const piece={position:1,main:18105,quality:'Orange',level:12,bound:false,sub:[]};people[0].contractId=catalog.suits[0].id;people[0].trinkets=[piece];
 const run=()=>makeLiveDamageInput({catalog,call:(k,v)=>engine.run(k,v),state:{keeperId:0,enemies:[{tid:72151,hp:100000,maxHp:100000}]},people,person:people[0],card:people[0].cards[0]});
 const unbound=await run();piece.bound=true;const bound=await run();
 assert.equal(unbound.builds[0].equipment.trinkets[0].main.value,6);assert.equal(bound.builds[0].equipment.trinkets[0].main.value,9);
 assert.equal(bound.input.init.roleData[0].attrs.crit_damage-unbound.input.init.roleData[0].attrs.crit_damage,3);
 people[0].contractBound=false;assert.equal((await run()).builds[0].equipment.trinkets[0].main.value,6,'Whole-contract unbinding overrides old part flags');
 people[0].contractBound=true;piece.bound=false;assert.equal((await run()).builds[0].equipment.trinkets[0].main.value,9,'Whole-contract binding reaches the original engine');
 delete people[0].contractBound;piece.bound=true;
 people[0].finalAttributes={atk:9999999,def:9999999,physique:9999999};
 const legacy=await run();
 assert.deepEqual(legacy.input.init.roleData[0].attrs,bound.input.init.roleData[0].attrs,'Removed manual overrides must not survive in legacy saves');
 piece.sub=[{id:18105,value:covenantSubValue(18105,8)}];
 const withSub=await run();
 assert.ok(Math.abs(withSub.builds[0].attributes.crit_damage-bound.builds[0].attributes.crit_damage-2.4)<1e-8,'Lv.8 contributes 2.4 before original combat-property rounding');
 assert.equal(withSub.input.init.roleData[0].attrs.crit_damage,69,'Preserve original final combat-property rounding');
 piece.sub=Array.from({length:3},()=>({id:18105,value:covenantSubValue(18105,8)}));
 assert.doesNotThrow(()=>validateCovenantParts([piece]));
 const repeated=await run();
 assert.ok(Math.abs(repeated.builds[0].attributes.crit_damage-bound.builds[0].attributes.crit_damage-7.2)<1e-8,'Repeated substats must all reach the original engine');
 assert.equal(covenantAttributeTotals(catalog,people[0])[18105],23.4,'Overview adds repeated substats, bound main value and set bonus');
});
import {covenantSlots,covenantSets,equippedCovenantParts,covenantAttributeTotals} from '../js/scarecrow/covenant-equipment.mjs';
test('Six per-part IDs override legacy sets, including empty slots',async()=>{
 const catalog=JSON.parse(await readFile(new URL('../scarecrow/runtime/catalog.json',import.meta.url),'utf8'));
 const [a,b]=catalog.suits;
 assert.deepEqual(covenantSlots(catalog,{contractId:a.id}),Array(6).fill(a.id));
 const mixed={contractId:a.id,contract:'different translation',contractSlots:[a.id,a.id,a.id,b.id,b.id,b.id]};
 assert.deepEqual(covenantSlots(catalog,{contract:'unknown old translation',contractSlots:mixed.contractSlots}),mixed.contractSlots);
 assert.deepEqual(covenantSets(catalog,mixed),[{id:a.id,count:3},{id:b.id,count:3}]);
 mixed.contractSlots=[0,a.id,a.id,b.id,b.id,b.id];mixed.trinkets=[{position:1,main:18105},{position:2,main:18105}];
 assert.deepEqual(equippedCovenantParts(catalog,mixed),[{position:2,main:18105,bound:false}]);
 mixed.contractSlots=Array(6).fill(0);assert.deepEqual(covenantSets(catalog,mixed),[]);
 assert.throws(()=>covenantSlots(catalog,{contractSlots:[a.id]}),/다시 선택/);
 assert.throws(()=>covenantSlots(catalog,{contractSlots:[a.id,a.id,a.id,b.id,b.id,99999999]}),/다시 선택/);
});
test('All 21 published sets cross their 3/6-piece thresholds through the original engine',async()=>{
 const json=async p=>JSON.parse(await readFile(new URL('../scarecrow/runtime/'+p,import.meta.url),'utf8'));
 const catalog=await json('catalog.json'),data=await json('live-data.json'),map=await json('site-contract-map.json'),engine=new ScarecrowEngine();
 await engine.initialize(gunzipSync(await readFile(new URL('../scarecrow/runtime/engine.scpack.gz',import.meta.url))));
 const people=['폴룩스','카티구라','오지에','판디아'].map(name=>structuredClone(data.people.find(p=>p.name===name)));
 for(const p of people)Object.assign(p,{level:60,potency:0,sign:0,training:0,inherent:0,trinkets:[],gear1:'미장착',gear2:'미장착',contract:'미장착'});
 const cache=new Map(),call=async(k,v)=>{const key=k+JSON.stringify(v);if(!cache.has(key))cache.set(key,engine.run(k,v));return structuredClone(await cache.get(key));};
 const run=()=>makeLiveDamageInput({catalog,call,state:{keeperId:0,enemies:[{tid:72151,hp:100000,maxHp:100000}]},people,person:people[0],card:people[0].cards[0]});
 const baseline=(await run()).builds[0];let cases=0;
 assert.equal(Object.keys(map).length,21);
 for(const id of Object.values(map)){
  const suit=catalog.suits.find(s=>s.id===id);assert.ok(suit,'Published stable set ID '+id);
  for(let count=0;count<=6;count++){
   people[0].contractSlots=Array.from({length:6},(_,i)=>i<count?id:0);
   const result=(await run()).builds[0];
   const totals=covenantAttributeTotals(catalog,people[0]);for(const [attrId,meta]of Object.entries(data.equipmentMetadata.attributes))assert.ok(Math.abs((result.attributes[meta.name]||0)-(baseline.attributes[meta.name]||0)-(totals[attrId]||0))<1e-8,'Overview totals match original engine '+id+'/'+count+'/'+attrId);
   for(const effect of suit.effects){
    if(effect.type==='CommonAttr')for(let n=0;n<effect.params.length;n+=2){const attr=data.equipmentMetadata.attributes[effect.params[n]].name;assert.ok(Math.abs((result.attributes[attr]||0)-(baseline.attributes[attr]||0)-(count>=effect.num?effect.params[n+1]:0))<1e-8,`${id}/${count}/${attr}`);}
    if(effect.type==='Add_State')for(const state of effect.params)assert.equal(Object.values(result.states).some(s=>s.id===state),count>=effect.num,`${id}/${count}/${state}`);
   }cases++;
  }
 }
 assert.equal(cases,147);
 // Mixed sets must apply both three-piece attributes, without either six-piece state.
 const [a,b]=catalog.suits;people[0].contractSlots=[a.id,a.id,a.id,b.id,b.id,b.id];const mixed=(await run()).builds[0];
 assert.ok(Math.abs(mixed.attributes.crit_damage-baseline.attributes.crit_damage-7.2)<1e-8);
 assert.ok(Math.abs(mixed.attributes.death_resist-baseline.attributes.death_resist-16.8)<1e-8);
 assert.ok(!Object.values(mixed.states).some(s=>[2505,3108].includes(s.id)));
});


test('Three substats use Lv.1–8 and convert levels to actual attribute values',()=>{
 assert.equal(covenantSubValue(18159,8),1.6);
 assert.equal(covenantSubValue(18105,8),2.4);
 assert.equal(covenantSubValue(18155,8),1.2);
 assert.equal(covenantSubValue(18142,1),0.2);
 assert.equal(covenantSubLevel({id:18105,value:2.4}),8);
 assert.equal(covenantSubLevel({id:18142,value:1.8}),null);
 assert.throws(()=>covenantSubValue(18105,9),/1~8/);
 assert.throws(()=>validateCovenantParts([{sub:[{id:18159,value:0.2},{id:18105,value:0.3},{id:18126,value:0.5},{id:18142,value:0.2}]}]),/3개/);
 assert.doesNotThrow(()=>validateCovenantParts([{sub:[{id:18159,value:0.2},{id:18159,value:0.4}]}]));
});


import {isBoundMaterialPixel} from '../js/covenant-bound-material.mjs';
test('Client bound material selects gold pixels, preserving white and dark illustration pixels',async()=>{
 const config=JSON.parse(await readFile(new URL('../data/covenant_bound_material.json',import.meta.url),'utf8'));
 assert.equal(Object.keys(config.partUV).length,126);
 for(const uv of Object.values(config.partUV)){assert.equal(uv.length,4);assert.ok(uv.every(n=>Number.isFinite(n)&&n>=0&&n<=1));assert.ok(uv[0]+uv[2]<=1.000001&&uv[1]+uv[3]<=1.000001);}
 assert.equal(isBoundMaterialPixel([1,0.8,0.5],config),true);
 assert.equal(isBoundMaterialPixel([1,1,1],config),false);
 assert.equal(isBoundMaterialPixel([0.1,0.12,0.2],config),false);
 assert.equal(isBoundMaterialPixel([0,0,0],config),false);
});

test('Contract-wide binding overrides stale part flags and applies to all equipped parts',async()=>{
 const catalog=JSON.parse(await readFile(new URL('../scarecrow/runtime/catalog.json',import.meta.url),'utf8'));
 const p={contractId:catalog.suits[0].id,trinkets:[{position:1,main:18105,level:12,bound:true,sub:[]},{position:2,main:18159,level:12,bound:false,sub:[]}]};
 const legacy=equippedCovenantParts(catalog,p);assert.ok(legacy.every(p=>p.bound));
 const completion=covenantCompletion(legacy);p.contractBound=false;const off=equippedCovenantParts(catalog,p);assert.ok(off.every(p=>!p.bound));
 p.contractBound=true;const on=equippedCovenantParts(catalog,p);assert.ok(on.every(p=>p.bound));
 assert.equal(covenantCompletion(on),completion);assert.equal(covenantCompletion(off),completion);
 assert.equal(covenantMainValue(on[0]),9);assert.equal(covenantMainValue(on[1]),6);
});

test('Overview totals include main/sub attributes, global binding, and three-piece bonuses',async()=>{
 const catalog=JSON.parse(await readFile(new URL('../scarecrow/runtime/catalog.json',import.meta.url),'utf8'));
 const p={contractId:18338,contractBound:false,trinkets:[{position:1,main:18105,level:12,sub:[{id:18159,value:1.6}]}]};
 const off=covenantAttributeTotals(catalog,p);assert.equal(off[18105],6);assert.equal(off[18159],1.6);assert.equal(off[18126],12);
 p.contractBound=true;const on=covenantAttributeTotals(catalog,p);assert.equal(on[18105],9);assert.equal(on[18159],1.6);assert.equal(on[18126],12);
 p.contractSlots=[18338,18338,0,0,0,0];assert.equal(covenantAttributeTotals(catalog,p)[18126]||0,0);
 p.contractSlots=Array(6).fill(0);assert.deepEqual(covenantAttributeTotals(catalog,p),{});
});
