const test=require('node:test');
const assert=require('node:assert/strict');
const model=import('./covenant-simulator-model.mjs');
test('주옵션 미설정이어도 장착 부위의 부옵션과 완성도는 누락하지 않는다',async()=>{
 const m=await model,stats=await import('./covenant-stats.mjs'),equipment=await import('./covenant-equipment.mjs');
 const old=parts();old.forEach(p=>{p.mainOption='none';p.setId=11;});
 const catalog={suits:[{id:11,effects:[]}]},owner=m.simulatorEquipment(old);
 assert.deepEqual(m.simulatorTotals(old,catalog),{18159:9.6,18105:14.4,18126:24});
 assert.equal(m.simulatorCompletion(old),54.5);
 const equipped=equipment.equippedCovenantParts(catalog,owner);
 assert.throws(()=>stats.validateCovenantParts(equipped,{requireMain:true}),/1번 부위의 주옵션/);
 owner.contractSlots[0]=0;
 assert.equal(equipment.covenantAttributeTotals(catalog,owner)[18159],8);
 assert.equal(stats.covenantCompletion(equipment.equippedCovenantParts(catalog,owner)),45.4);
});
test('빈 계약의 첫 부위 선택은 6부위를 채우고 이후 선택·해제는 해당 부위만 바꾼다',async()=>{
 const {selectCovenantSet}=await model,empty=Array(6).fill(0);
 const first=selectCovenantSet(empty,18335,6);
 assert.deepEqual(first,Array(6).fill(18335));assert.deepEqual(empty,Array(6).fill(0));
 assert.deepEqual(selectCovenantSet(first,18347,2),[18335,18347,18335,18335,18335,18335]);
 assert.deepEqual(selectCovenantSet([0,18335,0,0,0,0],18347,6),[0,18335,0,0,0,18347]);
 assert.deepEqual(selectCovenantSet(first,0,2),[18335,0,18335,18335,18335,18335]);
 assert.deepEqual(selectCovenantSet(empty,0,2),empty);
 assert.deepEqual(selectCovenantSet(first,18347),Array(6).fill(18347));
 for(const position of [0,7,1.5])assert.throws(()=>selectCovenantSet(empty,18335,position));
});
function parts(){return Array.from({length:6},()=>({mainOption:'critRate',mainLevel:12,substats:[{option:'critRate',level:8,locked:true},{option:'critDamage',level:8,locked:false},{option:'domainMastery',level:8,locked:false}],goals:[{option:'critDamage',level:7,enabled:true}]}));}
test('기존 프리셋을 6부위로 변환하며 혼합 세트를 보존한다',async()=>{
 const m=await model,old=parts();old[2].setId=22;
 const owner=m.simulatorEquipment(old,{fallbackSetId:11,bound:true});
 assert.deepEqual(owner.contractSlots,[11,11,22,11,11,11]);assert.equal(owner.trinkets[0].main,18159);assert.equal(owner.trinkets[0].sub[0].value,1.6);
 const restored=m.applyEditorEquipment(owner,old);assert.equal(restored[2].setId,22);assert.deepEqual(restored[0].substats,old[0].substats);assert.deepEqual(restored[0].goals,old[0].goals);
});
test('완성도는 6부위 합산 후 계산하며 귀속 여부로 바뀌지 않는다',async()=>{
 const m=await model;assert.equal(m.simulatorCompletion(parts()),100);assert.equal(m.simulatorCompletion(parts(),true),100);
 const p=parts();p.forEach(x=>{x.mainLevel=0;x.substats.forEach(s=>s.level=1)});assert.equal(m.simulatorCompletion(p),25);
});
test('미장착 부위에 보존된 옵션은 전사 완성도에 포함하지 않는다',async()=>{
 const m=await model,p=parts();p[0].setId=0;
 assert.equal(m.simulatorCompletion(p),83.3);assert.equal(m.simulatorCompletion([p[0]]),0);
 assert.equal(m.simulatorCompletion([parts()[0]]),16.6,'구형 저장값의 기본 세트는 유지한다');
});
test('전체 초기화는 세트와 옵션·잠금을 비우고 목표를 보존한다',async()=>{
 const m=await model,old=parts(),owner={contractSlots:Array(6).fill(0),trinkets:[],contractBound:false};
 const value=m.applyEditorEquipment(owner,old);assert.equal(value[0].mainOption,'none');assert.equal(value[0].setId,0);assert.equal(m.simulatorCompletion(value),0);assert.deepEqual(value[0].goals,old[0].goals);assert.equal(value[0].substats[0].locked,false);
});
test('주옵·부옵과 활성 3세트 효과가 같은 합계 계산을 사용한다',async()=>{
 const m=await model,catalog={suits:[{id:11,effects:[{num:3,type:'CommonAttr',params:[18159,4.8]}]}]};
 const value=m.simulatorTotals(parts(),catalog,{fallbackSetId:11});assert.equal(value[18159],38.4);
});
