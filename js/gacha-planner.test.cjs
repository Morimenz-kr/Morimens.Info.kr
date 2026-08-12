const assert = require('node:assert/strict');
const test = require('node:test');
const planner = require('./gacha-planner.js');

const simpleRules = {
    topRarityRate: 0.1,
    featuredRate: 1,
    hardPity: 100
};

test('일반 확률 배너의 목표 획득 확률을 정확히 계산한다', () => {
    const onePull = planner.simulateBanner({ rules: simpleRules, pulls: 1, targetCopies: 1 });
    const twoPulls = planner.simulateBanner({ rules: simpleRules, pulls: 2, targetCopies: 1 });

    assert.ok(Math.abs(onePull.successProbability - 0.1) < 1e-12);
    assert.ok(Math.abs(twoPulls.successProbability - 0.19) < 1e-12);
});

test('확정 천장 직전의 초기 스택을 반영한다', () => {
    const result = planner.simulateBanner({
        rules: { topRarityRate: 0, featuredRate: 1, hardPity: 3 },
        pulls: 1,
        targetCopies: 1,
        initialState: { pity: 2 }
    });

    assert.equal(result.successProbability, 1);
});

test('설정한 횟수만큼 픽업에 실패하면 다음 최고 등급의 픽업을 보장한다', () => {
    const result = planner.simulateBanner({
        rules: {
            topRarityRate: 1,
            featuredRate: 1 / 3,
            hardPity: 1,
            featuredGuaranteeAfterLosses: 2
        },
        pulls: 3,
        targetCopies: 1
    });

    assert.equal(result.successProbability, 1);
    assert.deepEqual(result.probabilityByCopies, [0, 1]);
});

test('Morimens 한정 배너 확률과 30·90뽑 보장을 제공한다', () => {
    assert.deepEqual(planner.MORIMENS_LIMITED_RULES, {
        topRarityRate: 0.0302,
        featuredRate: 1 / 3,
        hardPity: 30,
        featuredGuaranteeAfterLosses: 2
    });

    const firstPity = planner.simulateBanner({
        rules: planner.MORIMENS_LIMITED_RULES,
        pulls: 1,
        initialState: { pity: 29 }
    });
    const guaranteedPity = planner.simulateBanner({
        rules: planner.MORIMENS_LIMITED_RULES,
        pulls: 1,
        initialState: { pity: 29, featuredLosses: 2 }
    });
    const sixtyPulls = planner.simulateBanner({
        rules: planner.MORIMENS_LIMITED_RULES,
        pulls: 60
    });
    const ninetyPulls = planner.simulateBanner({
        rules: planner.MORIMENS_LIMITED_RULES,
        pulls: 90
    });

    assert.ok(Math.abs(firstPity.successProbability - (1 / 3)) < 1e-12);
    assert.equal(guaranteedPity.successProbability, 1);
    assert.ok(sixtyPulls.successProbability < 1);
    assert.equal(ninetyPulls.successProbability, 1);
});

test('Morimens 한정 캐릭터 한 장의 평균 획득 시점은 약 42.045뽑이다', () => {
    const result = planner.calculateExpectedPullsToTarget({
        rules: planner.MORIMENS_LIMITED_RULES,
        targetCopies: 1
    });

    assert.ok(Math.abs(result.expectedPulls - 42.04508364276593) < 1e-10);
    assert.equal(result.maxPulls, 90);
    assert.ok(Math.abs(result.guaranteedSuccessProbability - 1) < 1e-12);
});

test('소프트 천장 구간에서 최고 등급 확률을 단계적으로 올린다', () => {
    const rules = {
        topRarityRate: 0.02,
        featuredRate: 0.5,
        hardPity: 10,
        softPityStart: 7,
        softPityRateIncrease: 0.1
    };

    assert.ok(Math.abs(planner.getTopRarityRate(rules, 5) - 0.02) < 1e-12);
    assert.ok(Math.abs(planner.getTopRarityRate(rules, 6) - 0.12) < 1e-12);
    assert.ok(Math.abs(planner.getTopRarityRate(rules, 7) - 0.22) < 1e-12);
    assert.equal(planner.getTopRarityRate(rules, 9), 1);
});

test('희망 성공 확률에 도달하는 최소 뽑기 수를 찾는다', () => {
    const result = planner.findPullsForProbability({
        rules: simpleRules,
        targetCopies: 1,
        desiredProbability: 0.9,
        maxPulls: 100
    });

    assert.equal(result.pulls, 22);
    assert.ok(result.successProbability >= 0.9);
});

test('티켓과 재화를 실제 사용 가능한 뽑기 수로 환산한다', () => {
    assert.deepEqual(planner.calculatePullBudget({
        tickets: 7,
        currency: 3250,
        currencyPerPull: 150
    }), {
        totalPulls: 28,
        ticketPulls: 7,
        currencyPulls: 21,
        remainingCurrency: 100
    });
});

test('여러 배너 계획에서 천장과 픽업 보장 상태를 이어 계산한다', () => {
    const result = planner.simulatePlan({
        rules: {
            topRarityRate: 1,
            featuredRate: 0.5,
            hardPity: 1,
            featuredGuaranteeAfterLosses: 1
        },
        stages: [
            { id: 'first', pulls: 1, targetCopies: 1 },
            { id: 'second', pulls: 1, targetCopies: 1 }
        ]
    });

    assert.equal(result.stages[0].successProbability, 0.5);
    assert.equal(result.stages[1].successProbability, 0.75);
    assert.equal(result.allTargetsProbability, 0.25);
    assert.ok(Math.abs(result.finalCarryDistribution.reduce((sum, state) => sum + state.probability, 0) - 1) < 1e-12);
});

test('설정한 최대 뽑기 안에 목표 확률을 달성할 수 없으면 null을 반환한다', () => {
    const result = planner.findPullsForProbability({
        rules: {
            topRarityRate: 1,
            featuredRate: 0,
            hardPity: 1,
            featuredGuaranteeAfterLosses: null
        },
        targetCopies: 1,
        desiredProbability: 0.5,
        maxPulls: 10
    });

    assert.equal(result, null);
});

test('배너 종류가 바뀌면 명시적으로 천장 상태를 초기화할 수 있다', () => {
    const result = planner.simulatePlan({
        rules: {
            topRarityRate: 1,
            featuredRate: 0.5,
            hardPity: 1,
            featuredGuaranteeAfterLosses: 1
        },
        stages: [
            { id: 'first', pulls: 1, targetCopies: 1 },
            { id: 'second', pulls: 1, targetCopies: 1, resetPity: true }
        ]
    });

    assert.equal(result.stages[1].successProbability, 0.5);
    assert.equal(result.allTargetsProbability, 0.25);
});

test('잘못된 확률과 천장 입력은 조용히 계산하지 않는다', () => {
    assert.throws(() => planner.simulateBanner({
        rules: { topRarityRate: 1.1, featuredRate: 0.5, hardPity: 80 },
        pulls: 10
    }), /topRarityRate/);

    assert.throws(() => planner.calculatePullBudget({
        tickets: 0,
        currency: 100,
        currencyPerPull: 0
    }), /currencyPerPull/);
});
