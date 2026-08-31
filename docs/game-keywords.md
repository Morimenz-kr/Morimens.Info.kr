# 인게임 키워드 사전 — 단어·아이콘·설명 전수 연결

> 기준일: 2026-08-31 · 클라이언트 리소스 140 / 빌드 51 · 한국어 데이터 기준

## 무엇을 키워드로 보는가

이 문서에서 **인라인 키워드**는 설명 본문 안에서 아이콘과 함께 표시되고, 상태 또는 스킬 설명으로 연결되는 용어다. 정식 한국어 메뉴 명칭을 단정하지 않기 위해 문서상의 이름으로 사용한다. 버프·디버프뿐 아니라 카드 속성, 고유 효과, 전투 기믹도 포함된다. 파일명에 Buff가 들어간다고 모두 유리한 버프인 것은 아니다.

아이콘은 본문의 키워드 표시 설정에서 연결한 **Battle_Card 스프라이트**를 사용했다. 상태창의 버프 아이콘이나 몬스터 의도 아이콘으로 대체하지 않았다. 각 항목의 설명은 연결된 한국어 게임 설명이며, 사이트의 기존 툴팁 설명을 정답으로 삼지 않았다.

## 조사 범위와 누락 검증

| 분류 | 정의 수 | 수록 위치 |
|---|---:|---|
| 아이콘 + 설명 연결 + 명시적 색상 | 173 | 본문 사전 |
| 아이콘 + 설명 연결, 별도 색상 미지정 | 24 | 본문 사전, 색상 미지정으로 표시 |
| 전투 본문 아이콘은 있으나 고정 설명 연결 없음 | 27 | 부록 A |
| 아이콘 없이 상태·스킬 설명 연결 | 391 | 부록 B |
| 그 외 서식·재화·숫자·범용 링크 설정 | 322 | 부록 C |
| **전체 표시 정의** | **937** | 서로 중복되지 않는 전체 분류 |

- 한국어 텍스트 **72개 테이블 / 159,340개 레코드**를 전수 대조했다. 중첩 태그도 포함했다.
- 본문에서 관측된 태그는 **713종**이다. 이 중 정의 목록 밖의 항목은 각성체 이름 치환용 `AwakerName` 1종이다. 상태·스킬 설명 연결이나 본문 아이콘을 가진 고정 키워드로 분류하지 않았다.
- 본문 사전 **197개 태그**는 모두 연결 대상과 한국어 설명이 존재한다. 이 중 **8개**는 한국어 본문 사용이 관측되지 않았지만, 정의에 있으므로 빼지 않았다.
- 전투 본문 아이콘 정의 224개가 사용하는 **62종 이미지**를 실제 아틀라스의 이름·영역과 대조했다. 누락 이미지 0개, 핵심 사전 설명 누락 0개다.
- 아이콘 없는 보조 항목 WormGrowth → 상태 145228은 원본 설명이 비어 있다. 이를 임의로 채우지 않고 부록 B에 명시했다.
- “전수”는 **이 버전의 전체 표시 정의와 확보한 한국어 텍스트**에 대한 뜻이다. 모든 게임 화면을 직접 클릭했다거나, 서버 전용·향후 버전·현재 공개 여부까지 확인했다는 뜻은 아니다. 미사용 정의가 실제 플레이에 등장한다고 단정하지 않는다.

## 읽는 방법

- **태그가 식별자다.** 같은 한국어 이름이어도 다른 태그는 별도 항목으로 유지한다. 일반 전투와 PVP·페이즈 체스용 설명을 합치지 않는다.
- 제목은 연결된 상태·스킬의 한국어 이름을 우선 사용한다. 본문에 다른 번역·표기가 쓰이면 “본문 표기”에 모두 남긴다. 표기를 통일하거나 번역 충돌을 임의로 교정하지 않았다.
- 색상 값이 없는 항목은 주변 문맥·표시 계층의 색상일 수 있다. 이를 임의로 흰색 또는 버프 색상으로 확정하지 않는다.
- 설명의 [Layer], [Arg1], [StateArg1], [DescArg1] 등은 사용 문맥에 따라 바뀌는 원본 자리표시자다. 이 정적 사전에서는 임의의 숫자로 바꾸지 않는다. 설명 변형은 별도 원문 키로 구분한다.
- 관측 횟수는 텍스트 데이터 안의 출현 횟수이며, 실제 사용 빈도나 중요도 순위가 아니다. 근거 키는 추적 가능한 대표 예시다.

## 단어만으로 툴팁을 붙이면 안 되는 사례

- 하티 사냥떼라는 이름 안의 “사냥”과 BattueKeywords로 표시된 “집단 사냥”은 다르다.
- 조난한 탐험대의 행동명 “경계”와 AlertIconKeywords로 표시된 상태 “경계”는 다르다.
- 문장 속 “보유”, “포식”, “저주”가 사전에 있는 단어와 일치한다고 자동으로 키워드가 되지 않는다.
- HuoyanKeywords의 활염과 HuoyanKeywords4의 활염은 아이콘을 공유하지만, 후자는 고정 설명 연결이 없다.
- MonsterExFlameKeywords의 폭염은 아이콘·설명 연결이 있고, BaoyanKeywords의 폭염은 색상만 지정된다.

## 본문 사전 — 아이콘과 설명이 연결된 197개 태그

<a id="kw-birthritual"></a>

### 강생 의식 · `BirthRitual`

![강생 의식](../images/keyword-icons/inline/battle_card_buff_079.png)

- 본문 표기: 강생 의식
- 색상: `별도 색상 지정 없음`
- 아이콘: `Battle_Card_Buff_079` · 설명 연결: 상태 119108 · 본문 관측: 2회

> HP를 잃을 때, 스택당 잃은 HP의 1%만큼 희생을 획득한다.

설명 근거: `State_119108_Desc`

본문 근거 예시: `Text_KR.Text_Skill:Skill_118058_Desc`, `Text_KR.Text_Skill:Skill_118105_Desc`

<a id="kw-dwmofeikeywords"></a>

### 강생 의식 · `DwmofeiKeywords`

![강생 의식](../images/keyword-icons/inline/battle_card_buff_079.png)

- 본문 표기: 강생 의식 / 강림 의식
- 색상: `blueword (#76aac8)`
- 아이콘: `Battle_Card_Buff_079` · 설명 연결: 상태 120321 · 본문 관측: 7회

> 스택당 능동 또는 촉수 피해를 받을 때 피해의 1%에 해당하는 헌제 추가, 턴 종료 시 제거, 최대 75스택.

설명 근거: `State_120321_Desc`

본문 근거 예시: `Text_KR.Text_Skill:Skill_119764_OverLimitUtlSkillDesc`, `Text_KR.Text_Skill:Skill_120314_Desc`, `Text_KR.Text_Skill:Skill_119764_BattleDesc`

<a id="kw-reinforcekeywords"></a>

### 강화 · `ReinforceKeywords`

![강화](../images/keyword-icons/inline/battle_card_buff_046.png)

- 본문 표기: 보강 / 요새화 / 강고 / 치취
- 색상: `blueword (#76aac8)`
- 아이콘: `Battle_Card_Buff_046` · 설명 연결: 상태 19549 · 본문 관측: 19회

> 다음 턴 시작 전까지 받는 능동 공격 피해가 50% 감소하며, 적용 시 취약과 상쇄된다.

설명 근거: `State_19549_Desc`

본문 근거 예시: `Text_KR.Text_Skill:Skill_45260_Desc_1`, `Text_KR.Text_Skill:Skill_45644_Desc_1`, `Text_KR.Text_Skill:Skill_19412_Desc_1`

<a id="kw-strengthenkeywords"></a>

### 강화 · `StrengthenKeywords`

![강화](../images/keyword-icons/inline/battle_card_buff_071.png)

- 본문 표기: 강화 / 반격 / 모래주머니 / 실드 / 행동 봉쇄
- 색상: `orangeword (#c48662)`
- 아이콘: `Battle_Card_Buff_071` · 설명 연결: 상태 19996 · 본문 관측: 22회

> 이번 턴 종료 전까지 주는 피해가 25% 증가하며, 적용 시 허약과 상쇄된다.

설명 근거: `State_19996_Desc`

본문 근거 예시: `Text_KR.Text_Skill:Skill_48151_Desc_1`, `Text_KR.Text_Skill:Skill_84232_Desc_1`, `Text_KR.Text_Skill:Skill_21337_Desc_1`

<a id="kw-temppowerkeywords2"></a>

### 강화 · `TempPowerKeywords2`

![강화](../images/keyword-icons/inline/battle_card_buff_016.png)

- 본문 표기: 강화
- 색상: `orangeword (#c48662)`
- 아이콘: `Battle_Card_Buff_016` · 설명 연결: 상태 149664 · 본문 관측: 2회

> 1층마다 이 카드가 주는 피해, 고정 힘과 촉수 피해 증가, 고정 중독, 고정 반격 최종 효과를 2% 증가시키고; 고정 방어막, 고정 HP 회복, 힘 감소의 최종 효과를 1% 증가시키며, 사용 후 제거됩니다.

설명 근거: `State_149664_Desc`

본문 근거 예시: `Text_KR.Text_RelicConfig:RelicConfig_149665_Desc`, `Text_KR.Text_RelicConfig:RelicConfig_149665_BattleDesc`

<a id="kw-strongeffectkeywords"></a>

### 강효 · `StrongEffectKeywords`

![강효](../images/keyword-icons/inline/battle_card_buff_001.png)

- 본문 표기: 강효 / 증폭 효과 / 증폭
- 색상: `orangeword (#c48662)`
- 아이콘: `Battle_Card_Buff_001` · 설명 연결: 상태 59160 · 본문 관측: 40회

> 스택당 이번 전투에서 「명령 카드」, 「광기 폭발」이 주는 모든 피해, 치유 및 실드 효과가 10% 증가하며, 해제할 수 없다.

설명 근거: `State_59160_Desc`

본문 근거 예시: `Text_KR.Text_RelicConfig:RelicConfig_94695_Desc`, `Text_KR.Text_RelicConfig:RelicConfig_94695_BattleDesc`, `Text_KR.Text_Skill:Skill_124900_Desc_1`

<a id="kw-reduceeffectkeywords"></a>

### 강효 감소 · `ReduceEffectKeywords`

![강효 감소](../images/keyword-icons/inline/battle_card_buff_047.png)

- 본문 표기: 강효 감소
- 색상: `purpleword (#af6bb0)`
- 아이콘: `Battle_Card_Buff_047` · 설명 연결: 상태 59208 · 본문 관측: 2회

> 스택당 이번 전투에서 「명령 카드」, 「광기 폭발」이 주는 모든 피해, 치유 및 실드 효과가 10% 감소하며, 해제할 수 없다.

설명 근거: `State_59208_Desc`

본문 근거 예시: `Text_KR.Text_Skill:Skill_59428_Desc_1`, `Text_KR.Text_Skill:Skill_45251_Desc_1`

<a id="kw-guaiwuheiyu"></a>

### 검은 깃털 · `Guaiwuheiyu`

![검은 깃털](../images/keyword-icons/inline/battle_card_buff_016.png)

- 본문 표기: 검은 깃털
- 색상: `orangeword (#c48662)`
- 아이콘: `Battle_Card_Buff_016` · 설명 연결: 상태 91759 · 본문 관측: 22회

> 검은 깃털은 「성자·검은 깃털」의 능력을 강화할 수 있다.

설명 근거: `State_91759_Desc`

본문 근거 예시: `Text_KR.Text_Skill:Skill_91747_BattleDesc`, `Text_KR.Text_Skill:Skill_91744_BattleDesc`, `Text_KR.Text_Skill:Skill_91746_BattleDesc`

<a id="kw-killkeywords"></a>

### 격파 · `KillKeywords`

![격파](../images/keyword-icons/inline/battle_card_buff_016.png)

- 본문 표기: 격파
- 색상: `orangeword (#c48662)`
- 아이콘: `Battle_Card_Buff_016` · 설명 연결: 상태 94657 · 본문 관측: 1회

> 적을 처치하거나 적의 부활 효과가 발동될 때, 해당 효과가 발동된다.

설명 근거: `State_94657_Desc`

본문 근거 예시: `Text_KR.Text_State:State_94657_Name`

<a id="kw-alerticonkeywords"></a>

### 경계 · `AlertIconKeywords`

![경계](../images/keyword-icons/inline/battle_card_buff_009.png)

- 본문 표기: 경계 / 임시 경계
- 색상: `blueword (#76aac8)`
- 아이콘: `Battle_Card_Buff_009` · 설명 연결: 상태 2712 · 본문 관측: 49회

> 생성하는 실드가 증가한다.

설명 근거: `State_2712_Desc`

본문 근거 예시: `Text_KR.Text_RelicConfig:RelicConfig_121693_Desc`, `Text_KR.Text_RelicConfig:RelicConfig_13881_Desc`, `Text_KR.Text_RelicConfig:RelicConfig_13881_BattleDesc`

<a id="kw-guyoukeywords"></a>

### 고유 · `GuyouKeywords`

![고유](../images/keyword-icons/inline/battle_card_buff_016.png)

- 본문 표기: 고유
- 색상: `orangeword (#c48662)`
- 아이콘: `Battle_Card_Buff_016` · 설명 연결: 상태 60511 · 본문 관측: 6회

> 반드시 시작 패에 포함된다.

설명 근거: `State_60511_Desc`

본문 근거 예시: `Text_KR.Text_EnchantConfig:EnchantConfig_18171_Desc`, `Text_KR.Text_EnchantConfig:EnchantConfig_18200_Desc`, `Text_KR.Text_State:State_60511_Name`

<a id="kw-monsterpainkeywords"></a>

### 고통 구원 · `MonsterPainKeywords`

![고통 구원](../images/keyword-icons/inline/battle_card_buff_016.png)

- 본문 표기: 고통 구원
- 색상: `별도 색상 지정 없음`
- 아이콘: `Battle_Card_Buff_016` · 설명 연결: 상태 147968 · 본문 관측: 3회

> 최대 3 스택. 공격 의도로 전환 시, 「성자·백야」가 가하는 피해를 25% 증가시키고 1 스택을 소모합니다.

설명 근거: `State_147968_Desc`

본문 근거 예시: `Text_KR.Text_Skill:Skill_147937_Desc`, `Text_KR.Text_Skill:Skill_147942_Desc`, `Text_KR.Text_Skill:Skill_147943_Desc`

<a id="kw-analysiskeywords0"></a>

### 공감 · `AnalysisKeywords0`

![공감](../images/keyword-icons/inline/battle_card_buff_049.png)

- 본문 표기: 공감
- 색상: `purpleword (#af6bb0)`
- 아이콘: `Battle_Card_Buff_049` · 설명 연결: 상태 81059 · 본문 관측: 7회

> 그녀의 감정, 인식, 그리고 모든 것이 군체 의식과 영원히 연결되어 있다. 「공감」은 클레멘타인의 광기 폭발 「생명체 재구성」에 의해 약화 효과로 전환될 수 있으며, 최대 10스택까지 중첩된다.

설명 근거: `State_81059_Desc`

본문 근거 예시: `Text_KR.Text_Skill:Skill_78785_OverLimitUtlSkillDesc_3`, `Text_KR.Text_Skill:Skill_78785_Desc_2`, `Text_KR.Text_Skill:Skill_78785_BattleDesc_2`

<a id="kw-analysiskeywords3"></a>

### 공감 · `AnalysisKeywords3`

![공감](../images/keyword-icons/inline/battle_card_buff_049.png)

- 본문 표기: 공감
- 색상: `purpleword (#af6bb0)`
- 아이콘: `Battle_Card_Buff_049` · 설명 연결: 상태 81058 · 본문 관측: 4회

> 그녀의 감정, 인식, 그리고 모든 것이 군체 의식과 영원히 연결되어 있다. 「공감」은 클레멘타인의 광기 폭발 「생명체 재구성」에 의해 약화 효과로 전환될 수 있으며, 최대 15스택까지 중첩된다.

설명 근거: `State_81058_Desc`

본문 근거 예시: `Text_KR.Text_Skill:Skill_78785_Desc_3`, `Text_KR.Text_Skill:Skill_78785_BattleDesc_3`, `Text_KR.Text_Skill:Skill_78785_OverLimitUtlSkillDesc_0`

<a id="kw-resonancekeywords"></a>

### 공진 X · `ResonanceKeywords`

![공진 X](../images/keyword-icons/inline/battle_card_buff_016.png)

- 본문 표기: 공진3 / 공명3 / 공진 / 공명 / 공진 X
- 색상: `orangeword (#c48662)`
- 아이콘: `Battle_Card_Buff_016` · 설명 연결: 상태 126785 · 본문 관측: 16회

> 다른 각성체가 누적 X장의 명령 카드를 사용한 경우, 사용 후 후속 효과가 발동된다. 자신의 명령 카드를 사용하거나 턴 종료 후 자신의 공진 카운트가 초기화된다.

설명 근거: `State_126785_Desc`

본문 근거 예시: `Text_KR.Text_Skill:Skill_125380_Desc_3`, `Text_KR.Text_Skill:Skill_125383_Desc_2`, `Text_KR.Text_Skill:Skill_125380_BattleDesc`

<a id="kw-emptinesskeywords"></a>

### 공허 · `EmptinessKeywords`

![공허](../images/keyword-icons/inline/battle_card_buff_027.png)

- 본문 표기: 공허 / 허무
- 색상: `yellowword (#b6ad65)`
- 아이콘: `Battle_Card_Buff_027` · 설명 연결: 상태 50333 · 본문 관측: 12회

> 턴 종료 시 모든 각성체가 광기를 잃는다.

설명 근거: `State_50333_Desc`

본문 근거 예시: `Text_KR.Text_Skill:Skill_49552_Desc`, `Text_KR.Text_Skill:Skill_117862_Desc`, `Text_KR.Text_Skill:Skill_149281_Desc`

<a id="kw-pvpemptinesskeywords"></a>

### 공허 · `PVPEmptinessKeywords`

![공허](../images/keyword-icons/inline/battle_card_buff_027.png)

- 본문 표기: 공허
- 색상: `yellowword (#b6ad65)`
- 아이콘: `Battle_Card_Buff_027` · 설명 연결: 상태 47842 · 본문 관측: 11회

> 획득한 광기와 지연된 광기가 50% 감소하며, 모든 지연된 광기를 즉시 제거합니다.

설명 근거: `State_47842_Desc`

본문 근거 예시: `Text_KR.Text_Skill:Skill_142878_Desc_1`, `Text_KR.Text_Skill:Skill_45503_Desc_1`, `Text_KR.Text_Skill:Skill_46433_Desc_1`

<a id="kw-monsterb11_affull"></a>

### 과식 · `MonsterB11_AFFull`

![과식](../images/keyword-icons/inline/battle_card_buff_091.png)

- 본문 표기: 과식
- 색상: `별도 색상 지정 없음`
- 아이콘: `Battle_Card_Buff_091` · 설명 연결: 상태 149576 · 본문 관측: 12회

> 「백설 요정」의 의도가 「흩날리는 눈의 저주」로 전환될 때 1층을 소모하고, 의도를 「기적의 축복」으로 변경합니다.

설명 근거: `State_149576_Desc`

본문 근거 예시: `Text_KR.Text_Skill:Skill_149647_Desc`, `Text_KR.Text_Skill:Skill_149369_Desc`, `Text_KR.Text_Skill:Skill_149373_Desc`

<a id="kw-wormgrowth1"></a>

### 과식 · `WormGrowth1`

![과식](../images/keyword-icons/inline/battle_card_buff_091.png)

- 본문 표기: 과식
- 색상: `redword (#bb646d)`
- 아이콘: `Battle_Card_Buff_091` · 설명 연결: 상태 145709 · 본문 관측: 15회

> 스택당 카라부 체력의 10%에 해당하는 HP 상한이 증가하고, 「과식」은 최대 50스택까지 중첩된다. 해당 상태 획득 시 이미 상한에 도달했을 경우에는, 초과되는 1스택당 3배에 해당하는 HP를 회복하는 것으로 대체된다. 보스가 등장하지 않는 전투마다 「과식」을 최대 10스택까지 획득할 수 있다. 전투 종료 시 제거되지 않는다.

설명 근거: `State_145709_Desc`

본문 근거 예시: `Text_KR.Text_Skill:Skill_144486_Desc_0`, `Text_KR.Text_Skill:Skill_144486_Desc_3`, `Text_KR.Text_Skill:Skill_144486_BattleDesc_0`

<a id="kw-wormgrowth2"></a>

### 과식 · `WormGrowth2`

![과식](../images/keyword-icons/inline/battle_card_buff_091.png)

- 본문 표기: 과식
- 색상: `redword (#bb646d)`
- 아이콘: `Battle_Card_Buff_091` · 설명 연결: 상태 149169 · 본문 관측: 5회

> 스택당 카라부 체력의 15%에 해당하는 HP 상한이 증가하고, 「과식」은 최대 50스택까지 중첩된다. 해당 상태 획득 시 이미 상한에 도달했을 경우에는, 초과되는 1스택당 3배에 해당하는 HP를 회복하는 것으로 대체된다. 보스가 등장하지 않는 전투마다 「과식」을 최대 10스택까지 획득할 수 있다. 전투 종료 시 제거되지 않는다.

설명 근거: `State_149169_Desc`

본문 근거 예시: `Text_KR.Text_Skill:Skill_144486_OverLimitUtlSkillDesc`, `Text_KR.Text_State:State_149169_Name`

<a id="kw-puncturedamagewords"></a>

### 관통 피해 · `PunctureDamagewords`

![관통 피해](../images/keyword-icons/inline/battle_card_buff_016.png)

- 본문 표기: 관통 피해 / 관통
- 색상: `orangeword (#c48662)`
- 아이콘: `Battle_Card_Buff_016` · 설명 연결: 상태 2472 · 본문 관측: 68회

> 실드와 HP에 동시에 피해를 주며, 면역될 수 없다.

설명 근거: `State_2472_Desc`

본문 근거 예시: `Text_KR.Text_Skill:Skill_97918_OverLimitUtlSkillDesc`, `Text_KR.Text_Skill:Skill_4077_Desc_1`, `Text_KR.Text_Skill:Skill_4203_tempBattleDesc_2`

<a id="kw-madnessiconkeywords"></a>

### 광란 · `MadnessIconKeywords`

![광란](../images/keyword-icons/inline/battle_card_buff_030.png)

- 본문 표기: 광란 / 발광
- 색상: `greenword (#71aa86)`
- 아이콘: `Battle_Card_Buff_030` · 설명 연결: 상태 3135 · 본문 관측: 31회

> 스택당 주는 능동 피해 횟수가 1 증가한다.

설명 근거: `State_3135_Desc`

본문 근거 예시: `Text_KR.Text_Skill:Skill_80759_Desc`, `Text_KR.Text_Skill:Skill_4806_Desc`, `Text_KR.Text_Skill:Skill_21663_Desc`

<a id="kw-kuangxiang"></a>

### 광상 · `Kuangxiang`

![광상](../images/keyword-icons/inline/battle_card_buff_016.png)

- 본문 표기: 광상
- 색상: `orangeword (#c48662)`
- 아이콘: `Battle_Card_Buff_016` · 설명 연결: 상태 100542 · 본문 관측: 6회

> 픽맨이 「발견」 효과를 발동할 때 추가로 「영감 폭발!」 옵션이 추가된다: 「광상」 1스택을 소모하고, 모든 「발견」 효과를 선택하며 「창의」 1스택을 획득한다.

설명 근거: `State_100542_Desc`

본문 근거 예시: `Text_KR.Text_Skill:Skill_98989_Desc_0`, `Text_KR.Text_Skill:Skill_99016_Desc`, `Text_KR.Text_Skill:Skill_98987_Desc`

<a id="kw-kuangbao"></a>

### 광폭 · `Kuangbao`

![광폭](../images/keyword-icons/inline/battle_card_buff_016.png)

- 본문 표기: 광포 / 광폭
- 색상: `orangeword (#c48662)`
- 아이콘: `Battle_Card_Buff_016` · 설명 연결: 상태 95038 · 본문 관측: 3회

> 공격을 받을 때, 스택 수만큼의 임시 힘을 획득한다.

설명 근거: `State_95038_Desc`

본문 근거 예시: `Text_KR.Text_Skill:Skill_94954_Desc`, `Text_KR.Text_Skill:Skill_94956_Desc`, `Text_KR.Text_State:State_95038_Name`

<a id="kw-b02afkeyword4"></a>

### 구원 · `B02AFKeyWord4`

![구원](../images/keyword-icons/inline/battle_card_buff_016.png)

- 본문 표기: 구원
- 색상: `orangeword (#c48662)`
- 아이콘: `Battle_Card_Buff_016` · 설명 연결: 상태 45206 · 본문 관측: 2회

> 신앙으로 세상을 구원한다. 모든 핏빛 용광로의 남은 회복량을 소모하여, 소모량의 150%에 해당하는 실드를 획득한다. 이 실드는 실드 보너스와 약화 효과의 영향을 받지 않으며, 실드 상한을 무시한다.

설명 근거: `State_45206_Desc`

본문 근거 예시: `Text_KR.Text_Skill:Skill_4529_Desc_2`, `Text_KR.Text_Skill:Skill_4529_Desc_0`

<a id="kw-fishleapwords"></a>

### 군서의 힘 · `FishLeapWords`

![군서의 힘](../images/keyword-icons/inline/battle_card_buff_016.png)

- 본문 표기: 군서의 힘
- 색상: `별도 색상 지정 없음`
- 아이콘: `Battle_Card_Buff_016` · 설명 연결: 상태 117889 · 본문 관측: 1회

> 등장 시 자신의 최대 HP가 10% 증가하고, 다른 아군에게 \[DescArg1\]의 힘을 부여하며, 이번 전투 중 군서의 힘의 HP 증가 및 힘 획득 효과가 추가로 1회 발동된다.

설명 근거: `State_117889_Desc`

본문 근거 예시: `Text_KR.Text_State:State_117889_Desc`

<a id="kw-monster_newunit6_endboss_fever"></a>

### 극통 광란 · `Monster_NewUnit6_EndBoss_Fever`

![극통 광란](../images/keyword-icons/inline/battle_card_buff_016.png)

- 본문 표기: 극통 광란
- 색상: `별도 색상 지정 없음`
- 아이콘: `Battle_Card_Buff_016` · 설명 연결: 상태 150121 · 본문 관측: 1회

> 초기에 임시 열광 10층을 보유합니다. 능동 피해를 1회 받을 때마다 임시 열광 1층을 획득합니다.

설명 근거: `State_150121_Desc`

본문 근거 예시: `Text_KR.Text_Skill:Skill_149847_Desc`

<a id="kw-comakeywords"></a>

### 기절 · `ComaKeywords`

![기절](../images/keyword-icons/inline/battle_card_buff_023.png)

- 본문 표기: 기절 / 석화 / 실신
- 색상: `orangeword (#c48662)`
- 아이콘: `Battle_Card_Buff_023` · 설명 연결: 상태 19992 · 본문 관측: 11회

> 턴 종료 전까지 아무런 행동도 할 수 없다. 실신 피해를 받으면 대상이 내성을 획득하며, 내성 보유 시 다시 실신 피해를 받으면 실신 효과를 상쇄하고 피해가 2배가 된다.

설명 근거: `State_19992_Desc`

본문 근거 예시: `Text_KR.Text_Skill:Skill_45616_Desc_1`, `Text_KR.Text_Skill:Skill_19349_Desc_1`, `Text_KR.Text_Skill:Skill_19342_Desc_1`

<a id="kw-hunmikeywords"></a>

### 기절 · `HunmiKeywords`

![기절](../images/keyword-icons/inline/battle_card_buff_023.png)

- 본문 표기: 실신 / 기절
- 색상: `orangeword (#c48662)`
- 아이콘: `Battle_Card_Buff_023` · 설명 연결: 상태 123810 · 본문 관측: 3회

> 적의 현재 의도를 「행동 불가」로 대체한다.

설명 근거: `State_123810_Desc`

본문 근거 예시: `Text_KR.Text_Skill:Skill_122486_OverLimitUtlSkillDesc_0`, `Text_KR.Text_Skill:Skill_122486_OverLimitUtlSkillDesc_3`, `Text_KR.Text_State:State_123810_Name`

<a id="kw-pvpfeatheredseedskeywords"></a>

### 깃종 · `PVPFeatheredSeedsKeyWords`

![깃종](../images/keyword-icons/inline/battle_card_buff_087.png)

- 본문 표기: 우종
- 색상: `whiteword (#ffffff)`
- 아이콘: `Battle_Card_Buff_087` · 설명 연결: 상태 140489 · 본문 관측: 6회

> 동일한 양의 최대 생명력을 획득하며, 스택수는 각성체의 초기 최대 생명력을 초과하지 않는다.

설명 근거: `State_140489_Desc`

본문 근거 예시: `Text_KR.Text_Skill:Skill_133325_Desc_1`, `Text_KR.Text_Skill:Skill_133347_Desc_1`, `Text_KR.Text_Skill:Skill_133325_BattleDesc_1`

<a id="kw-abyssallock"></a>

### 꿈의 족쇄 · `Abyssallock`

![꿈의 족쇄](../images/keyword-icons/inline/battle_card_buff_016.png)

- 본문 표기: 꿈의 족쇄 / 심연의 사슬
- 색상: `별도 색상 지정 없음`
- 아이콘: `Battle_Card_Buff_016` · 설명 연결: 상태 119757 · 본문 관측: 5회

> 수호자 턴 시작 시, 「꿈의 족쇄」 스택 수만큼 손패의 카드에 둔화 1스택을 부여한다. 「낙원의 장막」이 능동 피해로 파괴될 때마다 1스택씩 감소하며, 파괴한 각성체를 1턴간 「완전 봉인」한다.

설명 근거: `State_119757_Desc`

본문 근거 예시: `Text_KR.Text_Skill:Skill_118092_Desc`, `Text_KR.Text_State:State_120215_Desc`, `Text_KR.Text_State:State_119749_Desc`

<a id="kw-abyssallock2"></a>

### 꿈의 족쇄 · `Abyssallock2`

![꿈의 족쇄](../images/keyword-icons/inline/battle_card_buff_016.png)

- 본문 표기: 꿈의 족쇄
- 색상: `별도 색상 지정 없음`
- 아이콘: `Battle_Card_Buff_016` · 설명 연결: 상태 119749 · 본문 관측: 1회

> 수호자 턴 시작 시, 「꿈의 족쇄」 스택 수만큼 손패의 카드에 둔화 1스택을 부여한다.

설명 근거: `State_119749_Desc`

본문 근거 예시: `Text_KR.Text_Skill:Skill_118097_Desc`

<a id="kw-bleesing_delay"></a>

### 놓쳐진 기회 · `Bleesing_Delay`

![놓쳐진 기회](../images/keyword-icons/inline/battle_card_buff_016.png)

- 본문 표기: 놓쳐진 기회
- 색상: `orangeword (#c48662)`
- 아이콘: `Battle_Card_Buff_016` · 설명 연결: 상태 145628 · 본문 관측: 98회

> 2턴 후 「선물」 효과를 획득한다.

설명 근거: `State_145628_Desc`

본문 근거 예시: `Text_KR.Text_Skill:Skill_149962_tempBattleDesc_2`, `Text_KR.Text_Skill:Skill_149996_Desc`, `Text_KR.Text_Skill:Skill_150011_tempBattleDesc_2`

<a id="kw-exhaustioncounter"></a>

### 눈에는 눈 · `ExhaustionCounter`

![눈에는 눈](../images/keyword-icons/inline/battle_card_buff_016.png)

- 본문 표기: 눈에는 눈
- 색상: `별도 색상 지정 없음`
- 아이콘: `Battle_Card_Buff_016` · 설명 연결: 상태 117885 · 본문 관측: 1회

> 힘 감소 효과를 받을 때, 부여한 대상에게도 동일한 양의 힘 감소 효과를 부여한다.

설명 근거: `State_117885_Desc`

본문 근거 예시: `Text_KR.Text_Skill:Skill_126450_Desc`

<a id="kw-pvpslowkeywords"></a>

### 느림 · `PVPSlowKeywords`

![느림](../images/keyword-icons/inline/battle_card_buff_024.png)

- 본문 표기: 둔화 / 느림
- 색상: `purpleword (#af6bb0)`
- 아이콘: `Battle_Card_Buff_024` · 설명 연결: 상태 19527 · 본문 관측: 19회

> 스택당 「스킬」의 이번 턴 행동력 소모+1, 최대 3스택, 사용 후 스택이 1보다 크면 스택-1.

설명 근거: `State_19527_Desc`

본문 근거 예시: `Text_KR.Text_Skill:Skill_45583_Desc_1`, `Text_KR.Text_Skill:Skill_45585_Desc_1`, `Text_KR.Text_Skill:Skill_60952_Desc_1`

<a id="kw-blessingnegativeeffect"></a>

### 대가 · `BlessingNegativeEffect`

![대가](../images/keyword-icons/inline/battle_card_buff_016.png)

- 본문 표기: 대가
- 색상: `orangeword (#c48662)`
- 아이콘: `Battle_Card_Buff_016` · 설명 연결: 상태 144508 · 본문 관측: 56회

> 「대가」는 총 3종(「놓쳐진 기회」, 「허풍」, 「은폐된 살의」)로 구성되어 있다.
> 「놓쳐진 기회」: 2턴 후 「선물」 효과를 획득한다.
> 「허풍」: 「선물」 효과가 50% 감소한다.
> 「은폐된 살의」: 자신에게 랜덤 효과 1종을 부여한다: 2턴 허약, 2턴 손상, 2턴 중상, 최대 HP의 1%에 해당하는 중독, 공허 2스택, 손에 든 랜덤 카드 2장에 둔화 1스택 부여, 드로우 덱 상단에 임시 증상 카드 2장(전투 간 계승 불가) 생성 후 추가.

설명 근거: `State_144508_Desc`

본문 근거 예시: `Text_KR.Text_Skill:Skill_149969_Desc_0`, `Text_KR.Text_Skill:Skill_144492_BattleDesc_0`, `Text_KR.Text_Skill:Skill_149960_Desc_0`

<a id="kw-tauntkeywords"></a>

### 도발 · `TauntKeywords`

![도발](../images/keyword-icons/inline/battle_card_buff_056.png)

- 본문 표기: 도발
- 색상: `redword (#bb646d)`
- 아이콘: `Battle_Card_Buff_056` · 설명 연결: 상태 19530 · 본문 관측: 22회

> · 상대의 우선 공격 대상이 되며, 상대가 단일 대상을 선택할 때 도발 각성체만 선택할 수 있다.
> · 도발 획득 시 자신의 잠행과 다른 아군의 도발을 해제하고, 동시에 적의 잠행을 제거한다.

설명 근거: `State_19530_Desc`

본문 근거 예시: `Text_KR.Text_Skill:Skill_45629_Desc_1`, `Text_KR.Text_Skill:Skill_45642_Desc_1`, `Text_KR.Text_Skill:Skill_45481_Desc_1`

<a id="kw-transitioniconkeywords"></a>

### 도약 · `TransitionIconKeywords`

![도약](../images/keyword-icons/inline/battle_card_buff_016.png)

- 본문 표기: 워프 / 도약 / 점프
- 색상: `orangeword (#c48662)`
- 아이콘: `Battle_Card_Buff_016` · 설명 연결: 상태 2735 · 본문 관측: 59회

> 이 카드를 사용한 후 「차원 이동」이 발동되거나 현재 초차원 턴일 경우, 후속 효과를 발동한다.

설명 근거: `State_2735_Desc`

본문 근거 예시: `Text_KR.Text_RelicConfig:RelicConfig_13924_Desc`, `Text_KR.Text_RelicConfig:RelicConfig_13924_BattleDesc`, `Text_KR.Text_Skill:Skill_4156_BattleDesc_0`

<a id="kw-witherkeywords"></a>

### 도취 · `WitherKeywords`

![도취](../images/keyword-icons/inline/battle_card_buff_080.png)

- 본문 표기: 도취
- 색상: `redword (#bb646d)`
- 아이콘: `Battle_Card_Buff_080` · 설명 연결: 상태 126776 · 본문 관측: 19회

> 스택당 받는 고정 중독이 5% 증가하며, 주는 피해가 \[DescArg1\]% 감소한다. 최대 \[DescArg2\]스택까지 중첩된다.

설명 근거: `State_126776_Desc`

본문 근거 예시: `Text_KR.Text_RelicConfig:RelicConfig_125489_BattleDesc`, `Text_KR.Text_RelicConfig:RelicConfig_125489_Desc`, `Text_KR.Text_Skill:Skill_126767_Desc_0`

<a id="kw-witherkeywords0"></a>

### 도취 · `WitherKeywords0`

![도취](../images/keyword-icons/inline/battle_card_buff_080.png)

- 본문 표기: 도취 / 도취 \[Arg1\]스택을 부여하며, 부여하는 중독량이 200% 증가한다.
- 색상: `redword (#bb646d)`
- 아이콘: `Battle_Card_Buff_080` · 설명 연결: 상태 127176 · 본문 관측: 7회

> 스택당 받는 고정 중독이 5% 증가하며, 주는 피해가 \[DescArg1\]% 감소한다. 최대 \[DescArg2\]스택까지 중첩된다.

설명 근거: `State_127176_Desc`

본문 근거 예시: `Text_KR.Text_Skill:Skill_125380_Desc_3`, `Text_KR.Text_Skill:Skill_125373_Desc_15`, `Text_KR.Text_Skill:Skill_126767_Desc_3`

<a id="kw-daohaizheyishi"></a>

### 도해자의 제의 · `Daohaizheyishi`

![도해자의 제의](../images/keyword-icons/inline/battle_card_buff_016.png)

- 본문 표기: 도해자의 제의
- 색상: `별도 색상 지정 없음`
- 아이콘: `Battle_Card_Buff_016` · 설명 연결: 상태 96783 · 본문 관측: 1회

> 매 라운드 2장의 카드에「바다를 건너는 자의 광란」을 추가합니다.

설명 근거: `State_96783_Desc`

본문 근거 예시: `Text_KR.Text_Skill:Skill_96756_Desc`

<a id="kw-duren"></a>

### 독검 · `Duren`

![독검](../images/keyword-icons/inline/battle_card_buff_016.png)

- 본문 표기: 독날 / 독검
- 색상: `orangeword (#c48662)`
- 아이콘: `Battle_Card_Buff_016` · 설명 연결: 상태 95035 · 본문 관측: 3회

> 방어되지 않은 능동 피해를 입혔을 때, 스택 1당 1의 중독을 부여한다.

설명 근거: `State_95035_Desc`

본문 근거 예시: `Text_KR.Text_Skill:Skill_96759_Desc`, `Text_KR.Text_State:State_95035_Name`, `Text_KR.Text_State:State_94708_Desc`

<a id="kw-d13afkeyword1"></a>

### 두려움 고착 · `D13AFKeyWord1`

![두려움 고착](../images/keyword-icons/inline/battle_card_buff_049.png)

- 본문 표기: 두려움 고착
- 색상: `purpleword (#af6bb0)`
- 아이콘: `Battle_Card_Buff_049` · 설명 연결: 상태 81057 · 본문 관측: 7회

> 군집 침식 아래, 너의 공포는 숨을 곳이 없다. 스택당 이번 턴 능동 및 촉수 피해 3% 감소, 최대 10스택.

설명 근거: `State_81057_Desc`

본문 근거 예시: `Text_KR.Text_Skill:Skill_78785_OverLimitUtlSkillDesc_3`, `Text_KR.Text_Skill:Skill_78785_Desc_2`, `Text_KR.Text_Skill:Skill_78785_BattleDesc_2`

<a id="kw-d13afkeywordq1"></a>

### 두려움 고착 · `D13AFKeyWordQ1`

![두려움 고착](../images/keyword-icons/inline/battle_card_buff_049.png)

- 본문 표기: 두려움 고착 / 공포 고착
- 색상: `purpleword (#af6bb0)`
- 아이콘: `Battle_Card_Buff_049` · 설명 연결: 상태 81054 · 본문 관측: 4회

> 군집 침식 아래, 너의 공포는 숨을 곳이 없다. 스택당 이번 턴 능동 및 촉수 피해 3% 감소, 최대 15스택.

설명 근거: `State_81054_Desc`

본문 근거 예시: `Text_KR.Text_Skill:Skill_78785_Desc_3`, `Text_KR.Text_Skill:Skill_78785_BattleDesc_3`, `Text_KR.Text_Skill:Skill_78785_OverLimitUtlSkillDesc_0`

<a id="kw-slowiconkeywords"></a>

### 둔화 · `SlowIconKeywords`

![둔화](../images/keyword-icons/inline/battle_card_buff_024.png)

- 본문 표기: 둔화 / 지연
- 색상: `purpleword (#af6bb0)`
- 아이콘: `Battle_Card_Buff_024` · 설명 연결: 상태 3178 · 본문 관측: 86회

> 카드의 행동력 소모를 증가시킨다.

설명 근거: `State_3178_Desc`

본문 근거 예시: `Text_KR.Text_RelicConfig:RelicConfig_149665_Desc`, `Text_KR.Text_RelicConfig:RelicConfig_149665_BattleDesc`, `Text_KR.Text_Skill:Skill_127252_Desc`

<a id="kw-disarmkeywords"></a>

### 마비 · `DisarmKeywords`

![마비](../images/keyword-icons/inline/battle_card_buff_054.png)

- 본문 표기: 마비
- 색상: `purpleword (#af6bb0)`
- 아이콘: `Battle_Card_Buff_054` · 설명 연결: 상태 47826 · 본문 관측: 17회

> ·대상이 「마비」 상태일 때 피해가 2배가 되며, 그렇지 않으면 이번 턴 해당 대상의 「공격」을 사용할 수 없음.
> ·연속 2턴 「마비」 상태일 경우, 해당 대상의 모든 「공격」이 「환상」으로 변함.

설명 근거: `State_47826_Desc`

본문 근거 예시: `Text_KR.Text_Skill:Skill_99038_Desc_1`, `Text_KR.Text_Skill:Skill_45646_Desc_1`, `Text_KR.Text_Skill:Skill_45467_Desc_1`

<a id="kw-monster_newunit6_endboss_debuff"></a>

### 만물 질식 · `Monster_NewUnit6_EndBoss_Debuff`

![만물 질식](../images/keyword-icons/inline/battle_card_buff_016.png)

- 본문 표기: 만물 질식
- 색상: `별도 색상 지정 없음`
- 아이콘: `Battle_Card_Buff_016` · 설명 연결: 상태 150543 · 본문 관측: 1회

> 행동 불가, 턴 종료 시 1층 제거.

설명 근거: `State_150543_Desc`

본문 근거 예시: `Text_KR.Text_Skill:Skill_149846_Desc`

<a id="kw-mingqikeywords"></a>

### 명계 · `MingqiKeywords`

![명계](../images/keyword-icons/inline/battle_card_buff_016.png)

- 본문 표기: 명계
- 색상: `orangeword (#c48662)`
- 아이콘: `Battle_Card_Buff_016` · 설명 연결: 상태 121231 · 본문 관측: 5회

> 스택당 다음 「망상의 왕녀」가 부여하는 「강생 의식」이 20% 증가하며, 최대 5스택까지 중첩된다. 5스택 달성 후 다음 「망상의 왕녀」의 피해 횟수가 2배로 증가한다.

설명 근거: `State_121231_Desc`

본문 근거 예시: `Text_KR.Text_Skill:Skill_119766_Desc_0`, `Text_KR.Text_Skill:Skill_119766_Desc_15`, `Text_KR.Text_State:State_121231_Name`

<a id="kw-dreamguide"></a>

### 몽인 · `DreamGuide`

![몽인](../images/keyword-icons/inline/battle_card_buff_043.png)

- 본문 표기: 몽인 / 꿈의 유혹 / 꿈의 인도
- 색상: `purpleword (#af6bb0)`
- 아이콘: `Battle_Card_Buff_043` · 설명 연결: 상태 40484 · 본문 관측: 32회

> 완다의 스킬이 도약 효과를 발동할 때, 꿈의 인도가 5스택 존재하면 5스택을 소모하고 추가 효과를 획득한다. 꿈의 인도 상한은 10스택이며, 다음 전투로 이월된다.

설명 근거: `State_40484_Desc`

본문 근거 예시: `Text_KR.Text_AwakerPotency:AwakerPotency_13679_PotencyDesc`, `Text_KR.Text_AwakerPotency:AwakerPotency_13686_PotencyDesc`, `Text_KR.Text_Skill:Skill_4769_tempBattleDesc_1`

<a id="kw-unlimiteddevourediconkeywords"></a>

### 무한 포식 · `UnlimitedDevouredIconKeywords`

![무한 포식](../images/keyword-icons/inline/battle_card_buff_016.png)

- 본문 표기: 무한 포식
- 색상: `orangeword (#c48662)`
- 아이콘: `Battle_Card_Buff_016` · 설명 연결: 상태 2603 · 본문 관측: 5회

> 손에 「배아」가 있을 경우, 모든 「배아」를 소모하며, 배아 1장당 후속 효과를 1회 발동한다.

설명 근거: `State_2603_Desc`

본문 근거 예시: `Text_KR.Text_RelicConfig:RelicConfig_13769_Desc`, `Text_KR.Text_RelicConfig:RelicConfig_13769_BattleDesc`, `Text_KR.Text_Skill:Skill_4770_OverLimitUtlSkillDesc_0`

<a id="kw-pvpretaliateiconkeywords"></a>

### 반격 · `PVPRetaliateIconKeywords`

![반격](../images/keyword-icons/inline/battle_card_buff_019.png)

- 본문 표기: 반격
- 색상: `blueword (#76aac8)`
- 아이콘: `Battle_Card_Buff_019` · 설명 연결: 상태 19998 · 본문 관측: 8회

> 다음 턴 시작 전, 공격을 받을 때마다 공격자에게 동일한 스택 수만큼의 순수 피해를 입힌다.

설명 근거: `State_19998_Desc`

본문 근거 예시: `Text_KR.Text_Skill:Skill_19438_Desc_1`, `Text_KR.Text_Skill:Skill_45468_Desc_1`, `Text_KR.Text_Skill:Skill_45596_Desc_1`

<a id="kw-retaliateiconkeywords"></a>

### 반격 · `RetaliateIconKeywords`

![반격](../images/keyword-icons/inline/battle_card_buff_019.png)

- 본문 표기: 반격 / 임시 반격
- 색상: `blueword (#76aac8)`
- 아이콘: `Battle_Card_Buff_019` · 설명 연결: 상태 3825 · 본문 관측: 255회

> 능동 피해를 받을 때, 피해 원천에게 동일한 스택 수만큼의 순수 피해를 입힌다.

설명 근거: `State_3825_Desc`

본문 근거 예시: `Text_KR.Text_AwakerConfig:AwakerConfig_15560_AwakerIntroduction`, `Text_KR.Text_AwakerConfig:AwakerConfig_15565_AwakerIntroduction`, `Text_KR.Text_AwakerConfig:AwakerConfig_15594_AwakerIntroduction`

<a id="kw-faxiankeywords"></a>

### 발견 · `FaxianKeywords`

![발견](../images/keyword-icons/inline/battle_card_buff_016.png)

- 본문 표기: 발견
- 색상: `orangeword (#c48662)`
- 아이콘: `Battle_Card_Buff_016` · 설명 연결: 상태 66359 · 본문 관측: 47회

> 무작위로 여러 개의 선택지를 생성하여 선택하게 한다.

설명 근거: `State_66359_Desc`

본문 근거 예시: `Text_KR.Text_RelicConfig:RelicConfig_84113_Desc`, `Text_KR.Text_RelicConfig:RelicConfig_147665_Desc`, `Text_KR.Text_RelicConfig:RelicConfig_84113_BattleDesc`

<a id="kw-embryofusioniconkeywords"></a>

### 배아 융합 · `EmbryoFusionIconKeywords`

![배아 융합](../images/keyword-icons/inline/battle_card_buff_016.png)

- 본문 표기: 배아 융합 / 배아융합
- 색상: `orangeword (#c48662)`
- 아이콘: `Battle_Card_Buff_016` · 설명 연결: 상태 3665 · 본문 관측: 94회

> 배아 융합이 상한에 도달하면, 「배아」 1장을 손패에 추가합니다.

설명 근거: `State_3665_Desc`

본문 근거 예시: `Text_KR.Text_AwakerConfig:AwakerConfig_15577_AwakerIntroduction`, `Text_KR.Text_AwakerConfig:AwakerConfig_15600_AwakerIntroduction`, `Text_KR.Text_AwakerConfig:AwakerConfig_15598_AwakerIntroduction`

<a id="kw-breedingkeywords1"></a>

### 번식 축전繁育庆典 · `BreedingKeywords1`

![번식 축전繁育庆典](../images/keyword-icons/inline/battle_card_buff_088.png)

- 본문 표기: 번식 축전 / 繁育庆典
- 색상: `redword (#bb646d)`
- 아이콘: `Battle_Card_Buff_088` · 설명 연결: 상태 140135 · 본문 관측: 3회

> 1스택 보유 시마다, 해당 각성체의 이번 턴 다음 광기 폭발로 인한 데미지, 잠금 방어막, 잠금 HP 회복, 잠금 힘, 힘 감소, 터치손상 증가, 잠금 중독, 잠금 반격의 최종 효과가 1% 증가합니다.

설명 근거: `State_140135_Desc`

본문 근거 예시: `Text_KR.Text_Skill:Skill_4052_tempBattleDesc_2`, `Text_KR.Text_Skill:Skill_48812_tempBattleDesc_2`, `Text_KR.Text_State:State_140135_Name`

<a id="kw-reinforcepvekeywords"></a>

### 보강 · `ReinforcePVEKeywords`

![보강](../images/keyword-icons/inline/battle_card_buff_046.png)

- 본문 표기: 견고 / 보강
- 색상: `blueword (#76aac8)`
- 아이콘: `Battle_Card_Buff_046` · 설명 연결: 상태 60088 · 본문 관측: 31회

> 스택당 받는 모든 피해 1% 감소.

설명 근거: `State_60088_Desc`

본문 근거 예시: `Text_KR.Text_Skill:Skill_130940_Desc`, `Text_KR.Text_Skill:Skill_130943_Desc`, `Text_KR.Text_Skill:Skill_62217_Desc`

<a id="kw-seal"></a>

### 봉인 · `Seal`

![봉인](../images/keyword-icons/inline/battle_card_buff_073.png)

- 본문 표기: 봉인
- 색상: `purpleword (#af6bb0)`
- 아이콘: `Battle_Card_Buff_073` · 설명 연결: 상태 122596 · 본문 관측: 3회

> 카드를 사용할 수 없으며, 광기 폭발을 발동할 수 없다.

설명 근거: `State_122596_Desc`

본문 근거 예시: `Text_KR.Text_RelicConfig:RelicConfig_121694_BattleDesc`, `Text_KR.Text_RelicConfig:RelicConfig_121694_Desc`, `Text_KR.Text_Skill:Skill_125907_Desc`

<a id="kw-sacrificialmark1"></a>

### 봉헌 · `SacrificialMark1`

![봉헌](../images/keyword-icons/inline/battle_card_buff_092.png)

- 본문 표기: 봉헌
- 색상: `whiteword (#ffffff)`
- 아이콘: `Battle_Card_Buff_092` · 설명 연결: 상태 145710 · 본문 관측: 93회

> 당신도 축복의 일부랍니다~. 카라부의 광기 폭발로 소모되어 버프를 획득할 수 있으며, 이 상태는 최대 5층까지 쌓이고 전투 종료 후 제거되지 않습니다.

설명 근거: `State_145710_Desc`

본문 근거 예시: `Text_KR.Text_Skill:Skill_149969_Desc_0`, `Text_KR.Text_Skill:Skill_149968_BattleDesc`, `Text_KR.Text_Skill:Skill_149960_Desc_0`

<a id="kw-decay"></a>

### 부패 · `Decay`

![부패](../images/keyword-icons/inline/battle_card_buff_014.png)

- 본문 표기: 부패
- 색상: `purpleword (#af6bb0)`
- 아이콘: `Battle_Card_Buff_014` · 설명 연결: 상태 119960 · 본문 관측: 9회

> 가하는 주동 및 촉수 피해가 35% 감소하며, 플레이어의 현재 HP가 50% 초과 시 제거됩니다.

설명 근거: `State_119960_Desc`

본문 근거 예시: `Text_KR.Text_Skill:Skill_118083_Desc`, `Text_KR.Text_Skill:Skill_118086_Desc`, `Text_KR.Text_Skill:Skill_118100_Desc`

<a id="kw-pvpresurrectionkeywords"></a>

### 부활 · `PVPResurrectionKeywords`

![부활](../images/keyword-icons/inline/battle_card_buff_026.png)

- 본문 표기: 부활 / 소생
- 색상: `greenword (#71aa86)`
- 아이콘: `Battle_Card_Buff_026` · 설명 연결: 상태 47843 · 본문 관측: 8회

> 각성체를 사망 상태에서 벗어나게 하여 해당 각성체의 전체 카드를 덱에 넣는다.

설명 근거: `State_47843_Desc`

본문 근거 예시: `Text_KR.Text_Skill:Skill_21362_Desc_1`, `Text_KR.Text_Skill:Skill_19321_Desc_1`, `Text_KR.Text_Skill:Skill_45679_Desc_1`

<a id="kw-fennu"></a>

### 분노 · `Fennu`

![분노](../images/keyword-icons/inline/battle_card_buff_016.png)

- 본문 표기: 분노
- 색상: `orangeword (#c48662)`
- 아이콘: `Battle_Card_Buff_016` · 설명 연결: 상태 96357 · 본문 관측: 2회

> 턴 종료 후, 스택 수만큼의 힘을 획득한다.

설명 근거: `State_96357_Desc`

본문 근거 예시: `Text_KR.Text_Skill:Skill_96345_Desc`, `Text_KR.Text_State:State_96357_Name`

<a id="kw-bonehitkeywords"></a>

### 뼈를 에는 일격 · `BoneHitKeywords`

![뼈를 에는 일격](../images/keyword-icons/inline/battle_card_buff_016.png)

- 본문 표기: 뼈를 에는 일격 / 작열
- 색상: `blueword (#76aac8)`
- 아이콘: `Battle_Card_Buff_016` · 설명 연결: 상태 149163 · 본문 관측: 15회

> 최대 HP가 동일한 스택 수만큼 감소하며, 전투 종료 후 절반으로 줄어듭니다.

설명 근거: `State_149163_Desc`

본문 근거 예시: `Text_KR.Text_Skill:Skill_149282_Desc`, `Text_KR.Text_Skill:Skill_149842_Desc`, `Text_KR.Text_Skill:Skill_149845_Desc`

<a id="kw-battuekeywords"></a>

### 사냥 · `BattueKeywords`

![사냥](../images/keyword-icons/inline/battle_card_buff_090.png)

- 본문 표기: 집단 사냥 / 사냥
- 색상: `blueword (#76aac8)`
- 아이콘: `Battle_Card_Buff_090` · 설명 연결: 상태 143336 · 본문 관측: 9회

> 「건트」에 1번 추가로 발동을 부여한다. 「건트」 사용 시 1층을 소모하며, 상한은 9층이고 전투 종료 시 제거되지 않는다.

설명 근거: `State_143336_Desc`

본문 근거 예시: `Text_KR.Text_Skill:Skill_142695_tempBattleDesc_2`, `Text_KR.Text_Skill:Skill_142700_BattleDesc_15`, `Text_KR.Text_Skill:Skill_142700_Desc_15`

<a id="kw-pvpfiercefightingkeywords"></a>

### 사투 · `PVPFierceFightingKeywords`

![사투](../images/keyword-icons/inline/battle_card_buff_039.png)

- 본문 표기: 본문 사용 미관측
- 색상: `whiteword (#ffffff)`
- 아이콘: `Battle_Card_Buff_039` · 설명 연결: 상태 19538 · 본문 관측: 미관측

> · 8번째 및 9번째 턴 시작 시 각각 1스택을 획득한다.
>
> · 스택당 받는 실드와 HP 회복량이 50% 감소하며, 장벽의 중첩 가능 횟수가 1 감소한다.
>
> · 사투는 해제할 수 없으며, 사망한 각성체에도 적용된다.

설명 근거: `State_19538_Desc`

<a id="kw-witherkeywords1"></a>

### 상약 · `WitherKeywords1`

![상약](../images/keyword-icons/inline/battle_card_buff_080.png)

- 본문 표기: 약속 / 상약
- 색상: `redword (#bb646d)`
- 아이콘: `Battle_Card_Buff_080` · 설명 연결: 상태 126789 · 본문 관측: 3회

> 전체 적에게 도취 2스택을 부여한다.

설명 근거: `State_126789_Desc`

본문 근거 예시: `Text_KR.Text_Skill:Skill_125376_Desc_0`, `Text_KR.Text_Skill:Skill_125376_Desc_3`, `Text_KR.Text_State:State_126789_Name`

<a id="kw-witherkeywords3"></a>

### 상약 · `WitherKeywords3`

![상약](../images/keyword-icons/inline/battle_card_buff_080.png)

- 본문 표기: 상허 / 상약
- 색상: `redword (#bb646d)`
- 아이콘: `Battle_Card_Buff_080` · 설명 연결: 상태 127108 · 본문 관측: 3회

> 전체 적에게 도취 5스택을 부여한다.

설명 근거: `State_127108_Desc`

본문 근거 예시: `Text_KR.Text_Skill:Skill_125376_OverLimitUtlSkillDesc_0`, `Text_KR.Text_Skill:Skill_125376_OverLimitUtlSkillDesc_3`, `Text_KR.Text_State:State_127108_Name`

<a id="kw-petrifactioniconkeywords"></a>

### 석화 · `PetrifactionIconKeywords`

![석화](../images/keyword-icons/inline/battle_card_buff_023.png)

- 본문 표기: 석화
- 색상: `orangeword (#c48662)`
- 아이콘: `Battle_Card_Buff_023` · 설명 연결: 상태 2410 · 본문 관측: 7회

> 1턴 동안 행동할 수 없다. 석화된 적은 다시 석화 효과를 받을 수 없다.

설명 근거: `State_2410_Desc`

본문 근거 예시: `Text_KR.Text_Skill:Skill_3967_tempOverLimitUtlSkillDesc_1`, `Text_KR.Text_Skill:Skill_3967_tempOverLimitUtlSkillDesc_2`, `Text_KR.Text_Skill:Skill_3967_tempBattleDesc_2`

<a id="kw-pvppetrifactionkeywords"></a>

### 석화 · `PVPPetrifactionKeywords`

![석화](../images/keyword-icons/inline/battle_card_buff_023.png)

- 본문 표기: 본문 사용 미관측
- 색상: `orangeword (#c48662)`
- 아이콘: `Battle_Card_Buff_023` · 설명 연결: 상태 47831 · 본문 관측: 미관측

> 턴 종료 전까지 아무런 행동도 할 수 없다. 실신 피해를 받으면 대상이 내성을 획득하며, 내성 보유 시 다시 실신 피해를 받으면 실신 효과를 상쇄하고 피해가 2배가 된다.

설명 근거: `State_47831_Desc`

<a id="kw-blessing"></a>

### 선물 · `Blessing`

![선물](../images/keyword-icons/inline/battle_card_buff_016.png)

- 본문 표기: 선물 / 축복 / 은총
- 색상: `orangeword (#c48662)`
- 아이콘: `Battle_Card_Buff_016` · 설명 연결: 상태 144494 · 본문 관측: 51회

> 총 7가지 효과로 구성되어 있다: 카드 8장 드로우, 행동력 6pt 획득, 은열쇠 에너지 획득, 모든 각성체 고정 광기 획득, 힘 획득, 전체 적의 임시 힘 감소, 임시 피해 증폭 효과 증가.

설명 근거: `State_144494_Desc`

본문 근거 예시: `Text_KR.Text_Skill:Skill_149969_Desc_0`, `Text_KR.Text_Skill:Skill_149960_Desc_0`, `Text_KR.Text_Skill:Skill_144486_OverLimitUtlSkillDesc`

<a id="kw-monsterbless"></a>

### 선물 · `MonsterBless`

![선물](../images/keyword-icons/inline/battle_card_buff_016.png)

- 본문 표기: 선물
- 색상: `별도 색상 지정 없음`
- 아이콘: `Battle_Card_Buff_016` · 설명 연결: 상태 149931 · 본문 관측: 1회

> 총 7가지 효과가 있으며, 다음을 포함합니다: 힘 획득, 드로우, 행동력 획득, 은열쇠 에너지 획득, 임시 피해 증폭 증가, 모든 각성체 광기 획득, 모든 적의 힘 임시 감소.

설명 근거: `State_149931_Desc`

본문 근거 예시: `Text_KR.Text_Skill:Skill_149362_Desc`

<a id="kw-derivativecardkeywords_10"></a>

### 성결의 자식 · `DerivativeCardKeywords_10`

![성결의 자식](../images/keyword-icons/inline/battle_card_buff_016.png)

- 본문 표기: 성결의 자식
- 색상: `orangeword (#c48662)`
- 아이콘: `Battle_Card_Buff_016` · 설명 연결: 스킬 48812 · 본문 관측: 6회

> 「배아」가 없을 때, 흡수되어 효과를 2회 발동한다. 직접 사용하거나 자동 변환할 경우 「태아」의 1.5배 효과로 간주된다.

설명 근거: `Skill_48812_Desc`

본문 근거 예시: `Text_KR.Text_AwakerConfig:AwakerConfig_15596_AwakerIntroduction`, `Text_KR.Text_Skill:Skill_4750_Desc_0`, `Text_KR.Text_Skill:Skill_4750_Desc_15`

<a id="kw-depleteiconkeywords"></a>

### 소모 · `DepleteIconKeywords`

![소모](../images/keyword-icons/inline/battle_card_buff_016.png)

- 본문 표기: 소모 / 소비
- 색상: `orangeword (#c48662)`
- 아이콘: `Battle_Card_Buff_016` · 설명 연결: 상태 3003 · 본문 관측: 142회

> 사용 후 버린 카드 더미로 들어가지 않고, 덱에서 제거된다.

설명 근거: `State_3003_Desc`

본문 근거 예시: `Text_KR.Text_AwakerPotency:AwakerPotency_13694_PotencyDesc`, `Text_KR.Text_EnchantConfig:EnchantConfig_18189_Desc`, `Text_KR.Text_EnchantConfig:EnchantConfig_119927_Desc`

<a id="kw-whirlpoolkeywords"></a>

### 소용돌이 장전 · `WhirlpoolKeywords`

![소용돌이 장전](../images/keyword-icons/inline/battle_card_buff_081.png)

- 본문 표기: 소용돌이 장전
- 색상: `blueword (#76aac8)`
- 아이콘: `Battle_Card_Buff_081` · 설명 연결: 상태 131657 · 본문 관측: 3회

> 다른 각성체가 광기 폭발을 발동한 후 1스택을 소모하고, 모스가 「소용돌이! 흐름! 탄!」을 발사하여 추격한다.

설명 근거: `State_131657_Desc`

본문 근거 예시: `Text_KR.Text_Skill:Skill_130932_Desc`, `Text_KR.Text_Skill:Skill_130932_BattleDesc`, `Text_KR.Text_State:State_131657_Name`

<a id="kw-fragileiconkeywords"></a>

### 손상 · `FragileIconKeywords`

![손상](../images/keyword-icons/inline/battle_card_buff_015.png)

- 본문 표기: 손상 / 취약
- 색상: `purpleword (#af6bb0)`
- 아이콘: `Battle_Card_Buff_015` · 설명 연결: 상태 2586 · 본문 관측: 154회

> 획득하는 모든 실드가 25% 감소하며, 턴 종료 시 1스택이 제거된다.

설명 근거: `State_2586_Desc`

본문 근거 예시: `Text_KR.Text_RelicConfig:RelicConfig_13832_Desc`, `Text_KR.Text_RelicConfig:RelicConfig_13818_Desc`, `Text_KR.Text_RelicConfig:RelicConfig_13832_BattleDesc`

<a id="kw-d06cardkeeperskill"></a>

### 시편 · `D06CardKeeperSkill`

![시편](../images/keyword-icons/inline/battle_card_buff_016.png)

- 본문 표기: 시편
- 색상: `orangeword (#c48662)`
- 아이콘: `Battle_Card_Buff_016` · 설명 연결: 상태 56208 · 본문 관측: 1회

> 비의 노래: \[DescArg1\]의 HP를 회복한다.
>
> 바람의 노래: \[DescArg2\]의 힘을 획득한다.
>
> 꽃의 노래: 모든 각성체가 광기 10을 획득한다.
>
> 달의 노래: 임시 치명타율이 30% 증가한다.

설명 근거: `State_56208_Desc`

본문 근거 예시: `Text_KR.Text_Skill:Skill_56202_Desc`

<a id="kw-blindingkeywords"></a>

### 실명 · `BlindingKeywords`

![실명](../images/keyword-icons/inline/battle_card_buff_074.png)

- 본문 표기: 실명
- 색상: `purpleword (#af6bb0)`
- 아이콘: `Battle_Card_Buff_074` · 설명 연결: 상태 49954 · 본문 관측: 24회

> 모든 각성체의 치명타 피해 수치가 절반으로 감소한다.

설명 근거: `State_49954_Desc`

본문 근거 예시: `Text_KR.Text_Skill:Skill_54441_Desc`, `Text_KR.Text_Skill:Skill_127250_Desc`, `Text_KR.Text_Skill:Skill_149175_Desc`

<a id="kw-heat"></a>

### 심연의 불꽃 · `Heat`

![심연의 불꽃](../images/keyword-icons/inline/battle_card_buff_016.png)

- 본문 표기: 심연의 불꽃 / 열량
- 색상: `orangeword (#c48662)`
- 아이콘: `Battle_Card_Buff_016` · 설명 연결: 상태 96732 · 본문 관측: 13회

> 스택당 모든 각성체의 치명타율이 \[DescArg1\]% 증가한다.

설명 근거: `State_96732_Desc`

본문 근거 예시: `Text_KR.Text_RelicConfig:RelicConfig_96652_Desc`, `Text_KR.Text_RelicConfig:RelicConfig_96652_BattleDesc`, `Text_KR.Text_Skill:Skill_98508_Desc`

<a id="kw-kuangnu"></a>

### 암류 · `KuangNu`

![암류](../images/keyword-icons/inline/battle_card_buff_080.png)

- 본문 표기: 암류 / 암용
- 색상: `redword (#bb646d)`
- 아이콘: `Battle_Card_Buff_080` · 설명 연결: 상태 149789 · 본문 관측: 12회

> 1 중첩당 부서약·오지에의 명령 카드 최종 피해가 33% 증가하고, 턴 시작 시 드로우 수 -1, 상한 \[DescArg1\] 중첩, 전투 종료 시 제거되지 않는다.

설명 근거: `State_149789_Desc`

본문 근거 예시: `Text_KR.Text_Skill:Skill_145675_OverLimitUtlSkillDesc_0`, `Text_KR.Text_Skill:Skill_145675_BattleDesc_0`, `Text_KR.Text_Skill:Skill_145675_Desc_0`

<a id="kw-undercurrent"></a>

### 암류 · `Undercurrent`

![암류](../images/keyword-icons/inline/battle_card_buff_016.png)

- 본문 표기: 암류
- 색상: `별도 색상 지정 없음`
- 아이콘: `Battle_Card_Buff_016` · 설명 연결: 상태 120908 · 본문 관측: 3회

> 촉수가 공격할 때 방어될 경우, 스택 수만큼의 중독을 부여한다.

설명 근거: `State_120908_Desc`

본문 근거 예시: `Text_KR.Text_Skill:Skill_118074_Desc`, `Text_KR.Text_Skill:Skill_100598_Desc`, `Text_KR.Text_Skill:Skill_100604_Desc`

<a id="kw-kuangnu2"></a>

### 암류暗涌 · `KuangNu2`

![암류暗涌](../images/keyword-icons/inline/battle_card_buff_080.png)

- 본문 표기: 暗涌 / 암용 / 암류
- 색상: `redword (#bb646d)`
- 아이콘: `Battle_Card_Buff_080` · 설명 연결: 상태 149930 · 본문 관측: 6회

> 1 중첩당 부서약·오지에의 명령 카드 최종 피해가 50% 증가하고, 턴 시작 시 드로우 수 -1, 상한 \[DescArg1\] 중첩, 전투 종료 시 제거되지 않는다.

설명 근거: `State_149930_Desc`

본문 근거 예시: `Text_KR.Text_Skill:Skill_145675_BattleDesc_3`, `Text_KR.Text_Skill:Skill_145675_Desc_3`, `Text_KR.Text_Skill:Skill_145675_OverLimitUtlSkillDesc_3`

<a id="kw-brokencard"></a>

### 암중 파괴 · `BrokenCard`

![암중 파괴](../images/keyword-icons/inline/battle_card_buff_003.png)

- 본문 표기: 암중 파괴 / 암중파괴
- 색상: `orangeword (#c48662)`
- 아이콘: `Battle_Card_Buff_003` · 설명 연결: 상태 128028 · 본문 관측: 9회

> 카드가 조작되었습니다! 사용 후 순수 피해를 받으며, 암중 파괴 스택이 절반으로 줄어듭니다.

설명 근거: `State_128028_Desc`

본문 근거 예시: `Text_KR.Text_Skill:Skill_127698_Desc`, `Text_KR.Text_Skill:Skill_129828_Desc`, `Text_KR.Text_Skill:Skill_128229_Desc`

<a id="kw-flaw"></a>

### 약점 · `Flaw`

![약점](../images/keyword-icons/inline/battle_card_buff_056.png)

- 본문 표기: 허점
- 색상: `별도 색상 지정 없음`
- 아이콘: `Battle_Card_Buff_056` · 설명 연결: 상태 3768 · 본문 관측: 3회

> 받은 능동 피해가 반드시 치명타로 적용되며, 턴 종료 후 제거된다.

설명 근거: `State_3768_Desc`

본문 근거 예시: `Text_KR.Text_Skill:Skill_4539_Desc`, `Text_KR.Text_Skill:Skill_118058_Desc`, `Text_KR.Text_Skill:Skill_4819_Desc`

<a id="kw-pvpweaknesskeywords"></a>

### 약화 · `PVPWeaknessKeywords`

![약화](../images/keyword-icons/inline/battle_card_buff_005.png)

- 본문 표기: 허약 / 약화
- 색상: `purpleword (#af6bb0)`
- 아이콘: `Battle_Card_Buff_005` · 설명 연결: 상태 19533 · 본문 관측: 5회

> 이번 턴 종료 전까지 주는 피해가 50% 감소하며, 적용 시 강화와 상쇄된다.

설명 근거: `State_19533_Desc`

본문 근거 예시: `Text_KR.Text_Skill:Skill_45477_Desc_1`, `Text_KR.Text_Skill:Skill_45487_Desc_1`, `Text_KR.Text_Skill:Skill_45621_Desc_1`

<a id="kw-pvpentanglementkeywords"></a>

### 얽힘 · `PVPEntanglementKeywords`

![얽힘](../images/keyword-icons/inline/battle_card_buff_055.png)

- 본문 표기: 엉킴
- 색상: `purpleword (#af6bb0)`
- 아이콘: `Battle_Card_Buff_055` · 설명 연결: 상태 47828 · 본문 관측: 11회

> · 적용 시 스택 수만큼 피해를 준다. 대상이 「엉킴」 상태일 경우 피해가 2배가 되며, 그렇지 않을 경우 대상이 턴 종료 전까지 장착한 명륜이 무효화된다.

설명 근거: `State_47828_Desc`

본문 근거 예시: `Text_KR.Text_Skill:Skill_19430_Desc_1`, `Text_KR.Text_Skill:Skill_45614_Desc_1`, `Text_KR.Text_Skill:Skill_45615_Desc_1`

<a id="kw-ripplekeywords"></a>

### 여파 · `RippleKeywords`

![여파](../images/keyword-icons/inline/battle_card_buff_016.png)

- 본문 표기: 여파
- 색상: `orangeword (#c48662)`
- 아이콘: `Battle_Card_Buff_016` · 설명 연결: 상태 83808 · 본문 관측: 61회

> 이 카드는 버려질 때 「여파」 효과가 발동된다.

설명 근거: `State_83808_Desc`

본문 근거 예시: `Text_KR.Text_EnchantConfig:EnchantConfig_119927_Desc`, `Text_KR.Text_RelicConfig:RelicConfig_121690_Desc`, `Text_KR.Text_RelicConfig:RelicConfig_121690_BattleDesc`

<a id="kw-burningkeywords"></a>

### 연소 · `BurningKeywords`

![연소](../images/keyword-icons/inline/battle_card_buff_057.png)

- 본문 표기: 연소 / 번영
- 색상: `redword (#bb646d)`
- 아이콘: `Battle_Card_Buff_057` · 설명 연결: 상태 81356 · 본문 관측: 37회

> 카드를 연소시켜 사용하며, 사용 후 \[DescArg1\]의 피해를 받고, 턴 종료 시까지 손에 있을 경우 소모된다.

설명 근거: `State_81356_Desc`

본문 근거 예시: `Text_KR.Text_RelicConfig:RelicConfig_96652_Desc`, `Text_KR.Text_RelicConfig:RelicConfig_96652_BattleDesc`, `Text_KR.Text_Skill:Skill_130931_tempOverLimitUtlSkillDesc_2`

<a id="kw-burningkeywords2"></a>

### 연소 · `BurningKeywords2`

![연소](../images/keyword-icons/inline/battle_card_buff_057.png)

- 본문 표기: 연소 / 번영
- 색상: `redword (#bb646d)`
- 아이콘: `Battle_Card_Buff_057` · 설명 연결: 상태 98752 · 본문 관측: 9회

> 카드를 연소시켜 사용하며, 사용 후 최대 HP의 5% 피해를 받고, 턴 종료 시까지 손에 있을 경우 소모된다.

설명 근거: `State_98752_Desc`

본문 근거 예시: `Text_KR.Text_Skill:Skill_144486_OverLimitUtlSkillDesc`, `Text_KR.Text_Skill:Skill_144486_Desc_0`, `Text_KR.Text_Skill:Skill_144486_Desc_3`

<a id="kw-chapter5_monster_agitation"></a>

### 연옥의 문 · `Chapter5_Monster_Agitation`

![연옥의 문](../images/keyword-icons/inline/battle_card_buff_016.png)

- 본문 표기: 심연옥의 문
- 색상: `별도 색상 지정 없음`
- 아이콘: `Battle_Card_Buff_016` · 설명 연결: 상태 131134 · 본문 관측: 1회

> 사망 후, 네프레아가 \[DescArg1\] 층의 임시 광열을 획득하지만, 최대 생명력의 3%를 잃는다.

설명 근거: `State_131134_Desc`

본문 근거 예시: `Text_KR.Text_Skill:Skill_130473_Desc`

<a id="kw-kuangre"></a>

### 열광 · `Kuangre`

![열광](../images/keyword-icons/inline/battle_card_buff_016.png)

- 본문 표기: 광열 / 광란 / 열광
- 색상: `orangeword (#c48662)`
- 아이콘: `Battle_Card_Buff_016` · 설명 연결: 상태 94623 · 본문 관측: 6회

> 광란 1스택당 주는 능동 피해와 촉수 피해에 피해량의 10%만큼 출혈이 추가로 부여된다.

설명 근거: `State_94623_Desc`

본문 근거 예시: `Text_KR.Text_RelicConfig:RelicConfig_91096_Desc`, `Text_KR.Text_RelicConfig:RelicConfig_91096_BattleDesc`, `Text_KR.Text_Skill:Skill_91159_BattleDesc`

<a id="kw-touqukeywords2"></a>

### 영구 탈취 · `TouquKeywords2`

![영구 탈취](../images/keyword-icons/inline/battle_card_buff_014.png)

- 본문 표기: 본문 사용 미관측
- 색상: `purpleword (#af6bb0)`
- 아이콘: `Battle_Card_Buff_014` · 설명 연결: 상태 100644 · 본문 관측: 미관측

> 대상의 힘을 영구적으로 감소시키고, 감소한 만큼의 힘을 획득한다.

설명 근거: `State_100644_Desc`

<a id="kw-exalticonkeywords"></a>

### 영지 각성 · `ExaltIconKeywords`

![영지 각성](../images/keyword-icons/inline/battle_card_buff_016.png)

- 본문 표기: 영지 각성 / 영지각성
- 색상: `orangeword (#c48662)`
- 아이콘: `Battle_Card_Buff_016` · 설명 연결: 상태 3607 · 본문 관측: 163회

> 사용 후 이번 전투에서 해당 각성체가 특수한 능력 향상을 획득한다. 영지 각성을 반복해서 사용해도 중첩되지 않는다.

설명 근거: `State_3607_Desc`

본문 근거 예시: `Text_KR.Text_RelicConfig:RelicConfig_13897_BattleDesc`, `Text_KR.Text_RelicConfig:RelicConfig_13873_Desc`, `Text_KR.Text_RelicConfig:RelicConfig_13898_BattleDesc`

<a id="kw-preparekeypvewords1"></a>

### 예비1 · `PrepareKeypvewords1`

![예비1](../images/keyword-icons/inline/battle_card_buff_016.png)

- 본문 표기: 준비1 / 예비1
- 색상: `orangeword (#c48662)`
- 아이콘: `Battle_Card_Buff_016` · 설명 연결: 상태 66884 · 본문 관측: 5회

> 턴 종료 시 행동력 소모가 감소하며, 버려질 때에도 해당 효과가 발동된다.

설명 근거: `State_66884_Desc`

본문 근거 예시: `Text_KR.Text_Skill:Skill_119764_OverLimitUtlSkillDesc`, `Text_KR.Text_Skill:Skill_66356_tempOverLimitUtlSkillDesc_3`, `Text_KR.Text_Skill:Skill_66356_tempBattleDesc_1`

<a id="kw-ashespastkeyword"></a>

### 옛날 잔재 · `AshesPastKeyWord`

![옛날 잔재](../images/keyword-icons/inline/battle_card_buff_025.png)

- 본문 표기: 옛날 잔재
- 색상: `purpleword (#af6bb0)`
- 아이콘: `Battle_Card_Buff_025` · 설명 연결: 상태 128692 · 본문 관측: 2회

> 능동 피해 또는 촉수 피해를 받은 후, 받은 피해량만큼 「옛날 잔재」를 제거하고 제거량의 300%만큼 HP를 잃는다. 기타 피해를 받을 때는 절반을 제거한다. 「옛날 잔재」 스택은 매 턴 초기화된다.

설명 근거: `State_128692_Desc`

본문 근거 예시: `Text_KR.Text_Skill:Skill_128689_Desc`, `Text_KR.Text_State:State_128692_Name`

<a id="kw-pvpwaterpowerkeywords"></a>

### 와류 · `PVPWaterPowerKeyWords`

![와류](../images/keyword-icons/inline/battle_card_buff_081.png)

- 본문 표기: 와류
- 색상: `blueword (#76aac8)`
- 아이콘: `Battle_Card_Buff_081` · 설명 연결: 상태 123246 · 본문 관측: 9회

> 적 처치 시 모든 층수를 제거하고 동일한 양의 광기를 획득합니다.

설명 근거: `State_123246_Desc`

본문 근거 예시: `Text_KR.Text_Skill:Skill_130948_Desc_1`, `Text_KR.Text_Skill:Skill_130946_Desc_1`, `Text_KR.Text_Skill:Skill_130928_Desc_1`

<a id="kw-kaihuajishu"></a>

### 우종 · `KaiHuajishu`

![우종](../images/keyword-icons/inline/battle_card_buff_087.png)

- 본문 표기: 우종
- 색상: `whiteword (#ffffff)`
- 아이콘: `Battle_Card_Buff_087` · 설명 연결: 상태 139687 · 본문 관측: 9회

> 빛나는 생명이 자유를 찬미하며 개선가를 울리고 있으며, 사야의 광기 폭발로 소모하여 그 효과를 강화할 수 있습니다. 이 상태는 최대 4층까지 쌓이며, 전투 종료 후에도 보존됩니다.

설명 근거: `State_139687_Desc`

본문 근거 예시: `Text_KR.Text_Skill:Skill_141058_Desc`, `Text_KR.Text_Skill:Skill_131856_Desc_15`, `Text_KR.Text_Skill:Skill_131858_BattleDesc`

<a id="kw-cutkeywords"></a>

### 운명 재단 · `CutKeywords`

![운명 재단](../images/keyword-icons/inline/battle_card_buff_055.png)

- 본문 표기: 운명 재단 / 운명 심판
- 색상: `purpleword (#af6bb0)`
- 아이콘: `Battle_Card_Buff_055` · 설명 연결: 상태 133391 · 본문 관측: 18회

> 해당 상태의 스택 수가 대상의 HP 이상일 경우, 모든 운명 재단을 제거하고 대상을 즉시 처치한다. 부여하는 잠금 운명 재단은 피해 강효의 영향을 받는다.

설명 근거: `State_133391_Desc`

본문 근거 예시: `Text_KR.Text_Skill:Skill_133366_tempBattleDesc_1`, `Text_KR.Text_Skill:Skill_132438_Desc`, `Text_KR.Text_Skill:Skill_132360_Desc`

<a id="kw-pvpeternaldimensionkeywords"></a>

### 운명, 이로써 고하노라 · `PVPEternalDimensionKeyWords`

![운명, 이로써 고하노라](../images/keyword-icons/inline/battle_card_buff_084.png)

- 본문 표기: 운명, 이로써 고하노라
- 색상: `purpleword (#af6bb0)`
- 아이콘: `Battle_Card_Buff_084` · 설명 연결: 상태 124997 · 본문 관측: 1회

> 가하거나 받는 치명적인 능동 피해를 동일한 양의 운명의 전조를 부여하는 것으로 대체함. 해제 불가.

설명 근거: `State_124997_Desc`

본문 근거 예시: `Text_KR.Text_State:State_124997_Name`

<a id="kw-resentchainskeywords"></a>

### 원한의 사슬 · `ResentChainsKeywords`

![원한의 사슬](../images/keyword-icons/inline/battle_card_buff_073.png)

- 본문 표기: 원한의 사슬 / 증오의 사슬 / 원망의 사슬
- 색상: `purpleword (#af6bb0)`
- 아이콘: `Battle_Card_Buff_073` · 설명 연결: 상태 49957 · 본문 관측: 19회

> 능동 피해를 받을 때 각성체를 공격하는 광기 폭발과 모든 카드를 1턴 봉인하고, 증오의 사슬 1스택 제거. 턴 종료 시 초기화.

설명 근거: `State_49957_Desc`

본문 근거 예시: `Text_KR.Text_Skill:Skill_142024_Desc`, `Text_KR.Text_Skill:Skill_48086_Desc`, `Text_KR.Text_Skill:Skill_142041_Desc`

<a id="kw-retainiconkeywords"></a>

### 유지 · `RetainIconKeywords`

![유지](../images/keyword-icons/inline/battle_card_buff_016.png)

- 본문 표기: 유지 / 보존 / 보류
- 색상: `orangeword (#c48662)`
- 아이콘: `Battle_Card_Buff_016` · 설명 연결: 상태 20026 · 본문 관측: 74회

> 카드는 버리기 단계에서 버린 카드 더미로 들어가지 않고, 손에 남아 있으며 후속 효과를 발동한다.

설명 근거: `State_20026_Desc`

본문 근거 예시: `Text_KR.Text_AwakerConfig:AwakerConfig_15571_AwakerIntroduction`, `Text_KR.Text_EnchantConfig:EnchantConfig_18189_Desc`, `Text_KR.Text_EnchantConfig:EnchantConfig_18178_Desc`

<a id="kw-invincibleuntilroused"></a>

### 은심 고정 · `InvincibleUntilRoused`

![은심 고정](../images/keyword-icons/inline/battle_card_buff_058.png)

- 본문 표기: 은심 고정
- 색상: `별도 색상 지정 없음`
- 아이콘: `Battle_Card_Buff_058` · 설명 연결: 상태 148020 · 본문 관측: 7회

> 모든 피해에 면역되며 HP를 잃을 수 없음. 각성 발동 후, 턴 종료 시 제거.

설명 근거: `State_148020_Desc`

본문 근거 예시: `Text_KR.Text_Skill:Skill_147937_Desc`, `Text_KR.Text_State:State_147971_Desc`, `Text_KR.Text_State:State_149391_Desc`

<a id="kw-d06cardkeyword1"></a>

### 은유 · `D06CardKeyWord1`

![은유](../images/keyword-icons/inline/battle_card_buff_016.png)

- 본문 표기: 은유
- 색상: `orangeword (#c48662)`
- 아이콘: `Battle_Card_Buff_016` · 설명 연결: 상태 56034 · 본문 관측: 8회

> 각 「은유」는 최대 3스택까지 중첩된다. 다른 「은유」는 시편의 다른 효과를 증폭시킨다:
>
> &lt;망상 시편&gt;: 모든 은유 「노」를 소모하며, 스택당 추가로 2회 피해를 준다.
>
> &lt;애통 시편&gt;: 모든 은유 「애」를 소모하며, 스택당 추가로 HP를 회복한다.
>
> &lt;환몽 시편&gt;: 모든 은유 「희」를 소모하며, 스택당 추가로 광기 10을 획득한다.
>
> &lt;기묘 시편&gt;: 모든 은유 「공포」를 소모하며, 스택당 추가로 힘을 획득한다.

설명 근거: `State_56034_Desc`

본문 근거 예시: `Text_KR.Text_Skill:Skill_4669_Desc_15`, `Text_KR.Text_Skill:Skill_4669_Desc_0`

<a id="kw-concealmentkeywords"></a>

### 은폐 · `ConcealmentKeywords`

![은폐](../images/keyword-icons/inline/battle_card_buff_043.png)

- 본문 표기: 은폐
- 색상: `orangeword (#c48662)`
- 아이콘: `Battle_Card_Buff_043` · 설명 연결: 상태 50358 · 본문 관측: 3회

> 받는 피해가 감소하며, 스택당 1%씩 감소한다. 다른 아군이 사망하면 이 상태가 제거된다.

설명 근거: `State_50358_Desc`

본문 근거 예시: `Text_KR.Text_Skill:Skill_49454_Desc`, `Text_KR.Text_Skill:Skill_49436_Desc`, `Text_KR.Text_State:State_50358_Name`

<a id="kw-yinnikeywords"></a>

### 은폐 · `YinniKeywords`

![은폐](../images/keyword-icons/inline/battle_card_buff_038.png)

- 본문 표기: 본문 사용 미관측
- 색상: `whiteword (#ffffff)`
- 아이콘: `Battle_Card_Buff_038` · 설명 연결: 상태 66456 · 본문 관측: 미관측

> 스킬 카드의 행동력 소모가 「은폐」 스택 수만큼 감소하며 최대 5스택까지 중첩할 수 있고, 피해를 받거나 스킬 카드를 사용하면 1스택이 제거된다.

설명 근거: `State_66456_Desc`

<a id="kw-bleesing_negative"></a>

### 은폐된 살의 · `Bleesing_Negative`

![은폐된 살의](../images/keyword-icons/inline/battle_card_buff_016.png)

- 본문 표기: 은폐된 살의
- 색상: `orangeword (#c48662)`
- 아이콘: `Battle_Card_Buff_016` · 설명 연결: 상태 145623 · 본문 관측: 100회

> 자신에게 랜덤 효과 1종을 부여한다: 2턴 허약, 2턴 손상, 2턴 중상, 최대 HP의 1%에 해당하는 중독, 공허 2스택, 손에 든 랜덤 카드 2장에 둔화 1스택 부여, 드로우 덱 상단에 임시 증상 카드 2장(전투 간 계승 불가) 생성 후 추가.

설명 근거: `State_145623_Desc`

본문 근거 예시: `Text_KR.Text_Skill:Skill_149968_BattleDesc`, `Text_KR.Text_Skill:Skill_149967_tempBattleDesc_3`, `Text_KR.Text_Skill:Skill_149365_Desc`

<a id="kw-timebeacon2"></a>

### 음엔트로피 · `TimeBeacon2`

![음엔트로피](../images/keyword-icons/inline/battle_card_buff_039.png)

- 본문 표기: 음엔트로피 / 네겐트로피
- 색상: `whiteword (#ffffff)`
- 아이콘: `Battle_Card_Buff_039` · 설명 연결: 상태 25166 · 본문 관측: 5회

> 음엔트로피 3스택을 보유할 때마다 순행·라모나의 명령 카드를 사용하면 모든 음엔트로피를 소모하고 회환 추가 효과가 발동된다. 음엔트로피는 최대 3스택까지 중첩된다.

설명 근거: `State_25166_Desc`

본문 근거 예시: `Text_KR.Text_Skill:Skill_4388_Desc_15`, `Text_KR.Text_Skill:Skill_4388_Desc_0`, `Text_KR.Text_Skill:Skill_4019_OverLimitUtlSkillDesc_3`

<a id="kw-cardcheerkeywords"></a>

### 응원 · `CardCheerKeywords`

![응원](../images/keyword-icons/inline/battle_card_buff_016.png)

- 본문 표기: 응원 / 환호
- 색상: `orangeword (#c48662)`
- 아이콘: `Battle_Card_Buff_016` · 설명 연결: 상태 25392 · 본문 관측: 2회

> 사용 후, 최대 HP의 2%를 잃고, 대마술사는 이번 턴에 「의기양양」 1스택을 획득한다.

설명 근거: `State_25392_Desc`

본문 근거 예시: `Text_KR.Text_State:State_25392_Name`, `Text_KR.Text_State:State_23827_Name`

<a id="kw-painword"></a>

### 인내 · `PainWord`

![인내](../images/keyword-icons/inline/battle_card_buff_040.png)

- 본문 표기: 인내
- 색상: `orangeword (#c48662)`
- 아이콘: `Battle_Card_Buff_040` · 설명 연결: 상태 34689 · 본문 관측: 52회

> HP 1을 잃을 때마다 인내 1스택을 획득하며, 상한은 최대 HP의 100%이다. 인내는 다음 전투로 이월된다.

설명 근거: `State_34689_Desc`

본문 근거 예시: `Text_KR.Text_Skill:Skill_4144_tempBattleDesc_1`, `Text_KR.Text_Skill:Skill_4334_tempOverLimitUtlSkillDesc_2`, `Text_KR.Text_Skill:Skill_4144_Desc_2`

<a id="kw-colorinkkeywords"></a>

### 인지 부조화 · `ColorInkKeywords`

![인지 부조화](../images/keyword-icons/inline/battle_card_buff_016.png)

- 본문 표기: 인지 부조화 / 채묵
- 색상: `orangeword (#c48662)`
- 아이콘: `Battle_Card_Buff_016` · 설명 연결: 상태 140656 · 본문 관측: 21회

> 이 카드의 행동력 소모가 10% 확률로 -2, 25% 확률로 -1, 30% 확률로 변동 없음, 25% 확률로 +1, 10% 확률로 +2가 됩니다. 사용하거나 버린 후 이 상태를 제거합니다.

설명 근거: `State_140656_Desc`

본문 근거 예시: `Text_KR.Text_RelicConfig:RelicConfig_98274_BattleDesc`, `Text_KR.Text_RelicConfig:RelicConfig_98274_Desc`, `Text_KR.Text_Skill:Skill_54441_Desc`

<a id="kw-erosioncolorinkkeywords"></a>

### 인지 착란 · `ErosionColorInkKeywords`

![인지 착란](../images/keyword-icons/inline/battle_card_buff_016.png)

- 본문 표기: 인지 착란 / 인지 혼란 / 융식 채묵 / 「인지 착란」 / 인지착란
- 색상: `orangeword (#c48662)`
- 아이콘: `Battle_Card_Buff_016` · 설명 연결: 상태 140655 · 본문 관측: 49회

> 이 카드는 융식으로 가려져 텍스트를 확인할 수 없으며, 행동력 소모가 10% 확률로 -2, 25% 확률로 -1, 30% 확률로 변동 없음, 25% 확률로 +1, 10% 확률로 +2가 됩니다. 사용하거나 버린 후 이 상태를 제거합니다.

설명 근거: `State_140655_Desc`

본문 근거 예시: `Text_KR.Text_RelicConfig:RelicConfig_131178_BattleDesc`, `Text_KR.Text_RelicConfig:RelicConfig_131178_Desc`, `Text_KR.Text_Skill:Skill_131192_Desc`

<a id="kw-pvpcognitivedissonancekeywords"></a>

### 인지 착란 · `PVPCognitiveDissonanceKeyWords`

![인지 착란](../images/keyword-icons/inline/battle_card_buff_008.png)

- 본문 표기: 인지 착란
- 색상: `redword (#bb646d)`
- 아이콘: `Battle_Card_Buff_008` · 설명 연결: 상태 140672 · 본문 관측: 2회

> 이번 턴이 끝나기 전까지, 매번 가하는 피해, 치유, 보호막이 무작위로 15%~35% 감소하며, 해제할 수 없습니다.

설명 근거: `State_140672_Desc`

본문 근거 예시: `Text_KR.Text_Skill:Skill_133324_Desc_1`, `Text_KR.Text_State:State_140672_Name`

<a id="kw-pvponemeetingkeywords"></a>

### 일기일회 · `PVPOneMeetingKeywords`

![일기일회](../images/keyword-icons/inline/battle_card_buff_016.png)

- 본문 표기: 일기일회
- 색상: `orangeword (#c48662)`
- 아이콘: `Battle_Card_Buff_016` · 설명 연결: 상태 132892 · 본문 관측: 2회

> ·획득 시 다른 아군의 「일기일회」 상태를 제거하고, 「벚꽃 아래의 수수께끼」를 장비한 아군의 증폭 효과와 동일한 효과를 획득하며, 최대 3중첩.
> ·「벚꽃 아래의 수수께끼」를 장비한 캐릭터는 「일기일회」를 획득할 수 없음.

설명 근거: `State_132892_Desc`

본문 근거 예시: `Text_KR.Text_Skill:Skill_132884_Desc_1`, `Text_KR.Text_State:State_132891_Desc`

<a id="kw-temppowerkeywords"></a>

### 임시 강화 · `TempPowerKeywords`

![임시 강화](../images/keyword-icons/inline/battle_card_buff_016.png)

- 본문 표기: 임시 강화
- 색상: `orangeword (#c48662)`
- 아이콘: `Battle_Card_Buff_016` · 설명 연결: 상태 133999 · 본문 관측: 3회

> 스택당 해당 카드가 주는 피해, 힘 및 촉수 피해, 잠금 중독, 잠금 반격의 최종 효과가 2% 증가하며, 실드, HP 회복, 힘 감소의 최종 효과가 1% 증가한다. 턴 종료 또는 사용 후 제거된다.

설명 근거: `State_133999_Desc`

본문 근거 예시: `Text_KR.Text_AwakerPotency:AwakerPotency_13368_PotencyDesc`, `Text_KR.Text_Skill:Skill_61123_Desc_15`, `Text_KR.Text_State:State_133999_Name`

<a id="kw-chapter5_monster_fervor1"></a>

### 임시 열광 · `Chapter5_Monster_Fervor1`

![임시 열광](../images/keyword-icons/inline/battle_card_buff_071.png)

- 본문 표기: 임시 열광 / 열광
- 색상: `별도 색상 지정 없음`
- 아이콘: `Battle_Card_Buff_071` · 설명 연결: 상태 128248 · 본문 관측: 9회

> 턴 시작 시 초기화된다. 10스택에 도달하면, 다음에 카드를 사용한 후 즉시 행동하여 열광을 제거하고, 의도를 허약을 부여하며 명령 카드를 무작위로 봉인하는 「속박의 그물」로 전환한다.

설명 근거: `State_128248_Desc`

본문 근거 예시: `Text_KR.Text_Skill:Skill_128207_Desc`, `Text_KR.Text_Skill:Skill_128474_Desc`, `Text_KR.Text_Skill:Skill_128476_Desc`

<a id="kw-chapter5_monster_fervor2"></a>

### 임시 열광 · `Chapter5_Monster_Fervor2`

![임시 열광](../images/keyword-icons/inline/battle_card_buff_071.png)

- 본문 표기: 열광 / 임시 열광
- 색상: `별도 색상 지정 없음`
- 아이콘: `Battle_Card_Buff_071` · 설명 연결: 상태 128245 · 본문 관측: 5회

> 턴 시작 시 초기화된다. 10스택에 도달하면, 다음에 카드를 사용한 후 즉시 행동하여 열광을 제거하고, 의도를 손상을 부여하며 암중 파괴를 무작위로 부여하는 「붕괴의 실」로 전환한다.

설명 근거: `State_128245_Desc`

본문 근거 예시: `Text_KR.Text_Skill:Skill_128254_Desc`, `Text_KR.Text_State:State_128247_Desc`, `Text_KR.Text_State:State_128245_Desc`

<a id="kw-chapter5_monster_fervor3"></a>

### 임시 열광 · `Chapter5_Monster_Fervor3`

![임시 열광](../images/keyword-icons/inline/battle_card_buff_071.png)

- 본문 표기: 열광
- 색상: `별도 색상 지정 없음`
- 아이콘: `Battle_Card_Buff_071` · 설명 연결: 상태 128644 · 본문 관측: 9회

> 턴 시작 시 초기화된다. 10스택에 도달하면, 다음에 카드를 사용한 후 즉시 행동하여 열광을 제거하고 무작위로 의도를 전환한다.

설명 근거: `State_128644_Desc`

본문 근거 예시: `Text_KR.Text_Skill:Skill_129638_Desc`, `Text_KR.Text_Skill:Skill_129618_Desc`, `Text_KR.Text_Skill:Skill_128624_Desc`

<a id="kw-chapter5_monster_fervor4"></a>

### 임시 열광 · `Chapter5_Monster_Fervor4`

![임시 열광](../images/keyword-icons/inline/battle_card_buff_071.png)

- 본문 표기: 광열 / 열광
- 색상: `별도 색상 지정 없음`
- 아이콘: `Battle_Card_Buff_071` · 설명 연결: 상태 131123 · 본문 관측: 2회

> 턴 시작 시 초기화된다. 10스택에 도달하면, 다음에 카드를 사용한 후 즉시 행동하여 다음 의도로 전환하고 열광을 제거한다.

설명 근거: `State_131123_Desc`

본문 근거 예시: `Text_KR.Text_Skill:Skill_130477_Desc`, `Text_KR.Text_State:State_131123_Desc`

<a id="kw-monster_fervor"></a>

### 임시 열광 · `Monster_Fervor`

![임시 열광](../images/keyword-icons/inline/battle_card_buff_071.png)

- 본문 표기: 임시 열광
- 색상: `별도 색상 지정 없음`
- 아이콘: `Battle_Card_Buff_071` · 설명 연결: 상태 123177 · 본문 관측: 4회

> 턴 시작 시 초기화된다. 10스택에 도달하면, 다음에 카드를 사용한 후 무셰트가 즉시 행동하여 「임시 열광」을 제거하고 의도 「인간 폭발」을 추가한다.

설명 근거: `State_123177_Desc`

본문 근거 예시: `Text_KR.Text_Skill:Skill_124420_Desc`, `Text_KR.Text_Skill:Skill_122413_Desc`, `Text_KR.Text_State:State_122431_Desc`

<a id="kw-monsterb05exfever"></a>

### 임시 열광 · `MonsterB05EXFever`

![임시 열광](../images/keyword-icons/inline/battle_card_buff_071.png)

- 본문 표기: 광열 / 임시 열광
- 색상: `별도 색상 지정 없음`
- 아이콘: `Battle_Card_Buff_071` · 설명 연결: 상태 148392 · 본문 관측: 3회

> 턴 시작 후 해제됩니다. 10 스택에 도달하면, 다음에 카드를 사용한 직후 즉시 행동하고, 광열을 제거하며 의도를 「선혈의 사슬」로 전환합니다.

설명 근거: `State_148392_Desc`

본문 근거 예시: `Text_KR.Text_Skill:Skill_148361_Desc`, `Text_KR.Text_Skill:Skill_148360_Desc`, `Text_KR.Text_State:State_148385_Desc`

<a id="kw-monsterpolluxfever"></a>

### 임시 열광 · `MonsterPolluxFever`

![임시 열광](../images/keyword-icons/inline/battle_card_buff_071.png)

- 본문 표기: 광열
- 색상: `별도 색상 지정 없음`
- 아이콘: `Battle_Card_Buff_071` · 설명 연결: 상태 147974 · 본문 관측: 1회

> 턴 시작 후 해제됩니다. 10 스택에 도달하면, 다음에 카드를 사용한 직후 즉시 행동하고, 광열을 제거하며 의도를 「성심」으로 전환합니다.

설명 근거: `State_147974_Desc`

본문 근거 예시: `Text_KR.Text_State:State_147969_Desc`

<a id="kw-b02afkeyword"></a>

### 자비의 보호 · `B02AFKeyWord`

![자비의 보호](../images/keyword-icons/inline/battle_card_buff_016.png)

- 본문 표기: 인애로 보호하기
- 색상: `orangeword (#c48662)`
- 아이콘: `Battle_Card_Buff_016` · 설명 연결: 스킬 44817 · 본문 관측: 2회

> 임시 장벽을 \[Arg1\]스택 획득하고, 배아 융합을 +\[Arg2\]% 증가시킵니다.

설명 근거: `Skill_44817_Desc`

본문 근거 예시: `Text_KR.Text_Skill:Skill_4664_Desc_0`, `Text_KR.Text_Skill:Skill_4664_Desc_15`

<a id="kw-shuzui"></a>

### 자죄 · `ShuZui`

![자죄](../images/keyword-icons/inline/battle_card_buff_090.png)

- 본문 표기: 자죄 / 자책
- 색상: `blueword (#76aac8)`
- 아이콘: `Battle_Card_Buff_090` · 설명 연결: 상태 149791 · 본문 관측: 8회

> 부서약·오지에의 「스킬」을 사용할 때, 1 중첩을 소모하여 「방어」 1장을 드로우하고, 다음에 사용하기 전까지 보존 상태가 되며, 상한 \[DescArg1\] 중첩, 전투 종료 시 제거되지 않는다.

설명 근거: `State_149791_Desc`

본문 근거 예시: `Text_KR.Text_Skill:Skill_145675_OverLimitUtlSkillDesc_0`, `Text_KR.Text_Skill:Skill_145675_BattleDesc_0`, `Text_KR.Text_Skill:Skill_145675_BattleDesc_3`

<a id="kw-carcasskeywords"></a>

### 잔해 · `CarcassKeywords`

![잔해](../images/keyword-icons/inline/battle_card_buff_076.png)

- 본문 표기: 잔해
- 색상: `redword (#bb646d)`
- 아이콘: `Battle_Card_Buff_076` · 설명 연결: 상태 141504 · 본문 관측: 6회

> 최대 3구까지 쌓을 수 있으며, 상한에 도달한 후 다음 「생령의 성찬」으로 이를 먹고 효과를 강화할 수 있습니다. 잔해는 다음 전투로 이어집니다.

설명 근거: `State_141504_Desc`

본문 근거 예시: `Text_KR.Text_Skill:Skill_95820_Desc_0`, `Text_KR.Text_Skill:Skill_95820_BattleDesc_3`, `Text_KR.Text_Skill:Skill_95820_BattleDesc_0`

<a id="kw-guaiwucanhai"></a>

### 잔해 · `Guaiwucanhai`

![잔해](../images/keyword-icons/inline/battle_card_buff_076.png)

- 본문 표기: 잔해
- 색상: `redword (#bb646d)`
- 아이콘: `Battle_Card_Buff_076` · 설명 연결: 상태 95967 · 본문 관측: 10회

> 잔해 수량은 「잔해 수집」의 효과를 증가시킨다.

설명 근거: `State_95967_Desc`

본문 근거 예시: `Text_KR.Text_Skill:Skill_95818_Desc`, `Text_KR.Text_Skill:Skill_95825_Desc`, `Text_KR.Text_Skill:Skill_95823_Desc`

<a id="kw-pvpsneakkeywords"></a>

### 잠행 · `PVPSneakKeywords`

![잠행](../images/keyword-icons/inline/battle_card_buff_038.png)

- 본문 표기: 잠행
- 색상: `whiteword (#ffffff)`
- 아이콘: `Battle_Card_Buff_038` · 설명 연결: 상태 97252 · 본문 관측: 3회

> · 상대의 우선 공격 대상이 되지 않으며, 상대가 단일 대상을 선택할 때 잠행 각성체를 선택할 수 없다.
>
> · 잠행 획득 시 자신의 도발과 다른 아군의 잠행을 해제한다. 다른 아군이 없거나 적이 도발을 획득할 경우 잠행을 해제한다.

설명 근거: `State_97252_Desc`

본문 근거 예시: `Text_KR.Text_Skill:Skill_126350_Desc_1`, `Text_KR.Text_Skill:Skill_125377_Desc_1`, `Text_KR.Text_State:State_97252_Name`

<a id="kw-parcloseiconkeywords"></a>

### 장벽 · `ParcloseIconKeywords`

![장벽](../images/keyword-icons/inline/battle_card_buff_013.png)

- 본문 표기: 장벽
- 색상: `blueword (#76aac8)`
- 아이콘: `Battle_Card_Buff_013` · 설명 연결: 상태 3450 · 본문 관측: 45회

> 능동 또는 촉수 피해를 받을 때, 피해 면역 후 1스택 제거.

설명 근거: `State_3450_Desc`

본문 근거 예시: `Text_KR.Text_RelicConfig:RelicConfig_13750_BattleDesc`, `Text_KR.Text_RelicConfig:RelicConfig_140282_Desc`, `Text_KR.Text_RelicConfig:RelicConfig_13750_Desc`

<a id="kw-pvpprotectivekeywords"></a>

### 장벽 · `PVPProtectiveKeywords`

![장벽](../images/keyword-icons/inline/battle_card_buff_013.png)

- 본문 표기: 장벽 / 배리어 / 스택
- 색상: `blueword (#76aac8)`
- 아이콘: `Battle_Card_Buff_013` · 설명 연결: 상태 45050 · 본문 관측: 50회

> 다음 능동 공격 피해를 상쇄하며, 최대 3스택까지 중첩할 수 있다. 스택당 사투는 실드의 중첩 가능 횟수를 1 감소시키며, 이미 획득한 실드는 중첩 가능 횟수가 감소해도 줄어들지 않는다.

설명 근거: `State_45050_Desc`

본문 근거 예시: `Text_KR.Text_Skill:Skill_19411_Desc_1`, `Text_KR.Text_Skill:Skill_45543_Desc_1`, `Text_KR.Text_Skill:Skill_45580_Desc_1`

<a id="kw-cursekeywords"></a>

### 저주 · `CurseKeywords`

![저주](../images/keyword-icons/inline/battle_card_buff_001.png)

- 본문 표기: 본문 사용 미관측
- 색상: `purpleword (#af6bb0)`
- 아이콘: `Battle_Card_Buff_001` · 설명 연결: 상태 3929 · 본문 관측: 미관측

> 획득하는 힘과 실드가 50% 감소하며, 턴 종료 시 1스택이 제거된다.

설명 근거: `State_3929_Desc`

<a id="kw-adaptkeywords"></a>

### 적응 · `AdaptKeywords`

![적응](../images/keyword-icons/inline/battle_card_buff_016.png)

- 본문 표기: 적응
- 색상: `orangeword (#c48662)`
- 아이콘: `Battle_Card_Buff_016` · 설명 연결: 상태 140873 · 본문 관측: 4회

> 1층마다 이 카드가 주는 데미지, 힘, 터치손상, 잠금 중독, 잠금 반격, 방어막, HP 회복, 힘 감소의 최종 효과가 1% 감소하며, 최대 \[DescArg1\]층까지 쌓입니다.

설명 근거: `State_140873_Desc`

본문 근거 예시: `Text_KR.Text_State:State_140873_Name`, `Text_KR.Text_State:State_140730_Desc`

<a id="kw-shimieluotanhuodong1"></a>

### 전의 · `Shimieluotanhuodong1`

![전의](../images/keyword-icons/inline/battle_card_buff_016.png)

- 본문 표기: 전의
- 색상: `orangeword (#c48662)`
- 아이콘: `Battle_Card_Buff_016` · 설명 연결: 상태 146147 · 본문 관측: 6회

> 「검의 뼈」에 의해 소모되어 버프를 획득할 수 있습니다. 이 상태는 최대 15스택까지 쌓입니다.

설명 근거: `State_146147_Desc`

본문 근거 예시: `Text_KR.Text_Skill:Skill_146112_Desc`, `Text_KR.Text_Skill:Skill_146114_Desc`, `Text_KR.Text_Skill:Skill_146113_Desc`

<a id="kw-d13afkeyword2"></a>

### 정신적 상처 · `D13AFKeyWord2`

![정신적 상처](../images/keyword-icons/inline/battle_card_buff_049.png)

- 본문 표기: 정신적 상처
- 색상: `purpleword (#af6bb0)`
- 아이콘: `Battle_Card_Buff_049` · 설명 연결: 상태 81055 · 본문 관측: 7회

> 군집 침식 아래, 너의 공포는 숨을 곳이 없다. 스택당 이번 턴 받는 능동 및 촉수 피해 3% 증가, 최대 10스택.

설명 근거: `State_81055_Desc`

본문 근거 예시: `Text_KR.Text_Skill:Skill_78785_OverLimitUtlSkillDesc_3`, `Text_KR.Text_Skill:Skill_78785_Desc_2`, `Text_KR.Text_Skill:Skill_78785_BattleDesc_2`

<a id="kw-d13afkeywordq2"></a>

### 정신적 상처 · `D13AFKeyWordQ2`

![정신적 상처](../images/keyword-icons/inline/battle_card_buff_049.png)

- 본문 표기: 정신적 상처
- 색상: `purpleword (#af6bb0)`
- 아이콘: `Battle_Card_Buff_049` · 설명 연결: 상태 81056 · 본문 관측: 4회

> 군집 침식 아래, 너의 공포는 숨을 곳이 없다. 스택당 이번 턴 받는 능동 및 촉수 피해 3% 증가, 최대 15스택.

설명 근거: `State_81056_Desc`

본문 근거 예시: `Text_KR.Text_Skill:Skill_78785_Desc_3`, `Text_KR.Text_Skill:Skill_78785_BattleDesc_3`, `Text_KR.Text_Skill:Skill_78785_OverLimitUtlSkillDesc_0`

<a id="kw-pvpsleepkeywords"></a>

### 정제된 수면 · `PVPSleepKeywords`

![정제된 수면](../images/keyword-icons/inline/battle_card_buff_043.png)

- 본문 표기: 정제된 수면
- 색상: `purpleword (#af6bb0)`
- 아이콘: `Battle_Card_Buff_043` · 설명 연결: 상태 57817 · 본문 관측: 2회

> 행동 불가. 턴 종료 시 스택이 1 감소하며, 스택 소진 시 강효 +5. 해제할 수 없음. 명륜 교체 시 정제된 수면 상태를 잃는다.

설명 근거: `State_57817_Desc`

본문 근거 예시: `Text_KR.Text_Skill:Skill_57762_Desc_1`, `Text_KR.Text_State:State_57753_Desc`

<a id="kw-o07cardkeyword"></a>

### 제의 · `O07CardKeyWord`

![제의](../images/keyword-icons/inline/battle_card_buff_016.png)

- 본문 표기: 의식
- 색상: `orangeword (#c48662)`
- 아이콘: `Battle_Card_Buff_016` · 설명 연결: 상태 52068 · 본문 관측: 12회

> 손에 있는 최대 3장의 「성례」를 「집착」으로 전환하며, 전환된 수량에 따라 단계별 추가 효과를 획득한다.

설명 근거: `State_52068_Desc`

본문 근거 예시: `Text_KR.Text_AwakerConfig:AwakerConfig_15582_AwakerIntroduction`, `Text_KR.Text_Skill:Skill_4152_Desc_0`, `Text_KR.Text_Skill:Skill_4755_BattleDesc_0`

<a id="kw-monstersinmarkkeywords"></a>

### 죄의 인장 · `MonsterSinMarkKeywords`

![죄의 인장](../images/keyword-icons/inline/battle_card_buff_078.png)

- 본문 표기: 죄인 / 죄의 인장
- 색상: `purpleword (#af6bb0)`
- 아이콘: `Battle_Card_Buff_078` · 설명 연결: 상태 147972 · 본문 관측: 9회

> 스택당 「성자·백야」가 가하는 피해에 1% 출혈을 추가합니다.

설명 근거: `State_147972_Desc`

본문 근거 예시: `Text_KR.Text_Skill:Skill_147937_Desc`, `Text_KR.Text_Skill:Skill_147940_Desc`, `Text_KR.Text_Skill:Skill_147941_Desc`

<a id="kw-pvpcorrosionkeywords"></a>

### 죄인 · `PVPCorrosionKeywords`

![죄인](../images/keyword-icons/inline/battle_card_buff_078.png)

- 본문 표기: 죄인 / 죄 인장
- 색상: `purpleword (#af6bb0)`
- 아이콘: `Battle_Card_Buff_078` · 설명 연결: 상태 117745 · 본문 관측: 12회

> 부여 시 동일한 스택 수만큼의 최대 HP를 잃으며, 해제 시 잃은 최대 HP는 반환되지 않는다. 발동 시 동일한 스택 수만큼의 순수 피해를 받는다. 영속.

설명 근거: `State_117745_Desc`

본문 근거 예시: `Text_KR.Text_Skill:Skill_117740_Desc_1`, `Text_KR.Text_Skill:Skill_117177_Desc_1`, `Text_KR.Text_Skill:Skill_117175_Desc_1`

<a id="kw-zuiyinkeywords"></a>

### 죄인 · `ZuiyinKeywords`

![죄인](../images/keyword-icons/inline/battle_card_buff_078.png)

- 본문 표기: 죄인 / 죄 인장 / 죄인의 낙인
- 색상: `purpleword (#af6bb0)`
- 아이콘: `Battle_Card_Buff_078` · 설명 연결: 상태 117358 · 본문 관측: 15회

> 스택당 폴룩스가 주는 피해에 1%의 출혈이 추가로 부여된다.

설명 근거: `State_117358_Desc`

본문 근거 예시: `Text_KR.Text_Skill:Skill_117315_BattleDesc_3`, `Text_KR.Text_Skill:Skill_117318_Desc_0`, `Text_KR.Text_Skill:Skill_117315_tempBattleDesc_4`

<a id="kw-deathresistanceiconkeywords"></a>

### 죽음 저항 · `DeathResistanceIconKeywords`

![죽음 저항](../images/keyword-icons/inline/battle_card_buff_012.png)

- 본문 표기: 죽음 저항 / 데스 리저스턴스
- 색상: `greenword (#71aa86)`
- 아이콘: `Battle_Card_Buff_012` · 설명 연결: 상태 2639 · 본문 관측: 27회

> 전투 중 치명타 피해를 받을 때, 일정 확률로 HP 1을 남기고 생존한다. 발동 후 이번 조사에서 확률이 절반으로 감소하며, 획득하는 죽음 저항도 절반으로 감소한다.

설명 근거: `State_2639_Desc`

본문 근거 예시: `Text_KR.Text_RelicConfig:RelicConfig_13901_Desc`, `Text_KR.Text_RelicConfig:RelicConfig_13837_Desc`, `Text_KR.Text_RelicConfig:RelicConfig_13824_Desc`

<a id="kw-guaiwusiwangdikang"></a>

### 죽음 저항 · `Guaiwusiwangdikang`

![죽음 저항](../images/keyword-icons/inline/battle_card_buff_012.png)

- 본문 표기: 죽음 저항
- 색상: `greenword (#71aa86)`
- 아이콘: `Battle_Card_Buff_012` · 설명 연결: 상태 94692 · 본문 관측: 15회

> 치명적 피해를 받은 후 1스택을 제거하고 최대 HP의 5%를 회복한다. 이번 턴 내에 발동될 때마다 회복량이 1%씩 증가한다.

설명 근거: `State_94692_Desc`

본문 근거 예시: `Text_KR.Text_Skill:Skill_124083_Desc`, `Text_KR.Text_Skill:Skill_94954_Desc`, `Text_KR.Text_Skill:Skill_94963_Desc`

<a id="kw-pvpdeathresistanceiconkeywords"></a>

### 죽음 저항 · `PVPDeathResistanceIconKeywords`

![죽음 저항](../images/keyword-icons/inline/battle_card_buff_012.png)

- 본문 표기: 본문 사용 미관측
- 색상: `greenword (#71aa86)`
- 아이콘: `Battle_Card_Buff_012` · 설명 연결: 상태 23726 · 본문 관측: 미관측

> 다음 턴까지 각성체의 사망을 1회 막는다. 최대 1스택.

설명 근거: `State_23726_Desc`

<a id="kw-intoxicationiconkeywords"></a>

### 중독 · `IntoxicationIconKeywords`

![중독](../images/keyword-icons/inline/battle_card_buff_006.png)

- 본문 표기: 중독
- 색상: `purpleword (#af6bb0)`
- 아이콘: `Battle_Card_Buff_006` · 설명 연결: 상태 3773 · 본문 관측: 286회

> 턴 종료 시 동일한 스택 수만큼의 순수 피해를 받는다.

설명 근거: `State_3773_Desc`

본문 근거 예시: `Text_KR.Text_AwakerConfig:AwakerConfig_15575_AwakerIntroduction`, `Text_KR.Text_AwakerConfig:AwakerConfig_15571_AwakerIntroduction`, `Text_KR.Text_AwakerConfig:AwakerConfig_15580_AwakerIntroduction`

<a id="kw-pvpmethysiskeywords"></a>

### 중독 · `PVPMethysisKeywords`

![중독](../images/keyword-icons/inline/battle_card_buff_006.png)

- 본문 표기: 중독
- 색상: `purpleword (#af6bb0)`
- 아이콘: `Battle_Card_Buff_006` · 설명 연결: 상태 19995 · 본문 관측: 19회

> 턴 종료 시 스택 수와 동일한 순수 피해를 입힌다. 영속.

설명 근거: `State_19995_Desc`

본문 근거 예시: `Text_KR.Text_Skill:Skill_19444_Desc_1`, `Text_KR.Text_Skill:Skill_45619_Desc_1`, `Text_KR.Text_Skill:Skill_45521_Desc_1`

<a id="kw-heavyinjurykeywords"></a>

### 중상 · `HeavyInjuryKeywords`

![중상](../images/keyword-icons/inline/battle_card_buff_031.png)

- 본문 표기: 중상 / 치명타 / 중창
- 색상: `redword (#bb646d)`
- 아이콘: `Battle_Card_Buff_031` · 설명 연결: 상태 50010 · 본문 관측: 57회

> 받는 HP 회복량이 25% 감소한다. 턴 종료 시 1스택이 제거된다.

설명 근거: `State_50010_Desc`

본문 근거 예시: `Text_KR.Text_Skill:Skill_49457_Desc`, `Text_KR.Text_Skill:Skill_4055_OverLimitUtlSkillDesc_0`, `Text_KR.Text_Skill:Skill_118057_Desc`

<a id="kw-pvpseriousinjurykeywords"></a>

### 중상 · `PVPSeriousInjuryKeywords`

![중상](../images/keyword-icons/inline/battle_card_buff_031.png)

- 본문 표기: 중상 / 치명타 / 중창
- 색상: `redword (#bb646d)`
- 아이콘: `Battle_Card_Buff_031` · 설명 연결: 상태 47830 · 본문 관측: 14회

> 적용 시 대상의 실드와 지연 치유를 해제하고, 턴 종료 전까지 받는 치유와 실드 효과가 50% 감소한다.

설명 근거: `State_47830_Desc`

본문 근거 예시: `Text_KR.Text_Skill:Skill_19364_Desc_1`, `Text_KR.Text_Skill:Skill_133346_Desc_1`, `Text_KR.Text_Skill:Skill_45494_Desc_1`

<a id="kw-silkkeywords"></a>

### 직명 · `SilkKeywords`

![직명](../images/keyword-icons/inline/battle_card_buff_084.png)

- 본문 표기: 직명
- 색상: `purpleword (#af6bb0)`
- 아이콘: `Battle_Card_Buff_084` · 설명 연결: 상태 134227 · 본문 관측: 7회

> 아라크네가 운명을 짜서 이끌어낸 실타래. 최대 \[DescArg1\]스택까지 중첩되며, 전투를 넘어 유지된다. 광기 폭발로 소모하여 「끝없는 실타래」 추격을 발동할 수 있다.

설명 근거: `State_134227_Desc`

본문 근거 예시: `Text_KR.Text_Skill:Skill_126488_Desc_0`, `Text_KR.Text_Skill:Skill_126488_BattleDesc_0`, `Text_KR.Text_State:State_135920_Name`

<a id="kw-singularitykeywords3"></a>

### 차원 이동 · `SingularityKeywords3`

![차원 이동](../images/keyword-icons/inline/battle_card_buff_067.png)

- 본문 표기: 차원 이동
- 색상: `purpleword (#af6bb0)`
- 아이콘: `Battle_Card_Buff_067` · 설명 연결: 상태 134391 · 본문 관측: 11회

> 매 턴 처음으로 명령 카드를 사용한 후 해당 효과가 발동되며, 명령 카드를 사용한 후 해당 카드의 임시 원본 복사본을 초차원 공간에 넣는다. 초차원 턴에서는 해당 효과를 발동할 수 없다.

설명 근거: `State_134391_Desc`

본문 근거 예시: `Text_KR.Text_Skill:Skill_126490_BattleDesc_15`, `Text_KR.Text_Skill:Skill_126490_Desc_0`, `Text_KR.Text_Skill:Skill_4506_OverLimitUtlSkillDesc_0`

<a id="kw-energystoragekeywords"></a>

### 차지 · `EnergyStorageKeywords`

![차지](../images/keyword-icons/inline/battle_card_buff_030.png)

- 본문 표기: 차지 / 축력 / 충전
- 색상: `greenword (#71aa86)`
- 아이콘: `Battle_Card_Buff_030` · 설명 연결: 상태 19544 · 본문 관측: 26회

> 「타격」 사용 후 모든 스택을 소모하며, 소모한 스택 1스택당 이번 「타격」이 주는 피해가 50% 증가한다. 최대 5스택까지 중첩할 수 있다.

설명 근거: `State_19544_Desc`

본문 근거 예시: `Text_KR.Text_Skill:Skill_45503_Desc_1`, `Text_KR.Text_Skill:Skill_45462_Desc_1`, `Text_KR.Text_Skill:Skill_45468_Desc_1`

<a id="kw-chuangyi"></a>

### 창의 · `Chuangyi`

![창의](../images/keyword-icons/inline/battle_card_buff_077.png)

- 본문 표기: 창의
- 색상: `redword (#bb646d)`
- 아이콘: `Battle_Card_Buff_077` · 설명 연결: 상태 100541 · 본문 관측: 6회

> 현재 「창의」가 10스택일 경우, 픽맨이 광기 폭발 발동 후 모든 「창의」를 소모하여 광상 1스택을 획득하고 모든 각성체가 광기 15를 획득한다. 창의의 최대치는 10스택이며, 다음 전투로 이월된다.

설명 근거: `State_100541_Desc`

본문 근거 예시: `Text_KR.Text_Skill:Skill_98989_Desc_0`, `Text_KR.Text_Skill:Skill_100304_Desc`, `Text_KR.Text_Skill:Skill_99016_Desc`

<a id="kw-chuanggoukeyin"></a>

### 창조 각인 · `Chuanggoukeyin`

![창조 각인](../images/keyword-icons/inline/battle_card_buff_016.png)

- 본문 표기: 그려진 각인 / 창조 각인
- 색상: `orangeword (#c48662)`
- 아이콘: `Battle_Card_Buff_016` · 설명 연결: 상태 100564 · 본문 관측: 4회

> 다음 「각인」을 포함한다: 계산, 묘수, 광화, 촉매, 난폭, 철벽, 쇠약, 영감.

설명 근거: `State_100564_Desc`

본문 근거 예시: `Text_KR.Text_Skill:Skill_98984_Desc_2`, `Text_KR.Text_Skill:Skill_98984_Desc_0`, `Text_KR.Text_Skill:Skill_98984_OverLimitUtlSkillDesc`

<a id="kw-chuanggouzaowu"></a>

### 창조 유물 · `Chuanggouzaowu`

![창조 유물](../images/keyword-icons/inline/battle_card_buff_016.png)

- 본문 표기: 창조 유물 / 창조의 금빛 유물 / 창조의 은빛 유물
- 색상: `orangeword (#c48662)`
- 아이콘: `Battle_Card_Buff_016` · 설명 연결: 상태 100559 · 본문 관측: 3회

> 다음 「별의 시대 유물」을 포함한다: 악동, 봄의 제전, 무거운 자물쇠, 줄마노, 은혜의 피, 녹슨 강톱, 황금빛 꿈나라, 피 묻은 자갈.

설명 근거: `State_100559_Desc`

본문 근거 예시: `Text_KR.Text_Skill:Skill_98985_Desc_2`, `Text_KR.Text_Skill:Skill_98985_Desc_0`, `Text_KR.Text_State:State_100559_Name`

<a id="kw-monsterlizverdantspark"></a>

### 청록색 불씨 · `MonsterLizVerdantSpark`

![청록색 불씨](../images/keyword-icons/inline/battle_card_buff_016.png)

- 본문 표기: 청록색 불씨
- 색상: `greenword (#71aa86)`
- 아이콘: `Battle_Card_Buff_016` · 설명 연결: 상태 126479 · 본문 관측: 8회

> 상한 10스택, 리즈가 주는 피해가 증가한다.

설명 근거: `State_126479_Desc`

본문 근거 예시: `Text_KR.Text_Skill:Skill_126449_Desc`, `Text_KR.Text_Skill:Skill_126452_Desc`, `Text_KR.Text_Skill:Skill_126450_Desc`

<a id="kw-wormholekeywords"></a>

### 초거리 · `WormholeKeywords`

![초거리](../images/keyword-icons/inline/battle_card_buff_016.png)

- 본문 표기: 초거리
- 색상: `orangeword (#c48662)`
- 아이콘: `Battle_Card_Buff_016` · 설명 연결: 상태 80207 · 본문 관측: 17회

> 이 카드를 사용한 후 「차원 이동」이 발동되면 후속 효과를 발동하며, 초차원 공간에서 꺼낼 경우 행동력 소모가 1 감소한다.

설명 근거: `State_80207_Desc`

본문 근거 예시: `Text_KR.Text_Skill:Skill_89781_Desc_0`, `Text_KR.Text_Skill:Skill_89777_BattleDesc_0`, `Text_KR.Text_Skill:Skill_89777_Desc_0`

<a id="kw-monstersightunbound"></a>

### 초월의 눈 · `MonsterSightUnbound`

![초월의 눈](../images/keyword-icons/inline/battle_card_buff_016.png)

- 본문 표기: 초월의 눈
- 색상: `별도 색상 지정 없음`
- 아이콘: `Battle_Card_Buff_016` · 설명 연결: 상태 127276 · 본문 관측: 4회

> 이 카드를 사용할 때, 「각자」는 회귀 1스택을 획득한다. 이 카드를 버릴 경우, 「각자」는 회귀 1스택을 잃는다.

설명 근거: `State_127276_Desc`

본문 근거 예시: `Text_KR.Text_Skill:Skill_127252_Desc`, `Text_KR.Text_Skill:Skill_127248_Desc`, `Text_KR.Text_State:State_127276_Name`

<a id="kw-dimensionalspaceiconkeywords"></a>

### 초차원 공간 · `DimensionalSpaceIconKeywords`

![초차원 공간](../images/keyword-icons/inline/battle_card_buff_016.png)

- 본문 표기: 초차원 공간 / 초원공간 / 초차원공간
- 색상: `orangeword (#c48662)`
- 아이콘: `Battle_Card_Buff_016` · 설명 연결: 상태 3260 · 본문 관측: 31회

> 초차원 공간이 가득 찼을 때, 추가 턴을 획득한다. 이 턴에는 카드를 드로우하지 않고, 초차원 공간의 카드를 손으로 가져온다.

설명 근거: `State_3260_Desc`

본문 근거 예시: `Text_KR.Text_EnchantConfig:EnchantConfig_18194_Desc`, `Text_KR.Text_EnchantConfig:EnchantConfig_18204_Desc`, `Text_KR.Text_RelicConfig:RelicConfig_13831_BattleDesc`

<a id="kw-tentacleinjurieiconkeywords"></a>

### 촉수 피해 · `TentacleInjurieIconKeywords`

![촉수 피해](../images/keyword-icons/inline/battle_card_buff_016.png)

- 본문 표기: 촉수 피해 / 터치손상 / 촉수
- 색상: `orangeword (#c48662)`
- 아이콘: `Battle_Card_Buff_016` · 설명 연결: 상태 3592 · 본문 관측: 118회

> 촉수가 주는 피해가 증가한다.

설명 근거: `State_3592_Desc`

본문 근거 예시: `Text_KR.Text_RelicConfig:RelicConfig_70786_BattleDesc`, `Text_KR.Text_RelicConfig:RelicConfig_70792_Desc`, `Text_KR.Text_RelicConfig:RelicConfig_13778_BattleDesc`

<a id="kw-maxhpkeywords"></a>

### 최대 HP · `MaxHPKeywords`

![최대 HP](../images/keyword-icons/inline/battle_card_buff_020.png)

- 본문 표기: 최대 HP
- 색상: `greenword (#71aa86)`
- 아이콘: `Battle_Card_Buff_020` · 설명 연결: 상태 23871 · 본문 관측: 7회

> 최대 HP 증가 시 현재 HP는 함께 증가하지 않으며, 최대 HP 감소 시 초과된 현재 HP는 제거된다. 최대 HP는 최소 1이며, 사망 후에도 초기화되지 않는다.

설명 근거: `State_23871_Desc`

본문 근거 예시: `Text_KR.Text_Skill:Skill_140680_Desc_1`, `Text_KR.Text_Skill:Skill_45251_Desc_1`, `Text_KR.Text_Skill:Skill_147734_Desc_1`

<a id="kw-pvpbless"></a>

### 축복 · `PVPBless`

![축복](../images/keyword-icons/inline/battle_card_buff_025.png)

- 본문 표기: 축복
- 색상: `purpleword (#af6bb0)`
- 아이콘: `Battle_Card_Buff_025` · 설명 연결: 상태 146154 · 본문 관측: 3회

> 해당 각성체가 기분 좋게 느끼도록 합니다. 해당 각성체의 「스킬」이 「축복?」으로 변화되며, 변화 후 동일한 스택 수를 소비합니다.

설명 근거: `State_146154_Desc`

본문 근거 예시: `Text_KR.Text_Skill:Skill_145974_Desc_1`, `Text_KR.Text_Skill:Skill_142978_Desc_1`, `Text_KR.Text_State:State_143019_Desc`

<a id="kw-bleedingiconkeywords"></a>

### 출혈 · `BleedingIconKeywords`

![출혈](../images/keyword-icons/inline/battle_card_buff_022.png)

- 본문 표기: 출혈
- 색상: `redword (#bb646d)`
- 아이콘: `Battle_Card_Buff_022` · 설명 연결: 상태 3514 · 본문 관측: 166회

> 턴 종료 시 동일한 스택 수만큼의 순수 피해를 받고 해당 상태를 제거한다.

설명 근거: `State_3514_Desc`

본문 근거 예시: `Text_KR.Text_AwakerConfig:AwakerConfig_15567_AwakerIntroduction`, `Text_KR.Text_RelicConfig:RelicConfig_100540_BattleDesc`, `Text_KR.Text_RelicConfig:RelicConfig_70769_BattleDesc`

<a id="kw-pvpbleedingkeywords"></a>

### 출혈 · `PVPBleedingKeywords`

![출혈](../images/keyword-icons/inline/battle_card_buff_022.png)

- 본문 표기: 출혈
- 색상: `redword (#bb646d)`
- 아이콘: `Battle_Card_Buff_022` · 설명 연결: 상태 47873 · 본문 관측: 38회

> 다음 턴 종료 시, 스택 수만큼 피해를 준다.

설명 근거: `State_47873_Desc`

본문 근거 예시: `Text_KR.Text_Skill:Skill_71905_Desc_1`, `Text_KR.Text_Skill:Skill_4454_Desc`, `Text_KR.Text_Skill:Skill_35528_Desc`

<a id="kw-pvpvulnerabilityiconkeywords"></a>

### 취약 · `PVPVulnerabilityIconKeywords`

![취약](../images/keyword-icons/inline/battle_card_buff_003.png)

- 본문 표기: 취약 / 약점 / 손상 / 피해 증가
- 색상: `redword (#bb646d)`
- 아이콘: `Battle_Card_Buff_003` · 설명 연결: 상태 19507 · 본문 관측: 16회

> 다음 턴 시작 전까지 받는 능동 공격 피해와 출혈 스택이 25% 증가하며, 적용 시 보강과 상쇄된다.

설명 근거: `State_19507_Desc`

본문 근거 예시: `Text_KR.Text_Skill:Skill_45502_Desc_1`, `Text_KR.Text_Skill:Skill_45545_Desc_1`, `Text_KR.Text_Skill:Skill_71834_Desc_1`

<a id="kw-vulnerabilityiconkeywords"></a>

### 취약 · `VulnerabilityIconKeywords`

![취약](../images/keyword-icons/inline/battle_card_buff_003.png)

- 본문 표기: 취약 / 약점 / 손상 / 피해 증가
- 색상: `redword (#bb646d)`
- 아이콘: `Battle_Card_Buff_003` · 설명 연결: 상태 2432 · 본문 관측: 258회

> 받는 능동 피해 및 촉수 피해가 50% 증가하며, 턴 종료 시 1 스택을 제거한다.

설명 근거: `State_2432_Desc`

본문 근거 예시: `Text_KR.Text_AwakerConfig:AwakerConfig_15574_AwakerIntroduction`, `Text_KR.Text_AwakerPotency:AwakerPotency_13489_PotencyDesc`, `Text_KR.Text_AwakerPotency:AwakerPotency_13231_PotencyDesc`

<a id="kw-baojidikang"></a>

### 치명타 저항 · `Baojidikang`

![치명타 저항](../images/keyword-icons/inline/battle_card_buff_016.png)

- 본문 표기: 치명타 저항 / 임시 치명타 저항
- 색상: `orangeword (#c48662)`
- 아이콘: `Battle_Card_Buff_016` · 설명 연결: 상태 96358 · 본문 관측: 9회

> 치명타를 받을 확률이 \[Layer\]% 감소한다.

설명 근거: `State_96358_Desc`

본문 근거 예시: `Text_KR.Text_Skill:Skill_130473_Desc`, `Text_KR.Text_Skill:Skill_96345_Desc`, `Text_KR.Text_Skill:Skill_94968_Desc`

<a id="kw-pvplostsoulkeywords"></a>

### 치취 · `PVPLostSoulKeyWords`

![치취](../images/keyword-icons/inline/battle_card_buff_080.png)

- 본문 표기: 치취
- 색상: `redword (#bb646d)`
- 아이콘: `Battle_Card_Buff_080` · 설명 연결: 상태 121797 · 본문 관측: 7회

> 스택당 이번 전투에서 「명령 카드」, 「광기 폭발」이 주는 모든 피해, 치유 및 실드 효과를 10% 감소시키며, 최대 2스택까지 적용된다. 해제할 수 없다.

설명 근거: `State_121797_Desc`

본문 근거 예시: `Text_KR.Text_Skill:Skill_125370_Desc_1`, `Text_KR.Text_Skill:Skill_125378_Desc_1`, `Text_KR.Text_Skill:Skill_125382_Desc_1`

<a id="kw-corrosion"></a>

### 침식 · `Corrosion`

![침식](../images/keyword-icons/inline/battle_card_buff_070.png)

- 본문 표기: 침식 / 부식
- 색상: `purpleword (#af6bb0)`
- 아이콘: `Battle_Card_Buff_070` · 설명 연결: 상태 90294 · 본문 관측: 35회

> 이번 턴에 능동 또는 촉수 피해를 받을 때, 받은 피해량만큼 침식을 제거하고 제거량의 \[DescArg1\]%만큼 HP를 잃는다. 기타 피해를 받을 때는 피해량의 50%만큼 침식을 제거한다.

설명 근거: `State_90294_Desc`

본문 근거 예시: `Text_KR.Text_RelicConfig:RelicConfig_84113_Desc`, `Text_KR.Text_RelicConfig:RelicConfig_98891_BattleDesc`, `Text_KR.Text_RelicConfig:RelicConfig_84113_BattleDesc`

<a id="kw-pvpcardlockkeywords"></a>

### 카드 봉쇄 · `PVPCardLockKeywords`

![카드 봉쇄](../images/keyword-icons/inline/battle_card_buff_044.png)

- 본문 표기: 카드 봉쇄
- 색상: `whiteword (#ffffff)`
- 아이콘: `Battle_Card_Buff_044` · 설명 연결: 상태 116958 · 본문 관측: 2회

> 카드 사용 후, 해당 스택 수만큼 피해를 받는다.

설명 근거: `State_116958_Desc`

본문 근거 예시: `Text_KR.Text_Skill:Skill_74946_Desc_1`, `Text_KR.Text_Skill:Skill_45516_Desc_1`

<a id="kw-pvpreciprocalkeywords"></a>

### 카운트다운 · `PVPReciprocalKeywords`

![카운트다운](../images/keyword-icons/inline/battle_card_buff_042.png)

- 본문 표기: 카운트다운 순간
- 색상: `orangeword (#c48662)`
- 아이콘: `Battle_Card_Buff_042` · 설명 연결: 상태 122443 · 본문 관측: 2회

> 턴 시작 시 스택이 1 감소하며, 스택 소진 시 자신의 부정 상태를 해제하고 광기 100을 획득한 후, 다시 3스택의 카운트다운 순간을 획득한다. 명륜 교체 시 카운트다운 순간 상태를 잃는다.

설명 근거: `State_122443_Desc`

본문 근거 예시: `Text_KR.Text_Skill:Skill_122433_Desc_1`, `Text_KR.Text_State:State_122441_Desc`

<a id="kw-witherkeywords2"></a>

### 탈백 · `WitherKeywords2`

![탈백](../images/keyword-icons/inline/battle_card_buff_080.png)

- 본문 표기: 영혼 탈취 / 탈백
- 색상: `redword (#bb646d)`
- 아이콘: `Battle_Card_Buff_080` · 설명 연결: 상태 126790 · 본문 관측: 3회

> 전체 적에게 도취 2스택을 부여한다.

설명 근거: `State_126790_Desc`

본문 근거 예시: `Text_KR.Text_Skill:Skill_125376_Desc_0`, `Text_KR.Text_Skill:Skill_125376_Desc_3`, `Text_KR.Text_State:State_126790_Name`

<a id="kw-witherkeywords4"></a>

### 탈백 · `WitherKeywords4`

![탈백](../images/keyword-icons/inline/battle_card_buff_080.png)

- 본문 표기: 탈백
- 색상: `redword (#bb646d)`
- 아이콘: `Battle_Card_Buff_080` · 설명 연결: 상태 127109 · 본문 관측: 3회

> 모든 적의 도취를 제거하고, 1스택을 제거할 때마다 체력의 15%만큼 진홍빛 용광로를 적립하며, 대상 최대 HP의 \[DescArg1\]%에 해당하는 순수 피해를 주고 중독 40%를 발동시킨다.

설명 근거: `State_127109_Desc`

본문 근거 예시: `Text_KR.Text_Skill:Skill_125376_OverLimitUtlSkillDesc_0`, `Text_KR.Text_Skill:Skill_125376_OverLimitUtlSkillDesc_3`, `Text_KR.Text_State:State_127109_Name`

<a id="kw-touqukeywords"></a>

### 탈취 · `TouquKeywords`

![탈취](../images/keyword-icons/inline/battle_card_buff_014.png)

- 본문 표기: 탈취 / 영구 탈취
- 색상: `purpleword (#af6bb0)`
- 아이콘: `Battle_Card_Buff_014` · 설명 연결: 상태 78781 · 본문 관측: 20회

> 대상의 힘을 임시로 감소시키고, 감소한 만큼의 임시 힘을 획득한다.

설명 근거: `State_78781_Desc`

본문 근거 예시: `Text_KR.Text_Skill:Skill_67170_Desc`, `Text_KR.Text_Skill:Skill_66355_Desc`, `Text_KR.Text_Skill:Skill_23810_Desc`

<a id="kw-singularitykeywords"></a>

### 특이점 도약 · `SingularityKeywords`

![특이점 도약](../images/keyword-icons/inline/battle_card_buff_067.png)

- 본문 표기: 특이점 도약 / 특이점 비콘 \[DescArg2\]
- 색상: `purpleword (#af6bb0)`
- 아이콘: `Battle_Card_Buff_067` · 설명 연결: 상태 133372 · 본문 관측: 7회

> 현재 초차원 턴일 경우, 특이점 도약 효과를 발동한다. 「특이점 소멸」도 이번 턴의 다음 특이점 도약을 반드시 발동시킬 수 있다.

설명 근거: `State_133372_Desc`

본문 근거 예시: `Text_KR.Text_State:State_135920_Name`, `Text_KR.Text_State:State_126895_Name`, `Text_KR.Text_State:State_135233_Name`

<a id="kw-singularitykeywords1"></a>

### 특이점 비콘 · `SingularityKeywords1`

![특이점 비콘](../images/keyword-icons/inline/battle_card_buff_067.png)

- 본문 표기: 특이점 비콘
- 색상: `purpleword (#af6bb0)`
- 아이콘: `Battle_Card_Buff_067` · 설명 연결: 상태 133774 · 본문 관측: 2회

> 스택당 해당 카드가 주는 피해, 힘 및 촉수 피해, 잠금 중독, 잠금 반격의 최종 효과가 2% 증가하며, 실드, HP 회복, 힘 감소의 최종 효과가 1% 증가한다. 특이점 비콘을 보유한 카드는 「차원 이동」을 발동할 수 없다.

설명 근거: `State_133774_Desc`

본문 근거 예시: `Text_KR.Text_Skill:Skill_126486_OverLimitUtlSkillDesc`, `Text_KR.Text_State:State_133774_Name`

<a id="kw-singularitykeywords2"></a>

### 특이점 프리즘 · `SingularityKeywords2`

![특이점 프리즘](../images/keyword-icons/inline/battle_card_buff_067.png)

- 본문 표기: 특이점 프리즘
- 색상: `purpleword (#af6bb0)`
- 아이콘: `Battle_Card_Buff_067` · 설명 연결: 상태 133775 · 본문 관측: 4회

> 스택당 모든 각성체 카드가 주는 피해, 고정 힘과 촉수 피해 증가, 고정 중독, 고정 반격 최종 효과 2% 증가; 고정 방어막, 고정 HP 회복, 힘 감소의 최종 효과 1% 증가.

설명 근거: `State_133775_Desc`

본문 근거 예시: `Text_KR.Text_Skill:Skill_133381_Desc_0`, `Text_KR.Text_Skill:Skill_133381_Desc_3`, `Text_KR.Text_Skill:Skill_140665_Desc`

<a id="kw-destructionkeywords"></a>

### 파괴 · `DestructionKeywords`

![파괴](../images/keyword-icons/inline/battle_card_buff_016.png)

- 본문 표기: 파괴 / 폐기
- 색상: `orangeword (#c48662)`
- 아이콘: `Battle_Card_Buff_016` · 설명 연결: 상태 120462 · 본문 관측: 18회

> 전투 종료 후에도 덱에 보존되지만, 사용하거나 소모되면 영구적으로 제거된다.

설명 근거: `State_120462_Desc`

본문 근거 예시: `Text_KR.Text_Skill:Skill_131856_Desc_15`, `Text_KR.Text_Skill:Skill_131858_BattleDesc`, `Text_KR.Text_Skill:Skill_131856_BattleDesc_0`

<a id="kw-devourediconkeywords"></a>

### 포식 · `DevouredIconKeywords`

![포식](../images/keyword-icons/inline/battle_card_buff_016.png)

- 본문 표기: 포식 / 흡수 / 무한 포식
- 색상: `orangeword (#c48662)`
- 아이콘: `Battle_Card_Buff_016` · 설명 연결: 상태 2888 · 본문 관측: 92회

> 손에 「배아」가 있을 경우, 1장을 소모하고 후속 효과를 발동한다.

설명 근거: `State_2888_Desc`

본문 근거 예시: `Text_KR.Text_AwakerConfig:AwakerConfig_15584_AwakerIntroduction`, `Text_KR.Text_AwakerConfig:AwakerConfig_15567_AwakerIntroduction`, `Text_KR.Text_AwakerConfig:AwakerConfig_15598_AwakerIntroduction`

<a id="kw-pvpfengsuokeywords"></a>

### 폭발 봉쇄 · `PVPfengsuoKeywords`

![폭발 봉쇄](../images/keyword-icons/inline/battle_card_buff_027.png)

- 본문 표기: 폭발 봉인
- 색상: `whiteword (#ffffff)`
- 아이콘: `Battle_Card_Buff_027` · 설명 연결: 상태 66465 · 본문 관측: 3회

> 광기 폭발 사용 후, 해당 스택 수만큼 피해를 받는다.

설명 근거: `State_66465_Desc`

본문 근거 예시: `Text_KR.Text_Skill:Skill_117208_Desc_1`, `Text_KR.Text_Skill:Skill_66446_Desc_1`, `Text_KR.Text_State:State_117213_Desc`

<a id="kw-monsterexflamekeywords"></a>

### 폭염 · `MonsterExFlameKeywords`

![폭염](../images/keyword-icons/inline/battle_card_buff_057.png)

- 본문 표기: 폭염
- 색상: `redword (#bb646d)`
- 아이콘: `Battle_Card_Buff_057` · 설명 연결: 상태 98140 · 본문 관측: 5회

> 폭염 10스택을 적립한 후 의도를 극히 높은 피해의 「엑사 플레어」로 전환한다!

설명 근거: `State_98140_Desc`

본문 근거 예시: `Text_KR.Text_Skill:Skill_98127_Desc`, `Text_KR.Text_Skill:Skill_98126_Desc`, `Text_KR.Text_State:State_98147_Desc`

<a id="kw-c01cardkeyword1"></a>

### 한계 초월 링크 · `C01CardKeyWord1`

![한계 초월 링크](../images/keyword-icons/inline/battle_card_buff_016.png)

- 본문 표기: 본문 사용 미관측
- 색상: `orangeword (#c48662)`
- 아이콘: `Battle_Card_Buff_016` · 설명 연결: 스킬 54566 · 본문 관측: 미관측

> 해제된 열쇠 지령 중 1개를 선택하여 발동한다.

설명 근거: `Skill_54566_Desc`

<a id="kw-b02afkeyword3"></a>

### 해방 · `B02AFKeyWord3`

![해방](../images/keyword-icons/inline/battle_card_buff_016.png)

- 본문 표기: 해방
- 색상: `orangeword (#c48662)`
- 아이콘: `Battle_Card_Buff_016` · 설명 연결: 상태 44731 · 본문 관측: 2회

> 고통으로 고통을 없앤다. 모든 진홍색 용광로의 남은 회복량을 소모하여, 1점당 3점의 피해량을 증가시킨다. 만약 리더 전투라면, 1점당 9점의 피해량을 증가시킨다. 최대 생명력의 1%에 해당하는 진홍색 용광로를 소모할 때마다 \[DescArg1\]% 최종 피해가 증가합니다.

설명 근거: `State_44731_Desc`

본문 근거 예시: `Text_KR.Text_Skill:Skill_4529_Desc_2`, `Text_KR.Text_Skill:Skill_4529_Desc_0`

<a id="kw-hungerkeywords"></a>

### 허기 · `HungerKeywords`

![허기](../images/keyword-icons/inline/battle_card_buff_016.png)

- 본문 표기: 굶주림 / 허기
- 색상: `orangeword (#c48662)`
- 아이콘: `Battle_Card_Buff_016` · 설명 연결: 상태 141468 · 본문 관측: 9회

> 허기이 5층에 도달하면, 턴 종료 후 모든 허기을 소모하고 의도를 강력 공격으로 전환하며 힘을 획득합니다.

설명 근거: `State_141468_Desc`

본문 근거 예시: `Text_KR.Text_Skill:Skill_140714_Desc`, `Text_KR.Text_Skill:Skill_140766_Desc`, `Text_KR.Text_Skill:Skill_140765_Desc`

<a id="kw-nothingnessiconkeywords"></a>

### 허무 · `NothingnessIconKeywords`

![허무](../images/keyword-icons/inline/battle_card_buff_016.png)

- 본문 표기: 허무 / 공허
- 색상: `orangeword (#c48662)`
- 아이콘: `Battle_Card_Buff_016` · 설명 연결: 상태 20039 · 본문 관측: 35회

> 버리기 단계에서 손에 남아 있을 경우, 카드가 소모되며 이번 전투에서 다시 등장하지 않는다.

설명 근거: `State_20039_Desc`

본문 근거 예시: `Text_KR.Text_RelicConfig:RelicConfig_13864_Desc`, `Text_KR.Text_RelicConfig:RelicConfig_13808_Desc`, `Text_KR.Text_RelicConfig:RelicConfig_13864_BattleDesc`

<a id="kw-weaknessiconkeywords"></a>

### 허약 · `WeaknessIconKeywords`

![허약](../images/keyword-icons/inline/battle_card_buff_005.png)

- 본문 표기: 허약 / 약화
- 색상: `purpleword (#af6bb0)`
- 아이콘: `Battle_Card_Buff_005` · 설명 연결: 상태 3212 · 본문 관측: 298회

> 능동 및 촉수 피해 감소 25%, 턴 종료 시 1스택 제거.

설명 근거: `State_3212_Desc`

본문 근거 예시: `Text_KR.Text_AwakerConfig:AwakerConfig_15574_AwakerIntroduction`, `Text_KR.Text_AwakerPotency:AwakerPotency_13489_PotencyDesc`, `Text_KR.Text_AwakerPotency:AwakerPotency_13231_PotencyDesc`

<a id="kw-bleesing_exaggerate"></a>

### 허풍 · `Bleesing_Exaggerate`

![허풍](../images/keyword-icons/inline/battle_card_buff_016.png)

- 본문 표기: 허풍
- 색상: `orangeword (#c48662)`
- 아이콘: `Battle_Card_Buff_016` · 설명 연결: 상태 145621 · 본문 관측: 100회

> 「선물」 효과가 50% 감소한다.

설명 근거: `State_145621_Desc`

본문 근거 예시: `Text_KR.Text_Skill:Skill_149996_tempBattleDesc_1`, `Text_KR.Text_Skill:Skill_149968_BattleDesc`, `Text_KR.Text_Skill:Skill_149365_Desc`

<a id="kw-b02afkeyword2"></a>

### 헌신 · `B02AFKeyWord2`

![헌신](../images/keyword-icons/inline/battle_card_buff_016.png)

- 본문 표기: 헌신
- 색상: `orangeword (#c48662)`
- 아이콘: `Battle_Card_Buff_016` · 설명 연결: 상태 44732 · 본문 관측: 2회

> 피로써 구원한다. 피해를 입힌 후, 현재 HP의 10%를 잃고, 잃은 HP와 동일한 양의 핏빛 용광로 회복량을 적립한다.

설명 근거: `State_44732_Desc`

본문 근거 예시: `Text_KR.Text_Skill:Skill_4529_Desc_2`, `Text_KR.Text_Skill:Skill_4529_Desc_0`

<a id="kw-pvpbluff"></a>

### 현혹 · `PVPBluff`

![현혹](../images/keyword-icons/inline/battle_card_buff_023.png)

- 본문 표기: 현혹
- 색상: `orangeword (#c48662)`
- 아이콘: `Battle_Card_Buff_023` · 설명 연결: 상태 146202 · 본문 관측: 2회

> 해당 각성체가 세속의 소란에서 벗어난 듯한 느낌을 받게 한다.
> ·턴 종료 전까지 어떠한 행동도 할 수 없으며, 피해를 99% 감소시킨다. 대상에게 내성이 없을 경우 대상에게 내성을 부여한다.
> ·효과 종료 시 아군 전체에게 동일한 스택 수만큼의 순수 피해를 입힌다.
> ·부여 시 대상이 내성을 보유하고 있을 경우, 즉시 기만을 종료하고 대상에게 입히는 피해가 2배가 된다.

설명 근거: `State_146202_Desc`

본문 근거 예시: `Text_KR.Text_Skill:Skill_145975_Desc_1`

<a id="kw-decaydye"></a>

### 환세 염료 · `DecayDye`

![환세 염료](../images/keyword-icons/inline/battle_card_buff_016.png)

- 본문 표기: 환세 염료
- 색상: `별도 색상 지정 없음`
- 아이콘: `Battle_Card_Buff_016` · 설명 연결: 상태 99336 · 본문 관측: 4회

> 「화가」가 그림을 그리는 데 사용되는 염료로, 스킬 효과를 강화할 수 있다. 최대 10스택까지 가능하다.

설명 근거: `State_99336_Desc`

본문 근거 예시: `Text_KR.Text_Skill:Skill_99119_Desc`, `Text_KR.Text_Skill:Skill_99121_Desc`, `Text_KR.Text_State:State_99336_Name`

<a id="kw-huoyankeywords"></a>

### 활염 · `HuoyanKeywords`

![활염](../images/keyword-icons/inline/battle_card_buff_057.png)

- 본문 표기: 활염
- 색상: `redword (#bb646d)`
- 아이콘: `Battle_Card_Buff_057` · 설명 연결: 상태 98488 · 본문 관측: 9회

> 「활염」 1스택당 카드가 주는 최종 피해, 실드, 광기, 힘이 30% 증가하며, 최대 3스택까지 중첩된다. 「활염」을 보유한 카드는 「유지」를 획득하며, 사용 후 모든 「활염」을 소모하고 1스택의 「활염」을 손에 있는 다른 케티구라의 명령 카드 1장으로 전이한다.

설명 근거: `State_98488_Desc`

본문 근거 예시: `Text_KR.Text_Skill:Skill_97912_Desc_2`, `Text_KR.Text_Skill:Skill_97918_Desc`, `Text_KR.Text_Skill:Skill_97915_Desc_15`

<a id="kw-huoyankeywords1"></a>

### 활염 1 · `HuoyanKeywords1`

![활염 1](../images/keyword-icons/inline/battle_card_buff_057.png)

- 본문 표기: 활염 1
- 색상: `redword (#bb646d)`
- 아이콘: `Battle_Card_Buff_057` · 설명 연결: 상태 98487 · 본문 관측: 2회

> 이 카드가 주는 실드와 광기가 \[DescArg2\]% 증가하며, 최종 피해와 힘이 \[DescArg1\]% 증가하고, 「유지」를 획득한다. 사용 후 모든 「활염」을 소모하고 1스택의 「활염」을 손에 있는 다른 케티구라의 명령 카드 1장으로 전이한다.

설명 근거: `State_98487_Desc`

본문 근거 예시: `Text_KR.Text_State:State_98466_Name`, `Text_KR.Text_State:State_98487_Name`

<a id="kw-huoyankeywords2"></a>

### 활염 2 · `HuoyanKeywords2`

![활염 2](../images/keyword-icons/inline/battle_card_buff_057.png)

- 본문 표기: 활염 2
- 색상: `redword (#bb646d)`
- 아이콘: `Battle_Card_Buff_057` · 설명 연결: 상태 98485 · 본문 관측: 2회

> 이 카드가 주는 실드와 광기가 \[DescArg2\]% 증가하며, 최종 피해와 힘이 \[DescArg1\]% 증가하고, 「유지」를 획득한다. 사용 후 모든 「활염」을 소모하고 1스택의 「활염」을 손에 있는 다른 케티구라의 명령 카드 1장으로 전이한다.

설명 근거: `State_98485_Desc`

본문 근거 예시: `Text_KR.Text_State:State_98485_Name`, `Text_KR.Text_State:State_98470_Name`

<a id="kw-huoyankeywords3"></a>

### 활염 3 · `HuoyanKeywords3`

![활염 3](../images/keyword-icons/inline/battle_card_buff_057.png)

- 본문 표기: 활염 3
- 색상: `redword (#bb646d)`
- 아이콘: `Battle_Card_Buff_057` · 설명 연결: 상태 98486 · 본문 관측: 2회

> 이 카드가 주는 실드와 광기가 \[DescArg2\]% 증가하며, 최종 피해와 힘이 \[DescArg1\]% 증가하고, 「유지」를 획득한다. 사용 후 모든 「활염」을 소모하고 1스택의 「활염」을 손에 있는 다른 케티구라의 명령 카드 1장으로 전이한다.

설명 근거: `State_98486_Desc`

본문 근거 예시: `Text_KR.Text_State:State_98486_Name`, `Text_KR.Text_State:State_98468_Name`

<a id="kw-timebeacon"></a>

### 회귀 · `TimeBeacon`

![회귀](../images/keyword-icons/inline/battle_card_buff_038.png)

- 본문 표기: 회귀
- 색상: `whiteword (#ffffff)`
- 아이콘: `Battle_Card_Buff_038` · 설명 연결: 상태 25165 · 본문 관측: 9회

> 순행·라모나 명령 카드의 고유 추가 효과로, 음엔트로피 3스택을 보유할 때 발동된다. 회환은 다음 전투로 이월된다.

설명 근거: `State_25165_Desc`

본문 근거 예시: `Text_KR.Text_Skill:Skill_4388_Desc_15`, `Text_KR.Text_Skill:Skill_4587_BattleDesc`, `Text_KR.Text_Skill:Skill_4017_Desc`

<a id="kw-recycle"></a>

### 회수 · `Recycle`

![회수](../images/keyword-icons/inline/battle_card_buff_016.png)

- 본문 표기: 회수
- 색상: `orangeword (#c48662)`
- 아이콘: `Battle_Card_Buff_016` · 설명 연결: 상태 146079 · 본문 관측: 1회

> 이 카드가 손패에서 나간 후 손패로 돌아온다.

설명 근거: `State_146079_Desc`

본문 근거 예시: `Text_KR.Text_State:State_146079_Name`

<a id="kw-monstertimebeacon"></a>

### 회전 · `MonsterTimeBeacon`

![회전](../images/keyword-icons/inline/battle_card_buff_038.png)

- 본문 표기: 회귀
- 색상: `whiteword (#ffffff)`
- 아이콘: `Battle_Card_Buff_038` · 설명 연결: 상태 127272 · 본문 관측: 17회

> 상한 3스택. 「각자」가 의도를 발동할 때 회귀 3스택을 보유하고 있다면, 회귀 효과가 발동되고 회귀가 초기화되며 부정 상태가 제거된다.

설명 근거: `State_127272_Desc`

본문 근거 예시: `Text_KR.Text_Skill:Skill_127250_Desc`, `Text_KR.Text_Skill:Skill_127252_Desc`, `Text_KR.Text_Skill:Skill_127249_Desc`

<a id="kw-pvpsacrificekeywords"></a>

### 희생 · `PVPSacrificeKeyWords`

![희생](../images/keyword-icons/inline/battle_card_buff_041.png)

- 본문 표기: 희생 / 헌신의 제사 / 헌제
- 색상: `blueword (#76aac8)`
- 아이콘: `Battle_Card_Buff_041` · 설명 연결: 상태 119051 · 본문 관측: 9회

> 턴 종료 시 발동하며, 발동 시 동일한 스택 수만큼의 순수 피해를 받고 스택의 절반을 제거한다. 해제 불가.

설명 근거: `State_119051_Desc`

본문 근거 예시: `Text_KR.Text_Skill:Skill_119045_Desc_1`, `Text_KR.Text_Skill:Skill_45475_Desc_1`, `Text_KR.Text_Skill:Skill_45464_Desc_1`

<a id="kw-sacrificekeyword"></a>

### 희생 · `SacrificeKeyWord`

![희생](../images/keyword-icons/inline/battle_card_buff_041.png)

- 본문 표기: 희생 / 헌제 / 헌신의 제사
- 색상: `blueword (#76aac8)`
- 아이콘: `Battle_Card_Buff_041` · 설명 연결: 상태 36152 · 본문 관측: 80회

> 턴 종료 시 스택 수만큼 피해를 받은 후, 희생 스택의 50%를 제거한다. 희생은 다음 전투로 이월된다.

설명 근거: `State_36152_Desc`

본문 근거 예시: `Text_KR.Text_AwakerConfig:AwakerConfig_15576_AwakerIntroduction`, `Text_KR.Text_RelicConfig:RelicConfig_119371_BattleDesc`, `Text_KR.Text_RelicConfig:RelicConfig_119371_Desc`

<a id="kw-powericonkeywords"></a>

### 힘 · `PowerIconKeywords`

![힘](../images/keyword-icons/inline/battle_card_buff_021.png)

- 본문 표기: 힘 / 임시 힘
- 색상: `greenword (#71aa86)`
- 아이콘: `Battle_Card_Buff_021` · 설명 연결: 상태 3281 · 본문 관측: 970회

> 주는 능동 피해를 증가시킨다.

설명 근거: `State_3281_Desc`

본문 근거 예시: `Text_KR.Text_AwakerConfig:AwakerConfig_15577_AwakerIntroduction`, `Text_KR.Text_AwakerConfig:AwakerConfig_15564_AwakerIntroduction`, `Text_KR.Text_AwakerConfig:AwakerConfig_15598_AwakerIntroduction`

<a id="kw-pvppowericonkeywords"></a>

### 힘 · `PVPPowerIconKeywords`

![힘](../images/keyword-icons/inline/battle_card_buff_021.png)

- 본문 표기: 힘
- 색상: `greenword (#71aa86)`
- 아이콘: `Battle_Card_Buff_021` · 설명 연결: 상태 19521 · 본문 관측: 6회

> 스택당 이번 전투에서 주는 모든 피해가 1pt 증가하며, 해제할 수 없다.

설명 근거: `State_19521_Desc`

본문 근거 예시: `Text_KR.Text_Skill:Skill_145559_Desc_1`, `Text_KR.Text_Skill:Skill_45259_Desc_1`, `Text_KR.Text_Skill:Skill_145560_Desc_1`

<a id="kw-exhaustioniconkeywords"></a>

### 힘 감소 · `ExhaustionIconKeywords`

![힘 감소](../images/keyword-icons/inline/battle_card_buff_037.png)

- 본문 표기: 힘 / 고갈 / 힘 감소 / 쇠약
- 색상: `purpleword (#af6bb0)`
- 아이콘: `Battle_Card_Buff_037` · 설명 연결: 상태 2549 · 본문 관측: 116회

> 주는 능동 피해와 촉수 피해가 감소한다.

설명 근거: `State_2549_Desc`

본문 근거 예시: `Text_KR.Text_RelicConfig:RelicConfig_98409_Desc`, `Text_KR.Text_RelicConfig:RelicConfig_98409_BattleDesc`, `Text_KR.Text_RelicConfig:RelicConfig_98398_Desc`

<a id="kw-pvpexhaustionkeywords"></a>

### 힘 감소 · `PVPExhaustionKeywords`

![힘 감소](../images/keyword-icons/inline/battle_card_buff_037.png)

- 본문 표기: 본문 사용 미관측
- 색상: `purpleword (#af6bb0)`
- 아이콘: `Battle_Card_Buff_037` · 설명 연결: 상태 47827 · 본문 관측: 미관측

> 스택당 이번 전투에서 주는 모든 피해가 1pt 감소하며, 해제할 수 없다.

설명 근거: `State_47827_Desc`

## 부록 A — 아이콘은 있으나 고정 설명 연결이 없는 27개 태그

아이콘이 있다고 모두 클릭형 키워드인 것은 아니다. 아래 항목은 StateLink·SkillLink가 없으므로, 동명 상태를 찾아 임의로 설명을 연결하지 않았다.

| 아이콘 | 본문 표기 | 태그 | 색상 | 관측 |
|---|---|---|---|---|
| ![공포의 피](../images/keyword-icons/inline/battle_card_buff_016.png) | 공포의 피 | `B01AFKeyWord1` | `orangeword (#c48662)` | 2회 |
| ![공포의 피](../images/keyword-icons/inline/battle_card_buff_016.png) | 공포의 피 | `B01AFKeyWordQ1` | `orangeword (#c48662)` | 2회 |
| ![깊은 잠의 반격](../images/keyword-icons/inline/battle_card_buff_016.png) | 깊은 잠의 반격 | `JingjinvwangKeywords1` | `orangeword (#c48662)` | 7회 |
| ![만물의 이치를 통달함](../images/keyword-icons/inline/battle_card_buff_016.png) | 만물의 이치를 통달함 | `TongxiaoKeywords` | `orangeword (#c48662)` | 1회 |
| ![부패의 피](../images/keyword-icons/inline/battle_card_buff_016.png) | 부패의 피 | `B01AFKeyWord2` | `orangeword (#c48662)` | 2회 |
| ![부패의 피](../images/keyword-icons/inline/battle_card_buff_016.png) | 부패의 피 | `B01AFKeyWordQ2` | `orangeword (#c48662)` | 2회 |
| ![생식의 피](../images/keyword-icons/inline/battle_card_buff_016.png) | 생식의 피 | `B01AFKeyWord3` | `orangeword (#c48662)` | 2회 |
| ![생식의 피](../images/keyword-icons/inline/battle_card_buff_016.png) | 생식의 피 | `B01AFKeyWordQ3` | `orangeword (#c48662)` | 2회 |
| ![영역 숙련](../images/keyword-icons/inline/battle_card_buff_034.png) | 영역 숙련 / 계역 숙련 | `ProficientInRealmsIconKeywords` | `greenword (#71aa86)` | 34회 |
| ![임시 강화 \[DescArg1\]](../images/keyword-icons/inline/battle_card_buff_016.png) | 임시 강화 \[DescArg1\] | `TempPowerKeywords1` | `orangeword (#c48662)` | 1회 |
| ![잠결의 메아리](../images/keyword-icons/inline/battle_card_buff_016.png) | 잠결의 메아리 | `JingjinvwangKeywords2` | `orangeword (#c48662)` | 7회 |
| ![적응 \[DescArg1\]](../images/keyword-icons/inline/battle_card_buff_016.png) | 적응 \[DescArg1\] | `AdaptKeywords1` | `orangeword (#c48662)` | 1회 |
| ![집적](../images/keyword-icons/inline/battle_card_buff_016.png) | 집적 / 집적 \[Layer\] / 강제 보존 | `RetainIconKeywordsColour` | `orangeword (#c48662)` | 5회 |
| ![최면 맥락](../images/keyword-icons/inline/battle_card_buff_016.png) | 최면 맥락 | `JingjinvwangKeywords3` | `orangeword (#c48662)` | 4회 |
| ![추론](../images/keyword-icons/inline/battle_card_buff_016.png) | 추론 | `TuiyanColour` | `orangeword (#c48662)` | 1회 |
| ![축복](../images/keyword-icons/inline/battle_card_buff_026.png) | 축복 | `BlessingIconKeywords` | `greenword (#71aa86)` | 1회 |
| ![한국어 표기 미확인](../images/keyword-icons/inline/battle_card_buff_031.png) | 본문 사용 미관측 | `BaseDamageIconKeywords` | `redword (#bb646d)` | 미관측 |
| ![한국어 표기 미확인](../images/keyword-icons/inline/battle_card_buff_017.png) | 본문 사용 미관측 | `CritChanceIconKeywords` | `orangeword (#c48662)` | 미관측 |
| ![한국어 표기 미확인](../images/keyword-icons/inline/battle_card_buff_007.png) | 본문 사용 미관측 | `CriticalDamageIconKeywords` | `orangeword (#c48662)` | 미관측 |
| ![한국어 표기 미확인](../images/keyword-icons/inline/battle_card_buff_011.png) | 본문 사용 미관측 | `DelayedReplyIconKeywords` | `greenword (#71aa86)` | 미관측 |
| ![한국어 표기 미확인](../images/keyword-icons/inline/battle_card_buff_032.png) | 본문 사용 미관측 | `EnergyIconKeywords` | `yellowword (#b6ad65)` | 미관측 |
| ![한국어 표기 미확인](../images/keyword-icons/inline/battle_card_buff_016.png) | 본문 사용 미관측 | `ExclamationPointIconKeywords` | `orangeword (#c48662)` | 미관측 |
| ![한국어 표기 미확인](../images/keyword-icons/inline/battle_card_buff_033.png) | 본문 사용 미관측 | `LuckyEngravingRateIconKeywords` | `greenword (#71aa86)` | 미관측 |
| ![한국어 표기 미확인](../images/keyword-icons/inline/battle_card_buff_035.png) | 본문 사용 미관측 | `SilverKeyEnergyIconKeywords` | `silveryword (#6baa83)` | 미관측 |
| ![한국어 표기 미확인](../images/keyword-icons/inline/battle_card_buff_035.png) | 본문 사용 미관측 | `SilverKeyIconKeywords` | `whiteword (#ffffff)` | 미관측 |
| ![한국어 표기 미확인](../images/keyword-icons/inline/battle_card_buff_020.png) | 본문 사용 미관측 | `VampirismIconKeywords` | `greenword (#71aa86)` | 미관측 |
| ![활염](../images/keyword-icons/inline/battle_card_buff_057.png) | 활염 | `HuoyanKeywords4` | `redword (#bb646d)` | 8회 |

## 부록 B — 아이콘 없이 설명만 연결되는 391개 태그

카드 이름·별도 상태 설명 링크를 포함한다. 요청한 “본문 아이콘 + 설명” 사전과 구분하되, 누락으로 오인하지 않도록 전부 남긴다. 이미지 없음은 실제 설정값이며, 상태창 아이콘을 대신 넣지 않는다.

| 표시명·본문 표기 | 태그 | 연결 대상 | 색상 | 관측 |
|---|---|---|---|---|
| 각성 | `DerivativeCardKeywords_100` | 스킬 70825 | `별도 색상 지정 없음` | 1회 |
| 각성Ⅰ | `Zhennu` | 스킬 70015 | `SchoolQuialty,Dark (#5EF2FF)` | 미관측 |
| 각성Ⅱ | `Zhennu2` | 스킬 70013 | `SchoolQuialty,Dark (#5EF2FF)` | 미관측 |
| 각성Ⅲ | `Zhennu3` | 스킬 70014 | `SchoolQuialty,Dark (#5EF2FF)` | 미관측 |
| 각인: 고급 합주<br>본문: “고급 앙상블” | `SeniorEnsembleKeywords` | 상태 48013 | `별도 색상 지정 없음` | 1회 |
| 각인: 합주<br>본문: “합주” / 「합주」 | `EnsembleKeywords` | 상태 48012 | `별도 색상 지정 없음` | 6회 |
| 갈림길을 가리키는 나침반<br>본문: 잘못된 길로 향하는 나침반 | `PVPCompassKeywords` | 상태 143409 | `orangeword (#c48662)` | 2회 |
| 감염된 쥐<br>본문:  | `PVPDerivativeCardKeywords_7` | 스킬 45681 | `별도 색상 지정 없음` | 2회 |
| 감춰진 고통 | `PVPAcheKeywords` | 상태 91797 | `redword (#bb646d)` | 2회 |
| 거대한 검의 위엄<br>본문: 「거대한 검의 위엄」 / "거대한 검의 위엄" | `DerivativeCardKeywords_17` | 스킬 4638 | `별도 색상 지정 없음` | 8회 |
| 거인의 공포<br>본문: 「거인의 공포」 | `DerivativeCardKeywords_35` | 스킬 4190 | `별도 색상 지정 없음` | 1회 |
| 검은 깃털 | `DerivativeCardKeywords_107` | 스킬 89779 | `별도 색상 지정 없음` | 18회 |
| 검은 깃털<br>본문: 「검은 깃털」 / '검은 깃털' | `PVPDerivativeCardKeywords_16` | 스킬 89428 | `별도 색상 지정 없음` | 5회 |
| 검은 양초 | `Heizhu` | 상태 67631 | `RedQuality,Dark (#FF7272)` | 1회 |
| 검의 뼈 | `DerivativeCardKeywords_157` | 스킬 146113 | `별도 색상 지정 없음` | 6회 |
| 결정 | `SelectKeywords` | 상태 55811 | `orangeword (#c48662)` | 미관측 |
| 결투의 계약<br>본문: 덤벼라! | `PVPDerivativeCardKeywords_32` | 스킬 145562 | `별도 색상 지정 없음` | 1회 |
| 경계 | `AlertColour` | 상태 2712 | `blueword (#76aac8)` | 1회 |
| 경계 | `DerivativeCardKeywords_74` | 스킬 59665 | `별도 색상 지정 없음` | 1회 |
| 경계 | `PVPAlertKeywords` | 상태 22405 | `blueword (#76aac8)` | 1회 |
| 경련<br>본문: 「기절」 / “경련” | `DerivativeCardKeywords_3` | 스킬 4826 | `별도 색상 지정 없음` | 11회 |
| 고급 영감<br>본문: 상급 영감 / 「고급 영감」 | `DerivativeCardKeywords_115` | 스킬 47484 | `별도 색상 지정 없음` | 7회 |
| 고백 | `TrueConfess` | 상태 100328 | `별도 색상 지정 없음` | 1회 |
| 고정 피해<br>본문: 고정 피해 / 잠금 피해 | `RealDamage` | 상태 149418 | `orangeword (#c48662)` | 21회 |
| 고통의 근원·지식<br>본문: 「고통의 근원·지식」 | `PVPDerivativeCardKeywords_18` | 스킬 117178 | `별도 색상 지정 없음` | 1회 |
| 공포의 피<br>본문:  | `DerivativeCardKeywords_149` | 스킬 48814 | `별도 색상 지정 없음` | 4회 |
| 공허 | `PVPVoidKeywords` | 상태 80809 | `redword (#bb646d)` | 3회 |
| 과거의 메아리<br>본문: 「과거의 메아리」 / 과거의 메아리 | `DerivativeCardKeywords_39` | 스킬 4672 | `별도 색상 지정 없음` | 6회 |
| 과식 | `WormGrowth` | 상태 145228 · 원본 설명 없음 | `redword (#bb646d)` | 1회 |
| 관통<br>본문: 관통 / 관통 1 / 꿰뚫기 1 / 贯穿 2 | `PVPPenetrateKeywords` | 상태 21720 | `orangeword (#c48662)` | 25회 |
| 관통 피해 | `PunctureDamagewords2` | 상태 2472 | `redword (#bb646d)` | 미관측 |
| 관통 피해 | `PVPPunctureDamagewords` | 상태 22134 | `orangeword (#c48662)` | 5회 |
| 광기의 뼈 | `DerivativeCardKeywords_155` | 스킬 146112 | `별도 색상 지정 없음` | 4회 |
| 광란<br>본문: 발광 / 광란 / 임시 발광 | `MadnessColour` | 상태 3135 | `greenword (#71aa86)` | 6회 |
| 교란의 건트<br>본문:  | `DerivativeCardKeywords_146` | 스킬 143557 | `별도 색상 지정 없음` | 8회 |
| 군중의 노래 | `Qunmengzhige` | 상태 67606 | `OrangeQuality,Dark (#e4b756)` | 1회 |
| 군중의 노래+ | `Jiaqunmengzhige` | 상태 67659 | `SchoolQuialty,Dark (#5EF2FF)` | 1회 |
| 그림자의 메아리<br>본문: 「그림자의 메아리」 / 「유영의 메아리」 / 그림자의 메아리 / 유영의 메아리 | `DerivativeCardKeywords_1` | 스킬 4433 | `별도 색상 지정 없음` | 17회 |
| 금지된 진실<br>본문: 금단의 진실 | `DerivativeCardKeywords_134` | 스킬 131192 | `별도 색상 지정 없음` | 2회 |
| 긍정 상태 밀쳐내기<br>본문: 밀쳐내기 | `PVPRepelKeywords` | 상태 94540 | `orangeword (#c48662)` | 2회 |
| 기계 무장-수축<br>본문: 「기계 무장-수축」 | `DerivativeCardKeywords_14` | 스킬 4065 | `별도 색상 지정 없음` | 4회 |
| 기계 무장-전개<br>본문: 「기계 무장-전개」 | `DerivativeCardKeywords_13` | 스킬 4663 | `별도 색상 지정 없음` | 4회 |
| 기묘한 긍정 효과<br>본문: 기묘한 긍정 효과 / 기묘한 버프 | `MysterybuffKeywords` | 상태 50375 | `orangeword (#c48662)` | 2회 |
| 기묘한 부정 효과 | `MysterydebuffKeywords` | 상태 60386 | `orangeword (#c48662)` | 4회 |
| 기묘한 요리<br>본문: 「기묘한 요리」 | `DerivativeCardKeywords_42` | 스킬 49215 | `별도 색상 지정 없음` | 8회 |
| 기묘한 요리<br>본문: 「기묘한 요리」 | `DerivativeCardKeywords_43` | 스킬 49216 | `별도 색상 지정 없음` | 1회 |
| 기묘한 효과 | `PVPWonderfulEffectKeywords` | 상태 47844 | `yellowword (#b6ad65)` | 20회 |
| 기억 공명<br>본문: 「기억 공명」 | `DerivativeCardKeywords_112` | 스킬 95819 | `별도 색상 지정 없음` | 1회 |
| 기이한 갈고리 발톱 | `Guguaigouzhua` | 상태 67656 | `RedQuality,Dark (#FF7272)` | 1회 |
| 기적의 축복 | `DerivativeCardKeywords_160` | 스킬 144492 | `별도 색상 지정 없음` | 미관측 |
| 기합 선율 | `XushiAKeywords` | 상태 60567 | `Color24CardLost (#676e73)` | 2회 |
| 기합 선율 | `XushiBKeywords` | 상태 60570 | `Color24CardLost (#676e73)` | 3회 |
| 깊은 잠 | `DerivativeCardKeywords_99` | 스킬 70826 | `별도 색상 지정 없음` | 1회 |
| 꽃바람<br>본문: 꽃눈보라 | `DerivativeCardKeywords_142` | 스킬 133953 | `별도 색상 지정 없음` | 1회 |
| 끈적이는 밀랍<br>본문: 「끈적이는 밀랍」 / 끈적이는 밀랍 | `DerivativeCardKeywords_32` | 스킬 4418 | `별도 색상 지정 없음` | 9회 |
| 끓어오르는 피<br>본문: 「비혈」 | `PVPDerivativeCardKeywords_10` | 스킬 45684 | `별도 색상 지정 없음` | 1회 |
| 끝없는 공격<br>본문: “끝없는 공격” | `DerivativeCardKeywords_49` | 스킬 50392 | `별도 색상 지정 없음` | 2회 |
| 끝없는 실타래<br>본문: 끝없는 실 | `DerivativeCardKeywords_137` | 스킬 133381 | `별도 색상 지정 없음` | 2회 |
| 끝없는 실타래<br>본문: 끝없는 실 | `DerivativeCardKeywords_144` | 스킬 140665 | `별도 색상 지정 없음` | 2회 |
| 끝없는 은심의 보물창고<br>본문: “무한은심 보물창고” / 「무한 은심 보물창고」 | `DerivativeCardKeywords_105` | 스킬 71652 | `별도 색상 지정 없음` | 3회 |
| 끝없는 폭염<br>본문: 폭발 초과 / 끝없는 폭염 | `Overload` | 스킬 98508 | `별도 색상 지정 없음` | 3회 |
| 네 날개의 성장<br>본문: 「네 개의 날개가 자라나다」 | `DerivativeCardKeywords_76` | 스킬 66355 | `별도 색상 지정 없음` | 1회 |
| 녹색 불꽃<br>본문: 「녹염」 | `DerivativeCardKeywords_18` | 스킬 4023 | `별도 색상 지정 없음` | 4회 |
| 녹슨 메스 | `Xiushiliuyedao` | 상태 67660 | `WhiteQuality,Dark (#FFFFFF)` | 1회 |
| 놀라운 마술 | `PVPAmazingMagicKeywords` | 상태 47833 | `orangeword (#c48662)` | 2회 |
| 대검·고래 낙하<br>본문: 「대검·고래 낙하」 | `DerivativeCardKeywords_153` | 스킬 146012 | `별도 색상 지정 없음` | 12회 |
| 대죄 | `DerivativeCardKeywords_158` | 스킬 147941 | `별도 색상 지정 없음` | 3회 |
| 도박의 지혜 | `Rolling1` | 스킬 130507 | `별도 색상 지정 없음` | 미관측 |
| 도박의 지혜 | `Rolling2` | 스킬 130508 | `별도 색상 지정 없음` | 미관측 |
| 도박의 지혜 | `Rolling3` | 스킬 130509 | `별도 색상 지정 없음` | 미관측 |
| 도박의 지혜 | `Rolling4` | 스킬 130506 | `별도 색상 지정 없음` | 미관측 |
| 도해자의 광란<br>본문: 도해자 광란 / 도해자의 광란 / 도해자광란 / 바다를 건너는 자의 광란 | `Kuangluan` | 상태 97119 | `orangeword (#c48662)` | 7회 |
| 도해자의 저주<br>본문: 도해자의 저주 / 도해자 저주 / 도해자 저주원한 | `SeastriderCurse` | 상태 120929 | `orangeword (#c48662)` | 4회 |
| 독성 감염<br>본문: “독성 감염” | `DerivativeCardKeywords_7` | 스킬 4328 | `별도 색상 지정 없음` | 4회 |
| 독성 발작<br>본문: “독성 발작” | `DerivativeCardKeywords_8` | 스킬 4359 | `별도 색상 지정 없음` | 2회 |
| 돌<br>본문: 「돌」 | `DerivativeCardKeywords_25` | 스킬 4647 | `별도 색상 지정 없음` | 3회 |
| 돌격<br>본문: 돌격 / 습격 | `PVPRaidKeywords` | 상태 22702 | `orangeword (#c48662)` | 4회 |
| 동결<br>본문: 냉동 / 동결 | `Dongjie` | 상태 62338 | `orangeword (#c48662)` | 2회 |
| 두 날개의 맥동<br>본문: 「두 개의 날개가 펼쳐지다」 | `DerivativeCardKeywords_75` | 스킬 66351 | `별도 색상 지정 없음` | 2회 |
| 따뜻한 가정<br>본문: “따뜻한 가정” / 「따뜻한 가정」 | `DerivativeCardKeywords_57` | 스킬 52319 | `별도 색상 지정 없음` | 2회 |
| 로스트<br>본문: 잃어버린 길 / 로스트 | `LostWay` | 상태 98912 | `별도 색상 지정 없음` | 5회 |
| 로열 마리 초콜릿 | `Caroboo_Tips` | 상태 147797 | `별도 색상 지정 없음` | 2회 |
| 리아의 동전<br>본문: 「리아의 동전」 | `PVPDerivativeCardKeywords_29` | 스킬 78915 | `별도 색상 지정 없음` | 1회 |
| 리아의 코인<br>본문: 「리아의 코인」 | `DerivativeCardKeywords_133` | 스킬 130493 | `별도 색상 지정 없음` | 1회 |
| 만상 영지의 신비 의식 | `Wanxianglingzhimiyi` | 상태 67657 | `OrangeQuality,Dark (#e4b756)` | 1회 |
| 머릿속의 소리 | `PVPDerivativeCardKeywords_23` | 스킬 19499 | `별도 색상 지정 없음` | 2회 |
| 명계<br>본문: 운명의 계약 | `FatePact` | 상태 119105 | `별도 색상 지정 없음` | 3회 |
| 명륜<br>본문: 명륜 / 운명의 바퀴 / 운명 바퀴 | `PVPWeaponKeywords` | 상태 21765 | `orangeword (#c48662)` | 318회 |
| 모독의 환영<br>본문: 「모독의 환영」 | `DerivativeCardKeywords_36` | 스킬 4248 | `별도 색상 지정 없음` | 3회 |
| 무거운 액자 | `Chenzhonghuakuang` | 상태 67677 | `OrangeQuality,Dark (#e4b756)` | 1회 |
| 무거운 자물쇠 | `Zhongsuo` | 상태 67641 | `WhiteQuality,Dark (#FFFFFF)` | 1회 |
| 무명 신의 베일 | `Wumingzhishenmiansha` | 상태 67704 | `OrangeQuality,Dark (#e4b756)` | 1회 |
| 문명의 빛 | `Wwenmingzhiguang` | 상태 67620 | `WhiteQuality,Dark (#FFFFFF)` | 1회 |
| 미래 찬가 | `C01EXCardKeyWord2` | 상태 54044 | `orangeword (#c48662)` | 1회 |
| 미사그 배지 | `Misagehuizhang` | 상태 67703 | `WhiteQuality,Dark (#FFFFFF)` | 1회 |
| 미학 원리 | `Meixueyuanli` | 상태 67636 | `WhiteQuality,Dark (#FFFFFF)` | 1회 |
| 미항의 빛<br>본문: 항해의 빛 | `LightOfTheLost` | 상태 100694 | `별도 색상 지정 없음` | 1회 |
| 미혹의 풍령 | `Guhuofengling` | 상태 67649 | `RedQuality,Dark (#FF7272)` | 1회 |
| 반격 | `RetaliateColour` | 상태 3825 | `blueword (#76aac8)` | 1회 |
| 발견 | `PVPDiscoveryKeyWords` | 상태 141989 | `orangeword (#c48662)` | 2회 |
| 방위 나침반 | `Dingxiangluopan` | 상태 67673 | `WhiteQuality,Dark (#FFFFFF)` | 1회 |
| 배아<br>본문: 「배아」 / 배아 | `DerivativeCardKeywords_2` | 스킬 4052 | `별도 색상 지정 없음` | 6회 |
| 뱀의 허물 | `Guaishecantui` | 상태 67674 | `OrangeQuality,Dark (#e4b756)` | 1회 |
| 번데기화<br>본문: 「번데기화」 | `DerivativeCardKeywords_53` | 스킬 50395 | `별도 색상 지정 없음` | 1회 |
| 번데기화 | `DerivativeCardKeywords_55` | 스킬 50395 | `별도 색상 지정 없음` | 미관측 |
| 번식 축전繁育庆典<br>본문: 번식 축전 | `BreedingKeywords2` | 상태 140135 | `redword (#bb646d)` | 2회 |
| 번식의 이치 | `Chapter5_Monster_Support1` | 상태 59526 | `별도 색상 지정 없음` | 1회 |
| 벚꽃 만개 | `DerivativeCardKeywords_141` | 스킬 133952 | `별도 색상 지정 없음` | 1회 |
| 변색 구속복<br>본문: 변색 구속복 β | `Biansejushufu` | 상태 66565 | `WhiteQuality,Dark (#FFFFFF)` | 1회 |
| 별들의 술<br>본문: 별빛의 술 | `Qunxingzhijiu` | 상태 66522 | `OrangeQuality,Dark (#e4b756)` | 1회 |
| 별들의 술 + | `Jiaqunxingzhijiu` | 상태 67647 | `SchoolQuialty,Dark (#5EF2FF)` | 1회 |
| 보유 | `PVPHoldingKeywords` | 상태 47845 | `orangeword (#c48662)` | 8회 |
| 봄의 제전 | `Chunzhiji` | 상태 66561 | `WhiteQuality,Dark (#FFFFFF)` | 1회 |
| 봄의 편지<br>본문: 봄의 소식 | `DerivativeCardKeywords_140` | 스킬 133951 | `별도 색상 지정 없음` | 1회 |
| 봉인<br>본문: 광기의 봉인 / 봉인 / 추격 봉인 / 카드 봉인 | `Seal1` | 상태 122596 | `purpleword (#af6bb0)` | 4회 |
| 봉헌 | `SacrificialMark` | 상태 145229 | `whiteword (#ffffff)` | 1회 |
| 부패의 녹색 불꽃<br>본문: 「부패 녹염」 / 부패 녹염 | `DerivativeCardKeywords_19` | 스킬 4824 | `별도 색상 지정 없음` | 2회 |
| 부패의 피<br>본문:  | `DerivativeCardKeywords_150` | 스킬 48813 | `별도 색상 지정 없음` | 4회 |
| 부활의 고치<br>본문: “부활의 고치” | `DerivativeCardKeywords_52` | 스킬 50396 | `별도 색상 지정 없음` | 2회 |
| 불굴의 전의 | `DerivativeCardKeywords_81` | 스킬 4807 | `별도 색상 지정 없음` | 미관측 |
| 불굴의 전의 β<br>본문: “불굴의 전의 β” / 불굴의 전의 β」 | `DerivativeCardKeywords_97` | 스킬 68874 | `별도 색상 지정 없음` | 2회 |
| 불규칙한 형태 | `DerivativeCardKeywords_16` | 스킬 4794 | `별도 색상 지정 없음` | 미관측 |
| 불균형한 저울 | `Shihengdetianping` | 상태 67634 | `WhiteQuality,Dark (#FFFFFF)` | 1회 |
| 불멸의 장례식 | `PVPDerivativeCardKeywords_13` | 스킬 45367 | `별도 색상 지정 없음` | 2회 |
| 불완전한 얼굴 | `Canquemiankong` | 상태 66553 | `RedQuality,Dark (#FF7272)` | 1회 |
| 불평등한 교환<br>본문: 「불평등한 교환」 / 불평등한 교환 | `PVPDerivativeCardKeywords_11` | 스킬 19343 | `별도 색상 지정 없음` | 7회 |
| 비둘기 깃털 부채 | `Geyushan` | 상태 67605 | `WhiteQuality,Dark (#FFFFFF)` | 1회 |
| 비둘기 손수건<br>본문:  / 「영감」 | `PVPDerivativeCardKeywords_4` | 스킬 45680 | `별도 색상 지정 없음` | 4회 |
| 빛나는 속임수 주사위<br>본문: 빛나는 편방 주사위 | `C05_yansheng2` | 스킬 57859 | `별도 색상 지정 없음` | 2회 |
| 빛나는 인간성의 빛<br>본문: “빛나는 인간성의 빛” | `DerivativeCardKeywords_71` | 스킬 65452 | `별도 색상 지정 없음` | 2회 |
| 빛바랜 사진+ | `Jiatuisezhaopian` | 상태 67672 | `SchoolQuialty,Dark (#5EF2FF)` | 1회 |
| 뼈를 침식하는 포옹 | `PVPDerivativeCardKeywords_21` | 스킬 45269 | `별도 색상 지정 없음` | 2회 |
| 사냥<br>본문: 围猎 | `BattueKeywords1` | 상태 143336 | `blueword (#76aac8)` | 1회 |
| 사냥<br>본문: "사냥" | `Pangtuosihuodong_Attack` | 상태 143542 | `별도 색상 지정 없음` | 1회 |
| 사냥의 건트<br>본문:  | `DerivativeCardKeywords_147` | 스킬 143558 | `별도 색상 지정 없음` | 8회 |
| 사멸의 녹색 불꽃<br>본문: 사멸 녹염 | `DerivativeCardKeywords_20` | 스킬 4367 | `별도 색상 지정 없음` | 1회 |
| 산호 기생 | `DerivativeCardKeywords_78` | 스킬 36030 | `별도 색상 지정 없음` | 미관측 |
| 살려줘<br>본문: 「살려줘」 | `DerivativeCardKeywords_33` | 스킬 4058 | `별도 색상 지정 없음` | 4회 |
| 삼지창<br>본문: 「삼지창」 | `DerivativeCardKeywords_5` | 스킬 4467 | `별도 색상 지정 없음` | 6회 |
| 상실의 아름다움 | `Shiluozhimei` | 상태 66559 | `SchoolQuialty,Dark (#5EF2FF)` | 1회 |
| 상처<br>본문: 「상처」 / “상처” / 상처 | `DerivativeCardKeywords_23` | 스킬 4374 | `별도 색상 지정 없음` | 16회 |
| 상처의 뼈 | `DerivativeCardKeywords_156` | 스킬 146114 | `별도 색상 지정 없음` | 4회 |
| 상행음 | `DerivativeCardKeywords_61` | 스킬 59490 | `별도 색상 지정 없음` | 1회 |
| 상호 계약: 레무리아 | `MutualAid1` | 상태 119076 | `별도 색상 지정 없음` | 2회 |
| 상호 계약: 심해 분열체 | `MutualAid3` | 상태 118115 | `별도 색상 지정 없음` | 미관측 |
| 상호 계약: 어군 | `MutualAid2` | 상태 117875 | `별도 색상 지정 없음` | 미관측 |
| 새 지갑 | `Zhanxindeqianbao` | 상태 66563 | `WhiteQuality,Dark (#FFFFFF)` | 1회 |
| 생식의 피<br>본문:  | `DerivativeCardKeywords_151` | 스킬 48815 | `별도 색상 지정 없음` | 4회 |
| 석화 | `PetrifactionColour` | 상태 2410 | `orangeword (#c48662)` | 1회 |
| 석화 진행 | `DerivativeCardKeywords_79` | 스킬 4687 | `별도 색상 지정 없음` | 미관측 |
| 선혈의 사슬<br>본문: 피의 사슬 | `DerivativeCardKeywords_65` | 스킬 61121 | `별도 색상 지정 없음` | 4회 |
| 성례<br>본문: 「성례」 | `O07CardKeyWord2` | 스킬 51902 | `orangeword (#c48662)` | 5회 |
| 성상 축복: 위엄의 꿈 | `DerivativeCardKeywords_121` | 스킬 119715 | `별도 색상 지정 없음` | 2회 |
| 성상 축복：영원한 꿈<br>본문: 성상 축복: 영원한 꿈 | `DerivativeCardKeywords_120` | 스킬 119716 | `별도 색상 지정 없음` | 2회 |
| 성상 축복：지식의 꿈<br>본문: 성상 축복: 지식의 꿈 | `DerivativeCardKeywords_122` | 스킬 119718 | `별도 색상 지정 없음` | 2회 |
| 성심<br>본문: 「성심」 | `DerivativeCardKeywords_118` | 스킬 117315 | `별도 색상 지정 없음` | 2회 |
| 성장 | `PVPGrowthKeywords` | 상태 91819 | `orangeword (#c48662)` | 4회 |
| 소리를 잃은 축음기 | `Shishengchangji` | 상태 67625 | `WhiteQuality,Dark (#FFFFFF)` | 1회 |
| 소용돌이! 발사!<br>본문:  | `DerivativeCardKeywords_132` | 스킬 130934 | `별도 색상 지정 없음` | 2회 |
| 속임수 주사위<br>본문: 편방 주사위 | `C05_yansheng1` | 스킬 57860 | `별도 색상 지정 없음` | 1회 |
| 속임수의 모자 | `Guishulimao` | 상태 67637 | `RedQuality,Dark (#FF7272)` | 1회 |
| 손상 | `FragileColour` | 상태 2586 | `purpleword (#af6bb0)` | 2회 |
| 순수 피해 | `FixedDamage` | 상태 149652 | `orangeword (#c48662)` | 101회 |
| 시계추·날개 | `Slbyuyi` | 상태 67665 | `SchoolQuialty,Dark (#5EF2FF)` | 1회 |
| 시계추·눈 | `Slbyan` | 상태 67658 | `SchoolQuialty,Dark (#5EF2FF)` | 1회 |
| 시계추·물결 | `Slbyiyong` | 상태 67640 | `SchoolQuialty,Dark (#5EF2FF)` | 1회 |
| 시계추·불결 | `Slbbujie` | 상태 67651 | `SchoolQuialty,Dark (#5EF2FF)` | 1회 |
| 시계추·불면 | `Slbbumian` | 상태 67661 | `SchoolQuialty,Dark (#5EF2FF)` | 1회 |
| 시계추·쌍둥이 | `Slbshuangsheng` | 상태 67650 | `SchoolQuialty,Dark (#5EF2FF)` | 1회 |
| 시계추·진화 | `Slbyanhua` | 상태 67604 | `SchoolQuialty,Dark (#5EF2FF)` | 1회 |
| 시계추·투사 | `Slbtoushe` | 상태 67599 | `SchoolQuialty,Dark (#5EF2FF)` | 1회 |
| 시를 바치다<br>본문: 헌시 | `PoetryKeywords` | 상태 55824 | `orangeword (#c48662)` | 4회 |
| 신께 바침<br>본문: 신에게 바침 | `DerivativeCardKeywords_119` | 스킬 119342 | `별도 색상 지정 없음` | 2회 |
| 신앙의 갈림길<br>본문: 「신앙의 갈림길」 | `O07CardKeyWord4` | 스킬 51733 | `orangeword (#c48662)` | 2회 |
| 신앙의 종말<br>본문: 「신앙의 종말」 | `O07CardKeyWord5` | 스킬 51734 | `orangeword (#c48662)` | 1회 |
| 실비아의 홍차 | `PVPDerivativeCardKeywords_25` | 스킬 122656 | `별도 색상 지정 없음` | 2회 |
| 심리 장벽<br>본문: 정신의 벽 / 심리 장벽 | `MindWall` | 상태 100327 | `별도 색상 지정 없음` | 3회 |
| 심연! 소용돌이! 대폭발<br>본문: 「심연! 소용돌이! 대폭격!」 /  | `PVPDerivativeCardKeywords_28` | 스킬 130928 | `별도 색상 지정 없음` | 3회 |
| 심연! 소용돌이! Mk. II!<br>본문: 「심연! 소용돌이! 이식!」 | `PVPDerivativeCardKeywords_27` | 스킬 130947 | `별도 색상 지정 없음` | 1회 |
| 아르카나 기록 | `Aerkanajilu` | 상태 67626 | `OrangeQuality,Dark (#e4b756)` | 1회 |
| 아름다운 순간<br>본문: 「아름다운 순간」 / 「아름다운 순간 」 | `DerivativeCardKeywords_40` | 스킬 4499 | `별도 색상 지정 없음` | 5회 |
| 아름다운 순간 β | `Meilishunjian` | 상태 67612 | `WhiteQuality,Dark (#FFFFFF)` | 1회 |
| 악동 | `Etong` | 상태 66558 | `WhiteQuality,Dark (#FFFFFF)` | 1회 |
| 안정적인 생활<br>본문: “안정적인 생활” / 「안정된 삶」 | `DerivativeCardKeywords_59` | 스킬 52318 | `별도 색상 지정 없음` | 2회 |
| 암류<br>본문: 暗涌 | `KuangNu1` | 상태 149789 | `redword (#bb646d)` | 2회 |
| 액화 허무<br>본문: 「액화된 허무」 | `PVPDerivativeCardKeywords_15` | 스킬 70358 | `별도 색상 지정 없음` | 1회 |
| 야마 조종<br>본문: 몽마 제어 | `DerivativeCardKeywords_148` | 스킬 140830 | `별도 색상 지정 없음` | 6회 |
| 약탈의 건트<br>본문:  | `DerivativeCardKeywords_145` | 스킬 143559 | `별도 색상 지정 없음` | 8회 |
| 양산<br>본문: 「양산」 | `DerivativeCardKeywords_6` | 스킬 4554 | `별도 색상 지정 없음` | 6회 |
| 어두운 인간성의 빛<br>본문: ‘희미한 인간성의 광휘’ / “어두운 인간성의 빛” | `DerivativeCardKeywords_68` | 스킬 65453 | `별도 색상 지정 없음` | 2회 |
| 엑사 플레어<br>본문:  | `DerivativeCardKeywords_117` | 스킬 97916 | `별도 색상 지정 없음` | 4회 |
| 여섯 날개의 해방<br>본문: 「여섯 날개의 해방」 | `DerivativeCardKeywords_77` | 스킬 66353 | `별도 색상 지정 없음` | 2회 |
| 여정의 유골 | `Xingdaozhihai` | 상태 66562 | `RedQuality,Dark (#FF7272)` | 1회 |
| 열상<br>본문: 「열상」 | `DerivativeCardKeywords_24` | 스킬 4054 | `별도 색상 지정 없음` | 7회 |
| 영감<br>본문: 「영감」 / “영감” / "영감" | `DerivativeCardKeywords_4` | 스킬 4677 | `별도 색상 지정 없음` | 60회 |
| 영감<br>본문: 「영감」 | `PVPDerivativeCardKeywords_17` | 스킬 89659 | `별도 색상 지정 없음` | 4회 |
| 영야의 향연<br>본문:  | `DerivativeCardKeywords_110` | 스킬 97318 | `별도 색상 지정 없음` | 2회 |
| 영야의 향연<br>본문:  | `DerivativeCardKeywords_114` | 스킬 97319 | `별도 색상 지정 없음` | 3회 |
| 영원한 직조 | `DerivativeCardKeywords_139` | 스킬 133366 | `별도 색상 지정 없음` | 미관측 |
| 영지 각성 | `ExaltColour` | 상태 3607 | `orangeword (#c48662)` | 미관측 |
| 영혼의 동조 | `Backupbody1` | 스킬 145442 | `별도 색상 지정 없음` | 미관측 |
| 영혼의 동조 | `Backupbody2` | 스킬 145441 | `별도 색상 지정 없음` | 미관측 |
| 영혼의 동조 | `Backupbody3` | 스킬 145439 | `별도 색상 지정 없음` | 미관측 |
| 영혼의 동조 | `Backupbody4` | 스킬 145440 | `별도 색상 지정 없음` | 미관측 |
| 영혼의 족쇄·미혹<br>본문: 「영혼의 족쇄·미혹」 | `PVPDerivativeCardKeywords_19` | 스킬 117175 | `별도 색상 지정 없음` | 1회 |
| 영혼의 포식<br>본문: 「영혼 포식」 / 「혼 포식」 | `DerivativeCardKeywords_111` | 스킬 95828 | `별도 색상 지정 없음` | 3회 |
| 예비<br>본문: 예비 / 준비 / 예비 \[Layer\] / 예비2 / 유지 | `PrepareKeywords` | 상태 123812 | `orangeword (#c48662)` | 11회 |
| 예비1<br>본문: 예비1 / 준비1 / 예비 | `PrepareKeypvewords` | 상태 66884 | `orangeword (#c48662)` | 9회 |
| 오레타의 보물<br>본문: "오레타의 보물" | `PVPDerivativeCardKeywords_31` | 스킬 45252 | `별도 색상 지정 없음` | 1회 |
| 왕권<br>본문: “왕권” / 「왕권」 | `DerivativeCardKeywords_60` | 스킬 36330 | `별도 색상 지정 없음` | 2회 |
| 요마 사냥<br>본문: "사냥의 악몽" / "요마 사냥" / "악몽 감금" | `PVPDerivativeCardKeywords_30` | 스킬 142874 | `별도 색상 지정 없음` | 5회 |
| 우리의 집 | `Womendejia` | 상태 67643 | `OrangeQuality,Dark (#e4b756)` | 1회 |
| 우종 | `KaiHuajishu1` | 상태 139687 | `whiteword (#ffffff)` | 1회 |
| 운명을 이끄는 실<br>본문: 사선인명 / 운명을 이끄는 실 | `DerivativeCardKeywords_138` | 스킬 126488 | `별도 색상 지정 없음` | 6회 |
| 운명의 붕괴·종말<br>본문: 획득 | `DerivativeCardKeywords_104` | 스킬 71523 | `별도 색상 지정 없음` | 1회 |
| 운명의 전조<br>본문: 운명의 전조 / 명정예조 | `PVPDestinedDeathKeyWords` | 상태 124917 | `purpleword (#af6bb0)` | 6회 |
| 원색 | `PrimaryColor` | 상태 98474 | `별도 색상 지정 없음` | 11회 |
| 원한의 사슬 | `ResentChainsKeywords1` | 상태 49957 | `purpleword (#af6bb0)` | 3회 |
| 원형 배터리 | `Yuanxingdianchi` | 상태 67667 | `OrangeQuality,Dark (#e4b756)` | 1회 |
| 위를 향한 추락<br>본문: 「위를 향한 추락」 | `Falltospace21` | 스킬 142804 | `별도 색상 지정 없음` | 2회 |
| 위를 향한 추락<br>본문: 「위로 추락」 / 「위를 향한 추락」 | `Falltospace22` | 스킬 142805 | `별도 색상 지정 없음` | 2회 |
| 위를 향한 추락<br>본문: 「위를 향한 추락」 | `Falltospace23` | 스킬 142802 | `별도 색상 지정 없음` | 2회 |
| 위를 향한 추락<br>본문: 「위를 향한 추락」 | `Falltospace24` | 스킬 142807 | `별도 색상 지정 없음` | 2회 |
| 윤회의 정원 | `C01EXCardKeyWord1` | 상태 54045 | `orangeword (#c48662)` | 1회 |
| 융식액<br>본문: 「융식액」 | `DerivativeCardKeywords_31` | 스킬 4140 | `별도 색상 지정 없음` | 1회 |
| 융식의 핵 | `DerivativeCardKeywords_63` | 스킬 60309 | `별도 색상 지정 없음` | 미관측 |
| 융합 | `PVPFusion` | 상태 145590 | `orangeword (#c48662)` | 1회 |
| 은백 연산기 | `Yinbaichaifenji` | 상태 67622 | `SchoolQuialty,Dark (#5EF2FF)` | 1회 |
| 은빛 열쇠의 이름으로·각인 | `DerivativeCardKeywords_162` | 스킬 149905 | `별도 색상 지정 없음` | 1회 |
| 은빛 열쇠의 이름으로·재주조 | `DerivativeCardKeywords_163` | 스킬 149902 | `별도 색상 지정 없음` | 1회 |
| 은신 | `DerivativeCardKeywords_82` | 스킬 4074 | `별도 색상 지정 없음` | 미관측 |
| 은신 β<br>본문: “은신 β” / ”은신 β” | `DerivativeCardKeywords_98` | 스킬 68873 | `별도 색상 지정 없음` | 2회 |
| 은열쇠 공명<br>본문: 「은열쇠 공명」 / 은열쇠 공명 | `DerivativeCardKeywords_41` | 스킬 4709 | `별도 색상 지정 없음` | 3회 |
| 은열쇠의 미광<br>본문: “은열쇠 미광” | `DerivativeCardKeywords_129` | 스킬 73536 | `별도 색상 지정 없음` | 2회 |
| 은열쇠의 새벽빛<br>본문: 은열쇠 서광 / 「은열쇠의 새벽빛」 / 은열쇠의 새벽빛 | `DerivativeCardKeywords_67` | 스킬 49882 | `별도 색상 지정 없음` | 7회 |
| 응고<br>본문: 「고화」 | `DerivativeCardKeywords_48` | 스킬 50397 | `별도 색상 지정 없음` | 1회 |
| 의사의 가방 | `Yishengshoutixiang` | 상태 67598 | `WhiteQuality,Dark (#FFFFFF)` | 1회 |
| 의식 간섭<br>본문: 「의식 간섭」 / 의식 간섭 | `Yishiganshe` | 상태 140856 | `orangeword (#c48662)` | 9회 |
| 의심 | `DerivativeCardKeywords_73` | 스킬 65372 | `별도 색상 지정 없음` | 2회 |
| 이국의 우표집 | `Yixiangyoupiaojia` | 상태 67662 | `WhiteQuality,Dark (#FFFFFF)` | 1회 |
| 이상 현상의 팔레트<br>본문: 팔레트 | `DerivativeCardKeywords_116` | 스킬 98317 | `별도 색상 지정 없음` | 8회 |
| 이상한 나라의 릴리 | `Alice1` | 스킬 140849 | `별도 색상 지정 없음` | 미관측 |
| 이상한 나라의 릴리 | `Alice2` | 스킬 140850 | `별도 색상 지정 없음` | 미관측 |
| 이상한 나라의 릴리 | `Alice3` | 스킬 140852 | `별도 색상 지정 없음` | 미관측 |
| 이상한 나라의 릴리 | `Alice4` | 스킬 140851 | `별도 색상 지정 없음` | 미관측 |
| 이성을 잃은 쥐<br>본문:  | `PVPDerivativeCardKeywords_9` | 스킬 45683 | `별도 색상 지정 없음` | 2회 |
| 이세 충격!<br>본문: 이세 충격!” | `DerivativeCardKeywords_135` | 스킬 130940 | `별도 색상 지정 없음` | 2회 |
| 이세 충격! | `DerivativeCardKeywords_136` | 스킬 130940 | `별도 색상 지정 없음` | 미관측 |
| 이치고이치에<br>본문: 일기일회 | `DerivativeCardKeywords_143` | 스킬 133950 | `별도 색상 지정 없음` | 1회 |
| 인간성의 빛<br>본문: “인성의 빛” | `DerivativeCardKeywords_70` | 스킬 65393 | `별도 색상 지정 없음` | 2회 |
| 인격 그림자 | `ShadowSelf` | 상태 100329 | `별도 색상 지정 없음` | 1회 |
| 인세로의 내딛음 | `Falltospace11` | 스킬 142806 | `별도 색상 지정 없음` | 미관측 |
| 인세로의 내딛음 | `Falltospace12` | 스킬 142809 | `별도 색상 지정 없음` | 미관측 |
| 인세로의 내딛음 | `Falltospace13` | 스킬 142808 | `별도 색상 지정 없음` | 미관측 |
| 인세로의 내딛음 | `Falltospace14` | 스킬 142803 | `별도 색상 지정 없음` | 미관측 |
| 인어의 눈물 | `Renyuleizhu` | 상태 66566 | `WhiteQuality,Dark (#FFFFFF)` | 1회 |
| 일방<br>본문: “단방향” | `DerivativeCardKeywords_50` | 스킬 50393 | `별도 색상 지정 없음` | 1회 |
| 잊혀진 자의 피 | `Beiyiwangzhezhixue` | 상태 67653 | `OrangeQuality,Dark (#e4b756)` | 1회 |
| 자손의 격려<br>본문: 「자손의 격려」 | `DerivativeCardKeywords_108` | 스킬 91159 | `별도 색상 지정 없음` | 2회 |
| 자손의 축복<br>본문: 「자손의 축복」 | `DerivativeCardKeywords_109` | 스킬 91158 | `별도 색상 지정 없음` | 2회 |
| 자아의 어두운 면 | `DarkEgo` | 상태 100326 | `별도 색상 지정 없음` | 3회 |
| 자죄<br>본문: 自罪 | `ShuZui1` | 상태 149791 | `blueword (#76aac8)` | 1회 |
| 자폭 개조·종말<br>본문: 선택 | `DerivativeCardKeywords_103` | 스킬 71522 | `별도 색상 지정 없음` | 1회 |
| 작은 소원<br>본문: 「작은 소원」 | `PVPDerivativeCardKeywords_12` | 스킬 19489 | `별도 색상 지정 없음` | 4회 |
| 작은 포대기 | `Xiaoxiaoqiangbao` | 상태 67607 | `OrangeQuality,Dark (#e4b756)` | 1회 |
| 잠금 | `PVPLock` | 상태 145592 | `orangeword (#c48662)` | 2회 |
| 장벽<br>본문: 장벽 / 임시 장벽 | `ParcloseColour` | 상태 3450 | `blueword (#76aac8)` | 5회 |
| 장벽 붕괴 | `BarrierCrash` | 상태 100330 | `별도 색상 지정 없음` | 3회 |
| 재앙 의식의 새 | `Eyunyishiniao` | 상태 67609 | `RedQuality,Dark (#FF7272)` | 1회 |
| 저주 | `DerivativeCardKeywords_102` | 스킬 70332 | `별도 색상 지정 없음` | 미관측 |
| 전기 쥐<br>본문:  | `PVPDerivativeCardKeywords_8` | 스킬 45678 | `별도 색상 지정 없음` | 2회 |
| 전의 | `Shimieluotanhuodong2` | 상태 146117 | `orangeword (#c48662)` | 1회 |
| 절단 분리 마법 상자<br>본문:  | `PVPDerivativeCardKeywords_5` | 스킬 45679 | `별도 색상 지정 없음` | 2회 |
| 정밀 계측기 | `Jingmijishiqi` | 상태 66556 | `WhiteQuality,Dark (#FFFFFF)` | 1회 |
| 제사장의 지팡이 | `Jisiquanzhang` | 상태 67603 | `OrangeQuality,Dark (#e4b756)` | 1회 |
| 제사장의 지팡이+ | `Jiajisiquanzhang` | 상태 67638 | `SchoolQuialty,Dark (#5EF2FF)` | 1회 |
| 조화<br>본문: 「조화」 / 조화 | `harmonyKeyWord` | 상태 90696 | `whiteword (#ffffff)` | 2회 |
| 종말 | `Zhongmowuqiling` | 상태 70443 | `별도 색상 지정 없음` | 미관측 |
| 줄마노 | `Chansimanao` | 상태 67666 | `WhiteQuality,Dark (#FFFFFF)` | 1회 |
| 쥐 떼 돌격<br>본문: 「쥐 떼 돌격」 | `DerivativeCardKeywords_12` | 스킬 4641 | `별도 색상 지정 없음` | 6회 |
| 쥐 카드 | `PVPMouseKeywords` | 상태 47832 | `orangeword (#c48662)` | 2회 |
| 증상: 망상<br>본문: 증상:「망상」 / 「증상:망상」 | `DerivativeCardKeywords_26` | 스킬 4119 | `별도 색상 지정 없음` | 3회 |
| 증상: 망언<br>본문: 증상:「망언」 | `DerivativeCardKeywords_29` | 스킬 4142 | `별도 색상 지정 없음` | 1회 |
| 증상: 발작<br>본문: 증상:「발작」 | `DerivativeCardKeywords_27` | 스킬 4496 | `별도 색상 지정 없음` | 1회 |
| 증상: 붕괴<br>본문: 「증상:의심」 / 증상:「붕괴」 | `DerivativeCardKeywords_28` | 스킬 4569 | `별도 색상 지정 없음` | 2회 |
| 증상: 쇼크<br>본문: 증상:「쇼크」 | `DerivativeCardKeywords_30` | 스킬 4184 | `별도 색상 지정 없음` | 1회 |
| 지난날의 꽃과 시<br>본문: 지난날의 꽃과 시 / 카운트다운 | `PVPFlowerKeywords` | 상태 57317 | `orangeword (#c48662)` | 3회 |
| 지식의 독서륜 | `Qiuzhidushulun` | 상태 67670 | `OrangeQuality,Dark (#e4b756)` | 1회 |
| 지연<br>본문: 지연 / 지연 1 / 延迟 1 | `DelayKeywords` | 상태 47825 | `orangeword (#c48662)` | 38회 |
| 지혜의 이치 | `Chapter5_Monster_Support2` | 상태 59520 | `별도 색상 지정 없음` | 1회 |
| 직명 | `SilkKeywords1` | 상태 134227 | `purpleword (#af6bb0)` | 미관측 |
| 진·회귀역설<br>본문: 진·윤회 역설 | `DerivativeCardKeywords_131` | 스킬 126008 | `별도 색상 지정 없음` | 3회 |
| 진실한 친구<br>본문: “진심어린 친구” / 「진심어린 친구」 | `DerivativeCardKeywords_58` | 스킬 52317 | `별도 색상 지정 없음` | 2회 |
| 질식<br>본문: 「질식」 | `DerivativeCardKeywords_37` | 스킬 4215 | `별도 색상 지정 없음` | 2회 |
| 질식<br>본문: 「질식」 | `DerivativeCardKeywords_80` | 스킬 3968 | `별도 색상 지정 없음` | 8회 |
| 집결<br>본문: “집결” | `DerivativeCardKeywords_51` | 스킬 50399 | `별도 색상 지정 없음` | 1회 |
| 집결<br>본문: 「잠식」 | `DerivativeCardKeywords_54` | 스킬 50492 | `별도 색상 지정 없음` | 1회 |
| 집결 | `DerivativeCardKeywords_56` | 스킬 50492 | `별도 색상 지정 없음` | 미관측 |
| 집착<br>본문: 「집착」 | `O07CardKeyWord3` | 스킬 52055 | `orangeword (#c48662)` | 1회 |
| 차원 폐쇄<br>본문: 「차원 폐쇄」 | `DerivativeCardKeywords_45` | 스킬 3999 | `별도 색상 지정 없음` | 5회 |
| 찬란한 인간성의 빛<br>본문: “찬란한 인간성의 빛” | `DerivativeCardKeywords_72` | 스킬 65454 | `별도 색상 지정 없음` | 2회 |
| 채워지지 않은 고통<br>본문: 「채워지지 않은 고통」 | `DerivativeCardKeywords_34` | 스킬 4146 | `별도 색상 지정 없음` | 3회 |
| 초한 폭발<br>본문: 초월 폭발 / 초한 폭발 | `OverLimitUtlSkillKeywords` | 상태 54416 | `orangeword (#c48662)` | 30회 |
| 촉수 집결 | `OceanAttack` | 상태 49225 | `orangeword (#c48662)` | 미관측 |
| 최고의 영광 | `Wushangrongchong` | 상태 66557 | `OrangeQuality,Dark (#e4b756)` | 1회 |
| 최종 법칙 | `UltraPotencyKeywords` | 상태 127312 | `orangeword (#c48662)` | 2회 |
| 추억 - 대행자의 판결<br>본문: 「추억-대행자의 심판」 | `DerivativeCardKeywords_94` | 스킬 68672 | `별도 색상 지정 없음` | 1회 |
| 추억 - 미완성된 밀랍상<br>본문: 「추억-미완성된 밀랍상」 | `DerivativeCardKeywords_91` | 스킬 68661 | `별도 색상 지정 없음` | 1회 |
| 추억 - 벌꿀 술<br>본문: 「추억-꿀술」 | `DerivativeCardKeywords_93` | 스킬 68663 | `별도 색상 지정 없음` | 1회 |
| 추억 - 변이의 심장<br>본문: 「추억-변이의 심장」 | `DerivativeCardKeywords_92` | 스킬 68662 | `별도 색상 지정 없음` | 1회 |
| 추억 - 순진한 보답<br>본문: 「추억-천진한 답례」 | `DerivativeCardKeywords_90` | 스킬 68666 | `별도 색상 지정 없음` | 1회 |
| 추억 - 유토피아의 장막<br>본문: 「추억-유토피아의 장막」 | `DerivativeCardKeywords_95` | 스킬 68660 | `별도 색상 지정 없음` | 1회 |
| 추억 - 풍요의 씨앗<br>본문: 「추억-풍요의 핵」 | `DerivativeCardKeywords_96` | 스킬 68664 | `별도 색상 지정 없음` | 1회 |
| 추억의 빛 - 대행자의 판결<br>본문: 「추억의 빛 - 대행자의 심판」 | `DerivativeCardKeywords_87` | 스킬 68668 | `별도 색상 지정 없음` | 2회 |
| 추억의 빛 - 미완성된 밀랍상<br>본문: 「추억의 빛 - 미완성된 밀랍상」 | `DerivativeCardKeywords_84` | 스킬 68665 | `별도 색상 지정 없음` | 2회 |
| 추억의 빛 - 벌꿀 술<br>본문: “추억의 빛 - 꿀 와인” | `DerivativeCardKeywords_86` | 스킬 68671 | `별도 색상 지정 없음` | 2회 |
| 추억의 빛 - 변이의 심장<br>본문: “추억의 빛 - 변이의 심장” | `DerivativeCardKeywords_85` | 스킬 68670 | `별도 색상 지정 없음` | 2회 |
| 추억의 빛 - 순진한 보답<br>본문: “추억의 빛 - 순진한 보답” | `DerivativeCardKeywords_83` | 스킬 68667 | `별도 색상 지정 없음` | 2회 |
| 추억의 빛 - 유토피아의 장막<br>본문: “추억의 빛 - 유토피아의 장막” | `DerivativeCardKeywords_88` | 스킬 68659 | `별도 색상 지정 없음` | 2회 |
| 추억의 빛 - 풍요의 씨앗<br>본문: “추억의 빛 - 풍요의 씨앗” | `DerivativeCardKeywords_89` | 스킬 68669 | `별도 색상 지정 없음` | 2회 |
| 축복<br>본문: 「축복」 / 「선녀의 은총」 | `DerivativeCardKeywords_152` | 스킬 145612 | `별도 색상 지정 없음` | 18회 |
| 축복 | `DerivativeCardKeywords_161` | 스킬 149362 | `별도 색상 지정 없음` | 3회 |
| 축복·각인된 의식 β | `Szyishimingke` | 상태 67619 | `SchoolQuialty,Dark (#5EF2FF)` | 1회 |
| 축복·검은 양초 | `Szheizhu` | 상태 67600 | `SchoolQuialty,Dark (#5EF2FF)` | 1회 |
| 축복·군충 의식 | `Szchongqunyishi` | 상태 67671 | `SchoolQuialty,Dark (#5EF2FF)` | 1회 |
| 축복·기괴한 갈고리발톱<br>본문: 축복·기괴한 갈고리 발톱 | `Szguguaigouzhua` | 상태 67639 | `SchoolQuialty,Dark (#5EF2FF)` | 1회 |
| 축복·악몽의 표상 β | `Szemengbiaoxiang` | 상태 67614 | `SchoolQuialty,Dark (#5EF2FF)` | 1회 |
| 축복·여정의 유골 | `Szxingdaozhihai` | 상태 67611 | `SchoolQuialty,Dark (#5EF2FF)` | 1회 |
| 축복·재앙 의식의 새 | `Szeyunyishiniao` | 상태 67621 | `SchoolQuialty,Dark (#5EF2FF)` | 1회 |
| 축복·칠성장어의 키스 | `Szqisaimanzhiwen` | 상태 67623 | `SchoolQuialty,Dark (#5EF2FF)` | 1회 |
| 축제의 축복 | `Jierizhufu` | 상태 67645 | `WhiteQuality,Dark (#FFFFFF)` | 1회 |
| 취약 | `VulnerabilityColour` | 상태 2432 | `redword (#bb646d)` | 1회 |
| 치명타 | `PVPCriticalStrikeKeywords` | 상태 21492 | `orangeword (#c48662)` | 미관측 |
| 침멸<br>본문: 「침멸」 /  | `DerivativeCardKeywords_154` | 스킬 146018 | `별도 색상 지정 없음` | 13회 |
| 침묵 | `DerivativeCardKeywords_130` | 스킬 125905 | `별도 색상 지정 없음` | 미관측 |
| 카운트다운: 0<br>본문: 「카운트다운: 0」 | `DerivativeCardKeywords_128` | 스킬 122119 | `별도 색상 지정 없음` | 1회 |
| 카운트다운: 1<br>본문: 「카운트다운: 1」 | `DerivativeCardKeywords_127` | 스킬 122118 | `별도 색상 지정 없음` | 1회 |
| 카운트다운: 2<br>본문: 「카운트다운: 2」 | `DerivativeCardKeywords_126` | 스킬 122123 | `별도 색상 지정 없음` | 1회 |
| 카운트다운: 3<br>본문: 「카운트다운: 3」 | `DerivativeCardKeywords_125` | 스킬 122122 | `별도 색상 지정 없음` | 1회 |
| 카운트다운: 4<br>본문: 「카운트다운: 4」 | `DerivativeCardKeywords_124` | 스킬 122120 | `별도 색상 지정 없음` | 1회 |
| 카운트다운: 5<br>본문: 「카운트다운: 5」 | `DerivativeCardKeywords_123` | 스킬 122121 | `별도 색상 지정 없음` | 1회 |
| 텔레파시 마이크<br>본문:  | `PVPDerivativeCardKeywords_6` | 스킬 45682 | `별도 색상 지정 없음` | 2회 |
| 통신 장비<br>본문: 통신 장비 β | `Tongxunshebei` | 상태 66554 | `WhiteQuality,Dark (#FFFFFF)` | 1회 |
| 통신 장비+β | `Jiatongxunshebei` | 상태 67635 | `SchoolQuialty,Dark (#5EF2FF)` | 1회 |
| 통찰의 일격<br>본문: 「심안 타격」 | `PVPDerivativeCardKeywords_1` | 스킬 45651 | `별도 색상 지정 없음` | 1회 |
| 팀 고유<br>본문: 팀 유일 / 팀 고유 | `TeamUnique` | 상태 117154 | `orangeword (#c48662)` | 13회 |
| 파동탄<br>본문: 「파동탄」 | `PVPDerivativeCardKeywords_26` | 스킬 130944 | `별도 색상 지정 없음` | 1회 |
| 파멸의 신앙·집착<br>본문: 「파멸의 신앙·집착」 | `PVPDerivativeCardKeywords_20` | 스킬 117173 | `별도 색상 지정 없음` | 1회 |
| 포식당함 | `DerivativeCardKeywords_113` | 스킬 97159 | `별도 색상 지정 없음` | 미관측 |
| 프리온 독소<br>본문: “프리온 독소” | `DerivativeCardKeywords_46` | 스킬 50394 | `별도 색상 지정 없음` | 2회 |
| 피에 굶주린 철구 | `DerivativeCardKeywords_66` | 스킬 61122 | `별도 색상 지정 없음` | 2회 |
| 피의 맹세<br>본문: 피의 서약 | `BloodOath` | 상태 61185 | `별도 색상 지정 없음` | 6회 |
| 피의 맹세 | `BloodOath_New` | 상태 149140 | `별도 색상 지정 없음` | 5회 |
| 하행음 | `DerivativeCardKeywords_62` | 스킬 59491 | `별도 색상 지정 없음` | 1회 |
| 항로 인도<br>본문: 파일럿 | `DerivativeCardKeywords_106` | 스킬 84357 | `별도 색상 지정 없음` | 9회 |
| 해와 달의 룰렛 | `Riyuelunpan` | 상태 67646 | `OrangeQuality,Dark (#e4b756)` | 1회 |
| 해와 달의 룰렛+ | `Jiariyuelunpan` | 상태 67675 | `SchoolQuialty,Dark (#5EF2FF)` | 1회 |
| 행동력 과부하 | `PVPOverloadKeywords` | 상태 96743 | `orangeword (#c48662)` | 미관측 |
| 행동력 상한<br>본문: 최대 산출력 /  / 최대 행동력 | `PVPCapKeywords` | 상태 142954 | `별도 색상 지정 없음` | 15회 |
| 행동력 유지 | `PVPRetainCostKeywords` | 상태 91706 | `orangeword (#c48662)` | 미관측 |
| 행복한 레코드 | `Kuailechangpian` | 상태 66560 | `RedQuality,Dark (#FF7272)` | 1회 |
| 허무의 종언 | `DerivativeCardKeywords_15` | 스킬 70303 | `별도 색상 지정 없음` | 미관측 |
| 허약<br>본문: 강효 감소 / 마비 / 약화 / 얽힘 / 허약 / 힘 감소 | `WeaknessColour` | 상태 3212 | `purpleword (#af6bb0)` | 6회 |
| 허점<br>본문: 약점 | `PVPWeaknessesKeywords` | 상태 96740 | `orangeword (#c48662)` | 1회 |
| 현실 모방 | `PVPDerivativeCardKeywords_14` | 스킬 45601 | `별도 색상 지정 없음` | 2회 |
| 협주의 교향 | `DerivativeCardKeywords_64` | 스킬 60552 | `별도 색상 지정 없음` | 2회 |
| 호위<br>본문: "방호" | `Pangtuosihuodong_Defend` | 상태 143541 | `별도 색상 지정 없음` | 1회 |
| 혼돈의 유산<br>본문: 「혼돈의 유산」 | `C05_zaowu` | 상태 58447 | `별도 색상 지정 없음` | 5회 |
| 혼란 | `Chaos` | 상태 96784 | `별도 색상 지정 없음` | 6회 |
| 혼란의 자식<br>본문: 음란 녀석 / 음란한 자식 | `DerivativeCardKeywords_44` | 스킬 49133 | `별도 색상 지정 없음` | 4회 |
| 화려한 풍경<br>본문: 「화려한 풍경」 | `PVPDerivativeCardKeywords_3` | 스킬 45063 | `별도 색상 지정 없음` | 1회 |
| 환각<br>본문: 환각 / 「환각」 | `DerivativeCardKeywords_38` | 스킬 4493 | `별도 색상 지정 없음` | 4회 |
| 환상<br>본문: 「환상」 / "환상" | `PVPDerivativeCardKeywords_2` | 스킬 19419 | `별도 색상 지정 없음` | 8회 |
| 환영 \[Layer\]<br>본문: 환영 | `PhantomKeywords` | 상태 19529 | `orangeword (#c48662)` | 4회 |
| 환희의 이치 | `Chapter5_Monster_Support3` | 상태 59522 | `별도 색상 지정 없음` | 1회 |
| 활성 주사기 | `Huoxingzhusheqi` | 상태 66555 | `WhiteQuality,Dark (#FFFFFF)` | 1회 |
| 황혼 속에서 | `Zaixiguangli` | 상태 67615 | `OrangeQuality,Dark (#e4b756)` | 1회 |
| 회전 선율<br>본문: 반복되는 선율 / 회전 선율 | `HuihuanaKeywords` | 상태 60562 | `redword (#bb646d)` | 4회 |
| 회전 선율<br>본문: 반복되는 선율 / 회전 선율 | `HuihuanbKeywords` | 상태 61085 | `redword (#bb646d)` | 6회 |
| 회중시계<br>본문: 회중시계 거울 β | `Huaibiaojing` | 상태 66564 | `WhiteQuality,Dark (#FFFFFF)` | 1회 |
| 후발제인 | `PVPDerivativeCardKeywords_22` | 스킬 19394 | `별도 색상 지정 없음` | 2회 |
| 흐트러짐<br>본문: 「비틀거림」 / 「불안정한 걸음걸이」 / 「흐트러짐」 / 비틀거림 / 「낙담」 | `DerivativeCardKeywords_9` | 스킬 4006 | `별도 색상 지정 없음` | 22회 |
| 흡착<br>본문: 「흡착」 | `DerivativeCardKeywords_47` | 스킬 50398 | `별도 색상 지정 없음` | 1회 |
| 흥분 | `DerivativeCardKeywords_101` | 스킬 70333 | `별도 색상 지정 없음` | 미관측 |
| 희미한 인간성의 빛<br>본문: “미약한 인간성의 빛” | `DerivativeCardKeywords_69` | 스킬 65451 | `별도 색상 지정 없음` | 2회 |
| 희미한 촛불 | `FlickeringCandle` | 상태 100621 | `별도 색상 지정 없음` | 2회 |
| 흰 까마귀 부리 | `Baiyahui` | 상태 67668 | `WhiteQuality,Dark (#FFFFFF)` | 1회 |
| 힘<br>본문: 힘 / 힘 감소 | `PowerColourKeywords` | 상태 3281 | `greenword (#71aa86)` | 8회 |
| 힘 감소 | `ExhaustionColour` | 상태 2549 | `purpleword (#af6bb0)` | 미관측 |
| HP와 방어막 최고<br>본문: HP와 방어막이 가장 높은 | `HPAndShieldMax` | 상태 145457 | `별도 색상 지정 없음` | 2회 |
| HP와 방어막 최저<br>본문: HP와 방어막이 가장 낮은 / HP와 방어막가 가장 낮은 | `HPAndShieldMin` | 상태 145456 | `별도 색상 지정 없음` | 3회 |

## 부록 C — 그 외 322개 표시 설정

아래 항목도 전체 정의를 확인했지만, 고정 키워드로 추가하지 않았다. 범용 링크는 호출 문맥이 대상을 정하며, 색상·서식 설정은 단어가 아니라 표시 규칙이다.

| 태그 | 제외·구분 사유 | 설정 이미지 | 색상 | 관측 |
|---|---|---|---|---|
| `BigBold` | 색상·크기·서식 또는 일반 치환 | 없음 | `별도 색상 지정 없음` | 1회 |
| `SmallShake` | 색상·크기·서식 또는 일반 치환 | 없음 | `별도 색상 지정 없음` | 33회 |
| `TipsHighlightText` | 색상·크기·서식 또는 일반 치환 | 없음 | `UXEmphasize,Dark (#5EF2FF)` | 21회 |
| `GrayState` | 색상·크기·서식 또는 일반 치환 | 없음 | `GrayState (#a3a6ab)` | 1회 |
| `LightGray` | 색상·크기·서식 또는 일반 치환 | 없음 | `LightGray,Light (#ACBFCA)` | 49회 |
| `ShakeRed` | 색상·크기·서식 또는 일반 치환 | 없음 | `Red,Light (#FF5A5A)` | 2회 |
| `WordSize20` | 색상·크기·서식 또는 일반 치환 | 없음 | `별도 색상 지정 없음` | 2회 |
| `TaskFinish` | 색상·크기·서식 또는 일반 치환 | 없음 | `TaskFinish (#93D1A0)` | 1회 |
| `Green` | 색상·크기·서식 또는 일반 치환 | 없음 | `greenword (#71aa86)` | 8회 |
| `Block` | 색상·크기·서식 또는 일반 치환 | 없음 | `blueword (#76aac8)` | 599회 |
| `Energy` | 색상·크기·서식 또는 일반 치환 | 없음 | `yellowword (#b6ad65)` | 879회 |
| `Heal` | 색상·크기·서식 또는 일반 치환 | 없음 | `greenword (#71aa86)` | 171회 |
| `Title` | 색상·크기·서식 또는 일반 치환 | 없음 | `별도 색상 지정 없음` | 2748회 |
| `Color4` | 색상·크기·서식 또는 일반 치환 | 없음 | `OldColor3,Light (#ef8936)` | 1회 |
| `GreenQuality` | 색상·크기·서식 또는 일반 치환 | 없음 | `GreenQuality,Dark (#09F331)` | 1회 |
| `NetworkDelayGreen` | 색상·크기·서식 또는 일반 치환 | 없음 | `NetworkDelayGreen,Light (#71aa86)` | 17회 |
| `OptionHighlight_Dadly` | 색상·크기·서식 또는 일반 치환 | 없음 | `OptionHighlight,Light (#30e7e9)` | 2회 |
| `TipsHighlightText_1` | 색상·크기·서식 또는 일반 치환 | 없음 | `UXEmphasize_1 (#2B8BA0)` | 2회 |
| `DoubleOutputActivityTimes` | 색상·크기·서식 또는 일반 치환 | 없음 | `UXDouble,Light (#ffffff)` | 1회 |
| `Gray1` | 색상·크기·서식 또는 일반 치환 | 없음 | `Gray1 (#a3a6ab)` | 1회 |
| `ItalicRed` | 색상·크기·서식 또는 일반 치환 | 없음 | `Red,Light (#FF5A5A)` | 1회 |
| `WeaponEffect_Num` | 색상·크기·서식 또는 일반 치환 | 없음 | `WeaponEffect_Num,Dark (#5ef2ff)` | 567회 |
| `Red` | 색상·크기·서식 또는 일반 치환 | 없음 | `Red,Light (#FF5A5A)` | 349회 |
| `FeatureUnlockDesc` | 색상·크기·서식 또는 일반 치환 | 없음 | `FeatureUnlockDesc (#a8bac5)` | 34회 |
| `Del` | 색상·크기·서식 또는 일반 치환 | 없음 | `별도 색상 지정 없음` | 14회 |
| `FeatureUnlockTitle` | 색상·크기·서식 또는 일반 치환 | 없음 | `FeatureUnlockTitle (#ffffff)` | 59회 |
| `Posse` | 색상·크기·서식 또는 일반 치환 | 없음 | `whiteword (#ffffff)` | 128회 |
| `SurveyLink` | 범용 링크: Survey | 없음 | `별도 색상 지정 없음` | 40회 |
| `BuffTip` | 색상·크기·서식 또는 일반 치환 | 없음 | `OldColor8,Light (#81511c)` | 1회 |
| `Negative` | 색상·크기·서식 또는 일반 치환 | 없음 | `E,Light (#e25312)` | 1회 |
| `Damage` | 색상·크기·서식 또는 일반 치환 | 없음 | `redword (#bb646d)` | 1875회 |
| `RedShake` | 색상·크기·서식 또는 일반 치환 | 없음 | `Red,Light (#FF5A5A)` | 19회 |
| `Rune_9` | 색상·크기·서식 또는 일반 치환 | 없음 | `blueword (#76aac8)` | 2회 |
| `PVPredKeyword` | 색상·크기·서식 또는 일반 치환 | 없음 | `redword (#bb646d)` | 2회 |
| `StrengthenColour` | 색상·크기·서식 또는 일반 치환 | 없음 | `orangeword (#c48662)` | 1회 |
| `Gray` | 색상·크기·서식 또는 일반 치환 | 없음 | `LightGray,Light (#ACBFCA)` | 151회 |
| `ComaColour` | 색상·크기·서식 또는 일반 치환 | 없음 | `orangeword (#c48662)` | 4회 |
| `BlueQuality` | 색상·크기·서식 또는 일반 치환 | 없음 | `BlueQuality,Dark (#5EF2FF)` | 176회 |
| `Rune_4` | 색상·크기·서식 또는 일반 치환 | 없음 | `whiteword (#ffffff)` | 2회 |
| `Rune_9_High` | 색상·크기·서식 또는 일반 치환 | 없음 | `blueword (#76aac8)` | 1회 |
| `Rune_4_High` | 색상·크기·서식 또는 일반 치환 | 없음 | `whiteword (#ffffff)` | 1회 |
| `Rune_5_High` | 색상·크기·서식 또는 일반 치환 | 없음 | `yellowword (#b6ad65)` | 1회 |
| `Rune_14_High` | 색상·크기·서식 또는 일반 치환 | 없음 | `greenword (#71aa86)` | 5회 |
| `Rune_10_High` | 색상·크기·서식 또는 일반 치환 | 없음 | `purpleword (#af6bb0)` | 1회 |
| `Rune_7_High` | 색상·크기·서식 또는 일반 치환 | 없음 | `whiteword (#ffffff)` | 1회 |
| `Rune_3_High` | 색상·크기·서식 또는 일반 치환 | 없음 | `whiteword (#ffffff)` | 1회 |
| `Rune_8_High` | 색상·크기·서식 또는 일반 치환 | 없음 | `whiteword (#ffffff)` | 1회 |
| `Rune_18_High` | 색상·크기·서식 또는 일반 치환 | 없음 | `purpleword (#af6bb0)` | 1회 |
| `Black` | 색상·크기·서식 또는 일반 치환 | 없음 | `Black,Dark (#171717)` | 26회 |
| `Rune_17_High` | 색상·크기·서식 또는 일반 치환 | 없음 | `whiteword (#ffffff)` | 1회 |
| `Rune_13_High` | 색상·크기·서식 또는 일반 치환 | 없음 | `purpleword (#af6bb0)` | 1회 |
| `Rune_11_High` | 색상·크기·서식 또는 일반 치환 | 없음 | `blueword (#76aac8)` | 1회 |
| `Rune_16_High` | 색상·크기·서식 또는 일반 치환 | 없음 | `yellowword (#b6ad65)` | 1회 |
| `Rune_1_High` | 색상·크기·서식 또는 일반 치환 | 없음 | `redword (#bb646d)` | 2회 |
| `Rune_15_High` | 색상·크기·서식 또는 일반 치환 | 없음 | `greenword (#71aa86)` | 1회 |
| `Rune_19_High` | 색상·크기·서식 또는 일반 치환 | 없음 | `orangeword (#c48662)` | 1회 |
| `Rune_12_High` | 색상·크기·서식 또는 일반 치환 | 없음 | `redword (#bb646d)` | 1회 |
| `CardTip` | 색상·크기·서식 또는 일반 치환 | 없음 | `A,Dark (#ffffff)` | 35회 |
| `OrangeQuality` | 색상·크기·서식 또는 일반 치환 | 없음 | `OrangeQuality,Dark (#e4b756)` | 499회 |
| `D13Colour` | 색상·크기·서식 또는 일반 치환 | 없음 | `purpleword (#af6bb0)` | 4회 |
| `EnergyColour` | 색상·크기·서식 또는 일반 치환 | 없음 | `yellowword (#b6ad65)` | 1회 |
| `PVPEmptinessColour` | 색상·크기·서식 또는 일반 치환 | 없음 | `yellowword (#b6ad65)` | 1회 |
| `PVPVoidKeyColour` | 색상·크기·서식 또는 일반 치환 | 없음 | `redword (#bb646d)` | 2회 |
| `Rune_5` | 색상·크기·서식 또는 일반 치환 | 없음 | `yellowword (#b6ad65)` | 1회 |
| `Small` | 색상·크기·서식 또는 일반 치환 | 없음 | `별도 색상 지정 없음` | 183회 |
| `Shake` | 색상·크기·서식 또는 일반 치환 | 없음 | `별도 색상 지정 없음` | 620회 |
| `Positive` | 색상·크기·서식 또는 일반 치환 | 없음 | `D,Dark (#189a9f)` | 7회 |
| `RedItalic` | 색상·크기·서식 또는 일반 치환 | 없음 | `Red,Light (#FF5A5A)` | 20회 |
| `Rune_14` | 색상·크기·서식 또는 일반 치환 | 없음 | `greenword (#71aa86)` | 2회 |
| `BigBoldRed` | 색상·크기·서식 또는 일반 치환 | 없음 | `Red,Light (#FF5A5A)` | 1회 |
| `SlowColour` | 색상·크기·서식 또는 일반 치환 | 없음 | `purpleword (#af6bb0)` | 3회 |
| `D05EX_Relic` | 색상·크기·서식 또는 일반 치환 | 없음 | `GrayState (#a3a6ab)` | 17회 |
| `BigShake` | 색상·크기·서식 또는 일반 치환 | 없음 | `별도 색상 지정 없음` | 73회 |
| `TauntColour` | 색상·크기·서식 또는 일반 치환 | 없음 | `redword (#bb646d)` | 1회 |
| `Rune_10` | 색상·크기·서식 또는 일반 치환 | 없음 | `purpleword (#af6bb0)` | 2회 |
| `SmallLightGray` | 색상·크기·서식 또는 일반 치환 | 없음 | `LightGray,Light (#ACBFCA)` | 4회 |
| `SummonOrange` | 색상·크기·서식 또는 일반 치환 | 없음 | `SummonOrange,Dark (#f0d67b)` | 1958회 |
| `Rune_7` | 색상·크기·서식 또는 일반 치환 | 없음 | `whiteword (#ffffff)` | 1회 |
| `Rune_3` | 색상·크기·서식 또는 일반 치환 | 없음 | `whiteword (#ffffff)` | 2회 |
| `Rune_8` | 색상·크기·서식 또는 일반 치환 | 없음 | `whiteword (#ffffff)` | 1회 |
| `Blue` | 색상·크기·서식 또는 일반 치환 | 없음 | `Blue,Light (#75ecff)` | 409회 |
| `WhiteRelic` | 색상·크기·서식 또는 일반 치환 | 없음 | `WhiteRelic,Light (#b8b8b8)` | 2회 |
| `AberrationKeywords` | 색상·크기·서식 또는 일반 치환 | 없음 | `orangeword (#c48662)` | 14회 |
| `ReinforceColour` | 색상·크기·서식 또는 일반 치환 | 없음 | `blueword (#76aac8)` | 6회 |
| `PVPResurrectionColour` | 색상·크기·서식 또는 일반 치환 | 없음 | `greenword (#71aa86)` | 1회 |
| `RedRelic` | 색상·크기·서식 또는 일반 치환 | 없음 | `RedRelic,Light (#855E5E)` | 3회 |
| `EnergyStorageColour` | 색상·크기·서식 또는 일반 치환 | 없음 | `greenword (#71aa86)` | 5회 |
| `CardKeyWord` | 색상·크기·서식 또는 일반 치환 | 없음 | `orangeword (#c48662)` | 145회 |
| `Rune_18` | 색상·크기·서식 또는 일반 치환 | 없음 | `purpleword (#af6bb0)` | 2회 |
| `Receive` | 색상·크기·서식 또는 일반 치환 | 없음 | `Receive (#ffd776)` | 1회 |
| `Claimed` | 색상·크기·서식 또는 일반 치환 | 없음 | `Claimed (#8d9196)` | 1회 |
| `AwakerSkill` | 색상·크기·서식 또는 일반 치환 | 없음 | `AwakerSkill,Light (#04ab04)` | 1회 |
| `BuffTipBlock` | 색상·크기·서식 또는 일반 치환 | 없음 | `D,Light (#127d81)` | 1회 |
| `ExclamationPointColour` | 색상·크기·서식 또는 일반 치환 | 없음 | `orangeword (#c48662)` | 11회 |
| `School_2` | 색상·크기·서식 또는 일반 치환 | 없음 | `blueword (#76aac8)` | 3회 |
| `SummonBlue` | 색상·크기·서식 또는 일반 치환 | 없음 | `SummonBlue,Dark (#6faeef)` | 552회 |
| `Rune_20` | 색상·크기·서식 또는 일반 치환 | 없음 | `blueword (#76aac8)` | 1회 |
| `WhiteQuality` | 색상·크기·서식 또는 일반 치환 | 없음 | `WhiteQuality,Dark (#FFFFFF)` | 291회 |
| `Rune_17` | 색상·크기·서식 또는 일반 치환 | 없음 | `whiteword (#ffffff)` | 1회 |
| `PrepareKeypvewordscolour` | 색상·크기·서식 또는 일반 치환 | 없음 | `orangeword (#c48662)` | 2회 |
| `Big` | 색상·크기·서식 또는 일반 치환 | 없음 | `별도 색상 지정 없음` | 242회 |
| `Rune_13` | 색상·크기·서식 또는 일반 치환 | 없음 | `purpleword (#af6bb0)` | 1회 |
| `Yellow` | 색상·크기·서식 또는 일반 치환 | 없음 | `Yellow,Light (#f5df94)` | 675회 |
| `ShakeBig` | 색상·크기·서식 또는 일반 치환 | 없음 | `별도 색상 지정 없음` | 1회 |
| `Bold` | 색상·크기·서식 또는 일반 치환 | 없음 | `별도 색상 지정 없음` | 20회 |
| `AberrationColour` | 색상·크기·서식 또는 일반 치환 | 없음 | `orangeword (#c48662)` | 1회 |
| `YinniColour` | 색상·크기·서식 또는 일반 치환 | 없음 | `whiteword (#ffffff)` | 1회 |
| `GreenWord` | 색상·크기·서식 또는 일반 치환 | 없음 | `greenword (#71aa86)` | 4회 |
| `PurpleKeyWord` | 색상·크기·서식 또는 일반 치환 | 없음 | `purpleword (#af6bb0)` | 4회 |
| `YellowItalic` | 색상·크기·서식 또는 일반 치환 | 없음 | `Yellow,Light (#f5df94)` | 2회 |
| `RedQuality1` | 색상·크기·서식 또는 일반 치환 | 없음 | `RedQuality,Dark (#FF7272)` | 1회 |
| `Rune_20_High` | 색상·크기·서식 또는 일반 치환 | 없음 | `orangeword (#c48662)` | 1회 |
| `O06_AFKeyWord2` | 색상·크기·서식 또는 일반 치환 | 없음 | `orangeword (#c48662)` | 2회 |
| `RedQuality` | 색상·크기·서식 또는 일반 치환 | 없음 | `RedQuality,Dark (#FF7272)` | 123회 |
| `DayTime` | 색상·크기·서식 또는 일반 치환 | 없음 | `DayTime (#2b3136)` | 1회 |
| `BigItalic` | 색상·크기·서식 또는 일반 치환 | 없음 | `별도 색상 지정 없음` | 3회 |
| `AwakerCard_24Lost` | 색상·크기·서식 또는 일반 치환 | 없음 | `Color24CardLost (#676e73)` | 14회 |
| `IntoxicationColour` | 색상·크기·서식 또는 일반 치환 | 없음 | `purpleword (#af6bb0)` | 4회 |
| `BaseDamageColour` | 색상·크기·서식 또는 일반 치환 | 없음 | `redword (#bb646d)` | 1회 |
| `PVPVulnerabilityIconColour` | 색상·크기·서식 또는 일반 치환 | 없음 | `redword (#bb646d)` | 3회 |
| `Rune_11` | 색상·크기·서식 또는 일반 치환 | 없음 | `blueword (#76aac8)` | 2회 |
| `O06_AFKeyWord1` | 색상·크기·서식 또는 일반 치환 | 없음 | `orangeword (#c48662)` | 2회 |
| `Italic` | 색상·크기·서식 또는 일반 치환 | 없음 | `별도 색상 지정 없음` | 106회 |
| `RedBig` | 색상·크기·서식 또는 일반 치환 | 없음 | `Red,Light (#FF5A5A)` | 13회 |
| `Rune_6` | 색상·크기·서식 또는 일반 치환 | 없음 | `blueword (#76aac8)` | 3회 |
| `School_4` | 색상·크기·서식 또는 일반 치환 | 없음 | `purpleword (#af6bb0)` | 3회 |
| `SummonPurple` | 색상·크기·서식 또는 일반 치환 | 없음 | `SummonPurple,Dark (#b27fff)` | 565회 |
| `Rune_16` | 색상·크기·서식 또는 일반 치환 | 없음 | `yellowword (#b6ad65)` | 1회 |
| `MaxHPColour` | 색상·크기·서식 또는 일반 치환 | 없음 | `greenword (#71aa86)` | 1회 |
| `BlessingColour` | 색상·크기·서식 또는 일반 치환 | 없음 | `greenword (#71aa86)` | 1회 |
| `PVPBlessColour` | 색상·크기·서식 또는 일반 치환 | 없음 | `purpleword (#af6bb0)` | 1회 |
| `BleedingColour` | 색상·크기·서식 또는 일반 치환 | 없음 | `redword (#bb646d)` | 5회 |
| `Rune_1` | 색상·크기·서식 또는 일반 치환 | 없음 | `redword (#bb646d)` | 2회 |
| `PVPCardLockColour` | 색상·크기·서식 또는 일반 치환 | 없음 | `whiteword (#ffffff)` | 1회 |
| `SilverKeyColour` | 색상·크기·서식 또는 일반 치환 | 없음 | `whiteword (#ffffff)` | 1회 |
| `TutorialHighlight` | 색상·크기·서식 또는 일반 치환 | 없음 | `TutorialHighlight,Light (#5EF2FF)` | 199회 |
| `Rune_15` | 색상·크기·서식 또는 일반 치환 | 없음 | `greenword (#71aa86)` | 2회 |
| `PVPfengsuoColour` | 색상·크기·서식 또는 일반 치환 | 없음 | `whiteword (#ffffff)` | 1회 |
| `BaoyanKeywords` | 색상·크기·서식 또는 일반 치환 | 없음 | `redword (#bb646d)` | 1회 |
| `BurningColor` | 색상·크기·서식 또는 일반 치환 | 없음 | `redword (#bb646d)` | 1회 |
| `BuffTipDamage` | 색상·크기·서식 또는 일반 치환 | 없음 | `E,Light (#e25312)` | 2회 |
| `36` | 색상·크기·서식 또는 일반 치환 | 없음 | `별도 색상 지정 없음` | 미관측 |
| `ActorSkillNum` | 색상·크기·서식 또는 일반 치환 | 없음 | `D,Dark (#189a9f)` | 미관측 |
| `AllyPosAwaker1Name` | 색상·크기·서식 또는 일반 치환 | 없음 | `별도 색상 지정 없음` | 2회 |
| `AllyPosAwaker2Name` | 색상·크기·서식 또는 일반 치환 | 없음 | `별도 색상 지정 없음` | 2회 |
| `AllyPosAwaker3Name` | 색상·크기·서식 또는 일반 치환 | 없음 | `별도 색상 지정 없음` | 2회 |
| `AllyPosAwaker4Name` | 색상·크기·서식 또는 일반 치환 | 없음 | `별도 색상 지정 없음` | 2회 |
| `AttrGreen` | 색상·크기·서식 또는 일반 치환 | 없음 | `AttrGreen,Light (#5EF2FF)` | 미관측 |
| `AwakerCard_24Now` | 색상·크기·서식 또는 일반 치환 | 없음 | `별도 색상 지정 없음` | 미관측 |
| `B` | 색상·크기·서식 또는 일반 치환 | 없음 | `별도 색상 지정 없음` | 미관측 |
| `BigBlue` | 색상·크기·서식 또는 일반 치환 | 없음 | `Blue,Light (#75ecff)` | 미관측 |
| `BigDel` | 색상·크기·서식 또는 일반 치환 | 없음 | `별도 색상 지정 없음` | 미관측 |
| `BigItalicBold` | 색상·크기·서식 또는 일반 치환 | 없음 | `별도 색상 지정 없음` | 미관측 |
| `BigLightGray` | 색상·크기·서식 또는 일반 치환 | 없음 | `LightGray,Light (#ACBFCA)` | 미관측 |
| `BigRed` | 색상·크기·서식 또는 일반 치환 | 없음 | `Red,Light (#FF5A5A)` | 미관측 |
| `BigYellow` | 색상·크기·서식 또는 일반 치환 | 없음 | `Yellow,Light (#f5df94)` | 미관측 |
| `BlueBig` | 색상·크기·서식 또는 일반 치환 | 없음 | `Blue,Light (#75ecff)` | 미관측 |
| `BlueBold` | 색상·크기·서식 또는 일반 치환 | 없음 | `Blue,Light (#75ecff)` | 미관측 |
| `BlueDel` | 색상·크기·서식 또는 일반 치환 | 없음 | `Blue,Light (#75ecff)` | 미관측 |
| `BlueItalic` | 색상·크기·서식 또는 일반 치환 | 없음 | `Blue,Light (#75ecff)` | 미관측 |
| `BlueShake` | 색상·크기·서식 또는 일반 치환 | 없음 | `Blue,Light (#75ecff)` | 미관측 |
| `BlueSmall` | 색상·크기·서식 또는 일반 치환 | 없음 | `Blue,Light (#75ecff)` | 미관측 |
| `BoldBig` | 색상·크기·서식 또는 일반 치환 | 없음 | `별도 색상 지정 없음` | 미관측 |
| `BoldBlue` | 색상·크기·서식 또는 일반 치환 | 없음 | `Blue,Light (#75ecff)` | 미관측 |
| `BoldDel` | 색상·크기·서식 또는 일반 치환 | 없음 | `별도 색상 지정 없음` | 미관측 |
| `BoldItalic` | 색상·크기·서식 또는 일반 치환 | 없음 | `별도 색상 지정 없음` | 미관측 |
| `BoldLightGray` | 색상·크기·서식 또는 일반 치환 | 없음 | `LightGray,Light (#ACBFCA)` | 미관측 |
| `BoldRed` | 색상·크기·서식 또는 일반 치환 | 없음 | `Red,Light (#FF5A5A)` | 미관측 |
| `BoldShake` | 색상·크기·서식 또는 일반 치환 | 없음 | `별도 색상 지정 없음` | 미관측 |
| `BoldSmall` | 색상·크기·서식 또는 일반 치환 | 없음 | `별도 색상 지정 없음` | 미관측 |
| `BoldYellow` | 색상·크기·서식 또는 일반 치환 | 없음 | `Yellow,Light (#f5df94)` | 미관측 |
| `BuffLink` | 범용 링크: Buff | 없음 | `별도 색상 지정 없음` | 미관측 |
| `BuffTipNe` | 색상·크기·서식 또는 일반 치환 | 없음 | `E,Light (#e25312)` | 미관측 |
| `BuffTipPo` | 색상·크기·서식 또는 일반 치환 | 없음 | `D,Light (#127d81)` | 미관측 |
| `Card1` | 색상·크기·서식 또는 일반 치환 | 없음 | `D,Light (#127d81)` | 미관측 |
| `Card2` | 색상·크기·서식 또는 일반 치환 | 없음 | `OldColor8,Light (#81511c)` | 미관측 |
| `Card3` | 색상·크기·서식 또는 일반 치환 | 없음 | `E,Light (#e25312)` | 미관측 |
| `CardDesc` | 색상·크기·서식 또는 일반 치환 | 없음 | `OldColor8,Light (#81511c)` | 미관측 |
| `CardDescColor1` | 색상·크기·서식 또는 일반 치환 | 없음 | `CardDescColor,Light (#000000)` | 미관측 |
| `CardDescColor2` | 색상·크기·서식 또는 일반 치환 | 없음 | `CardDescColor,Dark (#86847d)` | 미관측 |
| `CardNameColor1` | 색상·크기·서식 또는 일반 치환 | 없음 | `CardNameColor,Light (#464240)` | 미관측 |
| `CardNameColor2` | 색상·크기·서식 또는 일반 치환 | 없음 | `CardNameColor,Dark (#baa979)` | 미관측 |
| `CardUpdate` | 색상·크기·서식 또는 일반 치환 | 없음 | `D,Dark (#189a9f)` | 미관측 |
| `color1` | 색상·크기·서식 또는 일반 치환 | 없음 | `OldColor1,Light (#882C14)` | 미관측 |
| `color2` | 색상·크기·서식 또는 일반 치환 | 없음 | `OldColor2,Light (#00690B)` | 미관측 |
| `Color3` | 색상·크기·서식 또는 일반 치환 | 없음 | `D,Light (#127d81)` | 미관측 |
| `Color5` | 색상·크기·서식 또는 일반 치환 | 없음 | `OldColor4,Light (#00FF00)` | 미관측 |
| `Color6` | 색상·크기·서식 또는 일반 치환 | 없음 | `OldColor5,Light (#6AC3CB)` | 미관측 |
| `Color7` | 색상·크기·서식 또는 일반 치환 | 없음 | `OldColor6,Light (#a4f3ff)` | 미관측 |
| `CopyTask1` | 색상·크기·서식 또는 일반 치환 | 없음 | `C,Dark (#909395)` | 미관측 |
| `CopyTask2` | 색상·크기·서식 또는 일반 치환 | 없음 | `D,Dark (#189a9f)` | 미관측 |
| `CritChanceColour` | 색상·크기·서식 또는 일반 치환 | 없음 | `orangeword (#c48662)` | 미관측 |
| `CriticalDamageColour` | 색상·크기·서식 또는 일반 치환 | 없음 | `orangeword (#c48662)` | 미관측 |
| `D06CardKeyWordai` | 색상·크기·서식 또는 일반 치환 | 없음 | `D06yixiangai (#7193BC)` | 미관측 |
| `D06CardKeyWordju` | 색상·크기·서식 또는 일반 치환 | 없음 | `D06yixiangju (#A071BC)` | 미관측 |
| `D06CardKeyWordnu` | 색상·크기·서식 또는 일반 치환 | 없음 | `D06yixiangnu (#E0987F)` | 미관측 |
| `D06CardKeyWordxi` | 색상·크기·서식 또는 일반 치환 | 없음 | `D06yixiangxi (#FDC677)` | 미관측 |
| `DeathResistanceColour` | 색상·크기·서식 또는 일반 치환 | 없음 | `greenword (#71aa86)` | 미관측 |
| `DelayedReplyColour` | 색상·크기·서식 또는 일반 치환 | 없음 | `greenword (#71aa86)` | 미관측 |
| `DelBig` | 색상·크기·서식 또는 일반 치환 | 없음 | `별도 색상 지정 없음` | 미관측 |
| `DelBlue` | 색상·크기·서식 또는 일반 치환 | 없음 | `Blue,Light (#75ecff)` | 미관측 |
| `DelBold` | 색상·크기·서식 또는 일반 치환 | 없음 | `별도 색상 지정 없음` | 미관측 |
| `DelItalic` | 색상·크기·서식 또는 일반 치환 | 없음 | `별도 색상 지정 없음` | 미관측 |
| `DelLightGray` | 색상·크기·서식 또는 일반 치환 | 없음 | `LightGray,Light (#ACBFCA)` | 미관측 |
| `DelRed` | 색상·크기·서식 또는 일반 치환 | 없음 | `Red,Light (#FF5A5A)` | 미관측 |
| `DelShake` | 색상·크기·서식 또는 일반 치환 | 없음 | `별도 색상 지정 없음` | 미관측 |
| `DelSmall` | 색상·크기·서식 또는 일반 치환 | 없음 | `별도 색상 지정 없음` | 미관측 |
| `DelYellow` | 색상·크기·서식 또는 일반 치환 | 없음 | `Yellow,Light (#f5df94)` | 미관측 |
| `effect1` | 색상·크기·서식 또는 일반 치환 | 없음 | `OldColor1,Light (#882C14)` | 미관측 |
| `effect3` | 재화·숫자 등 비전투 키워드 이미지 | `1f60b` | `별도 색상 지정 없음` | 미관측 |
| `EmailDetail_Title` | 색상·크기·서식 또는 일반 치환 | 없음 | `TalentNumWhite,Light (#FFFFFF)` | 미관측 |
| `EnemyPosAwaker1Name` | 색상·크기·서식 또는 일반 치환 | 없음 | `별도 색상 지정 없음` | 1회 |
| `EnemyPosAwaker2Name` | 색상·크기·서식 또는 일반 치환 | 없음 | `별도 색상 지정 없음` | 1회 |
| `EnemyPosAwaker3Name` | 색상·크기·서식 또는 일반 치환 | 없음 | `별도 색상 지정 없음` | 1회 |
| `EnemyPosAwaker4Name` | 색상·크기·서식 또는 일반 치환 | 없음 | `별도 색상 지정 없음` | 1회 |
| `GrayItalic` | 색상·크기·서식 또는 일반 치환 | 없음 | `LightGray,Light (#ACBFCA)` | 미관측 |
| `ItalicBig` | 색상·크기·서식 또는 일반 치환 | 없음 | `별도 색상 지정 없음` | 미관측 |
| `ItalicBlue` | 색상·크기·서식 또는 일반 치환 | 없음 | `Blue,Light (#75ecff)` | 미관측 |
| `ItalicBold` | 색상·크기·서식 또는 일반 치환 | 없음 | `별도 색상 지정 없음` | 미관측 |
| `ItalicDel` | 색상·크기·서식 또는 일반 치환 | 없음 | `별도 색상 지정 없음` | 미관측 |
| `ItalicLightGray` | 색상·크기·서식 또는 일반 치환 | 없음 | `LightGray,Light (#ACBFCA)` | 미관측 |
| `ItalicShake` | 색상·크기·서식 또는 일반 치환 | 없음 | `별도 색상 지정 없음` | 미관측 |
| `ItalicSmall` | 색상·크기·서식 또는 일반 치환 | 없음 | `별도 색상 지정 없음` | 미관측 |
| `ItalicYellow` | 색상·크기·서식 또는 일반 치환 | 없음 | `Yellow,Light (#f5df94)` | 미관측 |
| `ItemLink` | 범용 링크: ItemConfig | 없음 | `별도 색상 지정 없음` | 미관측 |
| `LevelNum0` | 재화·숫자 등 비전투 키워드 이미지 | `Number1_0` | `별도 색상 지정 없음` | 미관측 |
| `LevelNum1` | 재화·숫자 등 비전투 키워드 이미지 | `Number1_1` | `별도 색상 지정 없음` | 미관측 |
| `LevelNum2` | 재화·숫자 등 비전투 키워드 이미지 | `Number1_2` | `별도 색상 지정 없음` | 미관측 |
| `LevelNum3` | 재화·숫자 등 비전투 키워드 이미지 | `Number1_3` | `별도 색상 지정 없음` | 미관측 |
| `LevelNum4` | 재화·숫자 등 비전투 키워드 이미지 | `Number1_4` | `별도 색상 지정 없음` | 미관측 |
| `LevelNum5` | 재화·숫자 등 비전투 키워드 이미지 | `Number1_5` | `별도 색상 지정 없음` | 미관측 |
| `LevelNum6` | 재화·숫자 등 비전투 키워드 이미지 | `Number1_6` | `별도 색상 지정 없음` | 미관측 |
| `LevelNum7` | 재화·숫자 등 비전투 키워드 이미지 | `Number1_7` | `별도 색상 지정 없음` | 미관측 |
| `LevelNum8` | 재화·숫자 등 비전투 키워드 이미지 | `Number1_8` | `별도 색상 지정 없음` | 미관측 |
| `LevelNum9` | 재화·숫자 등 비전투 키워드 이미지 | `Number1_9` | `별도 색상 지정 없음` | 미관측 |
| `LightGrayBig` | 색상·크기·서식 또는 일반 치환 | 없음 | `LightGray,Light (#ACBFCA)` | 미관측 |
| `LightGrayBold` | 색상·크기·서식 또는 일반 치환 | 없음 | `LightGray,Light (#ACBFCA)` | 미관측 |
| `LightGrayDel` | 색상·크기·서식 또는 일반 치환 | 없음 | `LightGray,Light (#ACBFCA)` | 미관측 |
| `LightGrayItalic` | 색상·크기·서식 또는 일반 치환 | 없음 | `LightGray,Light (#ACBFCA)` | 미관측 |
| `LightGrayShake` | 색상·크기·서식 또는 일반 치환 | 없음 | `LightGray,Light (#ACBFCA)` | 미관측 |
| `LightGraySmall` | 색상·크기·서식 또는 일반 치환 | 없음 | `LightGray,Light (#ACBFCA)` | 미관측 |
| `LockMyEnemy` | 색상·크기·서식 또는 일반 치환 | 없음 | `별도 색상 지정 없음` | 미관측 |
| `LuckyEngravingRateColour` | 색상·크기·서식 또는 일반 치환 | 없음 | `greenword (#71aa86)` | 미관측 |
| `MoneyIcon1` | 재화·숫자 등 비전투 키워드 이미지 | `UI_Coin_Sprite_0` | `별도 색상 지정 없음` | 미관측 |
| `MoneyIcon10` | 재화·숫자 등 비전투 키워드 이미지 | `UI_Coin_Sprite_7` | `별도 색상 지정 없음` | 미관측 |
| `MoneyIcon11` | 재화·숫자 등 비전투 키워드 이미지 | `UI_Coin_Sprite_8` | `별도 색상 지정 없음` | 미관측 |
| `MoneyIcon2` | 재화·숫자 등 비전투 키워드 이미지 | `UI_Coin_Sprite_6` | `별도 색상 지정 없음` | 미관측 |
| `MoneyIcon3` | 재화·숫자 등 비전투 키워드 이미지 | `UI_Coin_Sprite_2` | `별도 색상 지정 없음` | 미관측 |
| `MoneyIcon4` | 재화·숫자 등 비전투 키워드 이미지 | `UI_Coin_Sprite_3` | `별도 색상 지정 없음` | 미관측 |
| `MoneyIcon5` | 재화·숫자 등 비전투 키워드 이미지 | `UI_Coin_Sprite_4` | `별도 색상 지정 없음` | 미관측 |
| `Monster1` | 색상·크기·서식 또는 일반 치환 | 없음 | `별도 색상 지정 없음` | 미관측 |
| `Monster2` | 색상·크기·서식 또는 일반 치환 | 없음 | `별도 색상 지정 없음` | 미관측 |
| `MyLockedEnemy` | 색상·크기·서식 또는 일반 치환 | 없음 | `별도 색상 지정 없음` | 미관측 |
| `NetworkDelayRed` | 색상·크기·서식 또는 일반 치환 | 없음 | `NetworkDelayRed,Light (#a2564e)` | 미관측 |
| `NetworkDelayYellow` | 색상·크기·서식 또는 일반 치환 | 없음 | `NetworkDelayYellow,Light (#a27c4e)` | 미관측 |
| `OldColor3` | 색상·크기·서식 또는 일반 치환 | 없음 | `OldColor3 (#ef8936)` | 미관측 |
| `OptionHighlight` | 색상·크기·서식 또는 일반 치환 | 없음 | `OptionHighlight,Light (#30e7e9)` | 미관측 |
| `PotencyActive` | 색상·크기·서식 또는 일반 치환 | 없음 | `PotencyActive,Light (#ffffff)` | 미관측 |
| `PotencyChoose` | 색상·크기·서식 또는 일반 치환 | 없음 | `PotencyChoose,Light (#74ebfe)` | 미관측 |
| `PotencyLock` | 색상·크기·서식 또는 일반 치환 | 없음 | `C,Dark (#909395)` | 미관측 |
| `PotencyNotActive` | 색상·크기·서식 또는 일반 치환 | 없음 | `PotencyNotActive,Light (#97a0a1)` | 미관측 |
| `PotencyUnlock` | 색상·크기·서식 또는 일반 치환 | 없음 | `A,Light (#000000)` | 미관측 |
| `ProficientInRealmsColour` | 색상·크기·서식 또는 일반 치환 | 없음 | `greenword (#71aa86)` | 미관측 |
| `Purple` | 색상·크기·서식 또는 일반 치환 | 없음 | `Purple (#EE82EE)` | 미관측 |
| `PVPDerivativeCardKeywords_24` | 색상·크기·서식 또는 일반 치환 | 없음 | `별도 색상 지정 없음` | 미관측 |
| `PVPDerivativeCardKeywords_33` | 색상·크기·서식 또는 일반 치환 | 없음 | `별도 색상 지정 없음` | 미관측 |
| `PVPDerivativeCardKeywords_34` | 색상·크기·서식 또는 일반 치환 | 없음 | `별도 색상 지정 없음` | 미관측 |
| `PVPDerivativeCardKeywords_35` | 색상·크기·서식 또는 일반 치환 | 없음 | `별도 색상 지정 없음` | 미관측 |
| `PVPDerivativeCardKeywords_36` | 색상·크기·서식 또는 일반 치환 | 없음 | `별도 색상 지정 없음` | 미관측 |
| `RedBold` | 색상·크기·서식 또는 일반 치환 | 없음 | `Red,Light (#FF5A5A)` | 미관측 |
| `RedDel` | 색상·크기·서식 또는 일반 치환 | 없음 | `Red,Light (#FF5A5A)` | 미관측 |
| `RedSmall` | 색상·크기·서식 또는 일반 치환 | 없음 | `Red,Light (#FF5A5A)` | 미관측 |
| `Rune_2_High` | 색상·크기·서식 또는 일반 치환 | 없음 | `purpleword (#af6bb0)` | 미관측 |
| `Rune_6_High` | 색상·크기·서식 또는 일반 치환 | 없음 | `blueword (#76aac8)` | 미관측 |
| `SchoolQuialty` | 색상·크기·서식 또는 일반 치환 | 없음 | `SchoolQuialty,Dark (#5EF2FF)` | 미관측 |
| `ShakeBlue` | 색상·크기·서식 또는 일반 치환 | 없음 | `Blue,Light (#75ecff)` | 미관측 |
| `ShakeBold` | 색상·크기·서식 또는 일반 치환 | 없음 | `별도 색상 지정 없음` | 미관측 |
| `ShakeDel` | 색상·크기·서식 또는 일반 치환 | 없음 | `별도 색상 지정 없음` | 미관측 |
| `ShakeItalic` | 색상·크기·서식 또는 일반 치환 | 없음 | `별도 색상 지정 없음` | 미관측 |
| `ShakeLightGray` | 색상·크기·서식 또는 일반 치환 | 없음 | `LightGray,Light (#ACBFCA)` | 미관측 |
| `ShakeSmall` | 색상·크기·서식 또는 일반 치환 | 없음 | `별도 색상 지정 없음` | 미관측 |
| `ShakeYellow` | 색상·크기·서식 또는 일반 치환 | 없음 | `Yellow,Light (#f5df94)` | 미관측 |
| `Shop1` | 색상·크기·서식 또는 일반 치환 | 없음 | `B,Dark (#d8d5b9)` | 미관측 |
| `Shop2` | 색상·크기·서식 또는 일반 치환 | 없음 | `OldColor4,Light (#00FF00)` | 미관측 |
| `Shop3` | 색상·크기·서식 또는 일반 치환 | 없음 | `E,Light (#e25312)` | 미관측 |
| `Shuaxinbaiyin` | 색상·크기·서식 또는 일반 치환 | 없음 | `WhiteQuality,Dark (#FFFFFF)` | 미관측 |
| `Shuaxinhuangjin` | 색상·크기·서식 또는 일반 치환 | 없음 | `OrangeQuality,Dark (#e4b756)` | 미관측 |
| `Shuaxinlengcai` | 색상·크기·서식 또는 일반 치환 | 없음 | `SchoolQuialty,Dark (#5EF2FF)` | 미관측 |
| `Shuaxinzuzhou` | 색상·크기·서식 또는 일반 치환 | 없음 | `RedQuality,Dark (#FF7272)` | 미관측 |
| `SilverKeyEnergyColour` | 색상·크기·서식 또는 일반 치환 | 없음 | `silveryword (#6baa83)` | 미관측 |
| `SkillLink` | 범용 링크: ActorSkill | 없음 | `별도 색상 지정 없음` | 미관측 |
| `SkillName1` | 문맥별 스킬 이름: Slot\_Skill1 | 없음 | `별도 색상 지정 없음` | 3회 |
| `SkillName2` | 문맥별 스킬 이름: Slot\_Skill2 | 없음 | `별도 색상 지정 없음` | 3회 |
| `SkillName3` | 문맥별 스킬 이름: Slot\_Skill3 | 없음 | `별도 색상 지정 없음` | 5회 |
| `SmallBlue` | 색상·크기·서식 또는 일반 치환 | 없음 | `Blue,Light (#75ecff)` | 미관측 |
| `SmallBold` | 색상·크기·서식 또는 일반 치환 | 없음 | `별도 색상 지정 없음` | 미관측 |
| `SmallDel` | 색상·크기·서식 또는 일반 치환 | 없음 | `별도 색상 지정 없음` | 미관측 |
| `SmallItalic` | 색상·크기·서식 또는 일반 치환 | 없음 | `별도 색상 지정 없음` | 미관측 |
| `SmallRed` | 색상·크기·서식 또는 일반 치환 | 없음 | `Red,Light (#FF5A5A)` | 미관측 |
| `SmallYellow` | 색상·크기·서식 또는 일반 치환 | 없음 | `Yellow,Light (#f5df94)` | 미관측 |
| `Star` | 재화·숫자 등 비전투 키워드 이미지 | `UI_Coin_Sprite_9` | `별도 색상 지정 없음` | 미관측 |
| `StatusApplier` | 색상·크기·서식 또는 일반 치환 | 없음 | `별도 색상 지정 없음` | 7회 |
| `SummonTimesQuality` | 색상·크기·서식 또는 일반 치환 | 없음 | `RedQuality,Dark (#FF7272)` | 미관측 |
| `TrinketSuitOff` | 색상·크기·서식 또는 일반 치환 | 없음 | `TrinketSuitOff,Light (#828282)` | 미관측 |
| `TrinketSuitOn` | 색상·크기·서식 또는 일반 치환 | 없음 | `TrinketSuitOn,Light (#5ef2ff)` | 미관측 |
| `UIUseable` | 색상·크기·서식 또는 일반 치환 | 없음 | `D,Dark (#189a9f)` | 미관측 |
| `UrlLink` | 범용 링크: Url | 없음 | `별도 색상 지정 없음` | 미관측 |
| `VampirismColour` | 색상·크기·서식 또는 일반 치환 | 없음 | `greenword (#71aa86)` | 미관측 |
| `YellowBig` | 색상·크기·서식 또는 일반 치환 | 없음 | `Yellow,Light (#f5df94)` | 미관측 |
| `YellowBold` | 색상·크기·서식 또는 일반 치환 | 없음 | `Yellow,Light (#f5df94)` | 미관측 |
| `YellowDel` | 색상·크기·서식 또는 일반 치환 | 없음 | `Yellow,Light (#f5df94)` | 미관측 |
| `YellowShake` | 색상·크기·서식 또는 일반 치환 | 없음 | `Yellow,Light (#f5df94)` | 미관측 |
| `YellowSmall` | 색상·크기·서식 또는 일반 치환 | 없음 | `Yellow,Light (#f5df94)` | 미관측 |
| `Rune_19` | 색상·크기·서식 또는 일반 치환 | 없음 | `orangeword (#c48662)` | 1회 |
| `Rune_2` | 색상·크기·서식 또는 일반 치환 | 없음 | `purpleword (#af6bb0)` | 2회 |
| `School_3` | 색상·크기·서식 또는 일반 치환 | 없음 | `redword (#bb646d)` | 3회 |
| `SummonRed` | 색상·크기·서식 또는 일반 치환 | 없음 | `SummonRed,Dark (#e05e5e)` | 575회 |
| `School_1` | 색상·크기·서식 또는 일반 치환 | 없음 | `yellowword (#b6ad65)` | 3회 |
| `OrangeRelic` | 색상·크기·서식 또는 일반 치환 | 없음 | `OrangeRelic,Light (#9C8A69)` | 5회 |
| `WhiteWord` | 색상·크기·서식 또는 일반 치환 | 없음 | `whiteword (#ffffff)` | 1회 |
| `Rune_12` | 색상·크기·서식 또는 일반 치환 | 없음 | `redword (#bb646d)` | 2회 |
| `BlueKeyWord` | 색상·크기·서식 또는 일반 치환 | 없음 | `blueword (#76aac8)` | 5회 |

## 한국어 조사 테이블 목록

| 테이블 | 레코드 수 |
|---|---:|
| `Text_KR.Text_Activity` | 1,821 |
| `Text_KR.Text_ActorAttrType` | 118 |
| `Text_KR.Text_AvgCommunicate` | 5,505 |
| `Text_KR.Text_AvgDialog` | 53,129 |
| `Text_KR.Text_AvgRole` | 1,403 |
| `Text_KR.Text_AvgVideoCaption` | 2,405 |
| `Text_KR.Text_AwakerBreakThrough` | 380 |
| `Text_KR.Text_AwakerConfig` | 749 |
| `Text_KR.Text_AwakerPotency` | 1,474 |
| `Text_KR.Text_AwakerSkin` | 17 |
| `Text_KR.Text_AwakerStory` | 943 |
| `Text_KR.Text_AwakerTalent` | 3,950 |
| `Text_KR.Text_BattlePass` | 54 |
| `Text_KR.Text_Bonus` | 134 |
| `Text_KR.Text_CardType` | 15 |
| `Text_KR.Text_Charge` | 62 |
| `Text_KR.Text_ClientPush` | 12 |
| `Text_KR.Text_CollectionHall` | 2,862 |
| `Text_KR.Text_CommonID` | 235 |
| `Text_KR.Text_EnchantConfig` | 92 |
| `Text_KR.Text_ErrCode` | 286 |
| `Text_KR.Text_Event` | 6,570 |
| `Text_KR.Text_FeatureUnlock` | 568 |
| `Text_KR.Text_GuideConfig` | 34 |
| `Text_KR.Text_Item` | 9,571 |
| `Text_KR.Text_ItemGets` | 477 |
| `Text_KR.Text_ItemTag` | 47 |
| `Text_KR.Text_LanguageConfig` | 3,279 |
| `Text_KR.Text_Lead` | 16 |
| `Text_KR.Text_LoadingTips` | 69 |
| `Text_KR.Text_Lottery` | 118 |
| `Text_KR.Text_Mail` | 1,059 |
| `Text_KR.Text_MapNode` | 12 |
| `Text_KR.Text_MapNodeType` | 157 |
| `Text_KR.Text_MonsterConfig` | 1,242 |
| `Text_KR.Text_MonsterIntent` | 56 |
| `Text_KR.Text_NewbieGuide` | 31 |
| `Text_KR.Text_PVPCollect` | 56 |
| `Text_KR.Text_PVPNewRank` | 6 |
| `Text_KR.Text_PVPOpeningVoice` | 643 |
| `Text_KR.Text_PVPPosition` | 5 |
| `Text_KR.Text_PVPRank` | 30 |
| `Text_KR.Text_PVPSeason` | 35 |
| `Text_KR.Text_PanelText` | 3,026 |
| `Text_KR.Text_PermResSummary` | 5 |
| `Text_KR.Text_PopupAd` | 440 |
| `Text_KR.Text_Produce` | 29 |
| `Text_KR.Text_Rank` | 7 |
| `Text_KR.Text_RelicConfig` | 2,397 |
| `Text_KR.Text_Resonance` | 777 |
| `Text_KR.Text_ResonanceGroup` | 2 |
| `Text_KR.Text_SchoolConfig` | 28 |
| `Text_KR.Text_SdkErrorCode` | 75 |
| `Text_KR.Text_SeasonRankReward` | 25 |
| `Text_KR.Text_SeasonRotation` | 0 |
| `Text_KR.Text_ServerList` | 44 |
| `Text_KR.Text_Setup` | 71 |
| `Text_KR.Text_Shop` | 28 |
| `Text_KR.Text_ShopType` | 55 |
| `Text_KR.Text_Skill` | 9,329 |
| `Text_KR.Text_SpireMap` | 4 |
| `Text_KR.Text_Stage` | 11,906 |
| `Text_KR.Text_StageData` | 19 |
| `Text_KR.Text_StageGroup` | 2,371 |
| `Text_KR.Text_State` | 7,035 |
| `Text_KR.Text_Summon` | 3,876 |
| `Text_KR.Text_TagConfig` | 66 |
| `Text_KR.Text_Task` | 9,368 |
| `Text_KR.Text_TipsType` | 1,988 |
| `Text_KR.Text_TrinketSuitEffect` | 87 |
| `Text_KR.Text_Tutorial` | 178 |
| `Text_KR.Text_Voice` | 6,377 |

## 검증 식별값 및 공개 범위

- 기준 리소스: `Z1G_2025_11_OB / res140 / build51`
- 표시 정의·색상·상태·스킬·한국어 테이블 묶음 SHA-256: `3952f01194ffd28c892758fe05add6b5e95378b868272097ca6eb1925d77394c`
- 본문 아이콘 아틀라스 원본 SHA-256: `dec2d38c5cecfdf2c280fa0c793116ae70dfd3dd5e70aed8ed61c87673e9a8e7`
- 문서에는 결과와 추적용 설정·문자열 식별자만 기록한다. 원본 패치 묶음, 추출 프로그램, 실행 도구, 인증·계정 정보는 포함하지 않는다.
- 아이콘과 게임 설명의 권리는 게임 권리자에게 있다.
