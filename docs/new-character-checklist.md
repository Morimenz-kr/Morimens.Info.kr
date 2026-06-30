# 새 캐릭터 추가 체크리스트

이 문서는 새 캐릭터를 추가할 때 빠뜨리기 쉬운 항목을 확인하기 위한 작업 절차다.

체크리스트는 최종 해결책이 아니다. 최종 목표는 데이터 관계를 명시하고 검증 스크립트로 누락을 자동으로 잡는 것이다. 이 문서는 `tools/validate-character.mjs`와 함께 사용하는 보조 문서다.

작업 순서는 다음처럼 잡는다.

1. 데이터 파일을 수정한다.
2. `node tools\validate-character.mjs <characterId> --verbose`를 실행한다.
3. 스크립트가 잡지 못하는 화면 동작만 수동으로 확인한다.

## 1. 기본 원칙

- 기존 표시명 필드는 실제 인게임 이름 그대로 유지한다.
- `korean_name`을 "사야 전용 명륜", "사야 전용 은열쇠" 같은 설명형 이름으로 바꾸지 않는다.
- 전용 관계는 표시명으로 표현하지 않고 `owner_character_ids` 같은 관계 필드로 표현한다.
- 기존 필드(`korean_name`, `english_name`, `description`, `image_path`, `tags`, `grade`, `main_stat`, `optimized_for`)는 화면 표시와 검색에 계속 사용한다.
- JavaScript에는 검사/렌더링 로직을 두고, 캐릭터 태그/변형 관계/전용 장비 관계 같은 데이터성 규칙은 JSON으로 옮기는 방향을 유지한다.

## 2. 필수 데이터

### 캐릭터 기본 정보

- `data/character_manifest.json`
  - `id`
  - `name`
  - `image_thumb`
  - `relems`
  - `class`
  - `grade`

### 이미지

- 썸네일 이미지: manifest의 `image_thumb` 경로
- 파티 빌더/융재금구용 이미지: `images/{id}_tide.webp`
- 전용 은열쇠 이미지: `data/silverkey_list.json`의 `image_path`
- 전용 SSR 명륜 이미지: `data/wheel_list.json`의 `image_path`
- 전용 SR 명륜 이미지: `data/wheel_list.json`의 `image_path`

## 3. 장비 데이터

### 은열쇠

- `data/silverkey_list.json`
  - `korean_name`: 실제 은열쇠 이름
  - `english_name`: 은열쇠 ID
  - `description`: 은열쇠 설명
  - `image_path`: 이미지 경로
  - `tags`: 검색/필터용 태그
  - `source`: 획득처
  - `owner_character_ids`: 전용 관계를 명시하는 새 필드

예시:

```json
{
  "korean_name": "신세계를 위하여",
  "english_name": "key_saya",
  "description": "...",
  "image_path": "images/key_saya.png",
  "tags": ["사야", "방어막 획득", "드로우"],
  "source": "...",
  "owner_character_ids": ["saya"]
}
```

### 명륜

- `data/wheel_list.json`
  - `grade`: `SSR` 또는 `SR`
  - `korean_name`: 실제 명륜 이름
  - `english_name`: 명륜 ID
  - `optimized_for`: 기존 추천 대상 필드
  - `main_stat`: 주옵션
  - `description`: 명륜 설명
  - `image_path`: 이미지 경로
  - `owner_character_ids`: 전용 관계를 명시하는 새 필드

예시:

```json
{
  "grade": "SSR",
  "korean_name": "세상이 향기가 되길",
  "english_name": "wheel_saya_ssr",
  "optimized_for": ["사야"],
  "owner_character_ids": ["saya"],
  "main_stat": "검은 인장 드롭 10.8%",
  "description": "...",
  "image_path": "images/wheel_saya_ssr.png"
}
```

## 4. 추천 세팅

- `data/character_settings.json`
  - 캐릭터 `id`를 키로 추가한다.
  - `myeongryun_ssr.main_id`는 `data/wheel_list.json`에 존재해야 한다.
  - `myeongryun_ssr.substitutes`의 모든 ID도 `data/wheel_list.json`에 존재해야 한다.
  - `myeongryun_sr.main_id`는 `data/wheel_list.json`에 존재해야 한다.
  - `myeongryun_sr.substitutes`의 모든 ID도 `data/wheel_list.json`에 존재해야 한다.
  - `covenant.main_id`는 `data/covenant_list.json`에 존재해야 한다.
  - `covenant.substitutes`의 모든 ID도 `data/covenant_list.json`에 존재해야 한다.

## 5. 캐릭터 효과와 획득 타입

- `data/character_effects.json`
  - 캐릭터 `id`를 키로 스킬/돌파 데이터를 추가한다.
  - 나무위키 기반 갱신이 필요하면 `tools/update-character-effects.mjs`를 사용한다.

- `data/gachatype.json`
  - 캐릭터 `id`를 알맞은 획득 그룹에 추가한다.

## 6. 선택 데이터

- `data/resource_links.json`
  - 캐릭터 정보글 링크가 있으면 `characters[캐릭터ID]`에 추가한다.
  - 정보글이 아직 없을 수 있으므로 검증 스크립트에서는 경고로만 처리한다.

- `data/patch_notes.json`
  - 메인 화면 업데이트 내역에 노출할 필요가 있으면 갱신한다.

## 7. 파티 빌더 확인

파티 빌더의 데이터성 규칙은 `data/party_builder_rules.json`에서 관리한다.

확인할 항목:

- 캐릭터 검색 태그가 필요하면 `character_tags`에 캐릭터 `id`를 추가한다.
- 검색 별칭이 필요하면 `tag_aliases`에 별칭을 추가한다.
- 변형 캐릭터라서 동시 편성 제한이 필요하면 `exclusive_groups`에 캐릭터 `id` 묶음을 추가한다.
- 전용 명륜 자동 장착이 정상 동작하는지
- 전용 은열쇠 자동 장착이 정상 동작하는지

`tools/validate-character.mjs`는 `party_builder_rules.json` 안의 캐릭터 ID가 `character_manifest.json`에 존재하는지 확인한다. 다만 어떤 태그가 실제로 필요한지는 게임 내용 판단이 필요하므로 사람이 확인해야 한다.

## 8. 검증 명령

새 캐릭터 데이터를 추가한 뒤 반드시 실행한다.

```powershell
node tools\validate-character.mjs <characterId>
```

전용 장비 관계를 어떤 필드로 인식했는지까지 보려면 다음처럼 실행한다.

```powershell
node tools\validate-character.mjs <characterId> --verbose
```

전체 캐릭터를 검사하려면 다음을 실행한다.

```powershell
node tools\validate-character.mjs --all
```

기본 데이터, 추천 세팅 참조, 썸네일 이미지, 파티 빌더/융재금구용 이미지, 전용 장비 이미지, 스킬/돌파, 가챠 타입 누락은 오류로 처리한다.

전용 장비와 정보글 링크는 기존 데이터 현실을 고려해 우선 경고로 처리한다. 새 캐릭터가 전용 장비를 가져야 하는 경우에는 이 경고를 해결해야 한다.

스크립트가 자동으로 잡는 항목:

- manifest의 `id`, `name`, `image_thumb`
- manifest 썸네일 이미지 파일 존재 여부
- `images/{id}_tide.webp` 파일 존재 여부
- 추천 세팅의 명륜/계약 ID가 사전에 존재하는지
- `character_effects.json`의 스킬/돌파 데이터 존재 여부
- `gachatype.json` 포함 여부
- 전용 SSR/SR 명륜 관계와 이미지 파일 존재 여부
- 전용 은열쇠 관계와 이미지 파일 존재 여부
- `party_builder_rules.json`의 캐릭터 ID 참조 유효성

사람이 최종 판단해야 하는 항목:

- 추천 세팅 내용이 실제 공략 기준으로 맞는지
- 캐릭터가 어떤 검색 태그에 들어가야 하는지
- 변형 캐릭터 동시 편성 제한이 필요한지
- 정보글 링크를 지금 넣을 수 있는지
- 패치 노트에 노출할 내용이 있는지

## 9. 최종 수동 확인

- `links.html?category=character&id=<characterId>`에서 추천 세팅이 깨지지 않는지 확인한다.
- `스킬/돌파` 탭이 정상 표시되는지 확인한다.
- `party_builder.html`에서 캐릭터 이미지와 전용 장비 자동 장착이 정상 동작하는지 확인한다.
- `covenant_simulator.html`에서 캐릭터 이미지가 정상 표시되는지 확인한다.
- 명륜/은열쇠/계약 이미지가 placeholder로 떨어지지 않는지 확인한다.
