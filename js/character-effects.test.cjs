const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

function loadClassifier() {
    const source = fs.readFileSync(path.join(__dirname, 'character-effects.js'), 'utf8');
    const window = {};
    new Function('window', source)(window);
    return window.CharacterEffects;
}

const characterEffects = loadClassifier();
const { classifyCharacterEffects } = characterEffects;
const effectsData = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'character_effects.json'), 'utf8'));

test('카드별 3돌 뱃지는 선행 돌파 뱃지도 함께 활성화한다', () => {
    const result = characterEffects.renderBreakthroughBadges({
        breakthroughs: [{ stage: 1 }, { stage: 3 }]
    }, 3);

    assert.equal((result.match(/character-effect-breakthrough-badge active/g) || []).length, 2);
    assert.equal((result.match(/aria-pressed="true"/g) || []).length, 2);
    assert.match(result, /<button[^>]*data-breakthrough-stage="3"/);
});

test('선택한 돌파 단계에 맞는 스킬 전문을 표시한다', () => {
    const skill = {
        type: '명령',
        name: '폐쇄적 창작',
        effect: '기본 효과',
        levels: [{ level: 1, 수치: '30%' }],
        breakthroughs: [{
            stage: 1,
            effect: '즉시 n%를 획득하고 다음 턴 n%를 획득한다.',
            levels: [{ level: 1, 즉시: '10%', 다음: '30%' }]
        }]
    };

    const result = characterEffects.getBreakthroughVariant(skill, 1);

    assert.equal(result.effect, '즉시 n%를 획득하고 다음 턴 n%를 획득한다.');
    assert.equal(result.levels[0].즉시, '10%');
});

test('3돌에서는 같은 카드의 1돌과 3돌 추가 효과를 누적한다', () => {
    const skill = {
        effect: '기본 효과.',
        breakthroughs: [
            { stage: 1, append: '1돌 효과.' },
            { stage: 3, append: '3돌 효과.' }
        ]
    };

    assert.equal(
        characterEffects.getBreakthroughVariant(skill, 3).effect,
        '기본 효과. 1돌 효과. 3돌 효과.'
    );
});

test('3돌에서는 앞 단계에서 변경된 레벨 수치도 누적한다', () => {
    const skill = {
        effect: '피해 n%, 방어막 m%.',
        levels: [{ level: 1, 피해: '10%', 방어막: '20%' }],
        breakthroughs: [
            { stage: 1, levels: [{ level: 1, 피해: '15%' }] },
            { stage: 3, levels: [{ level: 1, 방어막: '30%' }] }
        ]
    };

    const result = characterEffects.getBreakthroughVariant(skill, 3);
    assert.deepEqual(result.levels, [{ level: 1, 피해: '15%', 방어막: '30%' }]);
});

test('확정된 24와 님피아 돌파 수치를 단계별 전문에 적용한다', () => {
    const chaosCut = effectsData['24'].skills.find(skill => skill.name === '혼돈의 절단');
    const nightWave = effectsData.nymphaea.skills.find(skill => skill.name === '요동치는 밤물결');
    const chaosCutAtOne = characterEffects.getBreakthroughVariant(chaosCut, 1);
    const nightWaveAtTwo = characterEffects.getBreakthroughVariant(nightWave, 2);

    assert.equal(chaosCutAtOne.levels[4].피해, '45%');
    assert.equal(nightWaveAtTwo.levels[0].피해, '33.75%');
    assert.match(chaosCutAtOne.effect, /추가로 3회 피해/);
});

test('확정된 산 1·2돌은 카드 전문과 레벨별 수치에 반영한다', () => {
    const closedCreation = effectsData.sanga.skills.find(skill => skill.name === '폐쇄적 창작');
    const aestheticCompassion = effectsData.sanga.skills.find(skill => skill.name === '미적 연민');
    const closedAtOne = characterEffects.getBreakthroughVariant(closedCreation, 1);
    const compassionAtTwo = characterEffects.getBreakthroughVariant(aestheticCompassion, 2);

    assert.equal(closedAtOne.levels[0].방어막, '10%');
    assert.equal(closedAtOne.levels[5]['다음 턴 방어막'], '60%');
    assert.match(closedAtOne.effect, /^방어력 n%의 방어막을 획득한다\./);
    assert.equal(compassionAtTwo.levels[0]['촉수당 방어막'], '3%');
    assert.equal(compassionAtTwo.levels[5]['촉수당 방어막'], '6%');
});

test('확정된 산 3돌은 잊혀진 예술의 전문과 레벨별 수치에 반영한다', () => {
    const forgottenArt = effectsData.sanga.skills.find(skill => skill.name === '잊혀진 예술');
    const artAtThree = characterEffects.getBreakthroughVariant(forgottenArt, 3);

    assert.equal(artAtThree.levels[0].방어막, '31.25%');
    assert.equal(artAtThree.levels[0].피해, '37.5%');
    assert.equal(artAtThree.levels[5].방어막, '62.5%');
    assert.equal(artAtThree.levels[5].피해, '75%');
    assert.match(artAtThree.effect, /추가로 31%의 크리티컬 확률과 크리티컬 피해 보너스/);
    assert.doesNotMatch(artAtThree.effect, /3돌파 시/);
});

test('확정된 셀레스트 1~3돌은 카드 전문과 레벨별 수치에 반영한다', () => {
    const celeste = effectsData.celeste;
    const eternalVision = characterEffects.getBreakthroughVariant(celeste.skills.find(skill => skill.name === '영원한 환영'), 1);
    const pureDream = characterEffects.getBreakthroughVariant(celeste.skills.find(skill => skill.name === '순백의 꿈'), 2);
    const immortalBird = characterEffects.getBreakthroughVariant(celeste.skills.find(skill => skill.name === '불멸의 극락조'), 3);

    assert.equal(eternalVision.levels[0].회복, '40%');
    assert.equal(eternalVision.levels[5].회복, '80%');
    assert.match(eternalVision.effect, /유지$/);
    assert.doesNotMatch(eternalVision.effect, /항해의 호각/);
    assert.equal(pureDream.levels[0]['턴당 추가 회복'], '10%');
    assert.equal(pureDream.levels[5]['턴당 추가 회복'], '20%');
    assert.match(pureDream.effect, /^HP를 체력의 n% 회복한다/);
    assert.match(pureDream.effect, /HP를 체력의 m% 회복한다/);
    assert.match(immortalBird.effect, /^자신의 중상 상태를 해제하고, HP를 체력의 n% 회복하며/);
    assert.match(immortalBird.effect, /모든 각성체가 25 광기를 획득한다/);
    assert.match(immortalBird.effect, /부활 후 6턴이 지나면 다시 부활할 수 있다/);
});

test('확정된 오레타 1~3돌은 필요한 카드에만 전문을 반영한다', () => {
    const aurita = effectsData.aurita;
    const companion = characterEffects.getBreakthroughVariant(aurita.skills.find(skill => skill.name === '동료의 힘'), 1);
    const hullSplit = characterEffects.getBreakthroughVariant(aurita.skills.find(skill => skill.name === '선체 분열'), 2);
    const noisySea = characterEffects.getBreakthroughVariant(aurita.skills.find(skill => skill.name === '소란스러운 바다'), 2);
    const defense = characterEffects.getBreakthroughVariant(aurita.skills.find(skill => skill.name === '방어'), 3);

    assert.match(companion.effect, /버린 카드 수보다 1장 많은 카드를 뽑는다/);
    assert.doesNotMatch(companion.effect, /이 카드와 같은 레벨/);
    assert.equal(hullSplit.levels[0].피해, '24%');
    assert.equal(hullSplit.levels[5].피해, '48%');
    assert.match(hullSplit.effect, /관통 피해/);
    assert.equal(noisySea.levels[0].피해, '48%');
    assert.equal(noisySea.levels[5].피해, '96%');
    assert.match(defense.effect, /카드를 1장 뽑는다/);
    assert.doesNotMatch(defense.effect, /매 3턴/);
});

test('확정된 카이커스 1~3돌은 카드 전문과 전역 계령에 반영한다', () => {
    const caecus = effectsData.caecus;
    const spear = characterEffects.getBreakthroughVariant(caecus.skills.find(skill => skill.name === '파쇄의 장창'), 1);
    const guard = characterEffects.getBreakthroughVariant(caecus.skills.find(skill => skill.name === '역린의 수호'), 2);
    const defense = caecus.skills.find(skill => skill.name === '방어');

    assert.match(spear.effect, /동일한 양의 반격을 획득한다/);
    assert.equal(spear.levels[0].광기, '15');
    assert.equal(spear.levels[5].광기, '20');
    assert.equal(guard.levels[0].방어막, '30%');
    assert.equal(guard.levels[5].방어막, '60%');
    assert.match(guard.effect, /유지$/);
    assert.equal(defense.breakthroughs, undefined);
    assert.match(caecus.enlighten[1].effect, /'역린의 수호'/);
    assert.equal(caecus.enlighten[2].effect, '턴 종료 시 카이커스의 체력의 7.5%만큼 HP를 회복한다.');
});

test('파생 카드를 뽑는 효과는 생성된 카드 자체에 돌파 뱃지를 붙이지 않는다', () => {
    const murphy = effectsData.Murphy_Fauxborn;
    const attack = murphy.skills.find(skill => skill.name === '타격');
    const hymn = [...murphy.skills, ...(murphy.derivedCards || [])].find(skill => skill.name === '심해의 성가');

    assert.match(attack.breakthroughs.find(item => item.stage === 3).append, /^「심해의 성가」/);
    assert.doesNotMatch(attack.breakthroughs.find(item => item.stage === 3).append, /타격.*방어/);
    assert.equal(hymn.breakthroughs, undefined);
});

test('다음 카드에 영향을 주더라도 참조 카드 자체가 바뀌지 않으면 뱃지를 붙이지 않는다', () => {
    const moss = effectsData.vortice;
    const charge = [...moss.skills, ...(moss.derivedCards || [])].find(skill => skill.name === '장전!');
    assert.equal(charge.breakthroughs, undefined);
});

test('전역 명령 카드 강화는 기본 방어 카드에 잘못 연결하지 않는다', () => {
    const defense = effectsData.doresain.skills.find(skill => skill.name === '방어');
    assert.equal(defense.breakthroughs, undefined);
});

test('기본 타격과 방어의 돌파 전문은 불필요한 사용 시로 시작하지 않는다', () => {
    for (const character of Object.values(effectsData)) {
        for (const skill of character.skills || []) {
            if (!['타격', '방어'].includes(skill.name)) continue;
            for (const variant of skill.breakthroughs || []) {
                assert.doesNotMatch(variant.append || '', /^사용 시/);
            }
        }
    }
});

test('탄망 머피와 미리암의 촉수 태세별 효과와 레벨 수치를 모두 표시한다', () => {
    const waltz = effectsData.Murphy_Fauxborn.skills.find(skill => skill.name === '레무리아의 왈츠');
    const prayer = effectsData.miryam.skills.find(skill => skill.name === '깊은 심연에 기도를');
    const waltzLv1 = characterEffects.interpolateEffect(waltz.effect, waltz.levels, 1);
    const waltzLv6 = characterEffects.interpolateEffect(waltz.effect, waltz.levels, 6);
    const prayerLv1 = characterEffects.interpolateEffect(prayer.effect, prayer.levels, 1);
    const prayerLv6 = characterEffects.interpolateEffect(prayer.effect, prayer.levels, 6);

    assert.match(waltzLv1, /조수:.*10\.5%/s);
    assert.match(waltzLv1, /정해:.*41%/s);
    assert.match(waltzLv6, /노도:.*60%.*75%/s);
    assert.match(prayerLv1, /조수:.*7\.5%.*7\.5%/s);
    assert.match(prayerLv1, /정해:.*10 광기/s);
    assert.match(prayerLv6, /노도:.*100%/s);
});

test('레무리아의 왈츠는 승인된 촉수 태세 명칭과 노도 문장을 사용한다', () => {
    const waltz = effectsData.Murphy_Fauxborn.skills.find(skill => skill.name === '레무리아의 왈츠');

    assert.match(waltz.effect, /- 조수:/);
    assert.match(waltz.effect, /- 정해:/);
    assert.match(waltz.effect, /- 노도:/);
    assert.match(waltz.effect, /피해를 5회 입히고, 이 피해에는 n%의 촉수 피해 보너스가 적용된다/);
    assert.doesNotMatch(waltz.effect, /밀려드는 물결|고요한 바다|몰아치는 파도/);
});

test('탄망 머피 1·2돌의 독립 효과는 계령에만 표시한다', () => {
    const murphy = effectsData.Murphy_Fauxborn;
    const waltz = murphy.skills.find(skill => skill.name === '레무리아의 왈츠');

    assert.equal(waltz.breakthroughs, undefined);
    assert.match(murphy.enlighten[0].effect, /은열쇠 충전 1당 추가로 0\.2% 증가한다/);
    assert.match(murphy.enlighten[1].effect, /희생 또는 지연 희생을 획득할 때마다/);
});

test('툴루 1돌 심연의 호령은 계산식과 레벨별 촉수 관통 피해를 표시한다', () => {
    const tulu = effectsData.tulu;
    const command = tulu.skills.find(skill => skill.name === '심연의 호령');
    const atOne = characterEffects.getBreakthroughVariant(command, 1);
    const renderedAtThree = characterEffects.interpolateEffect(atOne.effect, atOne.levels, 3);

    assert.match(command.effect, /광기 회복 1마다 15%의 촉수 피해 계수와 힘 계수/);
    assert.equal(command.levels[0]['촉수 관통 피해'], '100%');
    assert.equal(command.levels[5]['촉수 관통 피해'], '150%');
    assert.match(renderedAtThree, /공격력의 84%에 해당하는 관통 피해/);
    assert.match(renderedAtThree, /모든 촉수가 모든 적을 1회 공격하여 120%의 관통 피해/);
    assert.match(renderedAtThree, /현재 태세가 「정해」일 경우, 산출력 소모가 2 감소한다/);
});

test('툴루 2·3돌은 카드별 전문과 계령 전용 효과를 구분한다', () => {
    const tulu = effectsData.tulu;
    const attack = characterEffects.getBreakthroughVariant(tulu.skills.find(skill => skill.name === '타격'), 2);
    const defense = characterEffects.getBreakthroughVariant(tulu.skills.find(skill => skill.name === '방어'), 2);
    const returnOfLemuria = characterEffects.getBreakthroughVariant(tulu.skills.find(skill => skill.name === '레무리아의 재림'), 3);
    const attackAtSix = characterEffects.interpolateEffect(attack.effect, attack.levels, 6);

    assert.match(attackAtSix, /공격력의 20%에 해당하는 피해/);
    assert.match(attackAtSix, /10 광기를 획득한다/);
    assert.match(attackAtSix, /공격력의 12%만큼 증가/);
    assert.match(defense.effect, /^방어력의 n%에 해당하는 방어막/);
    assert.match(returnOfLemuria.effect, /임시 크리티컬 확률이 15% 증가한다/);
    assert.doesNotMatch(returnOfLemuria.effect, /턴 종료 시 툴루가 5 광기/);
    assert.match(tulu.enlighten[2].effect, /^턴 종료 시 툴루가 5 광기를 획득한다/);
});

test('서로 다른 레벨 수치 자리에는 n과 m을 순서대로 치환한다', () => {
    const result = characterEffects.interpolateEffect(
        '공격력 n%의 피해를 입히고 공격력 m%의 촉수 피해를 획득한다.',
        [{ level: 1, 피해: '16%', '촉수 피해': '3.75%' }],
        1
    );
    assert.equal(result, '공격력 16%의 피해를 입히고 공격력 3.75%의 촉수 피해를 획득한다.');
});

test('파로스와 모스의 돌파 전문은 레벨 수치와 완성 문장을 표시한다', () => {
    const sea = effectsData.faros.skills.find(skill => skill.name === '광열의 바다');
    const burst = effectsData.vortice.skills.find(skill => skill.name === '심연! 소용돌이! 대포!');
    const seaAtOne = characterEffects.getBreakthroughVariant(sea, 1);
    const burstAtOne = characterEffects.getBreakthroughVariant(burst, 1);
    const burstAtThree = characterEffects.getBreakthroughVariant(burst, 3);

    assert.match(characterEffects.interpolateEffect(seaAtOne.effect, seaAtOne.levels, 6), /공격력의 32%.*100%.*공격력의 7\.5%/s);
    assert.match(characterEffects.interpolateEffect(burstAtOne.effect, burstAtOne.levels, 6), /750%.*2배.*영역 숙련을 50/s);
    assert.match(characterEffects.interpolateEffect(burstAtThree.effect, burstAtThree.levels, 6), /750%.*3배.*20 광기를 소모할 때마다/s);
});

test('확정된 파로스 1~3돌은 카드 전문과 계령 전용 효과를 구분한다', () => {
    const faros = effectsData.faros;
    const blazingSea = characterEffects.getBreakthroughVariant(faros.skills.find(skill => skill.name === '광열의 바다'), 1);
    const attack = characterEffects.getBreakthroughVariant(faros.skills.find(skill => skill.name === '타격'), 2);
    const defense = characterEffects.getBreakthroughVariant(faros.skills.find(skill => skill.name === '방어'), 2);

    assert.match(blazingSea.effect, /^공격력의 n%에 해당하는 피해/);
    assert.match(blazingSea.effect, /공격력의 m%만큼 증가한다/);
    assert.match(attack.effect, /촉수 1개가 피해량 50%로 적을 2회 공격한다/);
    assert.match(defense.effect, /^방어력의 n%에 해당하는 방어막/);
    assert.equal(faros.skills.find(skill => skill.name === '깊은 암류').breakthroughs, undefined);
    assert.equal(faros.enlighten[2].effect, '턴 종료 시 손패 1장마다 모든 적의 중독을 3% 발동시키며, 파로스가 3 광기를 획득한다.');
});

test('확정된 모스 2돌은 타격과 방어에만 전문을 연결한다', () => {
    const moss = effectsData.vortice;
    const attack = characterEffects.getBreakthroughVariant(moss.skills.find(skill => skill.name === '타격'), 2);
    const defense = characterEffects.getBreakthroughVariant(moss.skills.find(skill => skill.name === '방어'), 2);
    const load = moss.skills.find(skill => skill.name === '장전!');

    assert.match(attack.effect, /다음 모스의 광기 폭발의 크리티컬 확률이 10% 증가/);
    assert.match(defense.effect, /다음에 사용하는 「장전!」의 산출력 소모가 1 감소/);
    assert.equal(load.breakthroughs, undefined);
});

test('확정된 폰토스 1~3돌은 레벨 수치와 건트 여파를 누적한다', () => {
    const pontos = effectsData.pontos;
    const huntingGaunt = pontos.skills.find(skill => skill.name === '사냥의 건트');
    const huntAtOne = characterEffects.getBreakthroughVariant(huntingGaunt, 1);
    const huntAtThree = characterEffects.getBreakthroughVariant(huntingGaunt, 3);
    const endlessHunt = characterEffects.getBreakthroughVariant(pontos.skills.find(skill => skill.name === '끝없는 사냥'), 1);
    const raid = characterEffects.getBreakthroughVariant(pontos.skills.find(skill => skill.name === '요마 습격'), 2);
    const attack = characterEffects.getBreakthroughVariant(pontos.skills.find(skill => skill.name === '타격'), 3);

    assert.equal(huntAtOne.levels[0].피해량, '1100%');
    assert.equal(huntAtOne.levels[5].피해량, '2200%');
    assert.match(huntAtThree.effect, /고정 피해가 추가로 0\.2% 증가한다.*여파: 산출력 소모가 1 감소한다/s);
    assert.equal(endlessHunt.levels[0]['힘 감소'], '18.9%');
    assert.equal(endlessHunt.levels[5]['힘 감소'], '37.8%');
    assert.equal(raid.levels[0].피해, '37.5%');
    assert.equal(raid.levels[5].피해, '75%');
    assert.match(raid.effect, /X\+1회 추가로 발동한다/);
    assert.match(attack.effect, /「건트」 1장을 뽑는다/);
});

test('도어세인 1·2돌은 계령에만 표시하고 3돌 파생 카드의 조사를 교정한다', () => {
    const doresain = effectsData.doresain;
    const feast = doresain.derivedCards.find(card => card.name === '영원한 밤의 향연');
    const feastAtThree = characterEffects.getBreakthroughVariant(feast, 3);

    assert.equal(doresain.skills.some(skill => skill.breakthroughs), false);
    assert.match(doresain.enlighten[0].effect, /도어세인의 크리티컬 확률이 0\.1% 증가한다/);
    assert.match(doresain.enlighten[1].effect, /방어막 획득량 및 광기 획득량/);
    assert.match(feast.effect, /공격력의 40%에 해당하는 관통 피해/);
    assert.match(feastAtThree.effect, /공격력의 120%에 해당하는 관통 피해/);
});

test('확정된 레이아 1~3돌은 레벨별 피해와 포식 힘을 표시한다', () => {
    const leigh = effectsData.leigh;
    const painAndJoy = characterEffects.getBreakthroughVariant(leigh.skills.find(skill => skill.name === '고통과 환희'), 1);
    const unfilledPain = characterEffects.getBreakthroughVariant(leigh.skills.find(skill => skill.name === '채워지지 않은 고통'), 2);
    const embrace = characterEffects.getBreakthroughVariant(leigh.skills.find(skill => skill.name === '아첨의 포옹'), 3);
    const embraceAtSix = characterEffects.interpolateEffect(embrace.effect, embrace.levels, 6);

    assert.equal(painAndJoy.levels[0].피해, '60%');
    assert.equal(painAndJoy.levels[5].피해, '120%');
    assert.match(painAndJoy.effect, /관통 피해를 3회 입힌다/);
    assert.match(unfilledPain.effect, /10 광기를 획득한다/);
    assert.match(embraceAtSix, /체력의 120% 회복/);
    assert.match(embraceAtSix, /공격력의 25%에 해당하는 힘/);
    assert.match(embraceAtSix, /공격력의 50%로 증가한다/);
});

test('확정된 살바도르 1~3돌과 고통의 해소 명칭을 반영한다', () => {
    const salvador = effectsData.salvador;
    const attack = characterEffects.getBreakthroughVariant(salvador.skills.find(skill => skill.name === '타격'), 1);
    const defense = characterEffects.getBreakthroughVariant(salvador.skills.find(skill => skill.name === '방어'), 1);
    const bones = characterEffects.getBreakthroughVariant(salvador.skills.find(skill => skill.name === '축복받은 뼈와 피'), 2);
    const relief = characterEffects.getBreakthroughVariant(salvador.skills.find(skill => skill.name === '고통의 해소'), 2);
    const grace = characterEffects.getBreakthroughVariant(salvador.skills.find(skill => skill.name === '창조주의 은총'), 3);

    assert.match(attack.effect, /용광로 축적량 2마다 피해량이 1 증가/);
    assert.match(defense.effect, /체력의 m%만큼 축적/);
    assert.equal(bones.levels[0]['배아 융합'], '40');
    assert.equal(bones.levels[5]['추가 용광로 축적량 (돌파2)'], '1.5%');
    assert.match(relief.effect, /크리티컬 확률이 25% 증가한다\. 준비1\.$/);
    assert.match(grace.effect, /임시 크리티컬 피해가 35% 증가/);
    assert.doesNotMatch(JSON.stringify(salvador), /마땅한 고통의 소멸/);
});

test('확정된 서 1~3돌과 승인된 카드·선택지 명칭을 반영한다', () => {
    const xu = effectsData.xu;
    const longing = characterEffects.getBreakthroughVariant(xu.skills.find(skill => skill.name === '잊지 못할 그리움'), 1);
    const attack = characterEffects.getBreakthroughVariant(xu.skills.find(skill => skill.name === '타격'), 2);
    const vow = characterEffects.getBreakthroughVariant(xu.skills.find(skill => skill.name === '밤안개 속의 서약'), 3);

    assert.match(longing.effect, /피해 증폭 1%마다 추가로 0\.2% 증가/);
    assert.match(attack.effect, /공명3: 추가로 15 광기를 획득한다/);
    assert.match(vow.effect, /「약속」 또는 「영혼 탈취」/);
    assert.match(vow.effect, /다음에 사용하는 서의 명령 카드의 공명 효과가 2배/);
    assert.doesNotMatch(JSON.stringify(xu), /뼈에 스민 그리움|정혼|탐혼/);
});

test('확정된 소렐 1~3돌은 카드 전문과 계령 전용 효과를 구분한다', () => {
    const sorel = effectsData.sorel;
    const attack = characterEffects.getBreakthroughVariant(sorel.skills.find(skill => skill.name === '타격'), 1);
    const defense = characterEffects.getBreakthroughVariant(sorel.skills.find(skill => skill.name === '방어'), 1);
    const rose = characterEffects.getBreakthroughVariant(sorel.skills.find(skill => skill.name === '장미의 아름다움'), 2);

    assert.match(attack.effect, /피해를 총 2회 입히고/);
    assert.match(defense.effect, /방어막을 총 2회 획득하고/);
    assert.equal(rose.levels[0].피해, '20%');
    assert.equal(rose.levels[5].피해, '40%');
    assert.match(rose.effect, /피해를 입힐 때마다 임시 크리티컬 확률이 5% 증가/);
    assert.match(sorel.enlighten[2].effect, /공격력의 4%만큼 증가/);
});

test('확정된 아그리파 1~3돌은 카드 전문과 레벨 수치를 반영한다', () => {
    const agrippa = effectsData.agrippa;
    const mercy = characterEffects.getBreakthroughVariant(agrippa.skills.find(skill => skill.name === '마지못한 자비'), 1);
    const attack = characterEffects.getBreakthroughVariant(agrippa.skills.find(skill => skill.name === '타격'), 2);
    const paleTurn = characterEffects.getBreakthroughVariant(agrippa.skills.find(skill => skill.name === '창백한 선회'), 3);

    assert.match(mercy.effect, /산출력 소모가 가장 높은 카드 1장/);
    assert.match(attack.effect, /모든 적의 중독을 20% 발동시킨다/);
    assert.equal(paleTurn.levels[0].피해, '22.5%');
    assert.equal(paleTurn.levels[5].피해, '45%');
    assert.match(paleTurn.effect, /사용 후 배아 융합을 20% 증가시킨다/);
});

test('확정된 아이기스 1~3돌은 대상 조건과 카드 회수를 반영한다', () => {
    const aigis = effectsData.aigis;
    const attack = characterEffects.getBreakthroughVariant(aigis.skills.find(skill => skill.name === '타격'), 1);
    const decomposition = characterEffects.getBreakthroughVariant(aigis.skills.find(skill => skill.name === '석질 분해'), 2);
    const wish = characterEffects.getBreakthroughVariant(aigis.skills.find(skill => skill.name === '작은 소원'), 3);

    assert.match(attack.effect, /취약 1스택마다 배아 융합을 5% 증가/);
    assert.match(decomposition.effect, /최종 피해가 5% 증가하며, 최대 500%/);
    assert.match(wish.effect, /버린 카드 더미에서 손패로 가져오고/);
    assert.match(wish.effect, /산출력 소모를 0으로 만든다/);
});

test('혈육 포식 전문은 겹낫표를 유지하고 유우하시 1~3돌을 반영한다', () => {
    const uvhash = effectsData.uvhash;
    const scream = characterEffects.getBreakthroughVariant(uvhash.skills.find(skill => skill.name === '피여, 소리 질러라!'), 1);
    const boil = characterEffects.getBreakthroughVariant(uvhash.skills.find(skill => skill.name === '피여, 끓어올라라!'), 2);
    const hymn = characterEffects.getBreakthroughVariant(uvhash.skills.find(skill => skill.name === '피와 모래의 찬가'), 3);
    const bloodBurstEffects = [
        characterEffects.getBreakthroughVariant(effectsData.leigh.skills.find(skill => skill.name === '아첨의 포옹'), 3).effect,
        characterEffects.getBreakthroughVariant(effectsData.salvador.skills.find(skill => skill.name === '창조주의 은총'), 3).effect,
        effectsData.xu.skills.find(skill => skill.name === '밤안개 속의 서약').effect,
        hymn.effect
    ];

    assert.equal(scream.levels[0].피해, '19.5%');
    assert.equal(boil.levels[5].피해, '32%');
    assert.match(hymn.effect, /적용되는 힘 계수가 2배로 증가한다/);
    bloodBurstEffects.forEach(effect => assert.match(effect, /^【 포식:/));
});

test('확정된 타이스 1~3돌은 선택 효과와 복제 비용 및 힘 획득을 반영한다', () => {
    const thais = effectsData.thais;
    const caress = characterEffects.getBreakthroughVariant(thais.skills.find(skill => skill.name === '고대의 애무'), 1);
    const instinct = characterEffects.getBreakthroughVariant(thais.skills.find(skill => skill.name === '성혈의 본능'), 1);
    const ritual = characterEffects.getBreakthroughVariant(thais.skills.find(skill => skill.name === '풍요의 의식'), 2);
    const attack = characterEffects.getBreakthroughVariant(thais.skills.find(skill => skill.name === '타격'), 3);
    const defense = characterEffects.getBreakthroughVariant(thais.skills.find(skill => skill.name === '방어'), 3);

    assert.equal(caress.levels[0].힘, '4.5%');
    assert.equal(caress.levels[5].힘, '9%');
    assert.match(instinct.effect, /배아 융합을 40% 증가시킨다/);
    assert.match(instinct.effect, /2턴 취약.*2턴 허약/s);
    assert.match(ritual.effect, /^【 포식:/);
    assert.match(ritual.effect, /원본보다 산출력 소모가 2 감소한 복제 카드 2장/);
    assert.match(attack.effect, /공격력의 3%에 해당하는 힘/);
    assert.match(defense.effect, /공격력의 3%에 해당하는 힘/);
    assert.match(thais.enlighten[2].effect, /혈육 영역이 매 턴 자동으로 회복하는 배아 융합이 50% 증가/);
});

test('확정된 파인트 1·2돌은 카드 전문에 표시하고 3돌은 계령에만 둔다', () => {
    const faint = effectsData.faint;
    const attack = characterEffects.getBreakthroughVariant(faint.skills.find(skill => skill.name === '타격'), 1);
    const defense = characterEffects.getBreakthroughVariant(faint.skills.find(skill => skill.name === '방어'), 2);

    assert.match(attack.effect, /피해를 2회 입히고/);
    assert.match(attack.effect, /입힌 피해의 50%에 해당하는 임시 반격/);
    assert.equal(defense.levels[0].방어막, '12.5%');
    assert.equal(defense.levels[5].방어막, '25%');
    assert.match(defense.effect, /획득한 방어막과 동일한 양의 반격/);
    assert.equal(faint.skills.some(skill => skill.breakthroughs?.some(item => item.stage === 3)), false);
    assert.match(faint.enlighten[2].effect, /죽음 저항이 발동한 횟수마다 이 고정 피해가 25% 증가/);
});

test('확정된 픽맨 1돌은 기본 카드에 표시하고 2·3돌은 계령에만 둔다', () => {
    const pickman = effectsData.pickman;
    const attack = characterEffects.getBreakthroughVariant(pickman.skills.find(skill => skill.name === '타격'), 1);
    const defense = characterEffects.getBreakthroughVariant(pickman.skills.find(skill => skill.name === '방어'), 1);

    assert.match(attack.effect, /출전 각성체의 「스킬」 1장을 뽑는다/);
    assert.match(defense.effect, /이 효과는 매 턴 최대 1회 발동한다/);
    assert.equal(pickman.skills.some(skill => skill.breakthroughs?.some(item => item.stage >= 2)), false);
    assert.match(pickman.enlighten[1].effect, /「고급 각인」.*「황금 유물」/);
    assert.match(pickman.enlighten[2].effect, /광기 폭발을 최대 2회 사용할 수 있다/);
});

test('확정된 혈쇄·히로 1~3돌은 실제로 변경되는 카드에만 표시한다', () => {
    const helot = effectsData.helot_catena;
    const attack = characterEffects.getBreakthroughVariant(helot.skills.find(skill => skill.name === '타격'), 1);
    const defense = characterEffects.getBreakthroughVariant(helot.skills.find(skill => skill.name === '방어'), 3);
    const resentment = characterEffects.getBreakthroughVariant(helot.skills.find(skill => skill.name === '원한 발산'), 2);
    const flail = characterEffects.getBreakthroughVariant(helot.skills.find(skill => skill.name === '피에 굶주린 철구'), 2);
    const chain = characterEffects.getBreakthroughVariant(helot.skills.find(skill => skill.name === '구속의 사슬'), 3);

    assert.match(attack.effect, /임시 크리티컬 확률과 임시 크리티컬 피해가 15% 증가/);
    assert.match(defense.effect, /모든 적의 출혈을 15% 발동/);
    assert.equal(defense.breakthroughs.some(item => item.stage === 3), false);
    assert.match(resentment.effect, /현재 HP가 50% 미만이면 획득하는 힘이 2배/);
    assert.match(flail.effect, /유지\. 준비2\.$/);
    assert.match(chain.effect, /목표의 방어막을 제거한다.*다음 턴에 방어막을 획득할 수 없다/s);
    assert.match(helot.enlighten[2].effect, /전투 시작 시 「불규칙한 형태·혈쇄」 1장/);
});

test('확정된 사야 1~3돌은 인장 공식과 배아 융합 및 우종 후속 효과를 반영한다', () => {
    const saya = effectsData.saya;
    const fleshAtThree = characterEffects.getBreakthroughVariant(saya.skills.find(skill => skill.name === '피어나는 살점'), 3);
    const songAtThree = characterEffects.getBreakthroughVariant(saya.skills.find(skill => skill.name === '사야의 노래'), 3);
    const attack = characterEffects.getBreakthroughVariant(saya.skills.find(skill => skill.name === '타격'), 2);
    const defense = characterEffects.getBreakthroughVariant(saya.skills.find(skill => skill.name === '방어'), 2);

    assert.equal(fleshAtThree.levels[0].침식, '6050%');
    assert.equal(fleshAtThree.levels[5].침식, '12100%');
    assert.match(fleshAtThree.effect, /최대 HP의 0\.5%에 해당하는 침식/);
    assert.match(fleshAtThree.effect, /검은 인장 드롭률 1%마다 침식 부여량이 추가로 0\.5% 증가/);
    assert.equal(songAtThree.levels[0].방어막, '136.5%');
    assert.match(songAtThree.effect, /^【 포식:/);
    assert.match(songAtThree.effect, /우종 1스택을 소모할 때마다.*추가로 카드 1장을 뽑는다/s);
    assert.match(attack.effect, /배아 융합을 15 증가시킨다/);
    assert.match(defense.effect, /증가량이 최대 100% 증가한다/);
});

test('확정된 히로 2·3돌은 기본 카드에 표시하고 계령 원문 구조를 유지한다', () => {
    const helot = effectsData.helot;
    const attack = characterEffects.getBreakthroughVariant(helot.skills.find(skill => skill.name === '타격'), 3);
    const defense = characterEffects.getBreakthroughVariant(helot.skills.find(skill => skill.name === '방어'), 2);

    assert.match(attack.effect, /히로의 크리티컬 피해가 10% 증가한다/);
    assert.match(defense.effect, /히로의 임시 크리티컬 확률이 25% 증가한다/);
    assert.equal(helot.derivedCards.find(card => card.name === '불규칙한 형태').breakthroughs, undefined);
    assert.match(helot.enlighten[0].effect, /^전투 시작 시,/);
    assert.match(helot.enlighten[1].effect, /^'방어' 사용 시/);
    assert.equal(helot.enlighten[2].effect, '「타격」 사용 시, 히로의 크리티컬 피해가 10% 증가한다.');
});

test('확정된 다포딜 1돌은 기본 카드에 표시하고 2·3돌은 계령에만 둔다', () => {
    const dafoodil = effectsData.dafoodil;
    const attack = characterEffects.getBreakthroughVariant(dafoodil.skills.find(skill => skill.name === '타격'), 1);
    const defense = characterEffects.getBreakthroughVariant(dafoodil.skills.find(skill => skill.name === '방어'), 1);

    assert.match(attack.effect, /200%의 힘 계수.*워프: 산출력 1/s);
    assert.match(defense.effect, /공격력의 1%에 해당하는 힘.*워프: 산출력 1/s);
    assert.equal(dafoodil.skills.some(skill => skill.breakthroughs?.some(item => item.stage >= 2)), false);
    assert.match(dafoodil.enlighten[1].effect, /모든 각성체의 크리티컬 확률이 영구적으로 5% 증가/);
    assert.match(dafoodil.enlighten[2].effect, /매 턴 최대 5회 발동/);
});

test('확정된 리즈 1~3돌은 실제 효과가 변하는 카드에만 표시한다', () => {
    const liz = effectsData.liz;
    const greenFlame = liz.skills.find(skill => skill.name === '녹염');
    const decayed = characterEffects.getBreakthroughVariant(liz.skills.find(skill => skill.name === '부패 녹염'), 1);
    const extinct = liz.skills.find(skill => skill.name === '사멸 녹염');
    const attack = characterEffects.getBreakthroughVariant(liz.skills.find(skill => skill.name === '타격'), 2);
    const defense = characterEffects.getBreakthroughVariant(liz.skills.find(skill => skill.name === '방어'), 2);
    const dance = characterEffects.getBreakthroughVariant(liz.skills.find(skill => skill.name === '죽음을 고하는 춤'), 3);

    assert.equal(greenFlame.breakthroughs, undefined);
    assert.equal(extinct.breakthroughs, undefined);
    assert.match(decayed.effect, /턴 종료 시 손패 또는 초차원 공간에 있으면 「사멸 녹염」/);
    assert.match(attack.effect, /입힌 피해의 50%에 해당하는 중독/);
    assert.match(defense.effect, /모든 적의 중독을 25% 발동/);
    assert.match(dance.effect, /카드 2장을 버릴 때마다 카드 1장을 뽑는다/);
});

test('확정된 윙클 1~3돌은 반격 계수와 추가 드로우 및 광기 폭발 횟수를 반영한다', () => {
    const winkle = effectsData.winkle;
    const attack = characterEffects.getBreakthroughVariant(winkle.skills.find(skill => skill.name === '타격'), 1);
    const beam = characterEffects.getBreakthroughVariant(winkle.skills.find(skill => skill.name === '에너지 광선'), 1);
    const rebuild = characterEffects.getBreakthroughVariant(winkle.skills.find(skill => skill.name === '정신 재건'), 2);
    const transfer = characterEffects.getBreakthroughVariant(winkle.skills.find(skill => skill.name === '형태 없는 전이'), 3);

    assert.match(attack.effect, /50%의 반격 계수/);
    assert.match(beam.effect, /워프:.*광기를 획득한다\. 이 피해에는 50%의 반격 계수가 적용된다/s);
    assert.match(rebuild.effect, /워프: 손패를 버리지 않고 카드 2장을 뽑으며/);
    assert.equal(rebuild.levels[0]['추가 방어막 (돌파2)'], '5%');
    assert.equal(rebuild.levels[5]['추가 방어막 (돌파2)'], '10%');
    assert.equal(transfer.levels[0].방어막, '40%');
    assert.equal(transfer.levels[5].반격, '100%');
    assert.match(transfer.effect, /광기 폭발을 최대 2회 사용할 수 있다/);
    assert.match(winkle.enlighten[1].effect, /추가로 카드 1장을 뽑는다/);
});

test('에리카의 기능 과부하는 X 비용과 레벨 수치 및 3돌 워프 효과를 표시한다', () => {
    const overload = effectsData.erica.skills.find(skill => skill.name === '기능 과부하');
    const overloadAtThree = characterEffects.getBreakthroughVariant(overload, 3);

    assert.equal(overload.type, '명령');
    assert.equal(overload.cost.value, 'X');
    assert.equal(overload.levels[0].피해, '22.5%');
    assert.equal(overload.levels[5].방어막, '15%');
    assert.match(overload.effect, /짝수이면.*X\+2회.*홀수이면.*X\+1회/s);
    assert.match(overloadAtThree.effect, /워프: 피해와 방어막 효과를 모두 발동한다/);
});

test('확정된 에리카 1·2돌은 생성 카드와 전자기 폭발에 연결한다', () => {
    const erica = effectsData.erica;
    const deploy = characterEffects.getBreakthroughVariant(erica.skills.find(skill => skill.name === '기계 무장-전개'), 1);
    const retrieve = characterEffects.getBreakthroughVariant(erica.skills.find(skill => skill.name === '기계 무장-회수'), 1);
    const burst = characterEffects.getBreakthroughVariant(erica.skills.find(skill => skill.name === '전자기 폭발'), 2);

    assert.match(deploy.effect, /에리카의 n레벨 「타격」 1장을 손패에 추가/);
    assert.match(retrieve.effect, /에리카의 n레벨 「방어」 1장을 손패에 추가/);
    assert.match(burst.effect, /100%의 힘 계수와 100%의 경계 계수/);
    assert.equal(erica.skills.find(skill => skill.name === '타격').breakthroughs, undefined);
    assert.equal(erica.skills.find(skill => skill.name === '방어').breakthroughs, undefined);
});

test('확정된 오를라 1~3돌은 시편별 상태와 공통 유지 및 감정 강화를 반영한다', () => {
    const horla = effectsData.horla;
    const rage = characterEffects.getBreakthroughVariant(horla.skills.find(skill => skill.name === '광상의 시편'), 2);
    const sorrow = characterEffects.getBreakthroughVariant(horla.skills.find(skill => skill.name === '애통의 시편'), 2);
    const joy = characterEffects.getBreakthroughVariant(horla.skills.find(skill => skill.name === '환몽의 시편'), 2);
    const fear = characterEffects.getBreakthroughVariant(horla.skills.find(skill => skill.name === '기묘한 시편'), 2);
    const finale = characterEffects.getBreakthroughVariant(horla.skills.find(skill => skill.name === '화려한 장편'), 3);

    assert.match(rage.effect, /모든 적에게 1턴 취약.*유지\.$/s);
    assert.match(sorrow.effect, /모든 적에게 1턴 허약.*유지\.$/s);
    assert.match(joy.effect, /유지\.$/);
    assert.match(fear.effect, /유지\.$/);
    assert.match(finale.effect, /현재 감정에 대응하는 효과가 250% 증가/);
    assert.match(finale.effect, /분노:.*슬픔:.*기쁨:.*공포:/s);
    assert.equal(horla.skills.filter(skill => skill.breakthroughs?.some(item => item.stage === 3)).length, 1);
});

test('확정된 완다 1·2돌은 크리티컬과 몽인 소모 강화를 카드별로 반영한다', () => {
    const wanda = effectsData.wanda;
    const guardian = characterEffects.getBreakthroughVariant(wanda.skills.find(skill => skill.name === '방황의 수호자'), 2);
    const chain = characterEffects.getBreakthroughVariant(wanda.skills.find(skill => skill.name === '가시 사슬'), 2);
    const city = characterEffects.getBreakthroughVariant(wanda.skills.find(skill => skill.name === '꿈속 죽음의 도시'), 2);

    assert.equal(guardian.levels[0].반격, '30%');
    assert.equal(guardian.levels[5]['추가 반격'], '100%');
    assert.match(guardian.effect, /기본 반격이 20% 증가/);
    assert.match(chain.effect, /크리티컬 확률이 25% 증가/);
    assert.equal(chain.levels[0]['힘 감소'], '2.5%');
    assert.equal(chain.levels[5]['힘 감소'], '5%');
    assert.equal(city.levels[0]['광기 (깊은 잠의 반격)'], '25');
    assert.match(city.effect, /입히는 피해가 65% 감소/);
    assert.equal(wanda.skills.some(skill => skill.breakthroughs?.some(item => item.stage === 3)), false);
});

test('확정된 젠킨 1~3돌은 발동 주체 카드에만 전문을 연결한다', () => {
    const jenkin = effectsData.jenkin;
    const brown = characterEffects.getBreakthroughVariant(jenkin.skills.find(skill => skill.name === '브라운 출동!'), 1);
    const defense = characterEffects.getBreakthroughVariant(jenkin.skills.find(skill => skill.name === '방어'), 2);
    const children = characterEffects.getBreakthroughVariant(jenkin.skills.find(skill => skill.name === '안개 도시 거리의 아이들'), 3);
    const rush = jenkin.derivedCards.find(card => card.name === '쥐 떼 돌격');

    assert.match(brown.effect, /「쥐 떼 돌격」의 기본 피해가 공격력의 n%만큼 증가/);
    assert.match(defense.effect, /카드 2장을 뽑고.*젠킨의 카드가 아니면 버린다/s);
    assert.match(children.effect, /「브라운 출동!」 4장을 손패에 추가/);
    assert.equal(rush.breakthroughs, undefined);
});

test('확정된 카스토르 2돌은 변경되는 두 카드에만 연결하고 1·3돌은 계령에 둔다', () => {
    const castor = effectsData.castor;
    const night = characterEffects.getBreakthroughVariant(castor.skills.find(skill => skill.name === '끝없는 밤을 지나'), 2);
    const sun = characterEffects.getBreakthroughVariant(castor.skills.find(skill => skill.name === '태양을 가리는 깃털'), 2);
    const feather = castor.derivedCards.find(card => card.name === '검은 깃털');

    assert.match(night.effect, /「검은 깃털」을 1장 사용할 때마다.*산출력 소모가 1 감소/s);
    assert.match(sun.effect, /손패에 있는 「검은 깃털」 1장마다 5 광기/);
    assert.equal(feather.breakthroughs, undefined);
    assert.match(castor.enlighten[0].effect, /전투 시작 시 「검은 깃털」 1장/);
    assert.match(castor.enlighten[2].effect, /「검은 깃털」을 3장 사용할 때마다/);
});

test('확정된 카시아 1~3돌은 추가 광기와 드로우 대상 및 여파를 반영한다', () => {
    const casiah = effectsData.casiah;
    const vanish = characterEffects.getBreakthroughVariant(casiah.skills.find(skill => skill.name === '사라지는 마술!'), 1);
    const carnival = characterEffects.getBreakthroughVariant(casiah.skills.find(skill => skill.name === '마술 카니발'), 2);
    const grasp = characterEffects.getBreakthroughVariant(casiah.skills.find(skill => skill.name === '허공 집기'), 3);

    assert.match(vanish.effect, /카드 1장을 뽑을 때마다 3 광기/);
    assert.match(carnival.effect, /카드 4장을 뽑는다/);
    assert.match(carnival.effect, /명령 카드, 증상 카드 또는 상태 카드/);
    assert.match(grasp.effect, /여파: 「영감」 1장을 드로우 덱에 섞는다/);
});

test('확정된 클레멘타인 1·2돌은 생체 재구성에 연결하고 3돌은 계령에만 둔다', () => {
    const clementine = effectsData.clementine;
    const reconstruction = clementine.skills.find(skill => skill.name === '생체 재구성');
    const stage1 = characterEffects.getBreakthroughVariant(reconstruction, 1);
    const stage2 = characterEffects.getBreakthroughVariant(reconstruction, 2);

    assert.equal(stage1.levels[0].피해, '180%');
    assert.equal(stage2.levels[0]['은열쇠 에너지'], '350%');
    assert.match(stage2.effect, /제거한 공감 1스택마다 이번 전투에서 클레멘타인이 입히는 기본 피해가 3% 증가한다/);
    assert.equal(reconstruction.breakthroughs.some(item => item.stage === 3), false);
    assert.match(clementine.enlighten[2].effect, /두려움 고착의 스택 상한/);
});

test('확정된 틴커트 1~3돌은 타격·방어와 크리티컬 강화 카드에 연결한다', () => {
    const tinct = effectsData.tinct;
    const attack = characterEffects.getBreakthroughVariant(tinct.skills.find(skill => skill.name === '타격'), 1);
    const defense = characterEffects.getBreakthroughVariant(tinct.skills.find(skill => skill.name === '방어'), 2);
    const melody = characterEffects.getBreakthroughVariant(tinct.skills.find(skill => skill.name === '서서히 퍼지는 선율'), 3);
    const aurora = characterEffects.getBreakthroughVariant(tinct.skills.find(skill => skill.name === '별빛의 오로라'), 3);

    assert.match(attack.effect, /피해를 2회.*워프: 추가로 1회 피해/s);
    assert.match(defense.effect, /방어막을 2회.*워프: 광기를 2배/s);
    assert.match(melody.effect, /크리티컬 확률과 크리티컬 피해가 각각 15%.*각각 45%/s);
    assert.match(aurora.effect, /임시 크리티컬 확률과 크리티컬 피해가 각각 15%/);
});

test('확정된 폴룩스 2·3돌은 광기와 성심 후속 효과에 연결하고 1돌은 계령에 둔다', () => {
    const pollux = effectsData.pollux;
    const attack = characterEffects.getBreakthroughVariant(pollux.skills.find(skill => skill.name === '타격'), 2);
    const defense = characterEffects.getBreakthroughVariant(pollux.skills.find(skill => skill.name === '방어'), 2);
    const devotion = pollux.derivedCards.find(card => card.name === '성심');
    const stage2 = characterEffects.getBreakthroughVariant(devotion, 2);
    const stage3 = characterEffects.getBreakthroughVariant(devotion, 3);

    assert.match(attack.effect, /손패 1장마다 추가로 1 광기/);
    assert.match(defense.effect, /손패 1장마다 추가로 1 광기/);
    assert.match(stage2.effect, /다음에 사용하는 '부정의 심판'의 산출력 소모가 1 감소/);
    assert.match(stage3.effect, /'고통 구원' 효과가 적용되며 추가로 1회 더 발동/);
    assert.equal(pollux.skills.some(skill => skill.breakthroughs?.some(item => item.stage === 1)), false);
    assert.doesNotMatch(pollux.enlighten[1].effect, /먼지에서의 심판/);
});

test('확정된 아라크네 1~3돌은 광기 폭발과 운명 재단 및 특이점 프리즘에 연결한다', () => {
    const arachne = effectsData.arachne;
    const burst = characterEffects.getBreakthroughVariant(arachne.skills.find(skill => skill.name === '운명, 이로써 고하노라'), 1);
    const loom = characterEffects.getBreakthroughVariant(arachne.skills.find(skill => skill.name === '영겁의 베틀'), 2);
    const thread = characterEffects.getBreakthroughVariant(arachne.skills.find(skill => skill.name === '운명을 얽는 실'), 2);
    const endless = characterEffects.getBreakthroughVariant(arachne.derivedCards.find(card => card.name === '끝없는 실타래'), 3);

    assert.equal(burst.levels[0]['피해 증폭'], '93.75%');
    assert.match(burst.effect, /특이점 도약:.*직명 1스택/s);
    assert.equal(loom.levels[0]['운명 재단'], '450%');
    assert.match(thread.effect, /준비1, 유지/);
    assert.match(endless.effect, /임시 특이점 프리즘 10스택/);
});

test('확정된 돌 1~3돌은 회복량과 허약·방어막·광기 대상을 반영한다', () => {
    const doll = effectsData.doll;
    const surgery = characterEffects.getBreakthroughVariant(doll.skills.find(skill => skill.name === '외부 수술'), 1);
    const exchange = characterEffects.getBreakthroughVariant(doll.skills.find(skill => skill.name === '등가 교환'), 2);
    const reality = characterEffects.getBreakthroughVariant(doll.skills.find(skill => skill.name === '이성, 진리와 현실'), 3);

    assert.equal(surgery.levels[0].회복, '20%');
    assert.match(surgery.effect, /모든 적에게 2턴 허약/);
    assert.equal(exchange.levels[0]['기본 회복'], '30%');
    assert.match(exchange.effect, /추가로 회복한 HP와 같은 양의 방어막/);
    assert.equal(reality.levels[0].회복, '40%');
    assert.match(reality.effect, /모든 각성체가 n 광기를 획득한다/);
});

test('확정된 라모나 1~3돌은 여왕의 검 기본 효과와 계령 효과를 분리해 반영한다', () => {
    const ramona = effectsData.ramona;
    const queen = ramona.skills.find(skill => skill.name === '여왕의 검');
    const stage1 = characterEffects.getBreakthroughVariant(queen, 1);
    const analysis = characterEffects.getBreakthroughVariant(ramona.skills.find(skill => skill.name === '공격 분석'), 2);
    const deduction = characterEffects.getBreakthroughVariant(ramona.skills.find(skill => skill.name === '세계 연역법'), 3);

    assert.equal(queen.effect, '공격력의 n%에 해당하는 피해를 3회 입힌다.');
    assert.match(stage1.effect, /피해 횟수가 1회 증가하며, 최대 6회/);
    assert.match(stage1.effect, /여파: 카드를 사용했을 때와 같은 양의 은열쇠 에너지/);
    assert.equal(stage1.levels[0]['임시 힘'], '2.5%');
    assert.match(analysis.effect, /뽑은 카드의 산출력 소모 1마다 은열쇠 에너지를 35/);
    assert.match(deduction.effect, /'영감' 1장을 드로우 덱에 섞는다/);
});

test('확정된 로탄 1~3돌은 타격 판정과 힘 및 혼돈의 짐승을 반영한다', () => {
    const lotan = effectsData.lotan;
    const attack = characterEffects.getBreakthroughVariant(lotan.skills.find(skill => skill.name === '타격'), 1);
    const blade = characterEffects.getBreakthroughVariant(lotan.skills.find(skill => skill.name === '반항의 칼날'), 1);
    const wave = characterEffects.getBreakthroughVariant(lotan.skills.find(skill => skill.name === '난폭한 물결'), 2);
    const beast = characterEffects.getBreakthroughVariant(lotan.skills.find(skill => skill.name === '혼돈의 짐승'), 3);

    assert.equal(attack.levels[0].피해, '13%');
    assert.match(blade.effect, /^'타격'으로 간주된다/);
    assert.equal(wave.levels[0].힘, '5%');
    assert.match(wave.effect, /^'타격'으로 간주된다/);
    assert.match(beast.effect, /피해를 2회 입힌다/);
    assert.match(beast.effect, /소모와 공허가 부여된 '타격' 2장/);
});

test('확정된 오지에 1~3돌과 기본 카드명·비용을 인게임 전문대로 반영한다', () => {
    const ogier = effectsData.ogier;
    const barrier = ogier.skills.find(skill => skill.name === '부정형 장벽');
    const stage3 = characterEffects.getBreakthroughVariant(barrier, 3);
    const spear = characterEffects.getBreakthroughVariant(ogier.skills.find(skill => skill.name === '관통의 창'), 1);
    const virtues = characterEffects.getBreakthroughVariant(ogier.skills.find(skill => skill.name === '일곱 덕목, 미덕의 전승'), 2);

    assert.equal(ogier.skills.some(skill => skill.name === '천공의 창'), false);
    assert.equal(barrier.cost.value, 'X');
    assert.match(barrier.effect, /방어막을 X\+1회 획득한다/);
    assert.match(stage3.effect, /공격력의 m%만큼 힘을 획득한다/);
    assert.equal(stage3.levels[3].힘, '6.4%');
    assert.match(spear.effect, /2턴 취약.*3배의 힘 계수/s);
    assert.match(virtues.effect, /손상 상태.*방어막을 추가로 획득/s);
    assert.match(virtues.effect, /취약 상태라면.*추가로 33%/s);
    assert.match(ogier.enlighten[0].effect, /힘 배수가 1 증가한다/);
    assert.match(characterEffects.interpolateEffect(stage3.effect, stage3.levels, 6), /방어력의 28\.6%.*공격력의 8%/s);
    assert.match(characterEffects.interpolateEffect(virtues.effect, virtues.levels, 6), /방어력의 72%.*공격력의 36%.*방어력의 24%/s);
});

test('누락된 광기 폭발 직접 영향 계령을 실제 광기 폭발 전문에 연결한다', () => {
    const timeworn = effectsData.ramona_timeworn;
    const convergence = characterEffects.getBreakthroughVariant(timeworn.skills.find(skill => skill.name === '패러독스 수렴'), 3);
    const cetarchon = effectsData.lotan_cetarchon;
    const boundary = characterEffects.getBreakthroughVariant(cetarchon.skills.find(skill => skill.name === '경계를 베는 검'), 3);

    assert.match(convergence.effect, /잠금 해제된 은열쇠 1개를 선택하여, 사용하거나 전투 종료 시까지 현재 은열쇠를 대체한다/);
    assert.match(timeworn.enlighten[2].effect, /잠금 해제된 은열쇠/);
    assert.match(boundary.effect, /피해가 \+150pt 증가한다/);
    assert.doesNotMatch(boundary.effect, /첫 번째 「침멸」/);
    assert.match(cetarchon.enlighten[2].effect, /첫 번째 「침멸」은 행동력을 소모하지 않는다/);
});

test('초월 폭발은 스킬과 계령 양쪽에서 같은 데이터 객체를 사용한다', () => {
    const normalSkill = { type: '스킬', name: '일반 스킬' };
    const transcendentBurst = { type: '초월 폭발', name: '초월 능력' };
    const finalLaw = { type: '최종 법칙', name: '최종 법칙 능력' };
    const breakthrough = { name: '계령 1' };

    const result = classifyCharacterEffects({
        skills: [normalSkill],
        enlighten: [breakthrough, transcendentBurst, finalLaw]
    });

    assert.deepEqual(result.skills, [normalSkill, transcendentBurst]);
    assert.deepEqual(result.enlighten, [breakthrough]);
    assert.deepEqual(result.enlightenSkills, [transcendentBurst, finalLaw]);
    assert.equal(result.skills[1], result.enlightenSkills[0]);
});

test('최종 법칙은 계령에만 표시한다', () => {
    const finalLaw = { type: '최종 법칙', name: '최종 법칙 능력' };
    const result = classifyCharacterEffects({ skills: [finalLaw] });

    assert.equal(result.skills.length, 0);
    assert.deepEqual(result.enlightenSkills, [finalLaw]);
});

test('일반 문장의 승인 키워드도 굵은 툴팁으로 변환한다', () => {
    characterEffects.configureTooltips({
        '관통 피해': '설명',
        '죽음 저항': '설명'
    });

    const result = characterEffects.renderRichText('관통 피해를 입히고 죽음 저항이 증가한다.');

    assert.match(result, /data-keyword="관통 피해"[^>]*>.*<span>관통 피해<\/span><\/strong>를/);
    assert.match(result, /data-keyword="죽음 저항"[^>]*>.*<span>죽음 저항<\/span><\/strong>이/);
});

test('이미 대괄호가 있는 키워드는 중복 대괄호를 만들지 않는다', () => {
    characterEffects.configureTooltips({ '중독': '설명' });

    const result = characterEffects.renderRichText('[중독]을 부여한다.');

    assert.equal((result.match(/data-keyword="중독"/g) || []).length, 1);
    assert.doesNotMatch(result, /\[\[중독\]\]/);
    assert.doesNotMatch(result, />\[중독\]</);
});

test('키워드는 대괄호 없이 굵게 표시한다', () => {
    characterEffects.configureTooltips({ '관통 피해': '설명' });

    const result = characterEffects.renderRichText('[관통 피해]를 입힌다.');

    assert.match(result, /<strong class="tooltip-trigger keyword-iconized"[^>]*>.*<span>관통 피해<\/span><\/strong>/);
    assert.doesNotMatch(result, /\[관통 피해\]/);
});

test('소모할 때마다의 소모는 일반 문장으로 표시한다', () => {
    characterEffects.configureTooltips({ '소모': '설명' });

    const bareResult = characterEffects.renderRichText('카드를 소모할 때마다 힘을 얻는다.');
    const bracketResult = characterEffects.renderRichText('카드를 [소모]할 때마다 힘을 얻는다.');

    assert.doesNotMatch(bareResult, /data-keyword="소모"/);
    assert.doesNotMatch(bracketResult, /data-keyword="소모"/);
    assert.match(bracketResult, /카드를 소모할 때마다/);
});

test('산출력 소모의 소모는 키워드 툴팁으로 표시하지 않는다', () => {
    characterEffects.configureTooltips({ '소모': '설명' });

    const bareResult = characterEffects.renderRichText('산출력 소모를 0으로 한다. 카드는 소모된다.');
    const bracketResult = characterEffects.renderRichText('산출력 [소모]를 0으로 한다.');

    assert.equal((bareResult.match(/data-keyword="소모"/g) || []).length, 0);
    assert.doesNotMatch(bracketResult, /data-keyword="소모"/);
    assert.match(bareResult, /산출력 소모를 0으로 한다/);
    assert.match(bracketResult, /산출력 소모를 0으로 한다/);
});

test('비용과 일반 동사로 쓰인 소모는 툴팁에서 제외한다', () => {
    characterEffects.configureTooltips({ 소모: '설명' });
    const result = characterEffects.renderRichText(
        '행동력 소모가 감소한다. 광기 10을 소모한다. 카드를 소모하여 발동한다. 대검을 소모해야 발동할 수 있다.'
    );

    assert.doesNotMatch(result, /data-keyword="소모"/);
});

test('카드 속성으로 쓰인 소모만 툴팁으로 표시한다', () => {
    characterEffects.configureTooltips({ 소모: '설명', 유지: '설명', 공허: '설명' });
    const result = characterEffects.renderRichText('소모, 유지. 소모가 부여된 카드와 소모와 공허가 부여된 카드를 얻는다.');

    assert.equal((result.match(/data-keyword="소모"/g) || []).length, 3);
});

test('캐릭터명과 카드·스킬명 안의 동음 키워드는 툴팁에서 제외한다', () => {
    const keywords = ['침식', '경계', '준비', '허무', '소멸', '회귀', '힘', '반격', '장벽', '잔해', '사냥'];
    characterEffects.configureTooltips(Object.fromEntries(keywords.map(keyword => [keyword, '설명'])));
    const result = characterEffects.renderRichText(
        '침식 · 로탄, 침식과 감염, 침식하는 색채, 잠재의식의 침식, 경계를 베는 검, 경계 너머의 목소리, ' +
        '출전 준비 완료, 허무의 종언, 고통의 해소, 고대 근원으로의 회귀, 해연의 힘, 동료의 힘, ' +
        '보호의 힘, 힘이 곧 정의, 깊은 잠의 반격, 부정형 장벽, 부패된 잔해, 사냥의 건트, 끝없는 사냥, 영혼 사냥 선언'
    );

    assert.doesNotMatch(result, /data-keyword=/);
});

test('다른 단어 안에 포함된 문자열은 키워드로 처리하지 않는다', () => {
    characterEffects.configureTooltips({ '배아': '설명' });

    const result = characterEffects.renderRichText('번식배아를 획득하고 배아를 추가한다.');

    assert.equal((result.match(/data-keyword="배아"/g) || []).length, 1);
});

test('키워드에 붙은 숫자만 같은 색으로 표시하고 공백 뒤 숫자는 제외한다', () => {
    characterEffects.configureTooltips({ 준비: '설명', 둔화: '설명', 직명: '설명' });
    const result = characterEffects.renderRichText('준비1, [준비 3], 둔화2, [둔화 4], 직명1, 직명 1');

    assert.equal((result.match(/data-keyword="준비"/g) || []).length, 2);
    assert.equal((result.match(/data-keyword="둔화"/g) || []).length, 2);
    assert.equal((result.match(/data-keyword="직명"/g) || []).length, 2);
    assert.match(result, /<span>준비1<\/span><\/strong>/);
    assert.match(result, /<span>준비<\/span><\/strong> 3/);
    assert.match(result, /<span>둔화2<\/span><\/strong>/);
    assert.match(result, /<span>둔화<\/span><\/strong> 4/);
    assert.match(result, /<span>직명1<\/span><\/strong>/);
    assert.match(result, /<span>직명<\/span><\/strong> 1/);
    assert.doesNotMatch(result, /data-keyword="준비\d+"/);
    assert.doesNotMatch(result, /data-keyword="둔화\d+"/);
});

test('초거리는 공용 특수 아이콘과 승인된 툴팁을 사용한다', () => {
    characterEffects.configureTooltips({ 초거리: '설명', 워프: '설명' });
    const result = characterEffects.renderRichText('초거리 : 후속 효과를 발동한다. 워프 : 추가 효과를 발동한다.');

    assert.match(result, /data-keyword="초거리"[^>]*>.*special\.png/);
    assert.match(result, /data-keyword="워프"[^>]*>.*special\.png/);
});

test('임시와 영구는 별도 키워드가 아니며 핵심 단어에만 툴팁을 표시한다', () => {
    characterEffects.configureTooltips({ 힘: '설명', 반격: '설명' });
    const result = characterEffects.renderRichText('임시 힘, 영구 힘, 임시 반격, 영구 반격');

    assert.equal((result.match(/data-keyword="힘"/g) || []).length, 2);
    assert.equal((result.match(/data-keyword="반격"/g) || []).length, 2);
    assert.doesNotMatch(result, /data-keyword="(?:임시|영구)/);
    assert.match(result, /<span>임시 힘<\/span>/);
    assert.match(result, /<span>영구 반격<\/span>/);
});

test('고정 중독·반격·힘은 문구 전체를 표시하고 기본 키워드 설명을 사용한다', () => {
    characterEffects.configureTooltips({ 중독: '중독 설명', 반격: '반격 설명', 힘: '힘 설명' });
    const result = characterEffects.renderRichText('고정 중독, 고정 반격, 고정 힘');

    assert.match(result, /data-keyword="중독"[^>]*>.*<span>고정 중독<\/span><\/strong>/);
    assert.match(result, /data-keyword="반격"[^>]*>.*<span>고정 반격<\/span><\/strong>/);
    assert.match(result, /data-keyword="힘"[^>]*>.*<span>고정 힘<\/span><\/strong>/);
    assert.doesNotMatch(result, /data-keyword="고정 (?:중독|반격|힘)"/);
});

test('차원 이동과 특이점 계열은 같은 전용 아이콘을 사용한다', () => {
    characterEffects.configureTooltips({
        '차원 이동': '설명', '특이점 프리즘': '설명', '특이점 도약': '설명', '특이점 신호': '설명',
        제의: '설명', 의식: '설명'
    });
    const result = characterEffects.renderRichText(
        '차원 이동, 특이점 프리즘, 특이점 도약, 특이점 신호. 제의 또는 의식을 사용한다.'
    );

    assert.match(result, /data-keyword="차원 이동"[^>]*>.*dimensional-travel\.png/);
    assert.equal((result.match(/dimensional-travel\.png/g) || []).length, 4);
    assert.equal((result.match(/special\.png/g) || []).length, 2);
});

test('임시 특이점 프리즘은 임시를 색상 범위에서 제외한다', () => {
    characterEffects.configureTooltips({ '특이점 프리즘': '설명' });
    const bareResult = characterEffects.renderRichText('임시 특이점 프리즘 5스택');
    const bracketResult = characterEffects.renderRichText('[임시 특이점 프리즘] 5스택');

    assert.match(bareResult, /임시 <strong[^>]*data-keyword="특이점 프리즘"[^>]*>.*<span>특이점 프리즘<\/span><\/strong> 5/);
    assert.match(bracketResult, /임시 <strong[^>]*data-keyword="특이점 프리즘"[^>]*>.*<span>특이점 프리즘<\/span>/);
    assert.doesNotMatch(bareResult, /<span>임시 특이점 프리즘/);
    assert.doesNotMatch(bracketResult, /<span>임시 특이점 프리즘/);
});

test('광상이 포함된 카드 이름은 광상 키워드로 처리하지 않는다', () => {
    characterEffects.configureTooltips({ 광상: '설명' });
    const result = characterEffects.renderRichText("월하의 광상곡과 '광상의 시편', 광상 1스택");

    assert.equal((result.match(/data-keyword="광상"/g) || []).length, 1);
    assert.match(result, /월하의 광상곡/);
    assert.match(result, /광상의 시편/);
});

test('팀·파티 고유 표기는 카드 키워드 고유로 처리하지 않는다', () => {
    characterEffects.configureTooltips({ 고유: '설명' });
    const result = characterEffects.renderRichText('팀 고유, 파티 고유, 이 카드는 고유를 획득한다.');

    assert.equal((result.match(/data-keyword="고유"/g) || []).length, 1);
});

test('회귀·라모나의 이름은 회귀 키워드로 처리하지 않는다', () => {
    characterEffects.configureTooltips({ 회귀: '설명' });
    const result = characterEffects.renderRichText('회귀·라모나의 명령 카드가 회귀 효과를 발동한다.');

    assert.equal((result.match(/data-keyword="회귀"/g) || []).length, 1);
});

test('카드·효과 이름에 포함된 메아리는 키워드로 처리하지 않는다', () => {
    characterEffects.configureTooltips({ 메아리: '설명' });
    const result = characterEffects.renderRichText("'과거의 메아리', '잠결의 메아리', 원초의 메아리, 메아리.");

    assert.equal((result.match(/data-keyword="메아리"/g) || []).length, 1);
});

test('힘 감소는 짧은 키워드 힘보다 우선하여 하나의 툴팁으로 처리한다', () => {
    characterEffects.configureTooltips({ 힘: '힘 설명', '힘 감소': '힘 감소 설명' });
    const result = characterEffects.renderRichText('힘 감소 효과와 힘을 획득한다.');

    assert.equal((result.match(/data-keyword="힘 감소"/g) || []).length, 1);
    assert.equal((result.match(/data-keyword="힘"/g) || []).length, 1);
});

test('힘을 감소시키는 문맥에서는 힘 감소 아이콘과 툴팁을 사용한다', () => {
    characterEffects.configureTooltips({ 힘: '힘 설명', '힘 감소': '힘 감소 설명' });
    const result = characterEffects.renderRichText(
        '힘 을 공격력 20% 획득하고, 목표의 힘 을 임시로 방어력 30% 감소시킨다. 힘을 10% 감소시킨다.'
    );

    assert.equal((result.match(/data-keyword="힘"/g) || []).length, 1);
    assert.equal((result.match(/data-keyword="힘 감소"/g) || []).length, 2);
    assert.equal((result.match(/strength-down\.png/g) || []).length, 2);
    assert.match(result, /data-keyword="힘"[^>]*>.*strength\.png/);
});

test('변경 영역 이름 전체에 통합 툴팁을 적용한다', () => {
    characterEffects.configureTooltips({
        '특이점 · 초차원': '설명',
        '번식 · 혈육': '설명'
    });
    const result = characterEffects.renderRichText(
        '초차원 영역을 특이점 · 초차원 영역으로, 혈육 영역을 번식 · 혈육 영역으로 교체한다.'
    );

    assert.equal((result.match(/data-keyword="특이점 · 초차원"/g) || []).length, 1);
    assert.equal((result.match(/data-keyword="번식 · 혈육"/g) || []).length, 1);
});

test('남은 전용 키워드 아이콘과 공유 관계를 적용한다', () => {
    characterEffects.configureTooltips({
        우종: '설명', 잔해: '설명', 부활: '설명', 둔화: '설명',
        회귀: '설명', 음엔트로피: '설명', '힘 감소': '설명', 직명: '설명',
        공허: '설명', 허무: '설명', 사냥: '설명', '집단 사냥': '설명'
    });
    const result = characterEffects.renderRichText(
        '우종 잔해 부활 둔화 회귀 음엔트로피 힘 감소 직명 공허 허무 사냥 집단 사냥'
    );

    assert.match(result, /praise-seed\.png/);
    assert.match(result, /data-keyword="우종"[^>]*style="--keyword-color:#ffffff"/);
    assert.match(result, /remains\.png/);
    assert.match(result, /revival\.png/);
    assert.match(result, /slow\.png/);
    assert.equal((result.match(/return\.png/g) || []).length, 1);
    assert.equal((result.match(/negative-entropy\.png/g) || []).length, 1);
    assert.match(result, /data-keyword="회귀"[^>]*style="--keyword-color:#ffffff"/);
    assert.match(result, /data-keyword="음엔트로피"[^>]*style="--keyword-color:#ffffff"/);
    assert.match(result, /strength-down\.png/);
    assert.match(result, /weave-fate\.png/);
    assert.match(result, /data-keyword="공허"[^>]*>.*void\.png/);
    assert.match(result, /data-keyword="허무"[^>]*>.*special\.png/);
    assert.equal((result.match(/group-hunt\.png/g) || []).length, 2);
});

test('지연 희생과 은유는 승인된 아이콘을 사용한다', () => {
    characterEffects.configureTooltips({ '지연 희생': '설명', 은유: '설명' });
    const result = characterEffects.renderRichText('지연 희생 2스택과 은유 1스택을 획득한다.');

    assert.match(result, /data-keyword="지연 희생"[^>]*>.*delayed-sacrifice\.png/);
    assert.match(result, /data-keyword="은유"[^>]*>.*special\.png/);
});
