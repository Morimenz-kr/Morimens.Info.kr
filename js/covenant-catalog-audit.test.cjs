const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const contracts = JSON.parse(fs.readFileSync(path.join(__dirname, '../data/covenant_list.json'), 'utf8'));
const find = id => contracts.find(row => row.english_name === `covenant_${id}`);

test('기존 비밀계약 21개의 안정 ID와 설명을 보존한다', () => {
    assert.equal(contracts.length, 21);
    assert.equal(new Set(contracts.map(row => row.english_name)).size, 21);
    for (const row of contracts) {
        assert.ok(row.korean_name && row.set_effect_3 && row.set_effect_6, row.english_name);
    }
});

test('4월의 찬가는 HP 75% 경계를 초과 조건으로 설명한다', () => {
    assert.match(find('April').set_effect_6, /75%를 초과/);
    assert.doesNotMatch(find('April').set_effect_6, /75% 이상/);
});

test('턴 내 발동 제한과 임시 크리티컬 지속 시간을 명시한다', () => {
    assert.match(find('blood').set_effect_6, /능동 피해.*35.*70.*매 턴 최대 3회/s);
    assert.match(find('scarlet').set_effect_6, /이번 턴.*30%/);
    assert.match(find('deus').set_effect_6, /1·5·9턴/);
    assert.doesNotMatch(find('deus').set_effect_6, /팀 고유/);
    assert.doesNotMatch(find('party').set_effect_6, /팀 고유/);
});

test('3세트 보너스의 퍼센트 단위와 조건부 영역 효과를 보존한다', () => {
    assert.equal(find('wolf').set_effect_3, '피해 증폭 +4.8%');
    for (const id of ['betray', 'vampire', 'revelation']) assert.equal(find(id).set_effect_3, '은열쇠 충전 +7.2');
    assert.match(find('vampire').set_effect_6, /혈육 각성체.*충전 5마다 배아 융합을 1/s);
    assert.match(find('sungood').set_effect_6, /혈육 각성체.*25~50/s);
    assert.match(find('ocean').set_effect_6, /심해 각성체.*팀 영역 숙련×0\.25/s);
    assert.match(find('virgin').set_effect_6, /심해 각성체.*최대 80%/s);
    assert.match(find('virgin').set_effect_6, /장비자에게 배아 또는 성결의 자식을 직접 사용/);
    assert.match(find('virgin').set_effect_6, /두 발동 조건은 매 턴 합계 1회/);
});

test('36호실의 고리는 고정 200 대신 일반·원초 혼돈의 비용 증가율을 구분한다', () => {
    const text = find('36rings').set_effect_6;
    assert.match(text, /소모량이 20%.*원초·혼돈.*10%/s);
    assert.doesNotMatch(text, /200 증가/);
});

test('달콤한 점액동물은 태세가 이미 적용된 경우와 같은 턴 전환을 모두 설명한다', () => {
    const text = find('snail').set_effect_6;
    assert.match(text, /정해 또는 노도 태세에서 소멸을 발동하거나/);
    assert.match(text, /소멸을 발동한 턴에 정해 또는 노도 태세로 전환/);
    assert.match(text, /25%.*3턴/s);
});
