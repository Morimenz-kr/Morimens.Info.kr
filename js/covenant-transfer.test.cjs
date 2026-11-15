const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const definition = JSON.parse(fs.readFileSync(path.join(__dirname, '../data/covenant_editor.json'), 'utf8'));
const transfer = import('./covenant-transfer.mjs');
const models = Promise.all([import('./covenant-simulator-model.mjs'), import('./covenant-equipment.mjs'), import('./covenant-stats.mjs')]);
test('모두 미장착인 가져오기·구형 저장값은 귀속을 해제하며 첫 장착에서 되살리지 않는다',async()=>{
 const {normalizeCovenantSetting}=await transfer;
 const source=owner();source.contractSlots=Array(6).fill(0);source.contractBound=true;
 const normalized=normalizeCovenantSetting(source,definition,definition.metadata);
 assert.equal(normalized.contractBound,false);assert.ok(normalized.trinkets.every(p=>!p.bound));
 const [model,equipment]=await models;
 const parts=model.applyEditorEquipment(source,source.trinkets.map(()=>({substats:[],goals:[]})));
 assert.equal(model.simulatorEquipment(parts,{bound:true}).contractBound,false);
 assert.equal(equipment.covenantBound(source),false);
 assert.equal(source.contractBound,true,'원본 입력을 변경하지 않는다');
});
test('누락된 미설정 부위와 명시적인 빈 부위는 같은 6부위 공유값으로 정규화한다',async()=>{
    const {encodeCovenantSetting}=await transfer;
    const source=owner();source.trinkets=source.trinkets.slice(0,1);
    const empty=Array.from({length:5},(_,i)=>({position:i+2,main:0,quality:'Orange',level:0,bound:true,sub:[]}));
    assert.equal(encodeCovenantSetting(source,definition,definition.metadata),encodeCovenantSetting({...source,trinkets:[...source.trinkets,...empty]},definition,definition.metadata));
});
test('비어 있는 부옵션 줄은 복사·가져오기·시뮬레이터 왕복 뒤에도 같은 위치로 남는다', async () => {
    const {encodeCovenantSetting,decodeCovenantSetting}=await transfer;
    const [model]=await models,source=owner();
    source.trinkets[0].sub=[{id:18142,value:1.4,slot:2}];
    source.trinkets[1].sub=[{id:18159,value:.2},{id:18105,value:.3,slot:2}];
    const decoded=decodeCovenantSetting(encodeCovenantSetting(source,definition,definition.metadata),definition,definition.metadata);
    const old=source.trinkets.map(()=>({substats:[],goals:[]}));
    const parts=model.applyEditorEquipment(decoded,old);
    assert.deepEqual(parts[0].substats.map(s=>s.option),['none','none','damageAmp']);
    assert.equal(parts[0].substats[2].level,7);
    assert.deepEqual(parts[1].substats.map(s=>s.option),['critRate','none','critDamage']);
    const returned=model.simulatorEquipment(parts,{bound:decoded.contractBound});
    assert.deepEqual(decodeCovenantSetting(encodeCovenantSetting(returned,definition,definition.metadata),definition,definition.metadata),decoded);
    for(const sub of [[{id:18159,value:.2,slot:3}],[{id:18159,value:.2,slot:1},{id:18105,value:.3,slot:1}]]){
        const bad=structuredClone(decoded);bad.trinkets[0].sub=sub;
        assert.throws(()=>encodeCovenantSetting(bad,definition,definition.metadata),/입력 위치/);
    }
});

function owner() {
    return {
        contractSlots: Array.from({length: 6}, (_, index) => Object.values(definition.setIds)[index < 3 ? 0 : 1]),
        contractBound: true,
        trinkets: definition.metadata.slots.map((slot, index) => ({
            position: index + 1, main: slot.main[0], quality: 'Orange', level: index * 2,
            bound: false, sub: [{id: 18159, value: 1.6}, {id: 18105, value: .3}, {id: 18126, value: 2}]
        })),
        level: 60, privateAccount: 'must-not-transfer', simulationHistory: [1, 2]
    };
}

test('시뮬레이터와 ScareCrow 사이에서 혼합 세트·부위·귀속·수치가 왕복한다', async () => {
    const {encodeCovenantSetting, decodeCovenantSetting} = await transfer;
    const [model, equipment, stats] = await models;
    const original = owner();
    const decoded = decodeCovenantSetting(encodeCovenantSetting(original, definition, definition.metadata), definition, definition.metadata);
    const simulator = original.trinkets.map(() => ({substats: [{locked: true}, {locked: false}, {locked: true}], goals: [{enabled: true, option: 'critRate', level: 8}]}));
    const parts = model.applyEditorEquipment(decoded, simulator);
    const returned = model.simulatorEquipment(parts, {bound: decoded.contractBound});
    assert.deepEqual(decodeCovenantSetting(encodeCovenantSetting(returned, definition, definition.metadata), definition, definition.metadata), decoded);
    assert.deepEqual(equipment.covenantAttributeTotals(definition, returned), equipment.covenantAttributeTotals(definition, original));
    assert.equal(stats.covenantCompletion(equipment.equippedCovenantParts(definition, returned)), stats.covenantCompletion(equipment.equippedCovenantParts(definition, original)));
    assert.deepEqual(parts[0].goals, simulator[0].goals);
    assert.deepEqual(parts[0].substats.map(s => s.locked), [true, false, true]);
});

test('공유에는 장비 정보만 포함하고 캐릭터 성장·계정·계산 이력은 포함하지 않는다', async () => {
    const {encodeCovenantSetting} = await transfer;
    const source = owner(), before = structuredClone(source);
    const encoded = encodeCovenantSetting(source, definition, definition.metadata);
    assert.deepEqual(Object.keys(JSON.parse(encoded).equipment).sort(), ['contractBound', 'contractSlots', 'trinkets']);
    assert.doesNotMatch(encoded, /must-not-transfer|privateAccount|simulationHistory/);
    assert.deepEqual(source, before);
});

test('빈 부위·미설정 옵션과 미귀속을 보존한다', async () => {
    const {encodeCovenantSetting, decodeCovenantSetting} = await transfer;
    const source = owner(); source.contractBound = false; source.contractSlots[2] = 0;
    source.trinkets[1].main = 0; source.trinkets[1].sub = [];
    const result = decodeCovenantSetting(encodeCovenantSetting(source, definition, definition.metadata), definition, definition.metadata);
    assert.equal(result.contractSlots[2], 0); assert.equal(result.contractBound, false);
    assert.equal(result.trinkets[1].main, 0); assert.deepEqual(result.trinkets[1].sub, []);
});

test('다른 버전·손상·과대 입력과 잘못된 세팅은 적용 전에 거절한다', async () => {
    const {encodeCovenantSetting, decodeCovenantSetting, covenantTransferLimit} = await transfer;
    const valid = JSON.parse(encodeCovenantSetting(owner(), definition, definition.metadata));
    const bad = [null, {}, {...valid, version: 2}, {...valid, schema: 'party'}];
    for (const mutate of [
        e => delete e.contractSlots,
        e => e.contractSlots.pop(),
        e => e.contractSlots[0] = 999999999,
        e => e.contractSlots[0] = definition.suits.find(s => !Object.values(definition.setIds).includes(s.id)).id,
        e => e.contractBound = 'true',
        e => e.trinkets.push(e.trinkets[0]),
        e => e.trinkets[1].position = 1,
        e => e.trinkets[0].position = 0,
        e => e.trinkets[0].main = 999999,
        e => e.trinkets[0].quality = 'Purple',
        e => e.trinkets[0].level = 13,
        e => e.trinkets[0].sub[0].value = .17,
        e => e.trinkets[0].sub[0].value = 1e100,
        e => e.trinkets[0].sub[0].id = 999999,
        e => e.trinkets[0].sub.push(e.trinkets[0].sub[0])
    ]) { const payload = structuredClone(valid); mutate(payload.equipment); bad.push(payload); }
    for (const payload of bad) assert.throws(() => decodeCovenantSetting(JSON.stringify(payload), definition, definition.metadata));
    assert.throws(() => decodeCovenantSetting('{', definition, definition.metadata));
    assert.throws(() => decodeCovenantSetting(' '.repeat(covenantTransferLimit + 1), definition, definition.metadata));
});

test('공유 링크는 장비만 포함하고 혼합·빈 슬롯·귀속·수치를 독립 복원한다',async()=>{
 const {createCovenantShareLink,decodeCovenantShareLink,encodeCovenantSetting,decodeCovenantSetting}=await transfer;
 const source=owner();source.contractSlots[2]=0;source.trinkets[0].sub=[{id:18159,value:.2,slot:2}];const before=structuredClone(source);
 const link=createCovenantShareLink(source,definition,definition.metadata,'https://example.test/tools/index.html?privateAccount=secret#old');
 assert.ok(link.startsWith('https://example.test/tools/covenant_simulator.html#covenant='));assert.ok(link.length<2000);assert.doesNotMatch(link,/secret|privateAccount|must-not-transfer/);
 const result=decodeCovenantShareLink(link,definition,definition.metadata);
 assert.deepEqual(result,decodeCovenantSetting(encodeCovenantSetting(source,definition,definition.metadata),definition,definition.metadata));
 result.trinkets[0].level=0;assert.deepEqual(source,before);
});

test('잘못된 공유 링크는 적용 전에 거절하고 비공개 계약은 링크로도 옮기지 않는다',async()=>{
 const {createCovenantShareLink,decodeCovenantShareLink,covenantShareLimit}=await transfer;
 const valid=createCovenantShareLink(owner(),definition,definition.metadata,'https://example.test/');
 for(const bad of ['', '#covenant=', '#covenant=***', valid+'&covenant=xxx','javascript:alert(1)',valid.replace(/covenant=.*/,'covenant='+btoa('[2,[],true,[]]')),valid+'x'.repeat(covenantShareLimit)])assert.throws(()=>decodeCovenantShareLink(bad,definition,definition.metadata));
 const hidden=owner();hidden.contractSlots[0]=definition.suits.find(s=>!Object.values(definition.setIds).includes(s.id)).id;assert.throws(()=>createCovenantShareLink(hidden,definition,definition.metadata,'https://example.test/'));
});

test('짧은 공유 코드는 72자로 혼합 부위·빈 입력 위치·모든 레벨을 손실 없이 복원한다',async()=>{
 const {encodeCovenantShareCode,decodeCovenantShareCode,encodeCovenantSetting,decodeCovenantSetting}=await transfer;
 for(const bound of[false,true])for(let level=0;level<=12;level++){
  const source=owner();source.contractBound=bound;source.contractSlots[level%6]=0;
  source.trinkets.forEach((p,i)=>{p.main=level%4===0?0:definition.metadata.slots[i].main[level%definition.metadata.slots[i].main.length];p.level=level;p.sub=[{id:18155,value:Number((.15*(level%8+1)).toFixed(8)),slot:2}];});
  const code=encodeCovenantShareCode(source,definition,definition.metadata);assert.equal(code.length,72);assert.match(code,/^MR1-(?:[A-HJ-NP-Z2-9]{8}-){7}[A-HJ-NP-Z2-9]{5}$/);
  const expected=decodeCovenantSetting(encodeCovenantSetting(source,definition,definition.metadata),definition,definition.metadata);
  assert.deepEqual(decodeCovenantShareCode(code.toLowerCase().replaceAll('-',' \n'),definition,definition.metadata),expected);
 }
});
test('공유 코드의 한 글자 오타·누락·다른 버전은 적용 전에 거절한다',async()=>{
 const {encodeCovenantShareCode,decodeCovenantShareCode}=await transfer,code=encodeCovenantShareCode(owner(),definition,definition.metadata);
 const clean=code.replaceAll('-','');for(let i=3;i<clean.length;i++){const changed=clean.slice(0,i)+(clean[i]==='A'?'B':'A')+clean.slice(i+1);assert.throws(()=>decodeCovenantShareCode(changed,definition,definition.metadata));}
 for(const bad of['',code.slice(1),code+'A',code.replace('MR1','MR2'),'0'.repeat(500)])assert.throws(()=>decodeCovenantShareCode(bad,definition,definition.metadata));
});

test('공유 코드는 8가지 부옵션의 Lv.1~8을 정확히 왕복한다',async()=>{
 const {encodeCovenantShareCode,decodeCovenantShareCode,encodeCovenantSetting,decodeCovenantSetting}=await transfer;
 const steps={18159:.2,18105:.3,18126:.5,18142:.2,22207:.1,18139:.3,18155:.15,18151:.7};
 for(const[id,step]of Object.entries(steps))for(let level=1;level<=8;level++){
  const source=owner();for(const piece of source.trinkets)piece.sub=[{id:Number(id),value:Number((step*level).toFixed(8))}];
  assert.deepEqual(decodeCovenantShareCode(encodeCovenantShareCode(source,definition,definition.metadata),definition,definition.metadata),decodeCovenantSetting(encodeCovenantSetting(source,definition,definition.metadata),definition,definition.metadata));
 }
});
