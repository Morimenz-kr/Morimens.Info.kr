# Firebase 운영 설정 가이드

이 문서는 코드 구현 이후 운영자가 한 번 수행해야 하는 설정만 다룬다. 기본 배포 모드는
`repository`이므로 아래 설정을 마치기 전에도 기존 GitHub Pages 배포는 계속 작동한다.

## 1. 필요한 도구와 비용 조건

- Node.js 20 이상
- 로컬 Firestore Emulator를 실행할 때만 Java 21 이상
- 저장소에 고정된 Firebase CLI와 Admin SDK (`npm ci`로 설치)
- 결제 계정을 연결하지 않은 Firebase Spark 프로젝트

사이트 브라우저에는 Firebase SDK가 필요하지 않다. Firebase CLI는 프로젝트 초기 설정,
Rules 배포, 에뮬레이터 실행에만 사용한다.

## 2. Firebase 프로젝트 생성

1. Firebase Console에서 새 Spark 프로젝트를 만든다.
2. Cloud Firestore를 Native mode로 만든다.
3. 위치는 서울인 `asia-northeast3`을 선택한다. Firestore 위치는 나중에 바꿀 수 없으므로
   생성 전에 반드시 확인한다.
4. 결제 계정 연결이나 Blaze 전환은 하지 않는다.
5. 실제 프로젝트 ID를 기록한다.

## 3. Rules와 인덱스 배포

운영자 계정으로 한 번 로그인한 뒤 저장소 루트에서 실행한다.

```powershell
npm.cmd ci
npx.cmd firebase-tools login
npx.cmd firebase-tools deploy --only firestore --project 실제_프로젝트_ID
```

`firestore.rules`는 모든 클라이언트 읽기·쓰기를 거부한다. GitHub Actions의 Admin SDK만
IAM을 통해 데이터를 기록한다. Rules 배포 권한은 운영자에게만 두고, Pages용 서비스
계정에는 부여하지 않는다.

## 4. GitHub Workload Identity Federation

장기 서비스 계정 JSON 키는 만들거나 저장하지 않는다. Google Cloud에서 다음 구성만 만든다.

1. Pages 데이터 게시 전용 서비스 계정을 만든다.
2. 서비스 계정에는 대상 프로젝트의 `Cloud Datastore User` 역할만 부여한다.
3. GitHub OIDC용 Workload Identity Pool과 Provider를 만든다.
4. Provider 조건은 정확한 저장소와 `refs/heads/main`만 허용한다.
5. 해당 GitHub principal에 서비스 계정의 `Workload Identity User` 권한을 부여한다.

GitHub 저장소에는 다음 값을 설정한다.

| 종류 | 이름 | 값 |
| --- | --- | --- |
| Actions variable | `FIREBASE_PROJECT_ID` | 실제 Firebase 프로젝트 ID |
| Actions variable | `SITE_DATA_SOURCE` | 초기에는 `repository` |
| Actions secret | `GCP_WORKLOAD_IDENTITY_PROVIDER` | Provider 전체 리소스 이름 |
| Actions secret | `GCP_FIREBASE_SERVICE_ACCOUNT` | 서비스 계정 이메일 |
| Actions secret | `CLOUDFLARE_DEPLOYMENT_CALLBACK_URL` | Worker의 `/deployment-complete` 전체 URL |
| Actions secret | `CLOUDFLARE_DEPLOYMENT_CALLBACK_TOKEN` | Worker의 `DEPLOYMENT_CALLBACK_TOKEN`과 같은 임의의 긴 값 |

PR 워크플로에는 운영 인증이 전달되지 않는다. 운영 인증은 `main` Pages 배포에서
`SITE_DATA_SOURCE=firestore`일 때만 사용된다.

Cloudflare 콜백 시크릿이 아직 없으면 배포는 실패하지 않는다. 기프트 코드 크론이 다음 실행에
공개 데이터를 확인해 알림을 복구하지만, 즉시 알림을 원하면 두 시크릿을 반드시 설정한다.

## 5. 로컬 검증

```powershell
npm.cmd test
npm.cmd run data:validate
npm.cmd run pages:prepare -- --data-source repository
npm.cmd run firebase:emulator-test
```

마지막 명령은 Java가 있어야 한다. 로컬에 Java가 없더라도 PR 검증 워크플로가 Java 21을
준비하고 같은 Emulator 테스트를 수행한다.

## 6. 최초 전환

1. `SITE_DATA_SOURCE=repository` 상태에서 `main` Pages 배포가 통과하는지 확인한다.
2. Rules가 배포되었고 WIF 변수·시크릿이 정확한지 확인한다.
3. `SITE_DATA_SOURCE`를 `firestore`로 변경한다.
4. Pages 워크플로를 수동 실행한다.
5. 워크플로가 다음 순서로 끝나는지 확인한다.
   - 전체 테스트와 JSON 검증
   - 비활성 Firestore 릴리스 업로드와 read-back 검증
   - 해당 릴리스로 `.generated/site` 생성
   - GitHub Pages 배포
   - 배포된 릴리스 활성화
   - 활성 릴리스와 최근 10개를 제외한 오래된 릴리스 정리
6. 사이트의 주요 페이지와 `data/resource_links.json`을 확인한다.

## 7. 롤백

Firebase 인증, 할당량 또는 데이터 게시 문제가 생기면 `SITE_DATA_SOURCE`를 `repository`로
되돌리고 Pages 워크플로를 다시 실행한다. 이 모드는 Firebase 인증과 조회를 모두 건너뛰고
Git에 있는 JSON으로 사이트를 배포한다.

Actions는 생성 JSON을 `main`에 커밋하지 않는다. 결과는 `.generated/site` 아티팩트에만
기록되므로 자동 배포가 자기 자신을 다시 실행하는 루프가 생기지 않는다.
