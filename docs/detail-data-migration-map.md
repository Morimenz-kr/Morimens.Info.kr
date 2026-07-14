# 상세 페이지 데이터 마이그레이션 맵

이 문서는 `detail.html`과 `js/detail.js`가 사용하는 legacy 데이터 흐름을 정규화 데이터 흐름으로 옮기기 위한 매핑 문서다.

현재 결론은 명확하다. `data/db_*`와 `data/awakener/*`는 아직 삭제하면 안 된다. `js/detail.js`가 실제로 사용하고 있고, 현재 데이터만으로는 상세 페이지의 카드 UI, 파생 카드, 추천 명륜, 추천 비밀계약, 툴팁을 완전히 대체할 수 없다.

## 현재 흐름

`js/detail.js`는 상세 페이지 로딩 시 다음 파일을 함께 읽는다.

- `data/awakener/{id}.json`
- `data/db_cards.json`
- `data/db_awakener_stats.json`
- `data/db_tooltips.json`
- `data/covenant_list.json`
- `data/wheel_list.json`
- `data/character_manifest.json`

현재 `data/awakener/{id}.json`은 상세 페이지의 조립 지시서 역할을 한다. 캐릭터 기본 정보, 이미지, 카드 ID, 스탯 ID, 추천 명륜 ID, 추천 비밀계약 ID, 추천 조합 ID를 가지고 있고, `detail.js`가 그 ID로 각 DB를 조회한다.

## 목표 흐름

상세 페이지도 다른 기능처럼 다음 원칙을 따라야 한다.

- 캐릭터 기본 정보는 `data/character_manifest.json`을 기준으로 한다.
- 스킬/계령/효과 설명은 `data/character_effects.json`을 기준으로 한다.
- 추천 명륜/계약은 `data/character_settings.json`을 기준으로 한다.
- 명륜 상세 정보는 `data/wheel_list.json`을 기준으로 한다.
- 계약 상세 정보는 `data/covenant_list.json`을 기준으로 한다.
- 추가 관계는 표시명 문자열이 아니라 ID 필드로 연결한다.

단, `character_effects.json`이 지금의 카드 UI를 그대로 표현할 수 있는지 아직 확정되지 않았다. 그래서 코드 마이그레이션 전에 데이터 표현 방식을 먼저 정해야 한다.

## 필드 매핑

| 현재 사용 데이터 | 현재 출처 | 목표 출처 | 상태 |
| --- | --- | --- | --- |
| 캐릭터 이름 | `data/awakener/{id}.json`의 `name` | `data/character_manifest.json`의 `name` | 이전 가능 |
| 속성/클래스/등급 | `data/awakener/{id}.json`의 `info` | `data/character_manifest.json` | 이전 가능 |
| 썸네일/전신 이미지 | `data/awakener/{id}.json`의 `images` | manifest와 이미지 규칙 | 전신 이미지 규칙 정의 필요 |
| 카드 목록 | `skill_kit_ids.command_cards` + `data/db_cards.json` | `data/character_effects.json` | 카드 UI 구조 정의 필요 |
| 광기/초월 카드 | `skill_kit_ids.rouse_skill`, `exalt`, `overexalt` + `data/db_cards.json` | `data/character_effects.json` | 카드 타입 매핑 필요 |
| 파생 카드 | `data/db_cards.json`의 `derives_cards` | 미정 | 별도 필드 필요 |
| 기본 스탯 | `stats_id` + `data/db_awakener_stats.json` | 미정 | manifest에는 없음 |
| 돌파/재능 | `data/db_awakener_stats.json` | `data/character_effects.json` 또는 별도 데이터 | 역할 분리 필요 |
| 추천 명륜 | `guide.recommended_wheel_id` + `data/wheel_list.json` | `data/character_settings.json` + `data/wheel_list.json` | 일부 가능 |
| 추천 비밀계약 | `guide.recommended_covenants` + `data/covenant_list.json` | `data/character_settings.json` + `data/covenant_list.json` | 구조 차이 큼 |
| 추천 조합 | `guide.recommended_team_ids` + manifest | 미정 | 별도 팀 추천 데이터 필요 |
| 툴팁 | `data/db_tooltips.json` | 공통 tooltip 데이터 | 공통화 필요 |

## 현재 Tawil 기준 차이

`node tools\audit-detail-data-migration.mjs` 기준으로 현재 `data/awakener/tawil.json`은 다음 상태다.

- `character_manifest.json`에 대응 캐릭터가 있다.
- `character_settings.json`에 추천 세팅이 있다.
- `character_effects.json`에 스킬/계령 데이터가 있다.
- legacy 카드 ID 7개는 모두 `data/db_cards.json`에 존재한다.
- legacy 카드 이름과 `character_effects.json`의 스킬 이름은 4/7개만 겹친다.
- `recommended_wheel_id: wheel_tawil_unique`는 현재 `data/wheel_list.json`에 없다.
- `recommended_covenants`의 14개 ID는 현재 `data/covenant_list.json`에 없다.
- `data/db_tooltips.json`에는 상세 페이지 전용 툴팁 9개가 있다.

즉, `detail.js`를 지금 바로 정규화 데이터만 읽도록 바꾸면 기능 손실이 생긴다.

## 먼저 결정해야 할 것

### 1. 카드 UI 데이터 구조

`character_effects.json`을 상세 페이지 카드 UI의 기준으로 삼을지 결정해야 한다.

결정할 내용:

- 일반 스킬, 광기 스킬, 초월, 초한을 어떤 필드명으로 구분할지
- 카드 비용, 카드 타입, 카드 이미지가 필요한지
- 현재 `db_cards.json`의 `derives_cards`를 어디에 둘지
- `<link id="...">`로 연결되는 파생 카드 링크를 계속 쓸지

### 2. 스탯/돌파/재능의 소유 위치

현재 `db_awakener_stats.json`은 기본 스탯, 돌파, 재능을 함께 가진다. 정규화하려면 다음 중 하나를 선택해야 한다.

- `character_effects.json`에 돌파/재능만 둔다.
- 별도 `data/character_stats.json`을 만든다.
- 상세 페이지 전용 데이터가 필요하다고 보고 `data/detail/characters/{id}.json` 같은 얇은 조립 파일을 유지한다.

추천은 세 번째다. 상세 페이지는 화면 구성이 복잡해서 완전히 한 파일로 합치기보다, 공통 데이터는 참조하고 상세 페이지에만 필요한 배열 순서와 표시 그룹만 조립 파일에 두는 편이 안전하다.

### 3. 추천 세팅과 상세 추천의 관계

`character_settings.json`은 현재 추천 세팅 카드에 맞춰져 있다. 반면 `data/awakener/tawil.json`의 `guide.recommended_covenants`는 6세트 묶음과 시너지 설명을 전제로 한다.

결정할 내용:

- 상세 페이지도 `character_settings.json`의 대표 추천만 보여줄지
- 상세 페이지 전용 추천 조합을 별도로 둘지
- `covenant_list.json`에 없는 legacy 계약 ID를 실제 데이터로 추가할지 폐기할지

### 4. 툴팁 공통화

`db_tooltips.json`은 상세 페이지에서만 쓰인다. 하지만 툴팁 자체는 다른 화면에서도 쓸 수 있는 공통 개념이다.

권장 방향:

- `data/tooltips.json` 같은 공통 파일로 이름을 바꾼다.
- 상세 페이지, 추천 세팅, 스킬 설명이 같은 툴팁 사전을 참조하게 한다.
- 기존 `db_tooltips.json`는 전환 후 삭제한다.

## 권장 단계

1. `docs/detail-data-migration-map.md`를 기준으로 상세 페이지 데이터 결정을 끝낸다.
2. `data/detail/characters/tawil.json` 같은 신규 조립 파일이 필요한지 결정한다.
3. `character_effects.json`이 카드 UI를 표현할 수 있도록 필드 구조를 확정한다.
4. Tawil 한 명만 대상으로 새 구조를 추가한다.
5. `detail.js`가 새 구조를 우선 읽고, 없으면 기존 legacy 흐름으로 fallback 하게 만든다.
6. Tawil 상세 페이지를 검증한다.
7. 모든 legacy 캐릭터가 새 구조로 옮겨진 뒤 `tools/audit-legacy-data.mjs`를 다시 실행한다.
8. 참조가 사라진 `data/db_*`, `data/awakener/*`만 삭제 후보로 올린다.

## 검증 명령

현재 legacy 사용 상태를 확인한다.

```powershell
node tools\audit-legacy-data.mjs
```

상세 페이지 마이그레이션 가능 상태를 확인한다.

```powershell
node tools\audit-detail-data-migration.mjs
```

캐릭터 공통 데이터 무결성을 확인한다.

```powershell
node tools\validate-character.mjs tawil --verbose
```
