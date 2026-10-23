# 각성체 이름과 장비 관계

각성체 표시명의 기준은 `data/character_manifest.json`의 `name`이다. 관계와 저장값은 표시명 대신 기존 `id`를 사용한다. 클라이언트 기록은 `client_id`로 연결한다.

| 필드 | 의미 |
|---|---|
| `name` | 현재 사이트 표시명. 다른 데이터에서 덮어쓰지 않는다. |
| `name_aliases` | 최초 표시명과 검증한 과거 표기. 이름을 바꿔도 이전 별칭을 삭제하지 않는다. 검색과 원문 표시 변환에 사용한다. |
| `owner_character_ids` | 전용 장비 소유자. 파티 빌더 전용 SSR·SR·은열쇠 버튼의 유일한 판단 기준이다. |
| `recommended_character_ids` | 명륜 추천 각성체. 표시할 때 manifest의 현재 이름으로 태그를 구성한다. |
| `related_character_ids` | 은열쇠 관련 각성체. 효과 태그와 분리해 현재 이름으로 표시한다. |

`js/character-identity.js`가 관계 조회, 검색 별칭, 설명 표시 변환을 공유한다. 짧은 이름인 서·산·돌은 일반 단어 안에서 치환하지 않으며, 변형 각성체 전체 이름을 기본 각성체 이름보다 먼저 해석한다. 명시적 문장 참조 형식은 `{character:alva}`이다.

도감·툴팁·각성체 효과·파티 빌더·보유 현황·복각 일정은 로딩한 데이터의 표시용 필드에 현재 이름을 적용한다. 융재 상성 이름과 이미지는 소유한 각성체 ID로 manifest에서 가져오고, 편성 통계의 클라이언트 각성체는 `client_id`로 연결한다. 원문 보관용 `raw*`, `source*`, `original*`, `research*`, `provenance*` 필드 및 커뮤니티 링크 데이터는 변환하지 않는다.

`node tools/migrate-character-identity.mjs`는 기존 관계를 점검한다. `--write`를 붙이면 과거 이름으로 저장된 관계를 ID 배열로 이관한다. 데이터 재생성 후에도 현재 manifest와 기존 ID를 보존하고, 이 명령으로 관계를 정규화해야 한다.

`node tools/validate-character-identity.mjs`는 별칭 충돌, 잘못된 클라이언트 ID, 관계 ID 누락, 이름 태그로 되돌아간 관계를 검사한다. 이 검사는 `npm run data:validate`에도 포함된다. 이름 변경 회귀 검사는 `js/character-identity.test.cjs`에서 전체 전용 장비 장착·저장, 설명과 별칭, 원문 보존을 확인한다.
