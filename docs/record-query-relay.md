# 직접 게임 조회의 공개 중계 경계

`records.html`의 실전 기능은 `workers/record-query-worker.mjs`를 통해 공개 GET 경로만 사설 Windows·Steam 조회 호스트로 중계한다. 정적 자료는 `js/record-catalog-client.js`로 Steam 없이 읽을 수 있다.

## 현재 상태

2026-10-08 사용자의 배포 철회 요청으로 공개 workers.dev/미리보기 접근을 비활성화하고 현재 PC 중계 프로세스를 중단했다. 구현·암호화 설정은 보존하지만 운영 중이 아니다. 명시적 재배포 요청 전에는 다시 활성화하지 않는다. 아래는 철회 전의 검증·운영 이력이다.

2026-10-08에 별도 Worker를 배포했다: `https://morimens-record-query.khj613401.workers.dev`. 사용자가 선택한 현재 PC의 **외부 접속형 중계**를 연결했으며 공개 주소를 통한 게임 서버 직접 조회가 성공했다. Cloudflare Tunnel·자체 도메인·PC 포트 개방을 사용하지 않는다. AWS나 별도 Windows 서버도 만들지 않았다.

## 현재 운영: 외부 접속형 중계

`RECORD_QUERY_MODE=pull`이다. PC의 `private-tools/record-relay-agent.mjs`가 인증된 HTTPS로 다음 작업을 받아, `127.0.0.1:8770`의 읽기 전용 API에서 처리한 공개 결과만 돌려준다. 게임 로그인·Steam 티켓·원본 전송 예외를 보내지 않는다.

- 최초 한 번: `powershell -NoProfile -ExecutionPolicy Bypass -File private-tools/start-record-relay.ps1 -Configure`.
- PC를 다시 켜거나 중계를 종료한 뒤에는 같은 명령에서 `-Configure`를 빼고 실행한다. 이번에는 실행한 상태로 남겨두었다. 시작 프로그램이나 Windows 서비스는 만들지 않았다.
- 중계 비밀값은 로컬 DPAPI 암호화 파일과 Cloudflare Secret에만 저장한다. 저장소·HTML/JS·명령행에 평문을 넣지 않는다. 실행 시 PC의 현재 Windows 사용자로 복호화한다.
- Steam 로그인과 게임 종료가 필요하다. 다른 PC에서 같은 Steam 계정의 인증 상태를 바꾸면 새 조회가 실패할 수 있다. 중계는 게임을 자동 종료하거나 재로그인하지 않는다.
- 작업은 동일 GET 경로로 중복 제거하고 최대 20건만 대기한다. 공용 요청은 HTTP 202 후 20초 간격으로 결과를 확인하며, 브라우저 대기는 최대 310초이다. 페이지를 떠나면 브라우저 폴링을 취소한다. 이미 시작한 서버 읽기 작업은 최대 300초 제한까지 끝날 수 있다.
- 완료된 공개 결과는 최대 60초 캐시한다. 비공개/실패 응답은 안전한 오류 코드만 보존하고 짧게 만료한다. 미수집·실패를 기록 없음으로 만들지 않는다.
- 중계 작업·분할 결과는 Durable Object에 보관한다. 워커 인스턴스가 바뀌어도 완료 결과를 다시 읽을 수 있다. 연결/대기/실패는 실제 게임 조회 성공과 별개다. `/api/health`는 `hostConnected`를 표시하지만 `gameQueryVerified=false`를 유지한다.
- 호스트 전용 `/__relay/next`, `/__relay/result`는 중계 비밀값을 요구하며 브라우저 Origin 요청을 거부한다. 공개 임의 POST/사설 경로/원본 RPC는 허용하지 않는다.

공개 중계에서 본인의 최신 기록 코드·15턴·피해 합계 2,636,232를 확인했다. 개인 검증 fixture는 Pages/Git 배포물에서 제외한다.

## 선택적 대안: HTTPS 원점형 중계

아래는 `RECORD_QUERY_MODE`를 pull이 아닌 원점형으로 운영할 때의 대안이다. 현재 운영에는 터널/원점 주소가 필요하지 않다.

- 조회 호스트: Windows, Steam 로그인, Morimens 종료, 검증한 게임 DLL/스키마. 개인 계정 대신 운영 용도가 정해진 계정과 호스트를 권장한다.
- 로컬 API: `node private-tools/record-feature-api.mjs`, 바인딩은 `127.0.0.1:8768` 유지.
- 조회 호스트의 비밀 환경 변수 `MORIMENS_RECORD_RELAY_TOKEN`: 32~256자. 터널 연결 시 반드시 구성한다. 설정 후 모든 로컬 API 요청은 같은 `X-Morimens-Relay` 인증을 요구한다. 값을 저장소·브라우저 JS·명령행 인자로 넣지 않는다.
- 인증된 사설 연결의 HTTPS 원점 주소. Cloudflare Tunnel을 사용한다면 원점 `httpHostHeader`를 `127.0.0.1:8768`로 고정한다. 다른 Host/Origin은 로컬 API가 계속 거부한다.
- Worker 비밀 설정 `RECORD_QUERY_TOKEN`: 로컬 중계 인증값과 동일. Steam 티켓·로그인 암호가 아니다.
- Worker 환경 설정 `RECORD_QUERY_ORIGIN`: 경로/사용자명/비밀번호 없는 HTTPS 원점 주소. 브라우저 입력으로 원점을 바꿀 수 없다.
- Worker 환경 설정 `RECORD_ALLOWED_ORIGINS`: 실제 팬사이트 Origin만 쉼표로 나열. 브라우저에 중계 인증값을 전달하지 않는다.
- `workers/record-query.wrangler.jsonc`: 별도 Worker와 SQLite Durable Object 속도 제한. 기존 피드백 Worker 설정/마이그레이션을 바꾸지 않는다.

설정된 경우에만 별도 Worker 설정을 선택해 Wrangler로 배포한다. 기존 Worker 배포 명령이 이 설정을 자동 선택하지 않는다.

## 제한 및 검증

공개 API는 GET/OPTIONS만 허용하고 경로를 허용 목록으로 검사한다. 호스트 전용 인증된 결과 전달 POST는 공개 API와 분리한다. 읽기 쿼리의 응답은 12MiB, 선택적 HTTPS 원점형의 사설 원점 대기는 25초로 제한한다. 원점 리디렉션을 따라가지 않는다. 임의 RPC/세션/원본 예외를 공개 응답에 넣지 않는다. 중계 인증은 서버 간에만 전송하고 응답에서 제거한다.

Durable Object는 클라이언트 IP의 SHA256 이름으로 분당 10회/시간당 60회를 원자적으로 제한한다. IP 자체를 객체 저장값에 기록하지 않는다. 원점의 조회 직렬화·2초 간격·시간당 60회·60초 캐시도 유지한다. 캐시는 원점의 공개 필드 처리 결과에만 적용된다. 공유 기록이 비공개/접근 불가이면 오류 상태로 보존한다.

`/api/health`의 `configurationPresent`는 환경 설정 존재만 뜻하며 `gameQueryVerified=false`다. 운영 후 본인 UID와 허용된 외부 공개 기록의 실조회·제한·취소/타임아웃·개인정보 변경 반영·장애 복구·터널 인증을 따로 확인해야 한다. Worker 단위 테스트를 실제 공개 운영 검증으로 해석하지 않는다.
