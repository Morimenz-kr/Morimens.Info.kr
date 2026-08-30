# 사이트 툴팁 키워드와 인게임 버프 아이콘 연결

사이트에 등록된 106개 툴팁 키워드를 인게임 전체 한국어 텍스트와 `Config.State`에 대조한 참조 자료다.

## 판정

- **직접 연결**: 해당 표시명을 사용하는 내부 태그의 상태 레코드에 전용 `Icon`이 지정되어 있다.
- **직접 VFX**: 태그 상태에 정적 아이콘 대신 `CardFaceVFX` 또는 `VFX`가 지정되어 있다.
- **동명 버프 아이콘/VFX**: 태그 레코드와는 별개지만 표시명이 같은 버프 상태에서 확인된다.
- **공용 아이콘만 존재**: 전용 이미지가 아니라 공용 경고 아이콘 `IconS_Buff_016.png`만 지정되어 있다.
- **연결 없음**: 같은 태그 또는 동명 상태에서 이미지 연결을 확인할 수 없다.

## 요약

- 연결 없음: 56개
- 공용 아이콘만 존재: 4개
- 직접 연결: 29개
- 동명 버프 아이콘: 14개
- 직접 VFX: 2개
- 동명 버프 VFX: 1개

## 결과

| 키워드 | 현재 사이트 이미지 | 내부 태그 | 판정 | 연결된 이미지·VFX | 상태 ID |
|---|---|---|---|---|---|
| 소모 | special.png | `DepleteIconKeywords`<br>`CardTip` | 연결 없음 | - | - |
| 보유 | special.png | `PVPHoldingKeywords`<br>`CardKeyWord` | 연결 없음 | - | - |
| 예비 | special.png | `PrepareKeypvewords1`<br>`PrepareKeywords`<br>`PrepareKeypvewords` | 공용 아이콘만 존재 | IconS_Buff_016.png | 66884, 123812 |
| 유지 | special.png | `RetainIconKeywords`<br>`PrepareKeywords`<br>`CardKeyWord` | 공용 아이콘만 존재 | IconS_Buff_016.png | 2448 |
| 광기 상한 | - | - | 연결 없음 | - | - |
| 힘 감소 | special.png | `ExhaustionIconKeywords`<br>`PowerColourKeywords`<br>`WeaknessColour` | 직접 연결 | IconS_Buff_037.png | 47827 |
| 회귀 | special.png | `TimeBeacon`<br>`MonsterTimeBeacon` | 연결 없음 | - | - |
| 음엔트로피 | special.png | `TimeBeacon2` | 동명 버프 아이콘 | IconS_Buff_039.png<br>VFX 1:24613;2:24611;3:24612 | 24564 |
| 경계 | special.png | `AlertIconKeywords`<br>`DerivativeCardKeywords_74`<br>`PVPAlertKeywords`<br>`AlertColour` | 직접 연결 | IconS_Buff_009.png | 3510, 22405 |
| 강제 보존 | - | `RetainIconKeywordsColour` | 연결 없음 | - | - |
| 중상 | - | `HeavyInjuryKeywords`<br>`PVPSeriousInjuryKeywords`<br>`PVPVulnerabilityIconColour`<br>`BaseDamageColour` | 직접 연결 | IconS_Buff_031.png | 47830, 49623 |
| 고유 | - | `CardTip`<br>`GuyouKeywords`<br>`CardKeyWord` | 공용 아이콘만 존재 | IconS_Buff_016.png | 2859 |
| 부활 | special.png | `PVPResurrectionKeywords`<br>`PVPResurrectionColour` | 직접 연결 | IconS_Buff_026.png | 47843 |
| 우종 | special.png | `KaiHuajishu`<br>`PVPFeatheredSeedsKeyWords`<br>`KaiHuajishu1` | 직접 연결 | IconS_Buff_087.png | 138824 |
| 무한 포식 | - | `DevouredIconKeywords`<br>`UnlimitedDevouredIconKeywords` | 연결 없음 | - | - |
| 지연 희생 | special.png | `BlueKeyWord` | 직접 연결 | IconS_Buff_042.png | 36013 |
| 은유 | special.png | `D06CardKeyWord1` | 연결 없음 | - | - |
| 허약 | special.png | `WeaknessIconKeywords`<br>`CardTip`<br>`PVPWeaknessKeywords`<br>`Rune_2`<br>`WeaknessColour` | 직접 연결 | UI_Rune_2_Small.png<br>IconS_Buff_005.png | 2962, 3469 |
| 취약 | special.png | `VulnerabilityIconKeywords`<br>`CardTip`<br>`FragileIconKeywords`<br>`PVPVulnerabilityIconKeywords`<br>`Rune_1`<br>`VulnerabilityColour`<br>`PVPVulnerabilityIconColour` | 직접 연결 | IconS_Buff_003.png<br>UI_Rune_1_Small.png | 2934, 3742, 19507 |
| 힘 | special.png | `PowerIconKeywords`<br>`CardTip`<br>`ExhaustionIconKeywords`<br>`PowerColourKeywords`<br>`PVPPowerIconKeywords`<br>`CardKeyWord` | 직접 연결 | IconS_Buff_021.png | 19521, 97743 |
| 영지 각성 | special.png | `CardTip`<br>`OrangeQuality`<br>`ExaltIconKeywords` | 연결 없음 | - | - |
| 손상 | special.png | `CardTip`<br>`VulnerabilityIconKeywords`<br>`FragileIconKeywords`<br>`FragileColour`<br>`PVPVulnerabilityIconKeywords` | 직접 연결 | IconS_Buff_015.png | 2564, 70182 |
| 저주 | - | `CardKeyWord` | 직접 연결 | IconS_Buff_001.png | 3929 |
| 흥분 | - | - | 동명 버프 아이콘 | IconS_Buff_001.png | 70318, 70330, 71279 |
| 정신적 외상 | special.png | - | 연결 없음 | - | - |
| 두려움 고착 | special.png | `D13AFKeyWord1`<br>`D13AFKeyWordQ1` | 연결 없음 | - | - |
| 메아리 | - | `CardKeyWord`<br>`Rune_7` | 직접 연결 | UI_Rune_7_Small.png | 3401 |
| 임시 강화 | - | `TempPowerKeywords` | 연결 없음 | - | - |
| 봉인 | - | `Seal`<br>`RedQuality`<br>`CardKeyWord`<br>`Seal1` | 직접 연결 | IconS_Buff_027.png<br>IconS_Buff_073.png | 3888, 122596 |
| 옛날 잔재 | special.png | `AshesPastKeyWord` | 동명 버프 아이콘 | IconS_Buff_025.png | 80575, 80774, 80810 |
| 잔해 | special.png | `Guaiwucanhai`<br>`CarcassKeywords` | 동명 버프 아이콘 | IconS_Buff_076.png | 91717, 95960, 141504 |
| 강효 | - | `StrongEffectKeywords`<br>`CardKeyWord` | 직접 연결 | IconS_Buff_001.png | 59160 |
| 특이점 신호 | special.png | - | 연결 없음 | - | - |
| 특이점 프리즘 | special.png | `SingularityKeywords2` | 연결 없음 | - | - |
| 특이점 소멸 | - | - | 연결 없음 | - | - |
| 초차원 숙련 | - | - | 연결 없음 | - | - |
| 순수 초차원 | - | - | 연결 없음 | - | - |
| 특이점 · 초차원 | - | - | 연결 없음 | - | - |
| 핏빛 용광로 | - | - | 연결 없음 | - | - |
| 핏빛 침식 | - | - | 연결 없음 | - | - |
| 번식 · 혈육 숙련 | - | - | 연결 없음 | - | - |
| 순수 혈육 | - | - | 연결 없음 | - | - |
| 번식 · 혈육 | - | - | 연결 없음 | - | - |
| 폭염 | special.png | `MonsterExFlameKeywords`<br>`BurningColor`<br>`BaoyanKeywords` | 직접 연결 | IconS_Buff_057.png | 98068, 98140 |
| 공허 | void.png | `NothingnessIconKeywords`<br>`EmptinessKeywords`<br>`PVPEmptinessKeywords`<br>`PVPVoidKeywords`<br>`PVPVoidKeyColour`<br>`PVPEmptinessColour`<br>`EnergyColour` | 직접 연결 | IconS_Buff_029.png | 3815, 47842 |
| 발견 | special.png | `FaxianKeywords`<br>`PVPDiscoveryKeyWords`<br>`CardKeyWord` | 연결 없음 | - | - |
| 둔화 | special.png | `SlowIconKeywords`<br>`PVPSlowKeywords` | 동명 버프 아이콘 | IconS_Buff_024.png<br>VFX [object Object] | 19555 |
| 허무 | special.png | `CardTip`<br>`NothingnessIconKeywords`<br>`EmptinessKeywords` | 연결 없음 | - | - |
| 초거리 | special.png | `WormholeKeywords` | 연결 없음 | - | - |
| 폐기 | - | `DestructionKeywords` | 연결 없음 | - | - |
| 준비 | special.png | `PrepareKeypvewords`<br>`PrepareKeypvewords1`<br>`PrepareKeywords` | 연결 없음 | - | - |
| 관통 피해 | special.png | `PunctureDamagewords`<br>`PVPPunctureDamagewords`<br>`CardKeyWord` | 연결 없음 | - | - |
| 장벽 | barrier.png | `ParcloseIconKeywords`<br>`PVPProtectiveKeywords`<br>`ParcloseColour`<br>`ReinforceColour` | 직접 연결 | IconS_Buff_013.png | 3332, 3589, 3638, 45050 |
| 고정 피해 | - | `RealDamage` | 연결 없음 | - | - |
| 촉수 피해 | special.png | `CardTip`<br>`TentacleInjurieIconKeywords`<br>`CardKeyWord` | 연결 없음 | - | - |
| 죽음 저항 | special.png | `CardKeyWord`<br>`Guaiwusiwangdikang`<br>`DeathResistanceIconKeywords` | 동명 버프 아이콘 | IconS_Buff_012.png | 23726, 94600 |
| 강탈 | special.png | - | 연결 없음 | - | - |
| 반격 | special.png | `RetaliateIconKeywords`<br>`PVPRetaliateIconKeywords`<br>`StrengthenKeywords`<br>`RetaliateColour` | 직접 연결 | IconS_Buff_019.png | 19998 |
| 여파 | special.png | `RippleKeywords` | 연결 없음 | - | - |
| 중독 | special.png | `IntoxicationIconKeywords`<br>`CardTip`<br>`PVPMethysisKeywords`<br>`IntoxicationColour` | 직접 연결 | IconS_Buff_006.png | 3068, 19995, 126990 |
| 출혈 | special.png | `BleedingIconKeywords`<br>`PVPBleedingKeywords`<br>`BleedingColour`<br>`PVPVulnerabilityIconColour` | 직접 연결 | IconS_Buff_022.png | 2840, 47873, 67866 |
| 포식 | special.png | `DevouredIconKeywords`<br>`CardKeyWord`<br>`CardTip` | 연결 없음 | - | - |
| 배아 | special.png | `DerivativeCardKeywords_2`<br>`CardKeyWord` | 연결 없음 | - | - |
| 배아 융합 | special.png | `EmbryoFusionIconKeywords`<br>`CardKeyWord`<br>`CardTip` | 연결 없음 | - | - |
| 희생 | special.png | `SacrificeKeyWord`<br>`PVPSacrificeKeyWords`<br>`BlueKeyWord` | 직접 연결 | IconS_Buff_041.png | 36014, 36124, 120363 |
| 소멸 | - | - | 연결 없음 | - | - |
| 초차원 공간 | special.png | `CardKeyWord`<br>`DimensionalSpaceIconKeywords` | 연결 없음 | - | - |
| 차원 이동 | special.png | `SingularityKeywords3` | 연결 없음 | - | - |
| 워프 | special.png | `TransitionIconKeywords`<br>`Rune_13` | 직접 연결 | UI_Rune_13_Small.png | 3698 |
| 강생 의식 | special.png | `DwmofeiKeywords`<br>`BirthRitual` | 동명 버프 아이콘 | IconS_Buff_079.png | 119052, 119108, 120324 |
| 요새화 | - | `ReinforceKeywords` | 연결 없음 | - | - |
| 인내 | special.png | `PainWord`<br>`CardKeyWord` | 직접 연결 | IconS_Buff_040.png | 34689, 34691 |
| 연소 | special.png | `BurningKeywords`<br>`BurningKeywords2` | 직접 VFX | CardFaceVFX 89940 | 81354 |
| 활염 | special.png | `HuoyanKeywords`<br>`HuoyanKeywords4`<br>`HuoyanKeywords1`<br>`HuoyanKeywords3`<br>`HuoyanKeywords2` | 직접 VFX | CardFaceVFX 98291<br>CardFaceVFX 98290<br>CardFaceVFX 98292 | 98466, 98468, 98470 |
| 도취 | special.png | `WitherKeywords0`<br>`WitherKeywords` | 연결 없음 | - | - |
| 명계 | special.png | `MingqiKeywords` | 동명 버프 VFX | IconS_Buff_016.png<br>VFX 1:120543;2:120541;3:120547;4:120540;5:120544 | 120320 |
| 운명 재단 | special.png | `CutKeywords` | 동명 버프 아이콘 | IconS_Buff_055.png | 134285 |
| 죄의 낙인 | special.png | - | 연결 없음 | - | - |
| 번식 축전 | - | `BreedingKeywords2` | 직접 연결 | IconS_Buff_088.png | 139039 |
| 번식배아 | - | - | 연결 없음 | - | - |
| 침식 | special.png | `Corrosion` | 연결 없음 | - | - |
| 공명 | special.png | `ResonanceKeywords` | 연결 없음 | - | - |
| 광상 | special.png | `Kuangxiang` | 연결 없음 | - | - |
| 창의 | special.png | `Chuangyi` | 동명 버프 아이콘 | IconS_Buff_077.png | 99640 |
| 석화 | - | `PetrifactionIconKeywords`<br>`ComaKeywords`<br>`ComaColour`<br>`PetrifactionColour` | 직접 연결 | IconS_Buff_023.png | 3208, 47831 |
| 기절 | - | `ComaKeywords`<br>`DerivativeCardKeywords_3`<br>`ComaColour`<br>`HunmiKeywords` | 직접 연결 | IconS_Buff_023.png | 19992 |
| 특이점 도약 | special.png | `SingularityKeywords` | 연결 없음 | - | - |
| 직명 | special.png | `SilkKeywords` | 동명 버프 아이콘 | IconS_Buff_084.png | 134237 |
| 인지 착란 | special.png | `ErosionColorInkKeywords`<br>`PVPCognitiveDissonanceKeyWords`<br>`ExclamationPointColour` | 동명 버프 아이콘 | IconS_Buff_008.png | 140673 |
| 소용돌이 장전 | special.png | `WhirlpoolKeywords` | 동명 버프 아이콘 | IconS_Buff_081.png | 131351 |
| 몽인 | special.png | `DreamGuide`<br>`PurpleKeyWord` | 직접 연결 | IconS_Buff_043.png | 40484 |
| 약속 | special.png | `WitherKeywords1` | 연결 없음 | - | - |
| 영혼 탈취 | special.png | `WitherKeywords2` | 연결 없음 | - | - |
| 제의 | special.png | `CardKeyWord` | 공용 아이콘만 존재 | IconS_Buff_016.png | 52068 |
| 의식 | special.png | `O07CardKeyWord` | 연결 없음 | - | - |
| 사냥 | special.png | `BattueKeywords` | 연결 없음 | - | - |
| 집단 사냥 | special.png | `BattueKeywords` | 연결 없음 | - | - |
| 공감 | special.png | `AnalysisKeywords0`<br>`AnalysisKeywords3` | 동명 버프 아이콘 | IconS_Buff_053.png | 80328, 80332 |
| 레무리아 | - | - | 연결 없음 | - | - |
| 회명 · 심해 | - | - | 연결 없음 | - | - |
| 원초·혼돈 | - | - | 연결 없음 | - | - |
| 과식 | caraboo-apple.png | `MonsterB11_AFFull`<br>`WormGrowth1`<br>`WormGrowth2`<br>`WormGrowth` | 동명 버프 아이콘 | IconS_Buff_091.png | 149398, 149576 |
| 봉헌 | caraboo-apple.png | `SacrificialMark1`<br>`SacrificialMark` | 직접 연결 | IconS_Buff_092.png | 145229 |
| 축복 | special.png | `DerivativeCardKeywords_152`<br>`DerivativeCardKeywords_161`<br>`PVPBless`<br>`Blessing`<br>`BlessingColour`<br>`BlessingIconKeywords`<br>`PVPBlessColour` | 직접 연결 | IconS_Buff_026.png<br>IconS_Buff_025.png | 3669, 146154 |
| 선물 | special.png | `Blessing`<br>`MonsterBless` | 연결 없음 | - | - |
| 대가 | special.png | `BlessingNegativeEffect` | 연결 없음 | - | - |
