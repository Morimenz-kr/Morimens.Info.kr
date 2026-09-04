# 융재금구 실전 편성 통계 연결

기존 `dzone_info.html` UI는 변경하지 않는다. 비공개 추출기는 정제·집계한 결과만 Cloudflare Worker로 보내고, 공개 사이트는 Worker의 조회 API를 30초마다 확인한다.

## 공개 저장소에서 완료된 범위

- `GET /api/dzone/stage/{stageTid}/usage`: 최신 집계 조회
- `POST /api/dzone/stage/{stageTid}/usage`: Bearer 토큰으로 인증한 집계 저장
- 기존 `RESOURCE_LINK_STATE` KV를 `dzone:usage:stage:{stageTid}` 접두사로 분리해 재사용
- 건수와 비율의 불일치를 막기 위해 Worker에서 `rate = count / recordCount` 재계산
- 캐릭터 수, 편성 수, 편성 인원, 정수 범위 및 이미지 경로 검증
- GitHub Pages에서 Worker의 공개 GET API를 호출하도록 연결
- `main`의 Worker 변경 시 자동 배포하는 GitHub Actions 워크플로

원본 응답, UID, 리플레이 코드, 인증 정보는 이 저장소나 공개 API에 저장하지 않는다.

## 회사에서 한 번만 할 작업

새 Cloudflare 계정 API 토큰은 필요하지 않다. 저장소에는 이미 `CLOUDFLARE_API_TOKEN`과 `CLOUDFLARE_ACCOUNT_ID`가 등록되어 있다.

1. 충분히 긴 임의 문자열을 생성한다.
2. GitHub 저장소의 Actions secret `DZONE_INGEST_TOKEN`으로 등록한다.
3. 같은 값을 비공개 추출 서비스의 환경변수 `DZONE_INGEST_TOKEN`으로 등록한다.
4. 이 브랜치의 PR을 병합한다. `Deploy Cloudflare Worker` 워크플로가 Worker secret 동기화와 배포를 수행한다.

PowerShell 예시:

```powershell
$bytes = New-Object byte[] 32
[Security.Cryptography.RandomNumberGenerator]::Fill($bytes)
$token = [Convert]::ToHexString($bytes).ToLowerInvariant()
$token | gh secret set DZONE_INGEST_TOKEN --repo Morimenz-kr/Morimens.Info.kr
$env:DZONE_INGEST_TOKEN = $token
```

토큰을 콘솔, Git 커밋, 로그 또는 JSON 파일에 출력하지 않는다. 회사의 비공개 저장소에서는 `.env` 같은 추적 제외 파일이나 운영 secret store를 사용한다.

## 추출기가 보낼 요청

```http
POST https://carriepigeon.khj613401.workers.dev/api/dzone/stage/82810/usage
Authorization: Bearer <DZONE_INGEST_TOKEN>
Content-Type: application/json
```

```json
{
  "stageTid": 82810,
  "since": 1788206400,
  "recordCount": 120,
  "awakeners": [
    {
      "tid": 101,
      "name": "각성체 이름",
      "image_thumb": "images/example-thumb.webp",
      "count": 48
    }
  ],
  "parties": [
    {
      "count": 12,
      "awakeners": [
        { "tid": 101, "name": "각성체 이름", "image_thumb": "images/example-thumb.webp" }
      ]
    }
  ]
}
```

`since`는 집계 시작 Unix 초다. `fetchedAt`과 모든 `rate`는 Worker가 저장 시 생성한다. 추출기는 새 전투 기록을 반영한 집계가 달라졌을 때만 스테이지별 POST를 보내면 된다. 고정된 1분 예약 실행은 필요하지 않으며, 새 기록 이벤트를 처리해 집계 결과가 바뀐 직후 전송하는 방식을 권장한다.

## 배포 후 확인

데이터를 한 번 전송한 뒤 다음 두 경로를 확인한다.

```text
https://carriepigeon.khj613401.workers.dev/api/dzone/stage/82810/usage
https://morimenz-kr.github.io/Morimens.Info.kr/dzone_info.html
```

첫 URL은 `data.stageTid`, `data.recordCount`, `data.awakeners`, `data.parties`, `fetchedAt`을 반환해야 한다. 사이트는 최대 약 30초 안에 기존 실전 편성 통계 영역을 갱신한다.
