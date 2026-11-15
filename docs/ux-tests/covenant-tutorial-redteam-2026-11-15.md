# 비밀계약 튜토리얼 독립 레드팀·UI 점검

## 범위

2026-11-15, codex/shared-covenant-editor 작업본. 소스8766과 산출물4185의10단계 튜토리얼을 레드팀과 UI 에이전트가 독립 Chrome 프로필에서 점검했다. 모바일은 설치된 데스크톱 Chrome의 viewport·터치 입력 검사이며 실제 모바일 기기 검사는 아니다. 사용자 프로필·운영 배포는 변경하지 않았다.

## 발견 및 수정

1. **전체 보기에서 직전 부위 기억 소실.** VI 편집→전체 보기→튜토리얼→닫기 후 ‘부위 편집’ 버튼과 VI 제목이 사라졌다. 저장 데이터는 같아서 스냅샷 검사만으로 발견되지 않았다. 공용 편집기의 부위 변경 콜백에 보기 정보를 함께 전달하고, 시뮬레이터가 재렌더링할 때 직전 부위와 전체 보기 상태를 복원한다. 명시적인 세팅 초기화에서는 이 UI 기억도 초기화한다. v45에서 수정하고 최종v47 양쪽8사례에서 실제 VI 편집 복귀까지 확인했다.
2. **가로 화면의 다음 버튼 터치 불가.** 844×390,9단계에서 ‘다음’ 하단이402.7px에 있었고 카드를 스크롤하면 위치 계산이 내부 scrollTop을0으로 돌려놓아 버튼을 누를 수 없었다. 카드 내부 스크롤은 강조 위치 재계산에서 제외하고, 재배치 중에도 카드의 스크롤을 유지한다. v46 전수 터치 검사와 최종v47 양쪽 가로 화면에서 scrollTop0→26 유지·다음→완료를 확인했다.

사용자 추가 요청에 따라 안내 중 배경 페이지의 스크롤을 잠근다. 카드 밖의 wheel·단일 touch 이동을 차단하고 긴 설명은 카드 안에서 읽을 수 있게 한다. 단계 전환의 자동 위치 이동은 유지하며, 종료하면 기존 overflow 설정·스크롤·포커스를 복원한다. Ctrl/Meta 확대 및 다중 터치는 확대 제스처를 방해하지 않도록 예외로 둔다.

## 최종 결과

- **레드팀 v46:96교차 사례 통과.** 소스/산출물×320/390px, editor/manual/target-current/target-goals 시작, 이전·다음 왕복과 단계별 건너뛰기/Escape/전체 완료. 원본 프리셋·전체 저장값·귀속·비용·목표 조건·실제 전사 미리보기/결과·목표 계산 결과·원래 보기·포커스·새로고침 복원 유지.
- **레드팀 v47:8사례 통과.** 소스/산출물의 모드·닫기 경로 교차에서 직전 VI/전체 보기 기억과 실제 부위 편집 복귀, 원래 탭·값, 스크롤 잠금 해제 확인.
- 빈6부위, 미저장 프리셋 이름, 불러오기 목록의 선택값도 별도 보존 확인.
- **UI v46:160단계 통과.** 두 사이트×8화면×10단계. 320/390/768/1024/1280px, 가로844×390, 320/1280px 글자200%. 조상 overflow clipping을 포함한 실제 강조 대상 노출 비율 최소1.0, 카드와 대상 겹침0, 터치 다음 실패0. 내부 스크롤이 필요한13단계도 실제 터치로 진행 가능.
- **UI v46:18교차 흐름 통과.** 두 사이트×세 시작 탭×건너뛰기/Escape/완료. 8단계→이전→다음 후에도 mode/current-goals 보기/전체 스냅샷/scrollY40/도움말 포커스 복원.
- **UI v47:배경 잠금4조건과 가로9단계2조건 통과.** 소스/산출물×390×844·844×390에서 실제 wheel·CDP 단일 touch 이동으로 배경 및 내부 작업 영역이 움직이지 않음을 확인. 종료 후 class 해제·기존 inline overflow·scrollY40·포커스 복원. 가로9단계는 카드 내부 스크롤과 다음·완료 정상.
- 320×640에서 첫 단계 이전 숨김, 첫/끝 키보드 Tab 순환, Enter 완료 및 잠금 해제도 양쪽 확인.
- 루트의 영구 회귀 도구에도 직전 부위 복원·배경 wheel 잠금·실제 터치 다음 진행 검사를 추가했다.

검사 범위에서 남은 확정 결함은 없다. v47 검사 중 한 차례 초기화 후 도움말 비활성 상태가 있었으나, 독립 콘솔/로딩 진단과 소스4회·산출물4회의 단독 재기동에서는 모두 정상(도움말 활성, 경고/오류/실패 요청0)으로 재현되지 않아 원인은 미확정으로 기록한다. 이를 빌드나 제품 결함으로 단정하지 않는다.

## 증거

- `.generated/scarecrow/tutorial-redteam-v44/overview-memory.json`: 최초 보기 기억 결함.
- `.generated/scarecrow/tutorial-ui-v44/landscape-step9.json` 및 스크린샷: 최초 가로 터치 결함.
- `.generated/scarecrow/tutorial-redteam-v46/data-results.json`, `tutorial-redteam-v46-built/data-results.json`:96사례.
- `.generated/scarecrow/tutorial-redteam-v47-overview/results.json`:최종8사례.
- `.generated/scarecrow/tutorial-redteam-v45/empty-draft-results.json`:빈 상태·미저장 이름·목록 선택 보존.
- `.generated/scarecrow/tutorial-ui-v46/matrix-8766.json`, `matrix-4185.json`, `flow-8766,4185.json`, `keyboard.json`.
- `.generated/scarecrow/tutorial-ui-v47/scroll-lock.json`, `landscape9.json`, `summary.json`, `init-audit.json`.
- `tools/test-covenant-onboarding.mjs`, `tools/test-covenant-isolation.mjs`:회귀 도구.
