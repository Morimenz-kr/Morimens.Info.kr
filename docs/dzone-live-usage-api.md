# 융재금구 실전 편성 통계 연결

기존 `dzone_info.html` UI는 변경하지 않는다. 비공개 추출기는 정제·집계한 결과만 Cloudflare Worker로 보내고, 공개 사이트는 Worker의 조회 API를 30초마다 확인한다.

## 로컬 전용으로 바로 쓰기

Cloudflare 설정 없이도 동작한다. 비공개 추출 저장소에서 집계가 끝나면 이 프로젝트의 아래 경로로 결과 JSON 한 파일만 복사한다.

```text
private-tools/output/dzone-usage-overview.json
```

`private-tools/`는 Git에서 제외되어 있으므로 원본 기록과 로컬 산출물이 GitHub Pages에 배포되지 않는다. `localhost` 또는 `127.0.0.1`에서 `dzone_info.html`을 열면 이 파일을 공개 API보다 먼저 읽는다. 파일이 없거나 형식이 잘못됐을 때만 Worker API를 시도한다.

파일 형식은 아래의 `GET /api/dzone/usage` 응답과 동일하다. 최상위에 `data`와 `fetchedAt`을 두고, `data.stages`에는 현재 집계 범위인 악몽·광기 10개 구간 또는 전체 난이도 20개 구간을 빠짐없이 넣는다. 각 스테이지에 `awakeners`와 `parties`를 함께 넣으면 로컬 화면의 채용률·편성 탭도 같은 파일에서 읽는다. 로컬 정적 서버가 프로젝트 루트를 서비스하고 있어야 한다.

## 공개 저장소에서 완료된 범위

- `GET /api/dzone/stage/{stageTid}/usage`: 최신 집계 조회
- `POST /api/dzone/stage/{stageTid}/usage`: Bearer 토큰으로 인증한 집계 저장
- `GET /api/dzone/usage`: 현재 집계 범위의 제한 클리어 집계 조회
- `POST /api/dzone/usage`: 악몽·광기 10개 또는 전체 난이도 20개 스테이지의 제한 클리어 집계를 한 번에 저장
- 기존 `RESOURCE_LINK_STATE` KV를 `dzone:usage:stage:{stageTid}` 접두사로 분리해 재사용
- 건수와 비율의 불일치를 막기 위해 Worker에서 `rate = count / recordCount` 재계산
- 캐릭터 수, 편성 수, 편성 인원, 정수 범위 및 이미지 경로 검증
- GitHub Pages에서 Worker의 공개 GET API를 호출하도록 연결
- `main`의 Worker 변경 시 자동 배포하는 GitHub Actions 워크플로

원본 응답, UID, 리플레이 코드, 인증 정보는 이 저장소나 공개 API에 저장하지 않는다.

## 회사에서 한 번만 할 작업

새 Cloudflare 계정 API 토큰은 필요하지 않다. 저장소에는 이미 `CLOUDFLARE_API_TOKEN`과 `CLOUDFLARE_ACCOUNT_ID`가 등록되어 있다.

1. 충분히 긴 임의 문자열을 생성한다.
2. GitHub 저장소의 Actions secret `DZONE_INGEST_TOKEN`으로 등록한다.
3. 같은 값을 비공개 추출 서비스의 환경변수 `DZONE_INGEST_TOKEN`으로 등록한다.
4. 이 브랜치의 PR을 병합한다. `Deploy Cloudflare Worker` 워크플로가 Worker secret 동기화와 배포를 수행한다.

PowerShell 예시:

```powershell
$bytes = New-Object byte[] 32
[Security.Cryptography.RandomNumberGenerator]::Fill($bytes)
$token = [Convert]::ToHexString($bytes).ToLowerInvariant()
$token | gh secret set DZONE_INGEST_TOKEN --repo Morimenz-kr/Morimens.Info.kr
$env:DZONE_INGEST_TOKEN = $token
```

토큰을 콘솔, Git 커밋, 로그 또는 JSON 파일에 출력하지 않는다. 회사의 비공개 저장소에서는 `.env` 같은 추적 제외 파일이나 운영 secret store를 사용한다.

## 추출기가 보낼 요청

```http
POST https://carriepigeon.khj613401.workers.dev/api/dzone/stage/82810/usage
Authorization: Bearer <DZONE_INGEST_TOKEN>
Content-Type: application/json
```

```json
{
  "stageTid": 82810,
  "since": 1788206400,
  "recordCount": 120,
  "awakeners": [
    {
      "tid": 101,
      "name": "각성체 이름",
      "image_thumb": "images/example-thumb.webp",
      "count": 48
    }
  ],
  "parties": [
    {
      "count": 12,
      "awakeners": [
        { "tid": 101, "name": "각성체 이름", "image_thumb": "images/example-thumb.webp" }
      ]
    }
  ],
  "constraintBuckets": [
    { "hasOverlimit": true,  "hasFinalLaw": true,  "usedEmergencySpirit": true,  "count": 40 },
    { "hasOverlimit": true,  "hasFinalLaw": false, "usedEmergencySpirit": true,  "count": 20 },
    { "hasOverlimit": true,  "hasFinalLaw": true,  "usedEmergencySpirit": false, "count": 15 },
    { "hasOverlimit": true,  "hasFinalLaw": false, "usedEmergencySpirit": false, "count": 10 },
    { "hasOverlimit": false, "hasFinalLaw": false, "usedEmergencySpirit": true,  "count": 20 },
    { "hasOverlimit": false, "hasFinalLaw": false, "usedEmergencySpirit": false, "count": 15 }
  ]
}
```

`since`는 집계 시작 Unix 초다. `fetchedAt`과 모든 `rate`는 Worker가 저장 시 생성한다. 추출기는 새 전투 기록을 반영한 집계가 달라졌을 때만 스테이지별 POST를 보내면 된다.

### 제한 조건 판정

`stageTid`는 각 파의 `일반·어려움·악몽·광기` 난이도를 구분한다. 각 클리어 기록은 다음 세 값으로 정확히 한 버킷에 들어간다.

- `hasOverlimit`: 파티에 초한 이상인 각성체가 한 명이라도 있으면 `true`
- `hasFinalLaw`: 파티에 최종 법칙이 열린 +15 각성체가 한 명이라도 있으면 `true`
- `usedEmergencySpirit`: 파티 데이터의 `응급 영지체 사용 횟수`가 1 이상이면 `true`

최종 법칙 +15는 초한 이후에만 가능하므로 `hasFinalLaw: true`이면서 `hasOverlimit: false`인 기록은 거부한다. 따라서 “초한만 없음”은 독립된 조합이 아니다. 전송한 버킷의 `count` 합계는 반드시 `recordCount`와 같아야 한다.

Worker는 이 버킷으로 다음 값을 계산한다.

- 전체 조건: 초한 각성체 없음, 최종 법칙 없음, 응급 영지체 미사용
- 정확한 조합: 최종 법칙만 없음, 응급 영지체만 미사용, 최종 법칙·영지체 없음, 초한·최종 법칙 없음, 전부 없음

## 전체 파·난이도 집계

사이트의 `제한 클리어` 표는 선택한 스테이지만 보지 않는다. 다음 경로에서 현재 기수의 모든 5개 파와 현재 집계 대상 난이도를 한 번에 읽는다.

```http
POST https://carriepigeon.khj613401.workers.dev/api/dzone/usage
Authorization: Bearer <DZONE_INGEST_TOKEN>
Content-Type: application/json
```

```json
{
  "period": 68,
  "since": 1788206400,
  "stages": [
    {
      "wave": 1,
      "difficulty": "normal",
      "stageTid": 82810,
      "recordCount": 120,
      "constraintBuckets": [
        { "hasOverlimit": true, "hasFinalLaw": true, "usedEmergencySpirit": true, "count": 120 }
      ]
    }
  ]
}
```

`stages`에는 예시의 한 항목만 보내면 안 된다. 현재 운영 범위인 `nightmare`, `madness`는 5개 파와 조합해 총 10개 모두 보내야 한다. 일반·어려움까지 수집할 때는 아래 네 난이도와 5개 파를 조합한 총 20개를 보낸다.

- `wave`: `1`부터 `5`
- `difficulty`: `normal`, `hard`, `nightmare`, `madness`
- `recordCount`: 해당 파·난이도의 전체 클리어 기록 수. 축약하거나 상한을 두지 않는다.
- `constraintBuckets`: 해당 스테이지의 모든 기록을 여섯 개의 성립 가능한 불리언 조합으로 분류하며, 합계가 `recordCount`와 같아야 한다.

Worker는 선택한 10개 또는 20개 조합의 누락·중복, 중복 `stageTid`, 잘못된 성장 관계, 불일치하는 기록 합계를 거부한다. 저장된 응답의 `data.recordCount`는 전송한 전체 스테이지의 기록 수 합계다.

## 증분 갱신 규칙

비공개 추출기는 최초 한 번만 대상 범위의 전체 기록을 읽어 채용률·편성·제한 조건의 기준 집계를 만든다. 이후 실행은 각 스테이지의 `snapshotCutoff` 주변 페이지를 조금 겹쳐 읽고, `stageTid`와 `battleUuid` 또는 `wid`로 만든 안정적인 기록 키가 기존 체크포인트에 없는 경우에만 세 집계에 함께 가산한다.

- 시간만으로 중복을 제거하지 않는다. 같은 초에 등록된 기록을 구분할 수 있도록 경계 시각의 기록 키도 보존한다.
- 스테이지별 `recordCount`, 각성체별 건수, 편성별 건수, 여섯 제한 버킷의 합계를 하나의 상태로 원자적으로 저장한다.
- 공개 Worker에는 스테이지별 채용률·편성을 먼저 저장하고, 모든 스테이지가 성공한 뒤 전체 제한 집계를 마지막에 저장한다.
- 로컬 JSON은 임시 파일에 완성본을 쓴 뒤 이름을 바꿔, 브라우저가 작성 중인 파일을 읽지 않게 한다.
- 누락·삭제·순위 재작성에 대비해 하루 한 번 또는 시즌 종료 시 전체 재집계 결과와 대조한다.

GitHub Pages의 HTML 파일을 매번 수정할 필요는 없다. 비공개 추출기가 집계 JSON을 Worker에 저장하면 정적 사이트의 JavaScript가 공개 GET API를 30초마다 다시 읽어 최신 결과를 표시한다. 진짜 서버 푸시가 필요하면 별도의 SSE/WebSocket 연결이 필요하지만, 추출 자체가 주기적으로 실행되는 구조에서는 30초 폴링이 더 단순하고 결과 지연도 추출 주기보다 작다.

## 배포 후 확인

데이터를 한 번 전송한 뒤 다음 두 경로를 확인한다.

```text
https://carriepigeon.khj613401.workers.dev/api/dzone/stage/82810/usage
https://carriepigeon.khj613401.workers.dev/api/dzone/usage
https://morimenz-kr.github.io/Morimens.Info.kr/dzone_info.html
```

첫 URL은 `data.stageTid`, `data.recordCount`, `data.awakeners`, `data.parties`, `fetchedAt`을 반환해야 한다. 사이트는 최대 약 30초 안에 기존 실전 편성 통계 영역을 갱신한다.
