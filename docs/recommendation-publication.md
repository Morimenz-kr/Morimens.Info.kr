# 추천 세팅 자동 게시

추천 세팅은 융재 전투 정보의 현재 기수와 별도로 **실제 상세 자료가 게시된 최신 기수**를 읽는다.
새 기수 자료가 없거나 검증·업로드에 실패하면 기존 기수를 삭제하거나 빈 자료로 교체하지 않는다.
원본 기록과 `.generated/`는 Git에 올리지 않는다. 게시 대상은 검증된 익명 스키마뿐이다.

## 실행 경로

비공개 추출기의 `Morimens DZone Sync` 작업은 기존 00/03/06/09/12/15/18/21시 KST에 실행한다.
게임 실행 중에는 기존 정책대로 수집을 건너뛰며, PC가 켜져 있고 사용자가 로그인되어 있어야 한다.
수집 → 전체 보관본 감사 → 기존 채용률 게시 → 공개 통계 Git 푸시 → **추천 자료 생성·게시·운영 조회 검증** 순서다.
`live-usage/run-dzone-sync.ps1`이 `publish-dzone-recommendations.ps1`을 호출한다.
설치 도구에도 새 래퍼가 포함되어 PC 이전·재설치 때 빠지지 않는다.

래퍼는 갱신된 clean push checkout의 `tools/publish-dzone-recommendations.mjs`를 사용한다.
수집 기수는 게임 서버가 확인한 `dzone-active-season.json`에서 가져온다.
다음 번호를 추정하거나 `dzone_season75.json` 같은 미래 전투 정보 파일을 요구하지 않는다.
장비·옵션 변환에는 비공개 환경의 검증된 client-config 카탈로그가 필요하다.

## 검증과 게시

- 서버 기수, 시작 시각, 35개 스테이지, 합계 건수, 전체 감사의 SHA-256과 오류 0개를 확인한다.
- 전체 상세 보관본으로 각성체별 장비·옵션과 파티 자료를 생성한다. 잘못된 원본은 게시를 중단한다.
- 생성 완료 목록 `publication.json`만 읽는다. 이전 생성에서 남은 파일은 게시 대상에 섞지 않는다.
- 각성체별 건수와 파티 구성원별 건수를 교차 대조하며, 누락된 상세 파일을 허용하지 않는다.
- 전체 검증 후 운영 KV의 이전 수집 시각을 확인한다. 더 최신인 자료는 덮어쓰지 않는다.
- 데이터 묶음을 모두 업로드한 뒤 기수 인덱스를 마지막에 게시한다. 과거 기수는 유지한다.
- 기본 운영 API와 필요 시 지정 기수 API를 다시 읽어 모든 자료의 SHA-256을 검증한다.
  KV 전파 지연은 10초 간격으로 최대 3분 기다린다. 최종 불일치는 실패다.
- 같은 자료는 데이터 재업로드를 생략한다. 완료 기록은 `.generated/recommendations-publish/{period}/verified.json`이다.

Cloudflare 인증은 기존 예약 작업과 같은 Windows 사용자 계정의 Wrangler OAuth를 사용한다.
GitHub Actions는 게임 원본과 로컬 카탈로그에 접근하지 않는다. 코드 푸시만으로 원본 수집이 실행되지는 않는다.
설치된 `private-tools/output/dzone-recommendations-status.json`과 `dzone-sync.log`에서 결과를 확인한다.
실패 시 작업 전체가 실패로 종료하고 다음 정규 수집 시각에 다시 처리한다.

## 수동 검증

```powershell
node tools/publish-dzone-recommendations.mjs --archive <상세보관폴더> --catalog <검증된카탈로그폴더> --season <활성기수.json> --overview <집계.json> --audit <전체감사.json> --dry-run
node --test tools/publish-dzone-recommendations.test.cjs
```

`--dry-run`은 실제 생성·스키마·건수 검증을 수행하고 운영 쓰기를 하지 않는다.
테스트는 미래 기수 전환, 과거 기수 유지, 개인정보 제거, 누락·건수 오류, 업로드 실패,
더 최신 자료 보호, 전파 지연과 운영 조회 실패를 포함한다.
