const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const wheels = JSON.parse(fs.readFileSync(path.join(__dirname, '../data/wheel_list.json'), 'utf8'));
const byId = new Map(wheels.map(wheel => [wheel.english_name, wheel]));
const description = id => byId.get(id).description;

test('명륜 제련 수치는 네 단계의 실제 계수를 표시한다', () => {
    const cases = [
        ['wheel_doomsday_rampage', '13/17/21/25%'],
        ['wheel_power_of_faith', '기초 크리티컬 피해 11/14/17/20%'],
        ['wheel_man_in_mirror', '1.5/2/2.5/3%'],
        ['wheel_light_of_intellect', '55/70/85/100% 확률'],
        ['wheel_door_of_truth', '200/300/400/500%'],
        ['wheel_comming_sun', '11/14/17/20%의 임시 크리티컬 확률'],
        ['wheel_lotan_cetarchon_sr', '20/30/40/50%']
    ];
    for (const [id, expected] of cases) assert.ok(description(id).includes(expected), id);
    assert.equal(byId.get('wheel_light_of_intellect').main_stat, '죽음 저항 25.2%');
});

test('성화 속 길잡이의 죽음 저항 회복량은 실행식의 고정 25%를 표시한다', () => {
    assert.match(description('wheel_guide_in_the_torch'), /다음 턴 시작 시 최대 HP의 25%를 회복/);
    assert.doesNotMatch(description('wheel_guide_in_the_torch'), /13\/17\/21/);
});

test('영혼의 탄생과 은빛 물고기는 독립 횟수와 공유 횟수를 구분한다', () => {
    assert.match(description('wheel_birth_of_soul'), /매 턴 각각 최대 1회/);
    assert.match(description('wheel_silver_fish'), /매 턴 합계 최대 5회/);
});

test('삼켜진 자장가는 죽음 저항 후 요람 2스택과 배아 융합 획득을 표시한다', () => {
    const text = description('wheel_swallowed_lullaby');
    assert.match(text, /'요람'을 2스택 획득/);
    assert.match(text, /죽음 저항 발동 후 배아 융합이 13\/17\/21\/25% 증가/);
    assert.doesNotMatch(text, /100%에 도달|배아.*효과가/);
});

test('능동 피해 발동 조건과 생성 카드 속성 및 재사용 제한을 보존한다', () => {
    for (const id of ['wheel_power_of_faith', 'wheel_pathless_path',
        'wheel_critical_point', 'wheel_eternal_requiem', 'wheel_silver_fish']) {
        assert.match(description(id), /능동 피해/, id);
    }
    assert.match(description('wheel_eternal_requiem'), /파괴가 부여된/);
    assert.match(description('wheel_caraboo_ssr'), /3턴의 쿨타임/);
    assert.match(description('wheel_falling_upward'), /다른 각성체의 명령 카드/);
});

test('무수한 총애의 시선은 포식 누적분의 실제 고정값 계수와 수명을 표시한다', () => {
    const text = description('wheel_million_eyes');
    assert.match(text, /공격력 6\/8\/10\/12%/);
    assert.match(text, /팀에 혈육 각성체가 있을 경우/);
    assert.match(text, /공격력 0\.03%\(소수점 올림\)/);
    assert.match(text, /이 추가 효과는 전투 종료 시 제거/);
    assert.doesNotMatch(text, /공격력 3%/);
});
