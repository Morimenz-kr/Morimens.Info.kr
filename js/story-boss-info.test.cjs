const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const data = JSON.parse(fs.readFileSync(path.join(root, 'data/story_boss_mountain_parasite.json'), 'utf8'));
const html = fs.readFileSync(path.join(root, 'story_boss_info.html'), 'utf8');
const script = fs.readFileSync(path.join(root, 'js/story-boss-info.js'), 'utf8');

test('산의 기생충 반복 패턴과 강제 전환 행동을 분리한다', () => {
    const monster = data.monster;
    assert.equal(monster.id, 150109);
    assert.equal(monster.hpBars, 2);
    assert.deepEqual(monster.opening.actions.map(action => action.id), [150122, 149842]);
    assert.deepEqual(monster.phaseOne.actions.map(action => action.id), [149843, 149842]);
    assert.equal(monster.transition.title, '탐식 공양');
    assert.deepEqual(monster.phaseTwo.actions.map(action => action.id), [149846, 149844, 149845]);
    assert.equal(monster.phaseOne.title, '1페이즈');
    assert.equal(monster.phaseTwo.title, '2페이즈');
    assert.equal(monster.phaseOne.badge, '2턴 반복');
});

test('2단계 전환, 조건부 상태, 스토리 지원 정보를 제공한다', () => {
    assert.equal(data.monster.transition.title, '탐식 공양');
    assert.equal(data.monster.transition.treasures.length, 5);
    assert.match(data.monster.transition.description, /행동 목록을 2페이즈 패턴으로 교체/);
    assert.equal(data.monster.initialMechanics.length, 4);
    assert.equal(data.monster.supportMechanics.length, 3);
    assert.deepEqual(data.monster.conditionalActions.map(item => item.title), ['분리', '칠성연주']);
    assert.match(data.monster.conditionalActions[0].trigger, /빙식을 세 번째 사용/);
    assert.match(data.monster.conditionalActions[1].trigger, /다섯 보물을 모두 파손하고 15턴 이내/);
    assert.equal(data.monster.rules, undefined);
    assert.equal(data.monster.lateBattleMechanics, undefined);
    assert.ok(data.monster.transition.treasures.every(treasure => treasure.effect && treasure.break));
    const [karaboo, nSupport, william] = data.monster.supportMechanics;
    assert.equal(karaboo.groups.length, 7);
    assert.ok(karaboo.groups.every(group => group.variants.length === 3));
    assert.deepEqual(nSupport.groups.map(group => group.entries.length), [6, 7]);
    assert.match(nSupport.description, /고정된 전용 카드 3종이 아닙니다/);
    assert.deepEqual(william.groups[0].entries.map(entry => entry.name), ['기록', '각인', '재주조']);
    assert.match(data.monster.conditionalActions[1].description, /전투 효과는 없습니다/);
});

test('일반과 어려움의 실제 체력 및 전투 스탯을 분리한다', () => {
    const { normal, hard } = data.monster.difficulties;
    assert.equal(normal.stageId, 146255);
    assert.equal(normal.hp, 1464193);
    assert.equal(normal.phaseTwoEntryHp, 2928388);
    assert.equal(normal.phaseTwoMaxHp, 4392580);
    assert.equal(normal.minimumEffectiveHp, 4392581);
    assert.equal(normal.attack, 1317);
    assert.equal(hard.stageId, 146231);
    assert.equal(hard.hp, 3746130);
    assert.equal(hard.phaseTwoEntryHp, 7492262);
    assert.equal(hard.phaseTwoMaxHp, 11238391);
    assert.equal(hard.minimumEffectiveHp, 11238392);
    assert.equal(hard.attack, 2115);
    assert.equal(data.monster.profile, undefined);
});

test('전용 페이지가 데이터와 반응형 스타일을 불러온다', () => {
    assert.match(html, /story-boss-info\.css/);
    assert.match(html, /story-boss-info\.js/);
    assert.match(script, /story_boss_mountain_parasite\.json/);
    assert.match(script, /intent_\$\{escapeHtml\(action\.intent\)\}/);
    assert.match(script, /data-difficulty/);
    assert.match(script, /resolvedActionDescription/);
    assert.match(script, /renderConditionalActions/);
    assert.match(script, /renderFlatRules\('스토리 지원'/);
    assert.match(script, /story-boss-support-groups/);
    assert.match(script, /story-boss-break/);
    assert.doesNotMatch(script, />전투 시작부터 적용되는 효과</);
    assert.doesNotMatch(script, /renderInfoSection/);
    assert.ok(script.indexOf('>보스</span>') < script.indexOf('monster.tags.map'));
    assert.ok(fs.existsSync(path.join(root, data.monster.portrait)));
    assert.ok(fs.existsSync(path.join(root, data.monster.transition.portrait)));
});
