# 허수아비 실행하기

통합 작업 브랜치는 `codex/scarecrow-checkpoint`다. Node.js 24와 npm을 설치한 환경에서 저장소 루트에서 실행한다.

```powershell
npm ci
npm run scarecrow:build
npm run scarecrow:serve
```

`http://127.0.0.1:4185/`를 연다. 게임이나 비공개 저장소 없이 공개 실행 자료로 동작한다. 서버는 Ctrl+C로 종료한다.

수정 후 `npm test`와 `node tools/test-scarecrow.mjs`를 실행한다. 화면 검사는 서버와 Microsoft Edge가 필요하다. 검증 기록은 `.generated/scarecrow/checkpoint-proof/`에 저장한다.

계산 소스는 비공개 `morimens-data-extractor` 저장소의 같은 이름 브랜치에서 수정한다. `simulator/workspace.ps1`의 `-SiteRoot`로 이 저장소를 연결한다. 화면을 별도로 복제하지 않는다.

자료 범위는 [통합 구성](scarecrow-consolidation.md)을 참고한다. 브랜치 푸시와 Cloudflare 배포는 별도 작업이다.
