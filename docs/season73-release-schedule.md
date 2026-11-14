# 73기 정식 배포 예약

- 실행 시각: 2026-11-09 10:00 Asia/Seoul (01:00 UTC).
- 워크플로: `.github/workflows/season73-release.yml`.
- 검증된 정식 전환 커밋: `68be0655ed6109c3598b4156cdfe8bc17d7593d5` (`codex/dzone-season73-audit`).
- 예약 설정만 main에 먼저 반영하며, 73기 전환 코드는 예약 실행 때 병합한다.
- GitHub 호스팅 러너에서 실행하므로 개인 컴퓨터나 Codex 앱의 실행 상태에 의존하지 않는다.

예약 작업은 당시 main에 고정된 전환 커밋을 병합하고 73기 기본 선택·72기 보관·원본 기반 여섯 의도 변형 및 단위 테스트·데이터 검사·배포 산출물을 검증한다. 강제 푸시 없이 main에 반영한 뒤 `pages.yml`을 명시적으로 실행한다. GITHUB_TOKEN으로 푸시한 커밋은 일반 push 워크플로를 시작하지 않으므로 별도 dispatch가 필요하다. 기존 Pages 작업의 Firestore import·배포·활성화 완료를 기다린 후 운영 데이터와 Chrome 렌더링을 확인한다.

`workflow_dispatch`의 `dry_run` 기본값은 true다. 드라이런은 병합과 검증까지만 수행하며 원격 main 변경·운영 배포를 하지 않는다. 실제 배포는 11월 9일 오전 10시부터 24시간 동안만 허용한다. 연도 조건이 없는 cron이 다음 해 실행되더라도 시간 검사에서 종료하므로 재배포하지 않는다. GitHub 예약은 서버 부하에 따라 시작이 지연될 수 있으며, 배포 완료는 검증·빌드 시간만큼 뒤따른다.

검증 명령:

```sh
node --test tools/scheduled-season73-release.test.cjs
gh workflow run season73-release.yml --ref main -f dry_run=true
```

로컬 Codex의 기존 73기 10시 예약은 GitHub 드라이런 성공 후 해제해 중복 실행을 막는다.
