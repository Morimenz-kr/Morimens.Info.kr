const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');
const vm = require('node:vm');
const {
    normalizeTeamCollection,
    readInventory,
    getTeamAvailability,
    getRequiredBreakthroughLevel
} = require('./team_recommendations.js');

function member(characterId, wheelA, wheelB) {
    return {
        character_id: characterId,
        breakthrough: '2돌',
        wheel_ids: [wheelA, wheelB],
        covenant_id: 'covenant-a',
        main_stats: ['은열쇠 충전', '영역 숙련', '피해 증폭', '광기 회복', '크리티컬 피해', '크리티컬 확률'],
        sub_stats: ['영역 숙련']
    };
}

const team = {
    members: [
        member('a', 'w1', 'w2'), member('b', 'w3', 'w4'),
        member('c', 'w5', 'w6'), member('d', 'w7', 'w8')
    ]
};

test('스크립트가 DOM 로드 후 실행되어도 화면 초기화를 시도한다', () => {
    let lookupCount = 0;
    const context = {
        console,
        document: {
            readyState: 'complete',
            getElementById() {
                lookupCount += 1;
                return null;
            }
        }
    };
    context.globalThis = context;
    vm.runInNewContext(fs.readFileSync(require.resolve('./team_recommendations.js'), 'utf8'), context);
    assert.equal(lookupCount, 1);
});

test('새 스키마와 배열형 구 스키마에서 조합 목록을 읽는다', () => {
    assert.equal(normalizeTeamCollection({ teams: [team] }).length, 1);
    assert.equal(normalizeTeamCollection([team]).length, 1);
    assert.equal(normalizeTeamCollection({}).length, 0);
});

test('보유 현황은 각성체와 명륜이 모두 있을 때만 구성 가능으로 판정한다', () => {
    const complete = getTeamAvailability(team, {
        registered: true,
        characters: new Set(['a', 'b', 'c', 'd']),
        wheels: new Set(['w1', 'w2', 'w3', 'w4', 'w5', 'w6', 'w7', 'w8']),
        characterBreakthroughs: { a: 2, b: 2, c: 2, d: 2 }
    });
    const missing = getTeamAvailability(team, {
        registered: true,
        characters: new Set(['a', 'b', 'c']),
        wheels: new Set(['w1']),
        characterBreakthroughs: { a: 2, b: 1, c: 2 }
    });
    assert.equal(complete.state, 'complete');
    assert.equal(missing.state, 'missing');
    assert.deepEqual(missing.missingCharacters, ['d']);
    assert.equal(missing.missingWheels.length, 7);
    assert.deepEqual(missing.missingBreakthroughs, ['b']);
});

test('추천 돌파 라벨을 보유 현황 단계로 변환한다', () => {
    assert.equal(getRequiredBreakthroughLevel('명함'), 0);
    assert.equal(getRequiredBreakthroughLevel('3돌 ~ 초한'), 3);
    assert.equal(getRequiredBreakthroughLevel('초한'), 7);
});

test('보유 현황 저장값이 없으면 미등록 상태를 반환한다', () => {
    const inventory = readInventory({ getItem: () => null });
    assert.equal(inventory.registered, false);
});

test('정적 추천 조합은 지정된 네 각성체와 범용 세팅을 사용한다', () => {
    const data = JSON.parse(fs.readFileSync(require.resolve('../data/recommended_teams.json'), 'utf8'));
    assert.equal(data.teams.length, 1);
    assert.deepEqual(data.teams[0].members, [
        {
            character_id: 'Murphy_Fauxborn', breakthrough: '3돌 ~ 초한',
            wheel_ids: ['wheel_wheel_of_seclusion', 'wheel_eternal_requiem'], covenant_id: 'covenant_medicine',
            main_stats: ['은열쇠 충전', '크리티컬 피해', '크리티컬 피해', '은열쇠 충전', '은열쇠 충전', '영역 숙련'],
            sub_stats: ['은열쇠 충전', '크리티컬 피해', '크리티컬 확률']
        },
        {
            character_id: 'miryam', breakthrough: '2돌',
            wheel_ids: ['wheel_peace_sleep_in_dark', 'wheel_spring_of_yakut'], covenant_id: 'covenant_deus',
            main_stats: ['은열쇠 충전', '영역 숙련', '피해 증폭', '영역 숙련', '피해 증폭', '영역 숙련'],
            sub_stats: ['영역 숙련']
        },
        {
            character_id: 'goliath', breakthrough: '2돌',
            wheel_ids: ['wheel_birth_of_soul', 'wheel_in_the_hard_rain'], covenant_id: 'covenant_deus',
            main_stats: ['은열쇠 충전', '영역 숙련', '피해 증폭', '영역 숙련', '피해 증폭', '영역 숙련'],
            sub_stats: ['영역 숙련']
        },
        {
            character_id: 'tulu', breakthrough: '1돌',
            wheel_ids: ['wheel_hymn_of_godking', 'wheel_never_ending_calculation'], covenant_id: 'covenant_reEvolve',
            main_stats: ['광기 회복', '영역 숙련', '피해 증폭', '광기 회복', '광기 회복', '영역 숙련'],
            sub_stats: ['광기 회복', '영역 숙련', '피해 증폭']
        }
    ]);
});
