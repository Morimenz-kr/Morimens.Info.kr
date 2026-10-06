const test = require('node:test');
const assert = require('node:assert/strict');
const api = require('./character-growth-data.js');
const growth = require('../data/character_growth.json');
const resources = require('../data/growth_resources.json');
const manifest = require('../data/character_manifest.json');

test('등록 캐릭터 전원의 모든 레벨과 재화 참조가 완전하다', () => {
    assert.deepEqual(Object.keys(growth.characters).sort(), manifest.map(row => row.id).sort());
    for (const entry of Object.values(growth.characters)) {
        assert.equal(entry.levels.length, entry.maxLevel);
        entry.levels.forEach((row, i) => {
            assert.equal(row.level, i + 1);
            for (const field of ['physique', 'attack', 'defense']) assert.ok(Number.isInteger(row[field]) && row[field] > 0);
        });
        for (const step of [...entry.ascensions, ...entry.limitIncreases]) for (const cost of step.resources) {
            assert.ok(resources.items[cost.itemId]?.name);
            assert.ok(Number.isInteger(cost.quantity) && cost.quantity > 0);
        }
        assert.equal(entry.maxLevel, entry.baseMaxLevel + entry.limitIncreases.at(-1).additionalMaxLevel + entry.potencyLimits.reduce((n, row) => n + row.additionalMaxLevel, 0));
    }
    assert.equal(growth.characters.jenkin.sourceId, 15593);
    assert.equal(growth.characters.GOgier.sourceId, 148578);
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
