# Firebase 마이그레이션 작업 인계 기록

마지막 기록: 2026-08-15 KST

## 현재 상태

- 작업 브랜치: `codex/firebase-data-migration`
- 아직 커밋하거나 푸시하지 않은 로컬 변경 상태
- 기본 운영 모드는 안전 전환을 위해 `repository`로 유지 중
- 기존 사용자 변경인 `.idea/workspace.xml`은 작업 범위에서 제외할 것

## 구현 완료

- 실제 사이트에서 쓰는 JSON 13종의 Firestore 문서 변환과 원본 형태 복원
- 중첩 배열을 포함한 임의 JSON을 `payloadJson`으로 보존하는 스키마 v2
- 체크섬, 문서 크기, 문서 ID, 문서 수, 스키마, 참조 무결성 검증
- 체크섬 기반 불변 릴리스와 비활성 업로드
- Pages 배포 성공 후 별도 활성화 및 과거 실행의 덮어쓰기 방지
- 활성 릴리스 보호, 최근 10개·최소 7일 보존 GC
- 브라우저 읽기·쓰기 전면 거부 Firestore Rules 및 인덱스 제외 설정
- `.generated/site` 허용 목록 기반 정적 Pages 아티팩트 생성
- `repository` 긴급 롤백 경로
- GitHub Pages 배포 및 PR 데이터 검증 워크플로
- WIF 기반 운영 인증 설계와 설정 문서
- Cloudflare 크론을 10분으로 변경하고 KV 상태 쓰기를 실행당 한 번으로 축소
- 기프트 코드의 60초 Pages 폴링 제거
- `/deployment-complete` 콜백, pending 알림 처리, 크론 복구 및 중복 알림 방지

## 확인된 수치

- 운영 캐릭터: 59개
- Firestore 릴리스: 68문서
- 전체 Firestore 문서 추정 크기: 약 1.10MB
- 최대 문서: 약 197KB (안전 제한 750KB)
- Cloudflare 크론 고정 KV 쓰기: 약 144회/일
- 예약 실행 기준 KV 목록 조회: 약 576회/일

## 마지막 검증 결과

- 기존 기능과 Worker 포함 전체 테스트: 173개 통과
- 데이터 검증: 59 캐릭터, 오류 0, 기존 경고 85
- Pages repository 아티팩트 생성 성공
- GitHub Actions YAML 파싱 성공
- 워크플로 정적 검사 4개 통과
- `git diff --check` 통과
- 로컬 Firestore Emulator는 Java 미설치로 아직 실행하지 못함

## 다음 시작점

1. 에이전트가 마지막으로 반영한 기프트 코드 콜백 변경을 직접 코드 리뷰한다.
2. `npm.cmd test`, `npm.cmd run data:validate`, Pages 아티팩트 생성을 다시 실행한다.
3. Java 21 환경 또는 PR CI에서 `npm.cmd run firebase:emulator-test`를 실행한다.
4. 운영 Firestore 업로드·활성화·read-back 및 Rules 배포 확인 완료
5. `.idea/workspace.xml`을 제외하고 변경 범위를 검토한다.
6. 이상이 없으면 의도한 파일만 커밋하고 브랜치를 푸시한다.
7. PR 병합 후 Pages의 repository 배포와 WIF 인증을 확인한 뒤
   `SITE_DATA_SOURCE=firestore`로 전환한다.

## 운영 전 필수 설정

- Firebase 프로젝트 `mythag-kr`와 서울 리전 `asia-northeast3` Firestore 생성 완료
- WIF Provider와 `firebase-pages-publisher` 최소 권한 서비스 계정 생성 완료
- GitHub 변수와 WIF·Cloudflare 콜백 시크릿 등록 완료
- Worker `DEPLOYMENT_CALLBACK_TOKEN` 등록 완료
- Firestore Rules와 인덱스 배포 완료
- 스키마 v2 초기 릴리스 `release-f574c165bf4759430b1e` 활성화 완료

설정 전에는 `SITE_DATA_SOURCE=repository` 기본값을 유지해야 한다.
