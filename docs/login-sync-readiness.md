# Google 로그인·개인 기록 동기화 구현 준비

작성일: 2026-11-20 KST. 상태: **조사·설계 완료, 구현 및 운영 변경 전**.

이 문서는 사용자가 요청한 조사·구현 준비 결과다. 앱 코드, 운영 Rules, 인증 제공자,
웹 앱 등록, 배포, 결제, IAM을 변경하지 않았다. 인증 폐기·재로그인도 수행하지 않았다.
구현 단계의 작업과 검증은 아래에 계획으로 구분한다. 이 문서 자체는 구현 완료 증거가 아니다.

## 1. 기준 코드와 실제 운영 주소

- 원격 저장소: `Morimenz-kr/Morimens.Info.kr`.
- 조회한 운영 main: `ac5e5d1a10f1af215494d2b8596c24134e533afd`.
- 로컬 브랜치: `codex/latest-data-season74`, HEAD `286eed24d60e0f9838addd37b55dcb86c6b0f31f`.
- 로컬에는 기존 수정·미추적 파일이 다수 있다. checkout/reset/rebase 또는 덮어쓰기를 하지 않았다.
- 원격 main의 inventory/party HTML, `js/roster-preview.js`, `js/party_builder.js`,
  `tools/prepare-roster-pages.mjs`, `package.json`은 로컬과 다르다. 구현은 현재의 오래된
  로컬 파일을 그대로 기반으로 삼지 않고 최신 main에서 시작해야 한다.
- Firebase 배포 도구·워크플로·Rules와 보유 모델은 원격 파일로 대조했다.
- GitHub Pages API: `build_type=workflow`, `cname=null`, 실제 주소는
  `https://morimenz-kr.github.io/Morimens.Info.kr/`. 공개 HTTP 200 확인.
- 별도 보유 현황 주소 `https://morimens-roster.pages.dev/`도 공개 HTTP 200 확인.
- `https://morimens.info.kr/`은 이번 컴퓨터의 DNS 조회에서 `ENOTFOUND`였다.
  저장소 이름을 실제 OAuth 허용 도메인으로 간주하면 안 된다.
- 두 실제 운영 주소는 다른 Origin이다. 로그인 계정은 공유할 수 있으나 기존 localStorage는
  서로 읽을 수 없다. 사용자는 기록이 있는 각 Origin에서 로그인·가져오기를 수행하거나
  JSON 백업을 이용한다. 다른 컴퓨터의 브라우저 기록을 현재 컴퓨터가 자동으로 읽을 수 없다.

## 2. 운영 상태 및 인증 확인

| 항목 | 읽기 전용 확인 결과 |
| --- | --- |
| Actions `FIREBASE_PROJECT_ID` | `mythag-kr` |
| Actions `SITE_DATA_SOURCE` | `firestore` |
| Actions `CLOUDFLARE_ACCOUNT_ID` | `c354247f849da8bc24fdddc21fd97d55` |
| Firebase 요금제 | Spark, 무료 |
| Cloud Billing API | HTTP 200, `billingEnabled=false`, 연결 결제 계정 없음 |
| Firestore DB | `(default)`, Standard, `asia-northeast3`, 무료 대상 DB |
| 배포된 Firestore Rules | 모든 클라이언트 read/write 거부 |
| Firebase 웹 앱 목록 | HTTP 200, 등록된 웹 앱 없음 |
| Authentication | 콘솔 시작하기 화면, Admin v2 프로젝트 설정 GET은 404 NOT_FOUND |
| Identity Platform | 콘솔 사용 설정 전 화면 |
| Cloudflare | 해당 운영 계정 Workers Free |
| 운영 Worker | `carriepigeon`, `https://carriepigeon.khj613401.workers.dev` |
| 연결 리소스 | KV 1개, SQLite DO 2개, Queue 1개, 10분 간격 Cron |

기존 Firebase CLI 계정을 명시적으로 운영자 이메일과 대조한 뒤 공식 firebase-tools의
기존 인증 자동 갱신 경로로 Cloud Billing/Monitoring/Firebase API를 조회했다.
갱신은 성공했으며 별도의 로그인·인증 폐기·권한 확대는 하지 않았다.
이번 추가 조회는 로거를 비활성화하고 허용된 집계 필드만 출력했다. 자격 증명은 이 문서에 없다.
Cloudflare는 사용자가 로그인한 운영 콘솔을 사용했다. 만료된 로컬 토큰을 직접 재사용하지 않았다.

## 3. 사용량 증거와 미확인 항목의 처리

### Firestore: 추가 API 조회로 정밀화한 연산량

조회 구간은 `2026-10-21T07:00:00Z` 이상 `2026-11-20T08:00:00Z`까지다.
태평양 날짜 10/21~11/19 완료 구간이며, DST 종료 때문에 시간 길이는 30일+1시간이다.
시간별 ALIGN_SUM을 태평양 날짜로 합산했다. 페이지 잘림은 없었고 기존 count와
새 ops_count 계열의 합계가 일치했다. 콘솔의 한국 날짜·부분 당일 구간 약 3.1만/1.5천/1.3천과
이 완료 구간의 값은 동일한 기간이 아니므로 구분한다.

| 항목 | 완료 구간 합계 | 태평양 날짜별 관측 최대 | 최대 발생일 | 무료 한도에서 관측 최대 차감 |
| --- | ---: | ---: | --- | ---: |
| 읽기 | 30,664 | 2,669 | 2026-10-26 | 47,331/일 |
| 쓰기 | 1,418 | 307 | 2026-10-26 | 19,693/일 |
| 삭제 | 1,216 | 284 | 2026-10-26 | 19,716/일 |

이 잔여량은 관측 최대치를 차감한 비교치이며 앞으로의 사용량 보증이나 청구 확정 수치가 아니다.
설계 계산에서는 기존 운영 몫으로 읽기 5,000/일, 쓰기·삭제 각 2,000/일을 더 보수적으로 예약한다.

| 추가 항목 | 결과 |
| --- | --- |
| 최근 30일 데이터·색인 저장량 | 13.238~16.665MiB, `storage/data_and_index_storage_bytes` |
| 저장 여유 | 조회 최대 기준 약 1,007.335MiB/1GiB |
| 기존 Auth 사용량 | 시작 전 상태. 기존 MAU 통계를 0으로 실측한 것은 아님 |
| 과금 기준 월 외부 전송량 E | 미확인. 0으로 가정하지 않음 |

외부 전송량은 아래 경로까지 추가 점검했다.

1. 프로젝트 공개 Firestore Monitoring metric descriptor 전체 목록을 API로 확인했다.
   별도의 청구 기준 egress bytes 지표는 없었다.
2. Consumer Quota allocation usage를 조회했으나 Firestore DB 개수 시계열만 제공됐다.
3. `billing.googleapis.com/usage/amount` 조회는 404 NOT_FOUND였다.
4. `serviceruntime.googleapis.com/api/response_sizes`에서 약 6,700,153바이트의 응답 크기
   집계를 구했지만 표본은 BatchGet 10건, Commit 273건, RunQuery 6건뿐이었다.
   전체 데이터 전송을 빠짐없이 포괄한다는 근거가 없고 청구 대상 목적지 구분도 없으므로,
   **이 값을 실제 egress E 또는 그 상한으로 사용하지 않는다.**
5. 공식 안내는 청구 데이터 내보내기를 가리키지만 프로젝트에 연결된 결제 계정이 없다.
   숫자를 얻으려고 결제를 연결하거나 요금제를 변경하지 않았다.

결론: 현재 제공되는 읽기 전용 경로의 점검은 수행했다. 정확한 E는 계속 미확인이며
공개 배포 시 무료 운영 보증은 할 수 없다. 이 사실이 로컬 구현·에뮬레이터 개발 자체를 막지는 않는다.

### Cloudflare

아래 값은 2026-11-20 운영 콘솔의 반올림 표시를 포함한다.

| 항목 | 기간 | 관측량 |
| --- | --- | ---: |
| carriepigeon 호출 | 최근 30일 | 약 494,400 |
| carriepigeon CPU | 최근 30일 | P50 1.67ms, P90 5.08ms |
| 계정 전체 Worker 요청·CPU | 11월 누계 | 약 318,610 / 1.05M CPU-ms |
| KV 읽기/쓰기/목록/삭제 | 최근 30일 | 약 348,700 / 15,100 / 25,000 / 270 |
| KV 읽기/쓰기/목록/삭제 | 최근 7일 | 약 62,500 / 3,700 / 6,100 / 43 |
| KV 저장 | 현재 | 약 336MB, 계정 목록에서 namespace 1개 확인 |
| ResourceProposal DO | 최근 30일 | 요청 약 22,000, 실행 219 GB-s, 행 읽기 약 22,000, 행 쓰기 524 |
| ArcaDedup DO | 최근 30일 | 요청 525, 실행 3.81 GB-s, 행 읽기 262, 행 쓰기 525 |
| 계정 DO 저장 | 현재 | 약 96.28MB, 연결 DO 외 기존 DO 2개 포함 |
| Queue 목록 | 추가 점검 | 계정에 resource-link-updates 1개 |
| Queue 당일 계정 사용량 | 11/20 | 0 / 10,000 operations |
| Queue 최근 30일 상세 | 최근 30일 | 요약 0, 차트 No data available |
| Queue This month 탭 | 추가 점검 | 0 표시지만 실제 기간 라벨 11/20~11/20, 월 전체 실측으로 사용 불가 |

Cloudflare 전체 일일 최대치와 Queue의 월 전체 시계열을 확정하지 못했다.
하지만 추천 구현은 기존 Worker와 Cloudflare 상태 저장소에 로그인·동기화 요청을 추가하지 않는다.
KV 목록 조회는 최근 7일 평균 약 871/일로 무료 1,000/일에 가깝다. 로그인 기능과 별개의 기존 운영 주의점이다.

## 4. 무료 한도와 비용 경계

| 서비스 | 무료 한도 및 단위 |
| --- | --- |
| 기본 Firebase Google 로그인 | 소셜 로그인 무료. 인증 API의 빈도 제한은 별도 |
| Identity Platform Spark | 활성화 시 Tier 1 3,000 DAU 제한. 이번 구현에는 활성화하지 않음 |
| Firestore Standard | 무료 대상 DB 한 개의 읽기 50,000/일, 쓰기·삭제 각 20,000/일, 저장 1GiB, 전송 10GiB/월 |
| Workers | 계정 전체 요청 100,000/일, 호출당 CPU 10ms. 월 CPU 잔여 풀로 계산하지 않음 |
| KV | 계정 읽기 100,000/일, 쓰기·목록·삭제 각 1,000/일, 저장 1GB |
| SQLite DO | 계정 요청 100,000/일, 실행 13,000 GB-s/일, 행 읽기 500만/일, 행 쓰기 10만/일, 저장 5GB |
| Queue | 계정 10,000 operations/일. 64KB 이하 메시지 정상 전달은 통상 3 operations, 재시도 추가 |

새 컬렉션·앱·Worker·namespace를 만들더라도 무료량을 별도로 얻는 것으로 계산하지 않는다.
현재 Spark/Workers Free의 한도 소진은 자동 초과 결제보다 요청·작업 실패의 문제다.
Firestore를 공유하므로 개인 동기화가 기존 데이터 배포·활성화·GC에 영향을 줄 수 있다.
기존에 배포된 정적 페이지는 DB 조회 없이 제공될 수 있다.
Blaze/Workers Paid로 변경하면 초과 과금이 가능해진다. 해당 변경은 이번 준비의 범위 밖이다.

## 5. 구현할 구성과 데이터 계약

브라우저가 Firebase Google 로그인 후 Firestore에 직접 접근한다.
Cloudflare Worker 프록시, Cloud Functions, Identity Platform, 유료 확장은 추가하지 않는다.

### 인증·호스팅

- Firebase 웹 앱 하나를 등록하고 기본 Authentication의 Google 제공자를 설정하는 작업이 필요하다.
  현재는 미수행이다. 지원 이메일은 기존 운영자 계정을 사용한다.
- 허용 도메인 후보는 실제 확인한 `morimenz-kr.github.io`, `morimens-roster.pages.dev`다.
  로컬 테스트는 Emulator를 우선하며 필요한 localhost만 명시한다. 임의의 프리뷰 호스트를 일괄 허용하지 않는다.
- GitHub Pages의 `/Morimens.Info.kr/` 하위 경로에서 스크립트·자산 주소가 동작하도록 상대 경로를 사용한다.
- 사용자의 로그인 버튼 클릭에서 `signInWithPopup`을 직접 호출한다. 비동기 사전 작업으로
  사용자 제스처를 잃지 않게 SDK 준비는 별도로 끝낸다. popup 차단·취소는 게스트 기록을 건드리지 않는다.
- 정적 외부 호스팅에서 `signInWithRedirect`를 무조건 fallback으로 넣지 않는다.
  제3자 저장소 제한과 Firebase auth helper 호스팅 조건을 별도로 검증해야 한다.
- 최초 실기 검증은 실제 운영 도메인과 Android Chrome/iOS Safari에서 필요하다.
  현재 인증 미설정이므로 실계정 로그인 성공 검증은 아직 수행할 수 없다.

### 사용자 문서

| 경로 | 내용 |
| --- | --- |
| `users/{firebaseUid}` | schemaVersion, revision, status, 선택적 gameUid, createdAt, updatedAt, 가져오기 표시 |
| `users/{firebaseUid}/state/roster` | schemaVersion, revision, updatedAt, payloadJson |
| `users/{firebaseUid}/state/parties` | schemaVersion, revision, updatedAt, payloadJson |

- 상태 문서 이름은 roster/parties 두 개만 허용한다. 사용자 임의 하위 컬렉션은 허용하지 않는다.
- Google 이메일·사진·표시 이름은 Auth에서 표시하고 Firestore에 불필요하게 복제하지 않는다.
- 게임 UID는 선택적 문자열이다. 형식을 실제로 확인하지 않은 상태에서 숫자 ID라고 단정하지 않는다.
  프로필 문자열 길이를 제한하고 빈 값은 null로 정규화한다. 로그인 식별과 접근 제어에는 사용하지 않는다.
- state는 실제 도메인 모델을 canonical JSON으로 직렬화한다. 비ASCII 문자를 JSON escape로 바꾸면
  ASCII 문자열 길이와 UTF-8 payload byte 길이가 같아져 Rules에서 상한 검증이 가능하다.
  본문 상한 제안은 문서별 64KiB다. 일반 사용량 계산의 24KiB와 하드 상한 64KiB를 혼동하지 않는다.
- 저장 전과 읽은 후 모두 구조 검증한다. Rules는 envelope 필드·타입·길이·revision을 검증하며,
  JSON 내부 게임 데이터 유효성은 기존 roster 검증기와 새 party 모델에서 검사한다.
- `state.payloadJson`은 색인 제외. 기존 `documents.payloadJson` 색인 제외도 보존한다.
- 캐릭터·명륜은 이름 대신 안정적인 기존 ID를 사용한다. 파티·페이지에는 안정적인 ID를 부여한다.
- 현재 catalog 62캐릭터/147명륜을 채운 예시는 19,189바이트, 50파티 예시는 16,121바이트다.
  실제 이용자의 브라우저 내용을 추출한 값이 아니며 JSON escape·프리셋·이름 길이에 따라 달라진다.

### 보안 규칙과 삭제 중 쓰기 차단

- 본인 UID만 정확한 문서 get을 허용하고 사용자 목록·다른 UID·운영 releases 접근은 거부한다.
- profile 생성은 active만 허용하며 createdAt/revision/updatedAt을 검증한다.
- state의 생성·수정은 부모 profile이 active인지 Rules get/getAfter로 확인한다.
  이 검사는 삭제 중인 다른 기기의 지연 쓰기가 데이터를 복원하는 것을 막기 위한 설계다.
- update는 revision을 정확히 1 증가시키고 updatedAt은 request.time과 같아야 한다.
- profile의 active→deleting 전환은 허용하되 deleting→active 복귀나 클라이언트의 profile 삭제는 금지한다.
- 부모 profile 검사는 일반 state 쓰기마다 의존 문서 읽기 1회로 계산한다.
  앞선 조사에서 설명한 '권한 추가 읽기 없는 최소안'에서 보완된 부분이며 아래 규모 계산에도 반영한다.
- Rules의 get/getAfter 캐시와 배치 접근 제한은 Emulator에서 검증한다. 실패·거부된 요청도
  의존 문서 읽기가 소비될 수 있다. 클라이언트 저장 간격은 계정 전체 할당량 차단기가 아니다.

## 6. 로컬 저장·가져오기·충돌 계약

### 저장 경로 통합

현재 주요 키는 `morimens_roster_preview_v1`, `morimens_inventory_checker_v2`,
파티 `morimens_v2_pages`, 이전 파티 `morimens_v2`다.
`party_builder.js`의 readOwnedInventory도 구형 inventory 키를 읽으므로 저장 함수만 교체하면 불충분하다.

- 공통 저장 adapter에서 guest와 firebaseUid별 local cache/outbox를 분리한다.
- 게스트 기존 키는 유지한다. 로그인 계정의 데이터로 게스트 키를 덮거나 삭제하지 않는다.
- roster load/commit, party load/saveAllData/readOwnedInventory를 모두 adapter로 연결한다.
- party의 기존 초기 로드가 normalize 후 즉시 저장하므로, 원본 가져오기 스냅샷을 그 전에 확보한다.
- 계정 변경 시 진행 중 네트워크 결과·outbox를 세션 세대 번호와 UID로 차단한다.
  A 계정의 늦은 응답이 B 계정 또는 게스트 기록에 적용되지 않아야 한다.
- 원격 반영 시 현재 undo 기준과 수정창 초안을 점검한다. 원격 적용을 다시 새 로컬 변경으로
  등록해 무한 업로드하지 않는다.

### 첫 로그인 가져오기

1. Origin별 원본을 변경 전에 보관하고 백업 다운로드가 가능하도록 한다.
2. 새 roster/구 inventory/파티 legacy를 각각 검증한다. 손상·미지원 레코드를 조용히 버리지 않는다.
3. 새 roster 값 우선, 구 inventory는 누락 항목 보완 후보로 사용한다. 자동 max/OR 병합은 하지 않는다.
4. 계정의 원격 기록을 읽어 가져올 양과 충돌을 표시한다. 클라우드 없음/로컬 없음/둘 다 있음으로 분기한다.
5. 보유 해제 false, 돌파·스킬 값 0, 삭제한 파티도 명시적 변경으로 취급한다.
6. 사용자 선택을 revision 검사 후 반영하고 성공한 항목만 가져오기 완료로 표시한다.
   출처·내용 hash와 안정적 파티 ID로 같은 원본 재가져오기를 구분하고 중복 프리셋·파티를 막는다.
7. 부분 실패는 완료로 표시하지 않는다. 원본 localStorage와 백업은 유지한다.

### 원격 저장과 기기 간 수정

- 입력 즉시 로컬 저장, dirty 문서만 원격 전송한다. 입력마다 Firestore setDoc하지 않는다.
- 자동 저장 제안: 마지막 변경 후 15초 debounce, 자동 전송 최소 간격 60초.
  저장 버튼은 명시적 flush다. 이 간격이 하루 4회 저장을 보장하는 것은 아니다.
- 변경 없는 저장은 0회. debounce/주기/저장 버튼의 중복 전송을 합친다.
- 기본 원격 조회는 로그인 또는 편집 화면 진입 때 한 번, 이후 수동 새로고침이다.
  무제한 polling이나 모든 페이지의 상시 snapshot listener는 초기 버전에 넣지 않는다.
- 같은 Origin 탭은 BroadcastChannel/storage event를 사용하되 원격 호출을 증폭하지 않는다.
  다른 기기의 열린 화면은 재진입·새로고침 시 최신 상태를 읽고, 저장 시에는 항상 revision을 확인한다.
- 마지막 동기화 기준본 B, 현재 로컬 L, 트랜잭션에서 읽은 원격 R로 3-way merge한다.
  겹치지 않는 필드는 합치고 같은 필드의 상이한 변경은 사용자 선택을 기다린다.
- device clock 기반 최신값 선택이나 현재 RosterModel.merge의 owned OR 병합은 동기화에 사용하지 않는다.
- 파티 배열 인덱스를 식별자로 쓰지 않는다. 이동/삭제/수정 충돌은 안정적 ID 기준으로 비교한다.
- 오프라인 중에는 로컬 outbox에 유지한다. 연결 복구 후 트랜잭션으로 재시도한다.
  Firestore 오프라인 setDoc의 last-write-wins를 충돌 처리 대신 사용하지 않는다.
- 네트워크·권한·quota 실패는 지수 backoff, 제한된 재시도와 수동 재시도로 처리한다.
  실패를 '저장 완료'로 표시하지 않고 로컬 변경을 보존한다.

## 7. 계정 삭제

세 서비스 작업을 하나의 원자적 삭제로 표시하지 않는다.

1. 재인증에 성공한 뒤 profile을 deleting으로 전환해 다른 기기의 state 쓰기를 차단한다.
2. roster와 parties를 삭제한다. 개인 필드는 profile에서도 제거한다.
3. Firebase Auth 계정을 삭제한다. 실패하면 삭제 진행 상태에서 재시도할 수 있어야 한다.
4. 다른 기기의 이미 발급된 ID token으로 재생성하지 못하도록 최소 삭제 표식 profile은 유지한다.
5. 24시간 이상 지난 표식과 고정 state 경로를 Admin SDK로 정리한다. 제안은 기존 GitHub OIDC
   방식의 별도 유지보수 workflow이며 Cloud Functions/Worker/장기 키는 필요하지 않다.
   이 workflow도 아직 만들거나 실행하지 않았다. 정기 실행 지연을 감안해 보관 기간과 상태를 안내한다.
6. 유지보수 query에는 status/deleteRequestedAt 복합 색인을 계획한다. 기존 릴리스 GC는
   releases에만 동작하는 것을 유지하고 사용자 자료를 혼합하지 않는다.

표식에는 게임 UID·보유·파티·이메일을 남기지 않는다. 삭제 토큰 유효기간 대응용 최소 UID 경로와
상태·시간만 일시 보관한다. 일괄 삭제·유지보수도 읽기/삭제 할당량을 소비한다.
실제 구현 시 workflow 지연·삭제 실패·다른 기기 재시도까지 검증해야 한다.

## 8. 규모 계산: 관측치와 설계 예약분을 구분

기본 가정: 로그인 DAU N, 30일, 1인 2회 진입/일, 매 진입 문서 3개 get,
원격 state 저장 4회/일. 문서 크기는 profile 1KiB와 state 각 24KiB를 가정한다.
저장 1회는 state 트랜잭션 읽기 1 + 쓰기 1 + 부모 상태 Rules 읽기 1이다.
따라서 **1인당 읽기 14회, 쓰기 4회/일**, 클라이언트 응답량은
`2×49 + 4×24 = 194KiB/일`이다. Rules 내부 profile 읽기는 클라이언트 전송 바이트로 더하지 않는다.
누적 저장 계정 수는 DAU의 5배, 색인 제외 후 계정당 저장 64KiB 가정이다.
이는 실측 계정 저장량이나 하드 상한이 아니다.

| DAU | 읽기: 관측 일최대+신규 | 쓰기: 관측 일최대+신규 | 읽기: 운영 5천 예약 포함 | 쓰기: 운영 2천 예약 포함 | 추가 전송/월 | 기존 포함 저장 추정 |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 100 | 4,069 | 707 | 6,400 | 2,400 | 0.555GiB | 47.915MiB |
| 1,000 | 16,669 | 4,307 | 19,000 | 6,000 | 5.550GiB | 329.165MiB |
| 3,000 | 44,669 | 12,307 | 47,000 | 14,000 | 16.651GiB | 954.165MiB |

- 실제 월 전송은 반드시 `E + 위 추가량`으로 비교한다. E를 0으로 두지 않는다.
- 100/1,000 DAU는 연산·가정 저장량상 여유가 있지만 전송 무료 보장은 미확인이다.
- 3,000 DAU 기본 패턴은 추가 전송만으로 10GiB를 넘는다. 읽기도 47,000으로 여유가 작다.
- 1회 진입·2회 저장으로 낮추면 읽기 7N/일, 쓰기 2N/일, 추가 전송 97KiB/N/일이다.
  3,000 DAU에서 예약분 포함 읽기 26,000, 쓰기 8,000, 추가 전송 8.326GiB/월로
  E 및 오버헤드에 약 1.674GiB만 남는다. 여전히 무료 확정이 아니다.
- 최초 가입·가져오기는 계정당 문서 생성 최대 3회 쓰기가 추가된다.
  3,000명이 같은 날 새로 가입하고 기본 4회 저장까지 하면 신규 쓰기만 21,000회이므로
  기존 사용량 전에도 일일 쓰기 20,000회를 넘는다. 초기 가져오기와 후속 자동 저장은 중복하지 않게 설계한다.
- 수동 새로고침·장시간 편집·반복 저장·재시도·탈퇴·삭제 정리는 별도 추가량이다.
  실제 조작 시나리오에서 호출 수·직렬화 바이트를 측정해 이 표를 교체해야 한다.

## 9. 구현 파일과 순서 — 아직 미수행

| 순서 | 대상 | 해야 할 일 |
| --- | --- | --- |
| 1 | 최신 main 체크아웃 | 기존 로컬 변경을 보존한 깨끗한 작업 기준 확보, npm ci |
| 2 | 새 저장/가져오기/파티 모델 모듈 | UID별 캐시·outbox, legacy 검증, 안정적 파티 ID, 3-way merge |
| 3 | 새 Firebase client 모듈 | 기본 Google Auth, 고정 문서 get/transaction, 세션 격리, 재시도 |
| 4 | firestore.rules / firestore.indexes.json | 본인 경로, envelope 크기·revision, 삭제 잠금, 색인 제외·정리 색인 |
| 5 | js/roster-preview.js / js/party_builder.js | load/commit/save 및 보유 필터 읽기까지 공통 adapter 연결 |
| 6 | inventory_checker.html / party_builder.html / 계정 UI | 로그인·동기화 상태·프로필·가져오기·충돌·탈퇴, 모바일 배치 |
| 7 | 새 계정 bundle build 도구 | 원격 main에 이미 있는 esbuild와 Firebase SDK를 사용, 생성 bundle은 .generated에 출력 |
| 8 | tools/prepare-pages-artifact.mjs / tools/prepare-roster-pages.mjs | 양쪽 배포에 동일 bundle/config/UI 포함, 하위 경로 검증 |
| 9 | .gitignore / package scripts / workflow 테스트 | 새 tools 파일 허용 목록과 빌드 연결, devDependencies 배포 단계 설치 유지 |
| 10 | 삭제 유지보수 도구/workflow | 기존 OIDC 방식으로 고정 경로 정리, 비밀 키 생성 없이 dry-run 검증 |
| 11 | 계정 데이터 안내·운영 문서 | UID 목적, 동기화 범위, 기기별 캐시, 탈퇴·표식 정리 기간 명시 |

실제 설정은 Firebase 웹 앱 등록→Google 제공자/허용 도메인→공개 client config 반영이 필요하다.
client config와 API key는 권한을 대체하지 않는다. 서비스 계정 키나 Google OAuth client secret을
브라우저 bundle에 넣지 않는다. Identity Platform과 결제 계정은 연결하지 않는다.

현재 컴퓨터는 Node 24.16.0/npm 11.13.0이다. 원격 main은 Firebase/esbuild/Playwright를
이미 고정하고 있지만 현재 로컬 node_modules에는 esbuild·Playwright 실행 파일이 없다.
Java 실행 파일 및 기본 Java 설치 디렉터리도 확인되지 않았다.
최신 코드의 의존성 설치와 Java 21 Emulator 환경 준비가 구현 검증 전에 필요하다.
이번 준비에서는 설치나 의존성 변경을 하지 않았다.

## 10. 검증·운영 전환 계획 — 아직 실행한 기능 테스트가 아님

### 로컬·Emulator

- 기존 npm test와 데이터 검증을 최신 코드에서 수행한다.
- Auth/Firestore Emulator의 가짜 사용자로 게스트·본인·다른 사용자·비로그인 접근을 검증한다.
- 운영 releases 접근이 계속 거부되고 기존 Admin 데이터 게시/GC 회귀 테스트가 통과해야 한다.
- 알 수 없는 문서 ID, 잘못된 타입/초과 payload/임의 revision/서버 시간 위조를 거부한다.
- active→deleting 이후 다른 기기와 오프라인 지연 쓰기를 거부하고 개인 문서가 되살아나지 않아야 한다.
- 최초 가져오기 반복·부분 실패·손상 JSON·명시적 0/false·파티 삭제/재정렬·구형 키 병합을 검증한다.
- A→B 계정 전환, 로그아웃, 늦은 응답, 수정 중 원격 변경, undo, 동시 탭을 검증한다.
- 매 입력이 아닌 묶음 저장인지, 변경 없는 저장 0회인지, Rules 의존 읽기/재시도 횟수를 측정한다.
- 64KiB 상한과 실제 ASCII JSON/Firestore 응답·저장 overhead를 측정한다.
- 정적 사이트와 별도 roster artifact 모두 자산 누락·루트/하위 경로 문제를 검사한다.

### UI·실계정

- docs/responsive-design.md에 따라 320, 390, 768, 1024, 1280px,
  변경한 breakpoint의 ±1px, 가로 화면, 200% 글자 확대를 검증한다.
- 가져오기/충돌/삭제 dialog의 초점 순서·Escape·포커스 복귀, 44px 주 조작,
  긴 Google 표시 이름·오류 문구·동기화 상태의 줄바꿈을 검사한다.
- 실계정 smoke test는 운영 인증 설정 이후 별도 검증 계정으로 수행한다.
  현재는 운영 설정을 하지 않았으므로 성공 검증으로 표시하지 않는다.
- 실제 도메인별 Google popup 및 모바일 Safari/Chrome 테스트가 필요하다.

### 공개 전환

- 구현·검증 결과를 먼저 검토 가능한 상태로 만든 뒤 운영 전환한다.
- 배포 시에는 Rules/색인을 먼저 준비하고 계정 기능 flag를 기본 off로 둔 프런트를 검증한다.
- 신규 사용자 가져오기 급증, DB read/write/egress, 저장량을 관찰하며 공개 범위를 넓힌다.
  정확한 E가 미확인인 상태에서 3,000 DAU 무제한 무료를 약속하지 않는다.
- Firebase 장애·한도 소진 시 로컬 저장을 유지하고 자동 재시도 폭주를 멈춘다.
- 기능 flag off는 새로운 원격 동기화를 중지하는 것으로 한정하고 사용자 문서는 삭제하지 않는다.
  계정 캐시를 게스트 데이터로 섞지 않는다. 인증을 켠 뒤의 롤백도 계정 격리를 유지해야 한다.
- SITE_DATA_SOURCE=repository는 기존 정적 데이터 배포의 fallback이며 로그인 복구책과는 구분한다.

## 11. 공식 근거

- [Firestore 무료량·한도](https://firebase.google.com/docs/firestore/quotas)
- [Firestore 읽기·Rules·전송 과금](https://firebase.google.com/docs/firestore/pricing)
- [Firestore 사용량 모니터링](https://firebase.google.com/docs/firestore/monitor-usage)
- [Google Cloud 공개 Firestore 측정항목](https://docs.cloud.google.com/monitoring/api/metrics_gcp_d_h#firestore)
- [Firebase 요금제와 결제 연결](https://firebase.google.com/docs/projects/billing/firebase-pricing-plans)
- [Firebase 인증 가격](https://firebase.google.com/pricing)
- [Authentication 제한](https://firebase.google.com/docs/auth/limits)
- [Google 로그인](https://firebase.google.com/docs/auth/web/google-signin)
- [Redirect와 제3자 저장소 제한](https://firebase.google.com/docs/auth/web/redirect-best-practices)
- [Rules 조건·get/getAfter](https://firebase.google.com/docs/firestore/security/rules-conditions)
- [트랜잭션](https://firebase.google.com/docs/firestore/manage-data/transactions)
- [오프라인과 last-write-wins](https://firebase.google.com/docs/firestore/manage-data/enable-offline)
- [사용자 삭제·재인증](https://firebase.google.com/docs/auth/web/manage-users)
- [Auth 세션과 토큰 수명](https://firebase.google.com/docs/auth/admin/manage-sessions)
- [Firestore 문서·하위 컬렉션 삭제](https://firebase.google.com/docs/firestore/manage-data/delete-data)
- [Workers 가격](https://developers.cloudflare.com/workers/platform/pricing/)
- [Workers 제한](https://developers.cloudflare.com/workers/platform/limits/)
- [KV 가격](https://developers.cloudflare.com/kv/platform/pricing/)
- [Durable Objects 가격](https://developers.cloudflare.com/durable-objects/platform/pricing/)
- [Queues 가격](https://developers.cloudflare.com/queues/platform/pricing/)
