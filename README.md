# Morimens.Info.kr

모리멘스 캐릭터·장비·공략 정보를 제공하는 정적 웹사이트입니다. GitHub Pages에는 저장소 전체가 아니라 검증을 통과한 `dist/` 산출물만 배포합니다.

## 개발 환경

- Node.js 24 이상(LTS)
- 외부 npm 패키지 없음

처음 내려받은 뒤 별도 설치 과정 없이 다음 명령으로 전체 품질 게이트를 실행할 수 있습니다.

```powershell
node tests/run-quality-gate.mjs
```

`npm run check`도 같은 진입점을 호출합니다. Windows 실행 정책이 `npm.ps1`을 차단하는 환경에서는 위 Node 명령이나 `npm.cmd run check`를 사용합니다.

이 명령은 순서대로 다음 작업을 수행하며 하나라도 실패하면 비정상 종료합니다.

1. HTML·CSS·JavaScript·JSON 및 로컬 참조 감사
2. 전체 캐릭터와 장비·세팅·파티 규칙 관계 검증
3. 편집 기준 원본과 커밋된 런타임 데이터 샤드 동기화 검증
4. `dist/` 클린 빌드
5. 데이터·색 대비·배포 산출물·Worker 보안 경계 테스트

개별 명령은 다음과 같습니다.

```powershell
npm run audit
npm run validate:data
npm run generate:data-shards
npm run check:data-shards
npm run build
npm test
```

`npm test`의 배포 테스트는 최신 `dist/`가 필요하므로, 일반 작업 완료 전에는 항상 단일 품질 게이트를 사용합니다.

## 주요 구조

- 루트 `*.html`: 공개 페이지와 의미 구조
- `css/common.css`, `css/components.css`: 디자인 토큰과 공통 UI
- `css/pages/`, 페이지별 CSS: 화면별 레이아웃
- `js/ui/`: 공통 UI 동작
- `js/`, 페이지별 JavaScript: 화면 제어 및 데이터 표현
- `data/`: 편집 기준 원본, 런타임 인덱스와 경로별 생성 샤드
- `shared/`: 생성기와 Worker가 함께 쓰는 데이터 계약
- `workers/feedback-worker.js`: 신고·정보 제안 API와 승인 흐름
- `tools/`: 감사, 데이터 검증, 배포 빌드
- `tests/`: Node 내장 테스트 기반 회귀 방지 계약

구조 원칙과 변경 경계는 [docs/architecture.md](docs/architecture.md), 새 캐릭터 추가 절차는 [docs/new-character-checklist.md](docs/new-character-checklist.md)를 참고하세요.

## 배포

PR과 `main` 브랜치 푸시에서 동일한 `node tests/run-quality-gate.mjs`를 수행합니다. PR에서는 검증만 실행하고, `main` 푸시 또는 수동 실행에서만 검증이 끝난 `dist/`를 GitHub Pages 아티팩트로 배포합니다. `images/`에는 런타임 WebP와 소셜 미리보기용 `background.png`만 두며, 편집 원본·압축 파일은 저장소와 배포 산출물에 포함하지 않습니다.
