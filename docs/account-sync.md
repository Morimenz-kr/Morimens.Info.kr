# 계정·개인 기록 동기화

2026-11-21 KST. `codex/dzone-clear-recommendations`에 구현. 운영 인증·Rules·결제·배포는 변경하지 않았다.
앞선 사용량 조사는 [login-sync-readiness.md](login-sync-readiness.md)에 조사 시점의 스냅샷으로 보관한다.
그 문서의 로컬 브랜치·도구 설치·미실행 테스트 설명은 조사 당시 기준이며, 아래가 구현 결과다.

## 구현한 동작

- 보유 현황과 파티 편성 페이지에서 Google 팝업 로그인, 선택적 게임 UID, 저장 상태 표시.
- 게스트 기록은 기존 키에 유지하고 로그인 기록은 Firebase UID별 로컬 캐시에 분리.
- 최초 로그인 때 가져오기 선택. 계정 값 유지하고 추가 / 브라우저 값으로 교체 / 나중에.
  기존 브라우저 원본은 덮어쓰지 않는다. 같은 계정의 파티 중복 가져오기는 페이지 내용을 비교한다.
- 각성체 보유·육성, 명륜, 프리셋, 파티와 융재 관측 기반 추천 출처(`usageSource`, `usagePeriod`) 보존.
- 변경 후 15초 묶음 저장, 자동 저장 간격 최소 60초. 수동 저장 가능. 변경 없는 문서는 쓰지 않는다.
- 시작/수동 새로고침/동일 계정 탭의 저장 변경에서 서버 확인. 상시 실시간 리스너와 주기 폴링은 없다.
  다른 기기의 변경은 다시 불러오기나 다음 저장 트랜잭션에서 확인한다.
- 필드별 3방향 병합, 파티 페이지/팀은 안정적인 ID로 병합. 같은 값 수정이 겹치면 선택 전까지 전송을 멈춘다.
- 통신·할당량 오류는 로컬 미전송 기록을 유지하며 무한 재시도하지 않는다. JSON 백업 제공.
- 탈퇴는 재인증→삭제 잠금 표식→개인 문서 삭제→Auth 사용자 삭제. 취소하면 삭제하지 않는다.
  게스트 기록은 남기며, 삭제된 계정의 다른 기기 지연 쓰기는 거부한다.
- 게임 UID로 인게임 기록 자동 조회, 기존 Worker 경유, Identity Platform 전환은 포함하지 않았다.

## 저장 경로와 제한

`users/{firebaseUid}`는 `gameUid`, 상태, revision, 생성/변경 시각을 보관한다.
`users/{firebaseUid}/state/roster`와 `.../parties`는 각 JSON 문자열, schemaVersion/revision/서버 시각을 보관한다.
64KiB ASCII JSON 상한과 payload 색인 제외를 적용한 후보 Rules/색인을 별도 파일에 둔다.
Rules는 본인 문서 직접 읽기만 허용하며 목록 조회·다른 계정·기존 사이트 데이터 접근을 거부한다.
상태 쓰기는 부모 active 상태 확인으로 추가 Rules 읽기가 발생한다. JSON 내부 의미 검증은 클라이언트가 하며,
Rules에서는 문자열 크기와 문서 필드·revision·소유권·삭제 상태를 검사한다. 사용자 내용은 실행하지 않는다.

한글 ASCII 이스케이프와 추천 출처를 포함한 크기이므로 파티가 많으면 64KiB에 먼저 도달할 수 있다.
초과 기록도 게스트/계정 로컬 저장에는 남으며 클라우드 전송만 오류가 된다. 현재 자동 문서 분할은 없다.
민감한 공유 컴퓨터에서는 계정 캐시와 Firebase 로그인 상태가 남을 수 있다. 로그아웃은 계정의 미전송 캐시를 지우지 않는다.

## 로컬 실행과 검증

Node/npm 의존성과 Java 21 이상이 필요하다. 운영 키 없이 데모 에뮬레이터만 사용한다.

```sh
npm ci
npm run account:build
npm run account:emulators
# 별도 터미널
node tools/test-account-browser.mjs --serve
```

`http://127.0.0.1:9357/inventory_checker.html?accountEmulator=1`에서 Google 에뮬레이터 또는 테스트 계정 사용.
운영 호스트에서는 이 쿼리로 에뮬레이터를 켤 수 없다. 생성 SDK는 커밋하지 않고 Pages 빌드에서 번들한다.

```sh
npm test
npm run data:validate
npm run account:test
# account:emulators 실행 중, preview 서버는 종료한 상태
node tools/test-account-browser.mjs
npm run pages:prepare -- --data-source repository
npm run pages:roster
```

Rules 테스트는 타인 접근, 목록 조회, 잘못된 필드/시간/revision/크기, 삭제 잠금과 재생성 방지를 검사한다.
실제 Firebase SDK로 두 기기 병합·충돌·삭제, Admin 정리 도구의 Auth 존재 확인도 에뮬레이터에서 검증한다.
브라우저 검증 결과와 화면은 `.generated/account-browser/`에 로컬 생성한다.
실제 운영 Google 제공자·모바일 Safari/실기기는 운영 설정 후 별도 smoke test가 필요하다.

이번 확인 결과: 전체 테스트 561개, 계정 Emulator 통합 3개, 브라우저 화면 검증 38개 통과.
320/390/767/768/769/1024/1280px, 844×390 가로, 200% 글자 확대에서 가로 넘침 없이 동작했다.
가져오기·충돌 선택·삭제와 에뮬레이터 Google 팝업도 통과했고 계정 흐름의 Worker 요청은 0건이었다.
전체/별도 보유 현황 Pages 산출물 빌드와 데이터 검증(오류 0)도 통과했다.

## 운영 활성화에 필요한 변경 — 이번 작업에서는 실행하지 않음

### 실제 Google 계정으로 로컬에서 테스트하려면

가상 계정 화면을 실제 Google 로그인으로 바꾸려면 아래 설정을 먼저 해야 한다.
등록/인증 제공자 활성화/승인 도메인/Rules 게시 자체가 Firebase 운영 설정 변경이므로 이번에는 실행하지 않았다.

1. `khj613401@gmail.com`으로 [mythag-kr 프로젝트 설정](https://console.firebase.google.com/project/mythag-kr/settings/general)에
   들어가 **내 앱 → 웹 앱 추가(</>)**를 선택한다. Firebase Hosting 연결은 선택하지 않아도 된다.
2. [Authentication 로그인 방법](https://console.firebase.google.com/project/mythag-kr/authentication/providers)에서
   **Google**을 켜고 공개 앱 이름·지원 이메일을 지정해 저장한다.
3. Authentication → Settings → Authorized domains에 **localhost**를 추가/확인한다.
   신규 프로젝트는 기본 승인 목록에 localhost가 없을 수 있다. 호스트만 입력하며 포트·전체 URL은 넣지 않는다.
4. 웹 앱의 **공개 firebaseConfig**를 `config/firebase-client.js`의 `config`에 넣고 `enabled: true`로 설정한다.
   이 설정을 공개 배포하지 않은 상태로 로컬에서만 실행한다. URL은
   `http://localhost:9357/inventory_checker.html`을 사용하고 **accountEmulator=1을 제거**한다.
   팝업 제한이 있는 내장 브라우저에서는 일반 Chrome에서 같은 URL을 연다.
5. 현재 Firestore 운영 Rules는 전체 거부이므로 Google 인증 성공과 기록 동기화 성공은 다르다.
   전체 동기화 테스트에는 아래 후보 Rules/색인 검토·게시가 먼저 필요하다. DB 테스트 모드나 전체 공개 Rules는 사용하지 않는다.
6. 실제 테스트 계정으로 로그인→가져오기→저장→다른 브라우저에서 같은 계정 조회→탈퇴를 확인한다.
   실제 사용자/개인 문서가 프로젝트에 만들어지고 기존 무료 사용량과 합산된다.

프로젝트 관리 설정을 하는 운영자 계정과 사이트 로그인 테스트용 Google 계정은 구분한다.
서비스 계정 키나 OAuth client secret은 필요하지 않으며, 결제 연결·Identity Platform 전환도 하지 않는다.
현재는 공개 config와 제공자 설정이 없어 실제 Google 인증 성공은 검증하지 않았다.
근거: [웹 앱 등록](https://firebase.google.com/docs/web/setup),
[Google 제공자 설정](https://firebase.google.com/docs/auth/web/google-signin),
[localhost 승인 도메인](https://firebase.google.com/docs/auth/faq-and-troubleshooting).

### 사이트 전체 공개 시 추가 절차

1. 운영자 `khj613401@gmail.com`으로 Firebase `mythag-kr`에 웹 앱 등록, Authentication 초기화와 Google 제공자 활성화.
   결제 연결과 Identity Platform 업그레이드는 필요하지 않다. 등록한 웹 앱의 공개 Firebase config만 사용한다.
2. 승인 도메인에 `morimenz-kr.github.io`, `morimens-roster.pages.dev` 등 실제 제공 호스트를 등록한다.
   조사 당시 `morimens.info.kr`은 DNS 해석이 안 됐다. 호스트 변경 시 실제 운영 주소를 재확인한다.
   서로 다른 origin의 게스트 기록은 각 주소에서 따로 가져와야 한다.
3. `firestore.account.rules`와 `firestore.account.indexes.json`을 검토해 운영 `firestore.rules`/색인에 반영하고
   Rules/색인을 먼저 배포한다. 현재 `firebase.json`은 기존 전체 거부 Rules를 계속 가리킨다.
4. 삭제 표식 정리를 운영 가능하게 준비한다. 기존 OIDC 서비스 계정은 Datastore 권한 외에
   `firebaseauth.users.get` 권한이 필요하다. 현재 권한을 추가하지 않았다.
   `tools/account-cleanup.mjs --project mythag-kr`는 dry-run이며 `--apply`를 붙일 때만 정리한다.
   Auth 사용자가 실제 없고 요청 후 24시간 지난 표식과 고정된 2개 상태 문서만 삭제한다.
   Auth 삭제 실패 계정이나 권한 확인 실패는 삭제하지 않는다. 1회 최대 100개이므로 잔여량 확인이 필요하다.
   `.github/workflows/account-cleanup.yml`은 main에서 수동 실행만 가능하고 기본 dry-run이다.
   정기 스케줄은 아직 없다. 공개 전 운영자가 일일 실행/점검 일정을 마련해야 한다.
5. `config/firebase-client.js`에 공개 웹 앱 config를 넣고 `enabled: true`로 전환할 준비를 한다.
   서비스 계정 키·OAuth secret은 넣지 않는다. 현재는 `enabled: false, config: null`이다.
6. 제한된 테스트 계정으로 실제 도메인 Google 로그인·가져오기·탈퇴를 확인한 후 공개 배포한다.
   이 브랜치 push 자체로 운영 Pages/Worker를 배포하지 않는다.

## 무료 운영 판단

조회 시점 Spark/결제 미연결, 기존 Firestore 일 최대 읽기 2,669·쓰기 307·삭제 284였다.
기존 사용량을 포함한 추정과 무료량 적용 단위는 조사 문서를 참조한다. 새 컬렉션/Worker에 별도 무료량이 생기지 않는다.
로그인·동기화는 Worker를 거치지 않는다. Firestore 읽기·쓰기·저장·외부 전송은 기존 프로젝트와 합산된다.
기존 외부 전송 실제량은 조회하지 못했으므로 모든 규모에서 추가 비용 없이 충분하다고 확정할 수 없다.
3,000 DAU/일 2회 방문·4회 저장 추정은 전송량이 월 무료량을 넘을 수 있다. Spark 초과 시 요청 제한과
동기화 지연이 발생할 수 있고 기존 Firestore 데이터 배포 작업도 영향을 받는다. 결제 연결로 해결하지 않는다.

공식 근거: [Google 로그인](https://firebase.google.com/docs/auth/web/google-signin),
[Firestore 한도](https://firebase.google.com/docs/firestore/quotas),
[Rules 의존 읽기 과금](https://firebase.google.com/docs/firestore/pricing),
[사용자 삭제·재인증](https://firebase.google.com/docs/auth/web/manage-users).
