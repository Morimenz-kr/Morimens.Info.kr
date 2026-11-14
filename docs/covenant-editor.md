# 비밀계약 공용 편집기

`js/covenant-editor.mjs`와 `css/covenant-editor.css`는 비밀계약 시뮬레이터와 ScareCrow가 함께 사용하는 6부위 편집기다. 선택·주옵·부옵·강화·귀속·전체 능력치·세트 효과를 렌더링한다. 전사 확률·소모량·파티 전투 상태·저장은 각 호스트가 관리한다.

## 편집 데이터

| 필드 | 의미 |
|---|---|
| `owner.contractSlots` | Ⅰ~Ⅵ의 원본 세트 ID 6개. 0은 미장착 |
| `owner.contractBound` | 계약 전체 귀속 여부 |
| `owner.trinkets` | `position`, `main`, `quality`, `level`, `bound`, `sub`를 가진 부위 배열 |
| `sub` | 원본 속성 ID와 실제 수치의 `{id,value}` 배열. 부옵 최대 3개, 레벨 1~8 |

완성도·주옵·부옵 수치는 `js/covenant-stats.mjs`, 세트 구성·정적 합계는 `js/covenant-equipment.mjs`가 담당한다. ScareCrow의 이전 모듈 경로는 이 공통 모듈을 다시 내보내어 기존 계산 어댑터를 유지한다.

## 호스트 인터페이스

`renderCovenantEditor(parent, options)`는 장착 객체를 편집하고 `{editPart(position),showOverview()}`를 반환한다. `position`은 1~6이다.

| 옵션 | 역할 |
|---|---|
| `owner`, `catalog`, `metadata`, `contracts`, `parts` | 장착값, 세트 효과·옵션 규칙·한국어 설명·부위 이미지 |
| `onChange(owner)` | 변경값 저장 및 호스트 계산 갱신 |
| `onPick(position)` | 호스트의 세트 선택창 열기. null은 전체 6부위 |
| `onReset()` | 전체 초기화 또는 세팅 가져오기 뒤 호스트 재렌더링 |
| `onPartChange(index)` | 선택 부위 동기화. 0~5, -1은 전체 보기 |
| `initialPart` | 초기 선택 부위. 기본 -1 |
| `pickOnPartSelect` | ScareCrow는 클릭 시 선택창, 시뮬레이터는 클릭 시 바로 부위 편집 |
| `allowEmptyOptions` | ScareCrow의 빈 옵션 입력을 허용. 시뮬레이터에서는 기존 3개 부옵 전사 구조 유지 |
| `renderSubstatActions(parent, {position,index,current})` | 부옵 행에 호스트 전용 동작 추가. 기본은 추가 동작 없음 |
| `onPartPanel(panel,index)` | 선택된 부위 패널을 전달. 전체 보기에서는 null과 -1 |

## 시뮬레이터 연결

`js/covenant-simulator-model.mjs`가 기존 문자열 옵션 ID·레벨을 공용 장착 객체와 상호 변환한다. 기존 `morimens_covenant_simulator_state_v1` 및 프리셋 저장소는 유지하며 스냅샷에 부위별 `setId`와 전체 귀속 여부를 추가했다. 이전 스냅샷의 세트는 당시 선택한 계약으로 채운다. 목표·잠금 데이터는 유지한다.

‘세팅·프리셋’ 탭은 공용 편집기와 프리셋 저장·불러오기·삭제를 제공한다. ‘전사’ 탭은 6부위 선택, 현재 옵션 표시, 최대 2개 잠금, 전사와 결과 교체를 제공한다. 두 화면은 동일한 `state.parts`를 사용하며, 교체를 누르면 공용 편집기에도 결과가 반영된다. ‘세팅 편집으로’는 현재 전사 부위의 편집창을 연다. 기존 프리셋도 불러온 뒤 세팅 탭을 유지한다. 목표 계산의 ‘편집한 세팅 가져오기’는 현재 6부위 옵션을 복사하면서 기존 목표 조건을 보존한다.

## 호스트 간 세팅 전달

공용 편집기의 **세팅 복사 → 다른 화면의 세팅 가져오기 → 세팅 적용**으로 6부위 세팅을 옮긴다. ScareCrow에서는 마지막으로 바깥 편집기의 **적용**을 눌러 파티에 저장한다. 다른 도메인에서도 같은 흐름을 사용하며 자동으로 클립보드를 읽지 않는다. 자동 복사가 허용되지 않으면 열린 창에서 전체 선택 후 직접 복사할 수 있다.

`js/covenant-transfer.mjs`는 `morimens.covenant-setting` 버전 1의 JSON에 `contractSlots`, `contractBound`, `trinkets`만 담는다. 각 부위의 주옵션·강화·부옵션 실수치를 보존하며 계정·캐릭터 성장·파티·전사 이력은 포함하지 않는다. 현재 공개된 세트와 황금 등급만 지원한다. 가져오기 전 세트 ID, 부위 중복, 강화 범위, 부옵 Lv.1~8의 실제 수치, 형식·크기를 검증한다. 실패 시 현재 세팅을 유지한다. 시뮬레이터의 목표·잠금과 다른 파티 정보도 유지한다.

전송 창은 native dialog를 사용하며 Escape로 닫은 뒤 시작 버튼에 포커스를 돌려준다. ScareCrow의 바깥 편집기는 함께 닫히지 않는다. `images/covenant-parts/sources.json`은 기존 검증 리소스에서 복원한 162개 부위 이미지의 Item.Icon 매핑과 SHA-256을 기록한다. 빌드는 설정된 부위 이미지가 하나라도 빠지면 실패한다.

잠금/해제 이미지는 설치된 게임의 공통 이미지 아틀라스에서 추출한 `UI_Common_D_Image_Unlock06` / `Unlock05`다. 실제 전사 프리팹 `ui_awaker_item_trinket_refinement`의 `Image_Lock_Icon` / `Image_Unlock_Icon` 참조와 대조했다. `images/covenant-ui/sources.json`에 원본 Sprite ID·아틀라스·참조 노드·해시를 기록한다. 원본 78×42 비율을 유지하며 버튼의 터치 영역은 44×44px이다.

`data/covenant_editor.json`은 기존 ScareCrow의 공개 res160 장비 메타데이터에서 세트·옵션 규칙·안정 ID만 분리한 자료다. 게임 최신 버전의 전투 공식을 갱신하거나 최신화 검증한 작업은 아니다. 데이터 갱신 시 공용 모듈과 양쪽 호스트의 수치·저장 호환성을 함께 확인해야 한다.

## 확인 범위

새 브랜치 `codex/shared-covenant-editor`에서 작업했다. 기존 ScareCrow 로컬 변경을 이어받았으며 운영 main에 병합하거나 커밋·푸시하지 않았다. Node 테스트 399개, 기존 ScareCrow 계약 검사 9개와 로컬 빌드·데이터 검증을 통과했다. 실제 브라우저에서 편집·잠금 전사·교체·혼합 세트 저장·새로고침·프리셋 복원·목표 계산·초기화·선택창 Escape/포커스 복귀를 확인했다.

## 브랜치 보존 점검 (2026-11-14)

위 확인 범위는 최초 작업 시점의 기록이다. 이번에는 공용 편집기와 함께 남아 있던 ScareCrow 후속 작업을 `codex/shared-covenant-editor` 브랜치의 개발 체크포인트로 묶어 보존한다. 카드 연속 적용·되돌리기, 효과 표시, 전투 화면·글꼴, 관련 빌드와 검사 파일을 함께 포함한다. 이들 변경이 서로 참조하므로 공용 편집기만 별도로 가져갈 때 의존성을 다시 확인해야 한다.

- 재실행: 기본 테스트 399개, 계약·연속 적용·효과 테스트 12개 통과, `npm run scarecrow:build` 성공.
- 빌드 기준은 res160이다. 번역 카드 설명 연결 누락 경고 84건이 남아 있다. 비비안, `wheel_imago_clinic`·비비안 SSR/SR 명륜, `key_GOgier`·비비안 은열쇠는 빌드의 미지원 목록에 있다. 최신 게임 전체 지원 완료를 뜻하지 않는다.
- 이번 브랜치 보존에서는 브라우저 반응형 검사와 실제 게임 피해 대조를 새로 수행하지 않았다. 최초 작업의 브라우저 기록과 이번 테스트 실행은 구분한다.
- main 병합과 공개 배포는 별도 마일스톤 작업으로 남긴다.


## M1 통합 진행 (2026-11-14)

위 기록 이후 `22157e3`의 원본 설명·미지원 콘텐츠 수정과 최신 main `6c4116f`를 병합 커밋 `20e8baa`로 합쳤다. 현재 빌드는 설명 누락 경고가 없으며 미지원 각성체·명륜·은열쇠 목록도 비어 있다. 계산 엔진의 기준은 계속 res160이며 최신 게임 전체 대조 완료를 뜻하지 않는다.

- 기본 Node 테스트 499개, 기존 엔진 계약 검사 9개, 데이터 검증, ScareCrow 빌드와 Pages 패키징 통과.
- `node tools/test-shared-covenant.mjs`: v1 저장·프리셋, 목표/잠금 보존, 전사·결과 교체 후 복원, 두 호스트의 수치 합계와 세팅 왕복, 파티 적용·재접속·부위 재편집, 오류 입력 시 무변경, Escape 포커스 복귀를 검증했다. 실행 전 저장소 서버(8766)와 `npm run scarecrow:serve`(4185)가 필요하며 URL은 환경 변수로 바꿀 수 있다. 독립 브라우저 저장소를 사용한다.
- 반응형은 양쪽 호스트에서 320·390·607·609·768·1024·1280×900, 844×390, 390×900 글자 200% 확대를 검사했다. 총 18개 경우의 DOM 경계·가로 넘침·버튼 크기와 스크린샷을 `.generated/scarecrow/shared-covenant-proof/`에 기록했다. 브라우저 예외가 없었으며 주요 화면을 시각적으로 확인했다.
- 아티팩트는 공개 73기와 기존 유물 정보만 포함한다. 74기와 유물 세트 효과는 공개하지 않는다. 운영 main 병합·공개 배포 확인은 남아 있어 M1 전체 완료로 표시하지 않는다.
