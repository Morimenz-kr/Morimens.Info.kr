# Morimens.Info.kr 아키텍처

## 목적과 경계

이 저장소는 빌드 프레임워크 없이 동작하는 정적 사이트와 별도 Cloudflare Worker로 구성됩니다. 브라우저 화면, 정적 데이터, 외부 쓰기 API의 책임을 분리하고, 배포 전에 자동 검증 가능한 계약을 두는 것이 핵심 원칙입니다.

```text
브라우저
  ├─ 루트 HTML + css/ + js/
  ├─ data/*.json 읽기
  └─ 신고·정보 제안만 Worker 호출
                         │
                         └─ GitHub / Discord / KV

소스 ── audit + data validation + build + tests ──> dist/ ──> GitHub Pages
```

`dist/`는 편집 대상이 아니라 언제든 다시 만들 수 있는 배포 산출물입니다. 정적 페이지 배포와 Worker 배포는 서로 다른 운영 경계이며, Pages 워크플로는 Worker를 배포하지 않습니다.

## 계층별 책임

| 계층 | 기준 위치 | 책임 | 두지 않는 것 |
| --- | --- | --- | --- |
| 문서 구조 | 루트 `*.html` | 랜드마크, 제목, 입력 레이블, 공통 자산 연결 | 데이터 목록, 인라인 이벤트 로직 |
| 디자인 기반 | `css/common.css`, `css/components.css` | 토큰, 타이포그래피, 포커스, 공통 컴포넌트 | 페이지 전용 배치 |
| 페이지 표현 | `css/pages/`, 페이지 CSS | 화면별 레이아웃과 반응형 조정 | 공통 컴포넌트 재정의 |
| 공통 UI 동작 | `js/ui/` | 대화상자 등 재사용 가능한 상호작용 | 도메인 데이터 |
| 페이지 제어 | `js/` | 데이터 로드, 상태 전환, 안전한 DOM 표현 | 캐릭터·장비 관계의 하드코딩 |
| 페이지 도메인 | `js/<page>/` | DOM과 분리된 계산·정규화·저장 어댑터 | 전역 변경 가능 상태, 화면 질의 |
| 정적 데이터 | `data/` | 캐릭터, 장비, 세팅, 규칙, 정보 링크의 기준 원본 | 화면 제어 로직 |
| 쓰기 API | `workers/feedback-worker.js` | 입력 검증, 인증·인가, 속도 제한, GitHub·Discord 연동 | 공개 페이지 렌더링 |
| 품질 도구 | `tools/`, `tests/` | 정적 감사, 관계 검증, 빌드, 회귀 계약 | 운영 데이터 수정 |

`js/covenant-simulator/` 는 비밀계약 계산·시뮬레이션·저장 계약을, `js/inventory-checker/`는 보유 목록 필터·돌파 연동·v3 저장 이전을 소유합니다. 두 모듈은 DOM이나 전역 변경 가능 상태를 참조하지 않으며, 페이지 제어기가 브라우저 입출력을 연결합니다.

## 데이터 소유권

한 정보는 한 파일이 소유하고 다른 파일은 안정적인 ID로 참조합니다.

| 정보 | 기준 원본 | 참조 키 |
| --- | --- | --- |
| 캐릭터 이름·속성·등급·썸네일 | `data/character_manifest.json` | 캐릭터 `id` |
| 추천 장비 세팅 | `data/character_settings.json` | 캐릭터 `id`, 장비 `english_name` |
| 스킬·고유 효과 | `data/character_effects.json` (원본), `data/character-effects/` (생성 샤드) | 캐릭터 `id` |
| 가챠 분류 | `data/gachatype.json` | 캐릭터 `id` |
| 명륜 | `data/wheel_list.json` | `english_name` |
| 은열쇠 | `data/silverkey_list.json` | `english_name` |
| 비밀계약 | `data/covenant_list.json` | `english_name` |
| 파티 편성 규칙 | `data/party_builder_rules.json` | 캐릭터 `id` |
| 정보 링크 | `data/resource_links.json` (원본), `data/resource-links/` (생성 샤드) | 카테고리 ID 또는 캐릭터 `id` |

추천 정보가 아직 검수되지 않았다면 임의 값을 채우지 않고 `status: "pending"`과 사용자 안내 메시지를 둡니다. 화면은 이 상태를 명시적으로 표현해야 합니다.

런타임 JSON의 정렬·직렬화·안전한 경로 규칙은 `shared/runtime-data-shards.js`가, 정보 링크 분류 ID·Worker 표시명·페이지 제목은 `shared/resource-categories.js`가 단독 소유합니다. 생성기와 Worker가 같은 모듈을 사용하고 품질 게이트가 원본과의 exact-set을 검사하므로 분류·샤드 계약을 별도로 복제하지 않습니다.

## 런타임 흐름

1. HTML이 `config/config.js`와 페이지에 필요한 공통·전용 자산을 로드합니다.
2. 페이지 JavaScript가 `data/runtime-index.json`에서 현재 경로에 필요한 샤드만 찾아 같은 출처에서 가져옵니다. 대형 원본 JSON은 편집·검증용이며 배포 산출물에 포함하지 않습니다.
3. 계산·정규화는 DOM을 알지 못하는 페이지 도메인 모듈이 담당하고, 페이지 제어기는 입출력만 연결합니다.
4. 로딩·빈 결과·오류·정상 상태를 구분해 DOM을 갱신합니다.
5. 외부 데이터와 URL은 검증한 뒤 텍스트 노드와 허용된 속성으로만 표현합니다.
6. 신고나 정보 제안처럼 쓰기가 필요한 작업만 Worker로 전송합니다.

정적 콘텐츠는 GitHub Pages에서 제공하므로 서버 세션이나 비밀 값이 존재하지 않습니다. GitHub·Discord 토큰과 승인자 정보는 Worker 환경 변수 또는 바인딩에만 둡니다.

## 품질 게이트

`node tests/run-quality-gate.mjs`가 로컬과 CI의 단일 진입점이며, `npm run check`는 같은 명령의 편의 별칭입니다. 로컬과 CI 모두 Node.js 24 LTS를 기준으로 합니다. PR에서는 품질 작업만 실행하고 Pages 쓰기 권한과 배포 작업은 `main` 푸시 및 수동 실행으로 제한합니다.

| 단계 | 명령 | 실패 조건 예시 |
| --- | --- | --- |
| 소스 감사 | `npm run audit` | 랜드마크·레이블 누락, 깨진 로컬 참조, 위험 URL, JS 문법 오류 |
| 데이터 관계 | `npm run validate:data` | 캐릭터 필수 데이터·이미지 누락, 존재하지 않는 장비·규칙 ID |
| 런타임 샤드 | `npm run check:data-shards` | 편집 기준 원본과 생성 샤드·인덱스의 누락 또는 바이트 불일치 |
| 배포 빌드 | `npm run build` | 안전하지 않은 출력 경로, 과도하게 큰 단일 파일 |
| 회귀 테스트 | `npm test` | 기준 ID 집합 불일치, 위험 링크·이미지, 태그 대비 저하, 배포 누락·오염·용량 초과, Worker CORS 회귀 |

배포 산출물 계약은 다음과 같습니다.

- 루트의 모든 공개 HTML 경로가 `dist/`에 동일한 내용으로 존재합니다.
- `config/`, `css/`, `data/`, `images/`, `js/` 중 배포 대상 파일만 복사합니다.
- `.zip`, `.psd`, `.ai`, 소스 맵과 편집기 메타데이터를 배포하지 않습니다.
- PNG는 소셜 미리보기용 `images/background.png`만 허용하고, JPEG를 포함한 나머지 배포 이미지에는 WebP를 사용합니다.
- 단일 파일은 2 MiB 이하, 전체 아티팩트는 25 MiB 이하를 유지합니다.
- `data/`, `config/`, `js/`는 빌드 과정에서 변형하지 않습니다.

용량 예산을 바꿔야 한다면 테스트 숫자만 늘리지 말고 실제 전송 비용, 이미지 포맷, 캐시 영향과 대안을 먼저 검토합니다.

## 변경 규칙

- 화면 공통 동작은 `js/ui/`와 공통 컴포넌트로 올리고 페이지에서 복제하지 않습니다.
- 데이터성 규칙은 JavaScript 조건문에 추가하지 않고 해당 JSON 원본에 둡니다.
- 데이터 스키마나 ID를 바꾸면 소비 페이지와 검증 테스트를 같은 변경에서 갱신합니다.
- 새 공개 페이지는 루트 HTML로 추가하고 `npm run check`로 배포 경로 포함 여부를 확인합니다.
- 이미지 원본 PNG를 추가하면 같은 경로의 WebP 대응 파일도 추가합니다.
- `dist/`를 직접 수정하거나 커밋하지 않습니다.
- CI에서 사용하는 외부 Action은 검증한 전체 커밋 SHA로 고정하고 버전 주석을 함께 유지합니다.
- Worker 변경은 [feedback-worker-setup.md](feedback-worker-setup.md)의 환경 변수와 운영 절차를 함께 검토합니다.

## 자동화 밖의 검증

정적 계약만으로 시각적 완성도와 실제 콘텐츠 정확성을 보장할 수는 없습니다. 다음 항목은 변경 시 사람과 실제 브라우저가 확인해야 합니다.

- 반응형 기준 폭과 경계값, 200% 확대, 가로·세로 방향
- 키보드 탐색 순서, 포커스 복귀, 스크린 리더용 이름
- 이미지 크롭, 텍스트 줄바꿈, 겹침과 가로 스크롤
- 추천 세팅, 태그, 공략 내용의 게임 기준 정확성
- 실제 Worker 배포 환경의 KV·Rate Limiter·GitHub·Discord 권한과 장애 복구

자동 테스트는 이 수동 검증을 대체하지 않고, 이미 합의한 구조와 불변조건이 조용히 무너지는 것을 막습니다.
