const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.resolve(__dirname, '..');

test('생성된 유물 카탈로그는 차원 영상을 제외한 전시관 유물 182종과 각 효과 변형을 포함한다', () => {
    const catalog = JSON.parse(fs.readFileSync(path.join(root, 'data/relic_catalog.json'), 'utf8'));
    assert.equal(catalog.schemaVersion, 3);
    assert.equal(catalog.scope, 'in-game-collection-hall');
    assert.equal(catalog.relics.length, 182);
    assert.deepEqual(catalog.relics.slice(0, 8).map(relic => relic.id), [
        51455, 51514, 51515, 51516, 51525, 51526, 51527, 51528
    ]);
    assert.ok(catalog.relics.every(relic => relic.variants.length > 0));
    assert.equal(catalog.relics.filter(relic => relic.image).length, 182);
    assert.equal(catalog.relics.some(relic => relic.id === 118586), false);
    assert.equal(catalog.relics.flatMap(relic => relic.variants).some(variant => /<[^>]+>/.test(variant.battleDescription)), false);

    const journeyRemains = catalog.relics.find(relic => relic.id === 51455);
    assert.ok(journeyRemains);
    assert.deepEqual(new Set(journeyRemains.variants.map(variant => variant.chapter)), new Set(['morimens', 'stars', 'special']));
    assert.deepEqual(new Set(journeyRemains.variants.map(variant => variant.tier)), new Set(['cursed', 'blessed', 'sinful']));

    const sextant = catalog.relics.find(relic => relic.id === 51544);
    assert.match(sextant.acquisition, /욕망의 파도/);

    const ruby = catalog.relics.flatMap(relic => relic.variants).find(variant => variant.id === 13764);
    assert.equal(ruby.name, '루비 브로치');
    assert.equal(ruby.parameters[0].expression, 'math.ceil(PlayerGrowth*0.03)');

    const allVariants = catalog.relics.flatMap(relic => relic.variants);
    assert.deepEqual(new Set(allVariants.map(variant => variant.tier)), new Set([
        'silver', 'gold', 'pendulum', 'special',
        'cursed', 'sinful', 'blessed', 'base', 'upgraded'
    ]));
    assert.equal(allVariants.filter(variant => variant.tier === 'sinful').length, 10);
    assert.equal(allVariants.filter(variant => variant.tier === 'sinful').every(variant => variant.tierLabel === '사악'), true);
    assert.deepEqual(allVariants.filter(variant => variant.quality === 'Green'), []);
    assert.equal(allVariants.some(variant => [13762, 13763, 13874, 13900, 13908].includes(variant.id)), false);
    assert.equal(allVariants.filter(variant => variant.tier === 'silver').every(variant => variant.tierLabel === '백은'), true);
    assert.equal(catalog.relics.find(relic => relic.id === 118573).variants.every(variant => variant.tier === 'pendulum'), true);
    for (const id of [118567, 118599, 118604]) {
        assert.deepEqual(new Set(catalog.relics.find(relic => relic.id === id).variants.map(variant => variant.tier)), new Set(['base', 'upgraded']));
        assert.deepEqual(new Set(catalog.relics.find(relic => relic.id === id).variants.map(variant => variant.tierLabel)), new Set(['라이커 · 기본', '라이커 · 강화']));
    }

    const alienVoice = allVariants.find(variant => variant.id === 70780);
    assert.equal(alienVoice.battleDescription, '「타격」으로 피해를 입힐 때 중독을 [Arg1]% 부여합니다. 한 턴에 이 효과로 부여할 수 있는 중독은 최대 [Arg2]pt입니다.');

    const heavyLock = catalog.relics.find(relic => relic.id === 51525);
    assert.deepEqual(heavyLock.variants.map(variant => variant.id), [13786, 70763, 70702]);
    const giftBlood = catalog.relics.find(relic => relic.id === 51532);
    assert.deepEqual(giftBlood.variants.map(variant => variant.id), [13752, 70738, 70727]);
    const rustySaw = catalog.relics.find(relic => relic.id === 51546);
    assert.deepEqual(rustySaw.variants.map(variant => variant.id), [13792, 70713, 70782, 100413, 100401]);
    assert.deepEqual(rustySaw.variants.filter(variant => variant.source === 'pickman').map(variant => variant.sourceLabel), ['픽맨 생성', '픽맨 생성']);
});

test('금기 학식 등급별 연구 깊이 표는 1~100급을 포함한다', () => {
    const data = JSON.parse(fs.readFileSync(path.join(root, 'data/research_depth_levels.json'), 'utf8'));
    assert.equal(data.levels.length, 100);
    assert.equal(data.levels[0].level, 1);
    assert.equal(data.levels.at(-1).level, 100);
    const level81 = data.levels.find(row => row.level === 81);
    assert.equal(level81.biological, 2.76);
    assert.equal(level81.material, 1074);
    assert.equal(level81.spirit, 3930.84);
});

test('유물 효과 문구는 실드와 피해 강효 용어를 사용하고 번역·띄어쓰기 오류를 제거한다', () => {
    const catalog = JSON.parse(fs.readFileSync(path.join(root, 'data/relic_catalog.json'), 'utf8'));
    const effects = catalog.relics.flatMap(relic => relic.variants)
        .flatMap(variant => [variant.description, variant.battleDescription]);
    const joined = effects.join('\n');

    assert.doesNotMatch(joined, /당신의|당신이|데스 리저스턴스|웨이크업 바디/);
    assert.doesNotMatch(joined, /방어막|피해 강화|HP이|임시힘|HP 답변|최대 HP력/);
    assert.doesNotMatch(joined, /스택의(?:허약|손상)|층약화|층의약화/);
    assert.doesNotMatch(joined, /，|。|;/);
    assert.doesNotMatch(joined, /죽음 저항[가를]|피해 강효가 \[Arg\d+\]%\.|실드[이을과]|\.\./);
    assert.match(joined, /실드/);
    assert.match(joined, /피해 강효/);
});
