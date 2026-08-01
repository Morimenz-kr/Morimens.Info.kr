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
        '출전 준비 완료, 허무의 종언, 마땅한 고통의 소멸, 고대 근원으로의 회귀, 해연의 힘, 동료의 힘, ' +
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
