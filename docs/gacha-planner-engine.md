# 가챠 계획 계산 엔진

`js/gacha-planner.js`는 UI와 게임별 수치에서 분리된 순수 계산 모듈이다. 브라우저에서는
`window.GachaPlanner`, Node 테스트에서는 `require('../js/gacha-planner.js')`로 사용한다.

## 현재 지원 범위

- 최고 등급 기본 확률
- 소프트 천장과 확정 천장
- 최고 등급 획득 시 천장 초기화
- 지정 횟수만큼 픽업에 실패한 뒤 다음 최고 등급 픽업 보장
- 현재 천장 스택과 연속 픽업 실패 횟수
- 목표 획득 수량별 성공 확률
- 지정 성공 확률에 필요한 최소 뽑기 수
- 티켓과 재화의 사용 가능 뽑기 수 환산
- 여러 예정 배너에 뽑기를 배분했을 때 배너별·전체 목표 달성 확률
- 배너 사이 천장 및 픽업 보장 상태 이월 또는 초기화

## Morimens 한정 배너 프리셋

`MORIMENS_LIMITED_RULES`는 한정 캐릭터 배너 규칙을 담고 있다. SSR 기본 확률은 3.02%,
SSR 확정은 최대 30뽑, SSR이 픽업 한정일 확률은 1/3이다. 상시 SSR이 2회 연속 나오면
다음 SSR은 픽업 한정으로 확정되므로 최악의 경우 90뽑 안에 한 장을 얻는다.

```js
const rules = GachaPlanner.MORIMENS_LIMITED_RULES;
```

이 규칙으로 계산한 픽업 한정 한 장의 평균 획득 시점은 약 42.045뽑이다.

수치 근거는 [이슈 #167](https://github.com/Morimenz-kr/Morimens.Info.kr/issues/167)에
첨부된 가챠 통계와 공개된 Morimens 배너 안내다. 게임 내 확률 안내가 변경되면 UI가 아니라
`MORIMENS_LIMITED_RULES`만 갱신한다.

## 단일 배너 계산

```js
const result = GachaPlanner.simulateBanner({
    rules,
    pulls: 120,
    targetCopies: 2,
    initialState: {
        pity: 20,
        featuredLosses: 0,
        copies: 0
    }
});

console.log(result.successProbability);
console.log(result.probabilityByCopies);
```

`probabilityByCopies`의 마지막 원소는 목표 수량 이상을 얻을 확률이다. 상태 수를 제한하기
위해 목표를 초과한 획득 수량은 목표 수량에 합산한다.

## 목표 확률에 필요한 뽑기 수

```js
const threshold = GachaPlanner.findPullsForProbability({
    rules,
    targetCopies: 1,
    desiredProbability: 0.9,
    initialState: { pity: 20, featuredLosses: 0 }
});
```

평균 획득 시점은 다음 API로 계산한다.

```js
const average = GachaPlanner.calculateExpectedPullsToTarget({
    rules,
    targetCopies: 1
});

console.log(average.expectedPulls); // 약 42.045
console.log(average.maxPulls); // 90
```

## 여러 배너 계획

```js
const plan = GachaPlanner.simulatePlan({
    rules,
    initialState: { pity: 20, featuredLosses: 0 },
    stages: [
        { id: 'character-a', pulls: 80, targetCopies: 1 },
        { id: 'character-b', pulls: 120, targetCopies: 2 },
        { id: 'different-banner-type', pulls: 60, targetCopies: 1, resetPity: true }
    ]
});

console.log(plan.stages);
console.log(plan.allTargetsProbability);
```

각 단계의 `successProbability`는 해당 배너 목표의 달성 확률이고,
`allTargetsProbability`는 앞 단계까지 모든 목표를 달성할 확률이다.

## UI 연결 시 필요한 입력

- 보유 티켓과 재화
- 1회 뽑기당 재화
- 현재 천장 스택
- 현재 연속 상시 SSR 횟수(0~2)
- 배너별 투자할 뽑기 수
- 배너별 현재 보유 수량과 목표 수량
- 배너 종류가 달라질 때 천장·보장 이월 여부

엔진은 DOM을 참조하지 않으므로 향후 별도 페이지, 모달 또는 기존 복각 일정 페이지 중
어느 UI에서도 그대로 사용할 수 있다.
