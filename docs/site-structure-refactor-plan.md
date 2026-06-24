# Morimens.Info.kr 사이트 구조 리팩토링 계획

## 1. 목표

이 문서는 Morimens.Info.kr의 데이터와 화면 구조를 점진적으로 정리하기 위한 개발 계획이다.

핵심 목표는 **하나의 데이터는 하나의 위치에만 두고, 다른 기능은 ID로 참조하는 구조**를 만드는 것이다. 지금 당장 전체 구조를 갈아엎는 것이 아니라, 현재 사이트가 계속 동작하는 상태에서 누락과 중복을 줄이는 방향으로 진행한다.

## 2. 현재 구조 평가

현재 사이트는 정적 HTML, CSS, JavaScript, JSON 데이터만으로 여러 기능을 제공한다. 캐릭터 목록, 추천 세팅, 명륜/은열쇠/비밀계약 사전, 파티 빌더, 융재금구 시뮬레이터, 인벤토리 체크 등 기능 범위가 넓다.

큰 방향은 나쁘지 않다. `data/*.json`으로 데이터를 분리하고, `css/common.css`, `css/components.css`, `css/pages/*`처럼 공통 스타일과 페이지 스타일을 나누려는 구조도 이미 있다.

다만 기능이 늘어나면서 유지보수 비용이 커지고 있다.

- 하나의 정보가 여러 파일에 흩어져 있다.
- 일부 데이터는 JSON에 있고, 일부 규칙은 JavaScript 코드 안에 박혀 있다.
- 공통 UI처럼 보이는 모달, 폼, 툴팁이 페이지마다 조금씩 다르게 구현되어 있다.
- `links.html`, `js/party_builder.js`, `js/covenant_simulator.js`처럼 한 파일에 너무 많은 책임이 모여 있다.
- 새 캐릭터 추가 시 어떤 파일을 수정해야 하는지 자동으로 검증할 수 없다.

결론적으로 지금 구조는 당장 갈아엎어야 하는 구조는 아니지만, 새 콘텐츠가 계속 추가될수록 실수가 늘어날 구조다.

## 3. 핵심 문제

### 3.1 Single Source of Truth 부재

가장 큰 문제는 하나의 데이터가 하나의 위치에만 존재하지 않는다는 점이다.

예를 들어 새 캐릭터를 추가하려면 다음 정보가 서로 다른 위치에 필요하다.

- 캐릭터 기본 정보: `data/character_manifest.json`
- 추천 세팅: `data/character_settings.json`
- 스킬/돌파: `data/character_effects.json`
- 획득 구분: `data/gachatype.json`
- 정보글 링크: `data/resource_links.json`
- 전용 명륜: `data/wheel_list.json`
- 전용 은열쇠: `data/silverkey_list.json`
- 파티 빌더 태그: `js/party_builder.js`
- 이미지 파일: `images/`

이 구조에서는 사람이 체크리스트를 보고 빠짐없이 입력해야 한다. 즉, 데이터 무결성이 코드나 도구가 아니라 기억에 의존한다.

체크리스트 문서화는 이 문제의 최종 해결책이 아니다. 체크리스트는 현재 구조에서 실수를 줄이기 위한 임시 안전장치다. 최종 목표는 체크리스트를 길게 유지하는 것이 아니라, 데이터 관계를 명시하고 검증 스크립트로 누락을 자동으로 잡아서 사람이 기억해야 할 항목을 줄이는 것이다.

### 3.2 코드 안에 데이터 규칙이 섞여 있음

`js/party_builder.js`에는 캐릭터 태그 분류, 변형 캐릭터 동시 편성 제한, 전용 명륜 자동 장착, 전용 은열쇠 자동 장착 규칙이 포함되어 있다.

여기서 JavaScript에 남아야 하는 것은 "검사하고 실행하는 로직"이다. JSON으로 옮겨야 하는 것은 "검사 대상과 관계 데이터"다.

예를 들어 편성 제한 검사 함수는 JavaScript에 남긴다. 하지만 어떤 캐릭터들이 서로 동시 편성 제한 그룹인지, 어떤 캐릭터가 어떤 검색 태그에 속하는지는 JSON으로 옮기는 편이 낫다.

### 3.3 전용 장비 관계가 암묵적임

전용 명륜은 현재 `optimized_for`를 통해 어느 정도 연결되어 있고, 전용 은열쇠는 `tags`나 이름 기반으로 찾는 흐름이 섞여 있다.

이 방식은 표시와 검색에는 유용하지만, "이 장비가 어떤 캐릭터의 전용 장비인가"를 검증하기에는 약하다.

따라서 기존 필드는 지우지 않고, 전용 관계를 명시하는 필드를 추가하는 방향이 좋다.

예시:

```json
{
  "english_name": "wheel_saya_ssr",
  "korean_name": "세상이 향기가 되길",
  "grade": "SSR",
  "optimized_for": ["사야"],
  "owner_character_ids": ["saya"],
  "image_path": "images/wheel_saya_ssr.png"
}
```

```json
{
  "english_name": "key_saya",
  "korean_name": "신세계를 위하여",
  "tags": ["사야", "방어막 획득", "드로우"],
  "owner_character_ids": ["saya"],
  "image_path": "images/key_saya.png"
}
```

`korean_name`, `english_name`, `description`, `image_path`, `tags`, `grade`, `main_stat` 같은 기존 표시/검색용 필드는 유지한다. `owner_character_ids`는 전용 장비 자동 장착과 검증용 신뢰 필드로 사용한다.

### 3.4 공통 UI 중복

신고 모달, 모달 열기/닫기, 폼 스타일, 닫기 버튼, 오버레이 동작이 여러 HTML, JavaScript, CSS에 반복되어 있다.

현재는 페이지마다 직접 구현되어 있어 다음 문제가 생긴다.

- 어떤 페이지는 `.show` 클래스로 열고, 어떤 페이지는 `style.display`를 같이 만진다.
- 같은 신고 모달인데 HTML이 페이지마다 복사되어 있다.
- 모달 스타일이 `css/components.css`, `css/party_builder.css`, `css/pages/links.css` 등에 중복되어 있다.
- 접근성 속성이나 닫기 동작을 한 번에 고치기 어렵다.

### 3.5 큰 파일에 기능 집중

특히 다음 파일은 역할이 너무 많다.

- `links.html`
  - 사전 렌더링
  - 캐릭터 추천 세팅
  - 캐릭터 정보글 링크
  - 스킬/돌파 탭
  - 툴팁
  - 대체 장비 모달
  - 신고 모달
  - 일부 CSS와 JavaScript 인라인 코드
- `js/party_builder.js`
  - 데이터 로딩
  - 상태 저장
  - 렌더링
  - 모달
  - 툴팁
  - 캐릭터 필터
  - 명륜/은열쇠 장착
  - 전용 장비 자동 장착
  - 복사/붙여넣기
  - 편성 제한
- `js/covenant_simulator.js`
  - 시뮬레이터 상태
  - 렌더링
  - 프리셋
  - 계약 변경 모달
  - 저장/복원

파일이 큰 것 자체가 문제는 아니지만, 변경 범위를 예측하기 어렵고 작은 수정도 전체 파일을 이해해야 하는 상태가 된다.

## 4. 개선 원칙

### 4.1 하나의 데이터는 하나의 위치에만 둔다

같은 의미의 정보는 한 곳에만 저장한다.

- 캐릭터 기본 정보는 `data/character_manifest.json` 또는 향후 통합 캐릭터 데이터에서만 관리한다.
- 캐릭터 태그, 변형 관계, 전용 장비 관계도 가능하면 데이터 파일로 옮긴다.
- JavaScript는 데이터를 정의하지 않고 해석한다.
- 화면은 데이터를 복사하지 않고 ID로 참조한다.

### 4.2 데이터는 ID로 연결한다

이름 문자열 비교에 의존하지 않고 가능한 한 ID로 연결한다.

- 추천 세팅은 명륜 이름이 아니라 `english_name` ID를 참조한다.
- 전용 은열쇠와 전용 명륜은 `owner_character_ids` 같은 명시적 필드를 우선 사용한다.
- 변형 캐릭터 관계도 코드 배열이 아니라 데이터로 관리한다.

### 4.3 로직과 데이터 규칙을 분리한다

JSON으로 기능 로직을 옮기지 않는다.

- JSON: 어떤 캐릭터들이 묶이는지, 어떤 캐릭터가 어떤 태그에 속하는지, 어떤 장비가 누구 전용인지 저장
- JavaScript: JSON을 읽어서 편성 가능 여부를 검사하고, 필터링하고, 렌더링하고, 모달을 열고 닫음

즉, JSON은 판단에 필요한 자료이고 JavaScript는 판단하고 실행하는 코드다.

### 4.4 공통 UI는 한 번만 구현한다

신고 모달, 기본 모달, 툴팁, 폼, 버튼 같은 공통 UI는 공통 JavaScript/CSS로 분리한다.

페이지별 CSS는 해당 페이지 고유 레이아웃만 담당한다.

### 4.5 리팩터링은 한 번에 크게 하지 않는다

현재 사이트는 이미 동작 중이므로 구조 개선은 단계적으로 진행한다.

우선순위는 다음과 같다.

1. 문서화
2. 검증 도구 추가
3. 데이터성 규칙 분리
4. 전용 장비 관계 명시
5. 공통 UI 중복 제거
6. 큰 파일 분리
7. legacy 데이터 정리

## 5. 단계별 리팩토링 계획

### 5.1 1단계: 캐릭터 추가 검증 스크립트 작성

가장 먼저 필요한 것은 구조 변경이 아니라 안전장치다.

`tools/validate-character.mjs <characterId>`를 만든다.

검증 내용:

- manifest에 캐릭터 ID가 존재하는지 확인
- manifest의 썸네일 이미지 경로가 실제 존재하는지 확인
- `images/{id}_tide.webp` 존재 여부 확인
- `data/character_settings.json`에 추천 세팅이 있는지 확인
- 추천 세팅의 명륜 ID가 `data/wheel_list.json`에 존재하는지 확인
- 추천 세팅의 계약 ID가 `data/covenant_list.json`에 존재하는지 확인
- 전용 SSR/SR 명륜이 캐릭터와 연결되어 있는지 확인
  - 우선순위: `owner_character_ids` -> `optimized_for`
- 전용 은열쇠가 캐릭터와 연결되어 있는지 확인
  - 우선순위: `owner_character_ids` -> `tags`
- `data/character_effects.json`에 스킬/돌파 데이터가 있는지 확인
- `data/gachatype.json`에 캐릭터 ID가 포함되어 있는지 확인
- `data/resource_links.json`의 정보글 링크는 없을 수 있으므로 경고로만 출력

이 단계가 가장 효과가 크다. 문서는 사람이 읽는 안전장치이고, 검증 스크립트는 실제 누락을 잡는 안전장치다.

### 5.2 2단계: 새 캐릭터 추가 체크리스트 문서화

`docs/new-character-checklist.md`를 만든다.

체크리스트는 최종 해결책이 아니라 검증 스크립트의 보조 문서다. 목적은 사람이 모든 것을 기억하게 만드는 것이 아니라, 스크립트가 무엇을 검사하는지와 사람이 마지막에 무엇을 확인해야 하는지 설명하는 것이다.

체크 항목:

- `data/character_manifest.json` 추가
- 썸네일 이미지 추가
- `images/{id}_tide.webp` 추가
- 은열쇠 이미지 추가
- 전용 SSR 명륜 이미지 추가
- 전용 SR 명륜 이미지 추가
- 융재금구용 이미지 추가
- `data/silverkey_list.json` 은열쇠 텍스트 추가
- `data/wheel_list.json` 전용 SSR 명륜 텍스트 추가
- `data/wheel_list.json` 전용 SR 명륜 텍스트 추가
- `data/character_settings.json` 추천 세팅 추가
- `data/character_effects.json` 스킬/돌파 추가
- `data/gachatype.json` 추가
- `data/resource_links.json` 정보글 링크 추가
- `js/party_builder.js` 태그/변형 관계 확인
- `data/patch_notes.json` 업데이트 여부 확인
- `node tools/validate-character.mjs <characterId>` 실행

### 5.3 3단계: 파티 빌더 데이터 규칙 분리

`js/party_builder.js` 안의 데이터성 규칙을 JSON으로 옮긴다.

예상 데이터 파일:

- `data/party_builder_rules.json`

분리 후보:

- 캐릭터 태그 맵
- 태그 별칭
- 변형 캐릭터 동시 편성 제한

JavaScript에 남길 것:

- 편성 제한 검사 함수
- 필터링 함수
- 검색 함수
- 모달/렌더링/저장 로직

목표:

- 새 캐릭터 추가 시 JavaScript 수정 빈도 줄이기
- 캐릭터 태그 누락을 검증 스크립트에서 확인 가능하게 만들기
- 코드 수정 없이 데이터 수정만으로 파티 빌더 분류 갱신 가능하게 만들기

### 5.4 4단계: 전용 장비 관계 명시

`data/wheel_list.json`과 `data/silverkey_list.json`에 `owner_character_ids`를 점진적으로 추가한다.

기존 필드는 유지한다.

- `korean_name`: 화면 표시용
- `english_name`: 장비 ID
- `description`: 설명
- `image_path`: 이미지 경로
- `tags`: 검색/필터용
- `optimized_for`: 기존 명륜 전용 대상
- `owner_character_ids`: 검증/자동 장착용 전용 관계

전용 장비 찾기 우선순위:

1. `owner_character_ids`
2. 기존 `optimized_for`
3. 기존 `tags`

이렇게 하면 기존 기능을 깨지 않고 새 데이터부터 점진적으로 정리할 수 있다.

### 5.5 5단계: 신고 모달 공통화

현재 여러 HTML에 반복된 신고 모달을 공통 모듈로 분리한다.

목표:

- 신고 모달 HTML 복사 제거
- `openReportModal`, `closeReportModal` 중복 제거
- 상태 메시지 초기화 방식 통일
- `js/feedback.js`와 연결 방식 통일
- 신고 버튼 스타일은 `css/common.css` 또는 별도 공통 CSS에서 관리

예상 구조:

- `js/ui/report-modal.js`
- `css/components.css`의 신고 모달 공통 스타일 정리

### 5.6 6단계: `links.html` 분리

`links.html`의 인라인 JavaScript와 CSS를 분리한다.

우선 분리 대상:

- 사전 렌더링 로직
- 캐릭터 추천 세팅 렌더링
- 정보글 링크 렌더링
- 툴팁
- 대체 장비 모달

예상 구조:

- `js/links/main.js`
- `js/links/dictionary.js`
- `js/links/character-settings.js`
- `js/links/resource-links.js`
- `js/links/tooltips.js`

HTML은 DOM 뼈대만 담당하고, 로직은 JavaScript 파일로 옮긴다.

### 5.7 7단계: legacy 데이터 정리

현재 `data/db_*`와 `data/awakener/{id}.json`은 주요 사이트 흐름에서는 사용하지 않는 legacy 후보로 보인다.

`db_*`라는 방향성 자체는 맞다. 하지만 현재 있는 `db_*` 파일을 그대로 메인 데이터로 부활시키는 것은 추천하지 않는다. 지금의 실제 주요 흐름은 `links.html`, `character_settings.json`, `character_effects.json`, `wheel_list.json`, `silverkey_list.json` 중심이다.

따라서 방향은 다음과 같다.

- 기존 `db_*` 즉시 삭제: 보류
- 기존 `db_*` 그대로 복구: 비추천
- 새 정규화 데이터 레이어 설계: 추천
- `detail.html`, `data/awakener/*`, `data/db_*`는 사용 여부를 확인한 뒤 legacy로 문서화하거나 제거 후보로 분류

## 6. 최종 데이터 방향

최종적으로는 이런 방향이 좋다.

```text
data/
  character_manifest.json
  character_settings.json
  character_effects.json
  gachatype.json
  wheel_list.json
  silverkey_list.json
  covenant_list.json
  party_builder_rules.json
```

완전히 한 파일로 합치는 것이 목표는 아니다. 중요한 것은 각 정보의 주인이 하나만 있는 것이다.

- 캐릭터 이름/속성/등급: `character_manifest.json`
- 명륜 설명/이미지/전용 관계: `wheel_list.json`
- 은열쇠 설명/이미지/전용 관계: `silverkey_list.json`
- 추천 세팅: `character_settings.json`
- 스킬/돌파: `character_effects.json`
- 가챠 타입: `gachatype.json`
- 파티 빌더 태그/변형 관계: `party_builder_rules.json`

## 7. 최종 목표

최종 목표는 다음 상태다.

- 새 캐릭터 추가 시 수정 위치가 명확하다.
- 데이터는 중복되지 않고 ID로 참조된다.
- 누락된 이미지, 추천 세팅, 전용 장비, 가챠 타입을 자동 검증할 수 있다.
- 공통 모달, 폼, 툴팁은 한 번만 구현되어 있다.
- 큰 페이지 파일은 기능별 모듈로 나뉘어 있다.
- 새 기능을 추가할 때 기존 페이지 전체를 건드리지 않아도 된다.

이 구조가 되면 사이트를 더 크게 확장해도 유지보수 비용이 급격히 늘어나지 않는다.
