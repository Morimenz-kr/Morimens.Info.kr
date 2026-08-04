const assert = require('node:assert/strict');
const test = require('node:test');
const {
    normalizeTeamCollection,
    readInventory,
    getTeamAvailability,
    getRequiredBreakthroughLevel,
    validateTeamPayload
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

test('등록 데이터는 네 명과 장비 및 계약 옵션을 모두 요구한다', () => {
    const catalogs = {
        characters: new Set(['a', 'b', 'c', 'd']),
        wheels: new Set(['w1', 'w2', 'w3', 'w4', 'w5', 'w6', 'w7', 'w8']),
        covenants: new Set(['covenant-a'])
    };
    assert.deepEqual(validateTeamPayload(team, catalogs), []);
    const invalid = structuredClone(team);
    invalid.members[3].character_id = 'a';
    invalid.members[0].sub_stats = [];
    const errors = validateTeamPayload(invalid, catalogs);
    assert.ok(errors.some(error => error.includes('중복')));
    assert.ok(errors.some(error => error.includes('부옵')));
});
