# Firebase 데이터 마이그레이션 계획

## 1. 목표와 완료 기준

사이트에서 실제 사용하는 운영 데이터를 Cloud Firestore로 옮기되 다음 조건을 모두 지킨다.

- Firebase Spark 요금제와 기존 무료 인프라만 사용한다.
- 방문자의 브라우저는 Firestore를 직접 조회하지 않는다.
- 기존 GitHub Pages 사이트와 URL, 화면, 데이터 구조를 유지한다.
- Firestore 장애나 동기화 실패가 기존 정상 배포를 깨뜨리지 않는다.
- 데이터 누락과 참조 오류를 자동 검사한 릴리스만 공개한다.
- `resource_links`의 Discord 승인, GitHub PR, 기프트 코드 자동 반영 흐름을 유지한다.
- 한 번의 배포 설정 변경으로 저장소 JSON 방식으로 되돌릴 수 있어야 한다.

마이그레이션 완료는 단순히 Firestore에 데이터가 존재하는 상태가 아니다. JSON과 Firestore의
왕복 동등성, 전체 자동 테스트, 페이지별 데이터 로딩, 정적 배포 및 롤백 검증이 모두
성공해야 완료로 판정한다.

## 2. 무료 운영 아키텍처

```text
관리 데이터 / Cloudflare Worker
              |
              v
      검증된 GitHub 변경
       편집·복구 원본
              |
              v
     GitHub Actions 동기화
        |             |
        v             v
  Cloud Firestore   정적 JSON 스냅샷
  게시 릴리스 저장소      |
                       v
                 GitHub Pages
                       |
                       v
                    방문자
```

1차 전환에서 Git JSON은 편집·재해복구 원본이고, Firestore는 검증된 버전형 게시 릴리스
저장소다. 사이트 방문자는 GitHub Pages에 배포된 정적 JSON만 읽는다. 방문자 수와 크롤러
트래픽은 Firestore 읽기 할당량에 영향을 주지 않는다.

Cloud Functions, Firebase Hosting, 실시간 리스너와 클라이언트용 Firebase SDK는 사용하지
않는다. 운영 Firebase 프로젝트에는 결제 계정을 연결하지 않고 Spark 요금제를 유지한다.

## 3. 데이터 범위

### 3.1 Firestore로 이관할 운영 데이터

| 현재 파일 | 역할 |
| --- | --- |
| `character_manifest.json` | 캐릭터 기본 목록 |
| `character_settings.json` | 캐릭터 추천 세팅 |
| `character_effects.json` | 스킬, 계령, 돌파 효과 |
| `gachatype.json` | 가챠 분류 |
| `resource_links.json` | 공략 링크와 기프트 코드 |
| `wheel_list.json` | 명륜 목록 |
| `silverkey_list.json` | 은열쇠 목록 |
| `covenant_list.json` | 비밀계약 목록 |
| `party_builder_rules.json` | 파티 빌더 규칙 |
| `db_tooltips.json` | 실제 사용 중인 공통 툴팁 사전 |
| `latest_wheel_recommendations.json` | 최신 명륜 추천 |
| `rerun_schedule.json` | 복각 일정 |
| `patch_notes.json` | 패치노트 |

`db_tooltips.json`은 이름과 달리 `links.html`과 파티 빌더가 실제 사용하므로 이관한다.
Firestore와 새 코드에서는 `tooltips` 데이터셋으로 취급하되, 정적 스냅샷 파일명은 기존
호환성을 위해 유지한다.

### 3.2 저장소에만 유지할 추출·생성·검증 데이터

- `covenant_main_stats.json`
- `covenant_main_stats_overrides.json`
- `character_settings_latest.json`
- `latest_settings_asset_map.json`
- `latest_settings_overrides.json`
- `latest_wheel_recommendation_overrides.json`

이 파일들은 사이트가 직접 읽지 않는다. Firestore 운영 데이터의 원본이 아니라 관리 도구의
입력 또는 중간 산출물로 저장소에 유지한다.

### 3.3 이관하지 않을 legacy 데이터

- `data/awakener/tawil.json`
- `data/db_cards.json`
- `data/db_awakener_stats.json`
- `detail.html`과 `js/detail.js`의 구형 상세 페이지 전용 데이터 흐름

현재 주요 캐릭터 이동은 `links.html`을 사용한다. 위 데이터는 Firestore에 넣지 않으며,
마이그레이션과 별개인 legacy 제거 작업에서 참조를 다시 확인한 뒤 삭제한다.

## 4. Firestore 릴리스 모델

Firestore 문서의 최대 크기와 인덱스 증가를 피하기 위해 큰 JSON 전체를 한 문서에 넣지
않는다. 모든 게시 데이터는 불변 릴리스로 저장한다.

```text
published/meta
  currentReleaseId
  schemaVersion
  checksum

releases/{releaseId}
  createdAt
  schemaVersion
  checksum
  documentCount

releases/{releaseId}/documents/{documentId}
  kind
  source
  payloadJson
  checksum
```

문서 구성은 다음과 같다.

- 캐릭터: `character__{characterId}` 문서 한 개씩
  - manifest
  - settings
  - effects
  - gachaType
  - resourceLinks
- 카탈로그: wheels, silverKeys, covenants 각각 한 문서
- 툴팁, 파티 빌더 규칙, 명륜 추천, 복각 일정, 패치노트 각각 한 문서
- 전역 resource link 카테고리와 캐릭터에 속하지 않는 링크 한 문서

새 릴리스의 모든 문서를 먼저 기록하고 검사한다. 해당 릴리스로 만든 Pages 아티팩트가 실제로
배포된 뒤에만 `published/meta` 포인터를 바꾼다. 따라서 업로드나 Pages 배포가 중간에
실패해도 활성 포인터는 이전 정상 릴리스를 계속 가리킨다. GitHub 실행 ID를 숫자 활성화
순서로 저장해 늦게 끝난 과거 실행이 최신 릴리스를 덮지 못하게 한다.

활성 릴리스와 최근 10개 릴리스는 보존한다. 그 밖의 릴리스 중 생성 후 7일이 지난 것은
하위 문서부터 삭제한다. GC는 기본적으로 dry-run이며 배포 워크플로에서만 `--apply`한다.

`payloadJson`은 Firestore가 금지하는 중첩 배열도 손실 없이 저장하기 위한 JSON 문자열이며,
검색 대상이 아니므로 Firestore 단일 필드 인덱스에서 제외한다. 사이트 검색과 필터링은 정적
스냅샷을 받은 브라우저에서 현재 방식대로 처리한다.

## 5. JSON 왕복과 정적 스냅샷

마이그레이션 도구는 다음 작업을 지원한다.

1. 현재 운영 JSON을 정규화된 Firestore 문서 목록으로 변환한다.
2. 문서별 크기와 전체 체크섬을 계산한다.
3. Firestore Emulator 또는 운영 Firestore에 불변 릴리스를 기록한다.
4. 업로드한 비활성 릴리스를 다시 기존 JSON 파일 구조로 복원한다.
5. 원본과 복원 결과를 의미 기준으로 깊은 비교한다.
6. 성공한 스냅샷만 GitHub Pages 배포 디렉터리에 덮어쓴다.

기존 페이지 코드는 계속 `data/*.json`을 읽는다. 정적 파일의 생성 주체만 저장소 수동 편집에서
Firestore 릴리스 내보내기로 바뀌므로 UI와 URL을 한 번에 다시 작성할 필요가 없다.

## 6. resource_links와 Cloudflare 자동화

`resource_links.json`은 1차 전환에서 예외적인 자동화 원장으로 유지한다.

### 공략 링크

1. 사용자가 링크를 제보한다.
2. Cloudflare Worker가 Discord 승인 메시지를 만든다.
3. 승인 시 기존처럼 `resource-links/pending` 브랜치와 PR을 갱신한다.
4. PR이 `main`에 병합되면 GitHub Actions가 전체 데이터를 검증한다.
5. 새 Firestore 릴리스를 비활성 상태로 업로드하고 정적 스냅샷을 배포한다.
6. Pages 배포가 성공한 뒤에만 해당 Firestore 릴리스를 활성화한다.

### 기프트 코드

1. 기존 Worker 크론이 새 코드를 찾는다.
2. 기존처럼 `main`의 `resource_links.json`을 갱신한다.
3. 같은 GitHub Actions 동기화와 정적 배포가 실행된다.

사이트는 이 원장 파일을 직접 제공받지 않고 Firestore에서 다시 생성된 스냅샷을 사용한다.
동기화 또는 검증에 실패하면 Pages 배포를 중단하며 이전 사이트는 유지된다. Git 커밋이
재실행 가능한 변경 기록이므로 Firestore 오류가 데이터 손실로 이어지지 않는다.

2차 전환에서 필요하면 Worker가 Firestore를 직접 갱신하고 GitHub에는 감사 기록만 남기는
구조를 검토할 수 있다. 무료 운영과 현재 기능 보존에는 1차 구조가 더 단순하고 안전하다.

## 7. 보안

- Firestore Security Rules는 브라우저 읽기와 쓰기를 모두 거부한다.
- 운영 동기화는 Firebase Admin SDK와 별도 서비스 계정만 사용한다.
- 서비스 계정 JSON 키는 저장소에 저장하지 않는다.
- 운영 GitHub Actions는 Workload Identity Federation으로만 단기 인증한다.
- 장기 서비스 계정 JSON 키는 로컬과 GitHub 어디에도 저장하지 않는다.
- 로컬 운영 명령은 Application Default Credentials를 사용한다.
- `FIRESTORE_EMULATOR_HOST`가 설정된 경우에만 인증 없이 에뮬레이터에 연결한다.
- 프로젝트 ID, 서비스 계정, 인증 파일과 임시 스냅샷은 커밋하지 않는다.

## 8. 배포와 롤백

GitHub Pages 배포는 두 모드를 가진다.

- `repository`: 현재 저장소의 `data/*.json`을 사용한다.
- `firestore`: 이번 실행에서 업로드·검증한 비활성 릴리스를 임시 디렉터리로 내보내고,
  Pages 성공 뒤에 활성화한다.

Firebase 프로젝트와 GitHub 인증이 준비되기 전에는 `repository`가 기본값이다. 운영 전환은
GitHub 저장소 변수 `SITE_DATA_SOURCE=firestore`를 설정하는 한 단계로 수행한다. 문제가 생기면
변수를 `repository`로 되돌리고 Pages 워크플로를 다시 실행한다.

Firestore 동기화가 실패한 커밋은 Pages에 배포하지 않는다. 단, Firebase 설정 전
`repository` 모드에서는 기존 배포를 계속 허용한다.

## 9. 구현 단계

### 1단계: 기반과 검증

- 데이터셋 목록을 코드로 고정한다.
- JSON → Firestore 문서 변환기와 역변환기를 구현한다.
- 체크섬, 문서 크기, 참조 무결성, 왕복 동등성 테스트를 작성한다.
- legacy 및 관리용 JSON이 문서 목록에 포함되지 않는지 테스트한다.

### 2단계: Firebase 로컬 환경

- Firebase CLI와 Admin SDK를 개발 의존성으로 고정한다.
- `firebase.json`, Firestore Rules, 인덱스 제외 설정을 추가한다.
- Firestore Emulator에서 import → activate → export를 검증한다.
- 로컬 에뮬레이터에는 Java 21 이상이 필요하며, PR 워크플로가 Java를 자동 준비한다.

### 3단계: 정적 사이트 빌드

- 공개 사이트에 필요한 파일과 디렉터리만 허용 목록으로 Pages 아티팩트에 복사한다.
- 선택한 데이터 소스의 JSON을 `data/`에 배치한다.
- 임시 파일, 인증 파일, 개발 의존성과 내부 설정을 배포에서 제외한다.
- 기존 페이지 전체 테스트를 실행한 뒤 Pages를 배포한다.

### 4단계: 자동화 연동

- `main` 변경 시 운영 JSON을 새 Firestore 릴리스로 동기화한다.
- `resource_links.json` 변경도 같은 동기화에 포함한다.
- 공개 저장소용 표준 GitHub Actions 러너만 사용한다.
- 동일 커밋과 동일 체크섬의 중복 릴리스 생성을 방지한다.

### 5단계: 운영 전환

- Firebase Spark 프로젝트와 서울 리전을 생성한다.
- GitHub Workload Identity Federation과 저장소 변수를 설정한다.
- 초기 릴리스를 업로드하고 원본/복원 체크섬을 비교한다.
- `SITE_DATA_SOURCE=firestore`로 전환한다.
- 페이지별 기능과 반응형 동작을 확인한다.
- 안정화 기간 뒤 운영 JSON의 역할과 legacy 파일 삭제를 별도 PR에서 정리한다.

## 10. 운영 전환 체크리스트

- [ ] 결제 계정이 연결되지 않은 Spark 프로젝트인가?
- [ ] Firestore 위치가 `asia-northeast3`인가?
- [ ] 브라우저의 Firestore 읽기와 쓰기가 모두 거부되는가?
- [ ] 원본 JSON과 Firestore 왕복 결과가 일치하는가?
- [ ] Firestore 문서가 크기 제한보다 충분히 작은가?
- [ ] 캐릭터와 장비·계약·가챠·링크 참조가 모두 유효한가?
- [ ] 전체 Node 테스트가 통과하는가?
- [ ] 공략 링크 승인 PR이 기존과 동일하게 생성되는가?
- [ ] 기프트 코드 자동 반영이 기존과 동일하게 작동하는가?
- [ ] Firestore 오류 시 Pages 배포가 중단되고 이전 사이트가 유지되는가?
- [ ] `repository` 모드 롤백이 동작하는가?
- [ ] 320, 360/390, 768, 1024, 1280px에서 주요 페이지가 정상인가?
- [ ] Firebase, Cloudflare, GitHub 무료 사용량을 확인했는가?

## 11. 이번 브랜치에서 하지 않는 일

- Firebase 운영 프로젝트를 임의로 생성하지 않는다.
- 결제 계정을 연결하거나 Blaze 요금제로 전환하지 않는다.
- 검증 전 기존 JSON을 삭제하지 않는다.
- `detail.html` legacy 제거를 Firebase 이관과 같은 커밋에 섞지 않는다.
- UI 디자인을 변경하지 않는다.
