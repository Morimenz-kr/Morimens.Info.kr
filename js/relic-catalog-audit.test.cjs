const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.resolve(__dirname, '..');
const catalog = JSON.parse(fs.readFileSync(path.join(root, 'data/relic_catalog.json'), 'utf8'));
const variants = new Map(catalog.relics.flatMap(relic => relic.variants).map(variant => [variant.id, variant]));

test('유물 도감은 일반 도감과 픽맨 변형의 안정 ID를 중복 없이 보존한다', () => {
    assert.equal(catalog.relics.length, 184);
    assert.equal(catalog.relics.flatMap(relic => relic.variants).length, 491);
    assert.equal(variants.size, 491);
    for (const relic of catalog.relics) {
        assert.ok(relic.variants.length > 0, relic.name);
        assert.ok(fs.existsSync(path.join(root, relic.image)), relic.image);
    }
});

test('번역명이 다른 픽맨 유물도 원래 도감 묶음에 백은·황금 변형을 모두 제공한다', () => {
    const cases = [[51517, 100539, 100540], [51525, 100404, 100408],
        [51532, 100412, 100400], [51552, 100407, 100410]];
    for (const [rootId, silverId, goldId] of cases) {
        const relic = catalog.relics.find(row => row.id === rootId);
        for (const [id, tier] of [[silverId, 'silver'], [goldId, 'gold']]) {
            const variant = relic.variants.find(row => row.id === id);
            assert.equal(variant.source, 'pickman', String(id));
            assert.equal(variant.chapter, 'special', String(id));
            assert.equal(variant.tier, tier, String(id));
        }
    }
});

test('능동 피해 전용 유물과 능동·촉수 피해 유물의 발동 조건을 구분한다', () => {
    for (const id of [13840, 13866, 13918]) {
        assert.match(variants.get(id).description, /능동 피해/, String(id));
        assert.doesNotMatch(variants.get(id).description, /또는 촉수 피해/, String(id));
    }
    for (const id of [13833, 70765, 70755, 13849, 13816, 44664, 13853,
        13754, 70774, 70783, 13751, 13742, 13923, 20177, 23691, 35135, 35139, 39302]) {
        assert.match(variants.get(id).description, /능동 피해 또는 촉수 피해/, String(id));
    }
});

test('광기 상한 기준·반복 발동·턴 종료 조건을 생략하지 않는다', () => {
    assert.match(variants.get(121691).description, /광기 상한의 500%/);
    assert.doesNotMatch(variants.get(121691).description, /500% 기본 광기/);
    assert.match(variants.get(121694).description, /4번 사용할 때마다/);
    assert.match(variants.get(13845).description, /행동력을 소모해 0이 될 때/);
    assert.match(variants.get(50489).description, /이번 턴 동안.*크리티컬 확률.*감소.*턴마다 최대 5회/s);
});

test('검은 불꽃은 구형 열량·번영 효과 대신 최초 3스택 생성 조건을 표시한다', () => {
    const variant = variants.get(96652);
    assert.match(variant.description, /카드 뽑기 단계 후.*명령 카드 1장.*연소/s);
    assert.match(variant.description, /이번 전투.*처음 3스택.*무한한 화염.*1장/s);
    assert.doesNotMatch(variant.description, /열량|번영|폭발 초과/);
});

test('누락된 활동 유물은 실제 이미지와 별도 가마술·박차 태그로 연결한다', () => {
    const badge = catalog.relics.find(row => row.id === 118561);
    const spur = catalog.relics.find(row => row.id === 118589);
    assert.equal(badge.variants[0].id, 151981);
    assert.equal(spur.variants[0].id, 152074);
    assert.equal(badge.image, 'images/dzone/relic/icon_creation_185.webp');
    assert.equal(spur.image, 'images/dzone/relic/icon_creation_184.webp');
    assert.match(badge.variants[0].description, /DerivativeCardKeywords_164:「가마술」/);
    assert.match(badge.variants[0].description, /DerivativeCardKeywords_165:「마법 물약」/);
    assert.doesNotMatch(badge.variants[0].description, /DerivativeCardKeywords_161|152499/);
    for (const tag of ['Genesis_Ogier_Tips_1', 'Genesis_Ogier_Tips_2', 'Genesis_Ogier_Tips_3']) {
        assert.ok(spur.variants[0].description.includes(tag), tag);
    }
});
