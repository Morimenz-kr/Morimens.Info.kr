# 캐릭터 효과 데이터 갱신

신규 캐릭터는 다음 순서로 추가한다.

1. `data/character_manifest.json`에 캐릭터를 추가한다.
2. 나무위키 캐릭터 문서에 스킬과 계령 표가 작성됐는지 확인한다.
3. 아래 명령을 실행한다.

```powershell
node tools/update-character-effects.mjs <캐릭터 ID> <나무위키 문서 URL>
```

예시:

```powershell
node tools/update-character-effects.mjs nautila https://namu.wiki/w/노틸라
```

스크립트는 해당 ID의 `data/character_effects.json` 항목만 생성하거나 교체한다.
스킬이 없거나 계령이 3개가 아니면 파일을 수정하지 않고 오류를 출력한다.
영지 각성과 최종 법칙은 캐릭터당 하나인지 검증한다. 영역별 효과나 단계별
연계 카드가 여러 개 있으면 스킬을 중복 생성하지 않고 `variants`에 묶는다.
스킬 섹션 안의 `파생 명령`, `버프`, `증상`, `추가 공격`은 `derivedCards`로 저장한다.

나무위키 접속이 불안정하면 HTML을 먼저 저장한 뒤 파일 경로를 전달할 수 있다.

```powershell
node tools/update-character-effects.mjs nautila C:\tmp\nautila.html
```
