const test = require('node:test');
const assert = require('node:assert/strict');
const api = require('./character-growth-data.js');
const growth = require('../data/character_growth.json');
const resources = require('../data/growth_resources.json');
const manifest = require('../data/character_manifest.json');
test('재료 계열은 유지하면서 같은 계열 안에서는 상위부터 표시한다',()=>{
    assert.deepEqual(api.sortResources(resources,[9799,9940,9793].map(itemId=>({itemId,quantity:1}))).map(row=>row.itemId),[9799,9793,9940]);
    assert.deepEqual(api.sortResources(resources,[9769,9825,9621].map(itemId=>({itemId,quantity:1}))).map(row=>row.itemId),[9769,9621,9825]);
});

test('등록 캐릭터 전원의 모든 레벨과 재화 참조가 완전하다', () => {
    assert.deepEqual(Object.keys(growth.characters).sort(), manifest.map(row => row.id).sort());
    for (const entry of Object.values(growth.characters)) {
        assert.equal(entry.levels.length, entry.maxLevel);
        entry.levels.forEach((row, i) => {
            assert.equal(row.level, i + 1);
            for (const field of ['physique', 'attack', 'defense']) assert.ok(Number.isInteger(row[field]) && row[field] > 0);
        });
        for (const step of [...entry.ascensions, ...entry.limitIncreases,...entry.potencySteps,...entry.skillUpgrades.flatMap(skill=>skill.steps),...entry.talentUpgrades.flatMap(talent=>talent.steps)]) for (const cost of step.resources) {
            assert.ok(resources.items[cost.itemId]?.name);
            assert.ok(Number.isInteger(cost.quantity) && cost.quantity > 0);
        }
        assert.equal(entry.maxLevel, entry.baseMaxLevel + entry.limitIncreases.at(-1).additionalMaxLevel + entry.potencyLimits.reduce((n, row) => n + row.additionalMaxLevel, 0));
    }
    assert.equal(growth.characters.jenkin.sourceId, 15593);
    assert.equal(growth.characters.GOgier.sourceId, 148578);
});
test('90레벨 목표는 선행 잠재력까지 자동 합산하고 이미 해금한 단계는 제외한다',()=>{
    const plan=api.quoteGrowthPlan(growth,'pandia',90);
    assert.equal(plan.needPotency,15);assert.equal(plan.needLimit,10);
    assert.deepEqual(plan.potencyResources,[{itemId:9673,quantity:15}]);
    const partial=api.quoteGrowthPlan(growth,'pandia',90,{rank:5,limit:10,potency:11});
    assert.deepEqual(partial.potencyResources,[{itemId:9673,quantity:4}]);
    assert.deepEqual(partial.ascension,[]);assert.deepEqual(partial.expansion,[]);
    assert.equal(api.quoteGrowthPlan(growth,'pandia',60).needLimit,0);
    for(const entry of Object.values(growth.characters)){
        const full=api.quoteGrowthPlan(growth,entry.id,entry.maxLevel);
        assert.equal(full.needPotency,entry.potencySteps.length);
        assert.equal(entry.skillUpgrades.length,6);
        assert.ok(entry.skillUpgrades.every(skill=>skill.steps.length===5));
    }
});
test('스킬별 슬롯 비용과 전체 합계는 광기 폭발 비용을 별도로 보존한다',()=>{
    assert.deepEqual(api.quoteSkillUpgrades(growth,'pandia',[{slot:'Slot_Strike',fromLevel:1,toLevel:2}]),[{itemId:9825,quantity:9},{itemId:10108,quantity:3150}]);
    assert.deepEqual(api.quoteSkillUpgrades(growth,'pandia',[{slot:'Slot_Super',fromLevel:1,toLevel:2}]),[{itemId:9776,quantity:1},{itemId:9825,quantity:18},{itemId:10108,quantity:6300}]);
    const all=api.quoteSkillUpgrades(growth,'pandia',growth.characters.pandia.skillUpgrades.map(skill=>({slot:skill.slot,fromLevel:1,toLevel:6})));
    assert.equal(all.find(cost=>cost.itemId===10108).quantity,1215900);
    assert.throws(()=>api.quoteSkillUpgrades(growth,'pandia',[{slot:'Slot_Strike',fromLevel:6,toLevel:7}]),RangeError);
});
test('재화 102종의 아이콘은 실제 공개 이미지 파일과 연결된다',()=>{
    const fs=require('node:fs'),path=require('node:path');
    assert.equal(Object.keys(resources.items).length,102);
    for(const item of Object.values(resources.items))assert.ok(fs.existsSync(path.join(__dirname,'..',item.icon)),item.name);
});
test('판디아 성장식의 올림과 60·90레벨 경계를 보존한다', () => {
    assert.deepEqual(api.statsAtLevel(growth, 'pandia', 1), {level:1,physique:32,attack:37,defense:33});
    assert.deepEqual(api.statsAtLevel(growth, 'pandia', 60), {level:60,physique:120,attack:140,defense:124});
    assert.deepEqual(api.statsAtLevel(growth, 'pandia', 90), {level:90,physique:165,attack:193,defense:171});
});
test('레벨 구간 전체 경험치를 합친 뒤 500 단위로 올림한다', () => {
    const quote = api.quoteLevelUp(growth, resources, 'pandia', 1, 4);
    assert.equal(quote.experience, 900);
    assert.equal(quote.billableExperience, 1000);
    assert.deepEqual(quote.currency, {itemId:10108,quantity:200});
    assert.deepEqual(quote.smallestBottleEquivalent, {itemId:10064,quantity:2});
    assert.equal([1,2,3].reduce((n,l)=>n+api.quoteLevelUp(growth,resources,'pandia',l,l+1).currency.quantity,0),300);
    const sr = Object.values(growth.characters).find(entry=>entry.experienceCurve==='SREXP');
    assert.equal(api.quoteLevelUp(growth,resources,sr.id,1,4).experience,600);
    // 변형 캐릭터의 사이트 분류를 경험치 등급으로 오인하지 않는다.
    assert.equal(api.quoteLevelUp(growth,resources,'ramona_timeworn',1,4).experience,900);
});
test('최대 레벨에서는 다음 레벨 경험치를 요구하지 않는다', () => {
    assert.equal(api.quoteLevelUp(growth,resources,'pandia',90,90).currency.quantity,0);
    assert.throws(()=>api.quoteLevelUp(growth,resources,'pandia',90,91),RangeError);
    assert.throws(()=>api.statsAtLevel(growth,'pandia',0),RangeError);
    assert.throws(()=>api.quoteLevelUp(growth,resources,'pandia',10,1),RangeError);
});
test('승급 비용은 출발 단계의 원본 비용이며 레벨업과 분리한다', () => {
    assert.deepEqual(api.quoteAscension(growth,'pandia',0,1),[{itemId:9940,quantity:9},{itemId:10108,quantity:1800}]);
    assert.deepEqual(api.quoteAscension(growth,'pandia',0,5),[{itemId:9793,quantity:27},{itemId:9799,quantity:39},{itemId:9940,quantity:9},{itemId:10108,quantity:228600}]);
    assert.deepEqual(api.quoteLimitIncrease(growth,'pandia',0,1),[{itemId:9799,quantity:36},{itemId:10108,quantity:194400},{itemId:25218,quantity:1}]);
    assert.throws(()=>api.quoteAscension(growth,'pandia',0,6),RangeError);
});

test('광기의 징조와 영혼 단련은 다음 단계의 재료를 누적한다',()=>{
    assert.deepEqual(api.quoteTalentUpgrades(growth,'pandia',[{type:1,fromLevel:0,toLevel:1}]),[{itemId:9762,quantity:22},{itemId:10108,quantity:108000}]);
    assert.deepEqual(api.quoteTalentUpgrades(growth,'pandia',[{type:2,fromLevel:0,toLevel:2}]),[{itemId:74093,quantity:9}]);
    assert.deepEqual(api.quoteTalentUpgrades(growth,'pandia',[{type:1,fromLevel:12,toLevel:12}]),[]);
    assert.throws(()=>api.quoteTalentUpgrades(growth,'pandia',[{type:2,fromLevel:10,toLevel:11}]),RangeError);
    for(const entry of Object.values(growth.characters))assert.deepEqual(entry.talentUpgrades.filter(t=>t.type!==3).map(t=>t.maxLevel),[12,10]);
});

test('내재영격은 기본 활성화 대상을 제외하고 5단계 비용을 합산한다',()=>{
    assert.equal(Object.values(growth.characters).filter(c=>c.talentUpgrades.some(t=>t.type===3)).length,28);
    assert.ok(!growth.characters.GOgier.talentUpgrades.some(t=>t.type===3));
    assert.deepEqual(api.quoteTalentUpgrades(growth,'celeste',[{type:3,fromLevel:0,toLevel:5}]),[{itemId:9719,quantity:300}]);
    assert.deepEqual(api.quoteTalentUpgrades(growth,'celeste',[{type:3,fromLevel:2,toLevel:5}]),[{itemId:9719,quantity:240}]);
});

test('회귀 라모나의 승급·잠재력 보너스는 누적하고 은열쇠 충전 등급의 소수를 보존한다',()=>{
    assert.deepEqual(api.growthAttributes(growth,'ramona_timeworn',0,0),{occupation_master:2,keeper_energy_eff_2:17.4,crit:5,crit_damage:50});
    const rank=api.growthAttributes(growth,'ramona_timeworn',5,0);assert.equal(rank.occupation_master,12);assert.equal(rank.keeper_energy_eff_2,29.4);
    const full=api.growthAttributes(growth,'ramona_timeworn',5,15);assert.equal(full.occupation_master,36);assert.equal(full.keeper_energy_eff_2,58.2);
});
