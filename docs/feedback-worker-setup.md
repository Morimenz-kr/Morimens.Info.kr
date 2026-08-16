# Feedback Worker Setup

This Worker receives website feedback, creates a GitHub Issue, and posts a Discord notification.
Resource link proposals do not create GitHub Issues. `RESOURCE_PROPOSAL_STATE` SQLite Durable Object is the canonical proposal state; `RESOURCE_LINK_STATE` KV is a mirror and recovery index. Approved updates are batched into a single PR.

## Required Cloudflare secrets

Set these in the Cloudflare Worker dashboard.

```text
GITHUB_TOKEN=<fine-grained GitHub personal access token>
DISCORD_WEBHOOK_URL=<new Discord webhook URL>
DISCORD_BOT_TOKEN=<Discord bot token>
DISCORD_PUBLIC_KEY=<Discord application public key>
```

## Required Cloudflare variables

Set these as plain environment variables.

```text
GITHUB_OWNER=Morimenz-kr
GITHUB_REPO=Morimens.Info.kr
ALLOWED_ORIGINS=https://morimenz-kr.github.io,https://arca.live
DISCORD_APPLICATION_ID=<Discord application id>
DISCORD_CHANNEL_ID=<Discord channel id for approval messages>
GIFT_CODE_CHANNEL_ID=1529856105562247358
DISCORD_APPROVER_USER_IDS=<comma-separated Discord user ids allowed to approve>
GITHUB_BASE_BRANCH=main
ARCA_LIST_URLS=https://arca.live/b/forgettingeve?category=%EC%A0%95%EB%B3%B4
https://arca.live/b/forgettingeve?category=dwrr
ARCA_LIST_SCAN_LIMIT=20
ARCA_MAX_PROPOSALS_PER_RUN=5
ARCA_DESCRIPTION_BACKFILL_LIMIT=5
```

`ARCA_LIST_URLS` can be comma-separated or line-separated. If it is empty, the scheduled monitor does nothing and the existing feedback/resource-link endpoints keep working.

## GitHub token permissions

Use a fine-grained personal access token scoped only to this repository.

```text
Repository: Morimenz-kr/Morimens.Info.kr
Issues: Read and write
Contents: Read and write
Pull requests: Read and write
Metadata: Read-only
```

The Worker tries to add the `feedback:new` label. If that label does not exist yet, it will still create the feedback issue without the label. Create the label in GitHub if you want filtered automation later.

Approved resource link updates are not committed directly to `main`. The Worker writes them to the automation branch:

```text
resource-links/pending
```

The Worker creates or reuses one open PR from `resource-links/pending` into `main`. Its description is automatically updated with every link added to the pending branch, including the target category or character.

운영 전략은 **단일 pending PR + 제보별 commit**이다. 승인된 제보 하나가 Queue 작업 하나와 commit 하나가 되며, 모든 commit은 `resource-links/pending`의 열린 PR 하나에 순서대로 쌓인다. Queue consumer는 `max_batch_size: 1`, `max_concurrency: 1`로 고정하여 여러 제보가 같은 브랜치를 동시에 수정하는 충돌을 막는다. 별도 PR을 제보마다 만들지 않으므로 GitHub Actions와 관리 비용도 줄어 무료 운영에 유리하다.

사용자 흐름은 다음과 같다.

1. 10분 Cron이 새 글을 찾고 게시물 ID, canonical URL, 열린 pending PR, main 등록 여부를 확인한 뒤 Discord에 한 번만 제보한다.
2. 사용자는 Discord에서 추천 대상을 승인하거나 직접 대상을 선택한 뒤 `선택 반영`을 누른다.
3. Worker가 제보를 원자적으로 선점하고 Queue에 넣는다. 중복 클릭은 같은 작업을 다시 만들지 않는다.
4. Queue가 제보별 commit을 `resource-links/pending`에 추가하고 단일 PR을 생성하거나 갱신한다.
5. 사용자는 `/list`로 누적 내용을 확인하고 `/push`로 PR을 `main`에 병합한다.

`resource-links/pending` 복구는 Git ref의 강제 갱신을 사용하지 않는다. 새 링크가 없는 뒤처진 브랜치만 fast-forward하고, pending에 main에 없는 링크가 하나라도 있으면 PR 조회가 일시적으로 어긋나더라도 커밋을 보존한 채 재시도한다.

After the next Cron run following deployment, the Worker registers two global Discord commands automatically. They use the same `DISCORD_APPROVER_USER_IDS` permission check as the approval controls.

- `/list`: show the links newly added to the currently open `resource-links/pending` PR.
- `/push`: merge that PR into `main`. GitHub Pages deployment then runs from the merged `main` commit.

Discord global commands can take up to an hour to appear after their first registration.

## Resource link approval UI

Discord approval messages support both recommended targets and manual target selection.

- `추천대로 OK`: approve the Worker's suggested targets.
- `선택 반영`: approve the manually selected categories and characters.
- `선택 초기화`: clear manual selections without closing the Discord approval request.
- `보류`: close the request without changing `resource_links`.

Manual selections and proposal transitions are saved canonically in the `RESOURCE_PROPOSAL_STATE` SQLite Durable Object. `RESOURCE_LINK_STATE` KV receives a best-effort mirror used for recovery and indexing; it is not the authority for a live proposal. If a Durable Object record is unavailable, the Worker may restore it from the KV mirror. Category selections and character selections do not update the PR by themselves; use `선택 반영` after choosing all targets. Character selections are grouped by relems tabs: `혼돈`, `심해`, `혈육`, `초차원`.

## Arca scheduled monitor

The Worker can periodically scan Arca list pages and send new posts to the same Discord approval workflow.

Required setup:

- Bind the SQLite Durable Object classes as `RESOURCE_PROPOSAL_STATE` and `ARCA_DEDUPE`.
- Add a KV namespace and bind it to this Worker as `RESOURCE_LINK_STATE` for mirror/recovery data.
- Add a Cron Trigger: `*/10 * * * *`.
- Set `ARCA_LIST_URLS` to the list pages to watch.

`ARCA_DEDUPE`는 선택 사항이 아니다. 바인딩이 없거나 호출할 수 없으면 감시 글을 Discord로 보내지 않는 **fail-closed** 방식으로 동작한다. 중복 방지 장치가 고장 난 상태에서 중복 메시지를 양산하는 것보다 해당 실행을 실패시키고 다음 Cron에서 재시도하는 편이 안전하다.

Discord 전송 직전에는 `main`과 열린 `resource-links/pending` PR의 `data/resource_links.json`을 함께 읽는다. Arca URL은 query, fragment, trailing slash와 관계없이 채널/게시물 ID를 canonical identity로 사용한다. 어느 쪽에든 같은 identity가 있으면 대기 항목을 terminal 상태로 기록하고 Discord 전송을 생략한다. GitHub 등록 상태를 확인할 수 없을 때도 fail-closed로 해당 실행을 중단한다.

자동 감시 proposal ID는 canonical identity의 SHA-256에서 결정적으로 만든다. `RESOURCE_PROPOSAL_STATE` Durable Object의 원자적 create가 URL별 전송 잠금이므로, 서로 다른 post ID가 같은 원문을 가리키거나 여러 Cron이 겹쳐도 활성 proposal은 하나만 존재한다. 자동 감시는 `ARCA_DEDUPE`와 `RESOURCE_PROPOSAL_STATE` 중 하나라도 없으면 Discord를 호출하지 않는다.

Discord POST 결과가 네트워크 단절 등으로 불명확하면 자동 재전송하지 않는다. 해당 글을 `deliveryStatus: unknown`으로 보존하고 중복 가능성을 차단한다. 명확한 Discord HTTP 실패는 다음 Cron에서 재시도할 수 있다.

10분 주기는 새 글 알림에 충분히 빠르면서 무료 한도에 여유를 둔다. 하루 실행 횟수는 5분 주기의 288회에서 144회로 절반이 되어 목록 조회, Durable Object, KV, Queue 호출과 외부 API 부하를 함께 줄인다. 수집 지연은 최대 약 10분이며, 이 서비스의 사람이 승인하는 흐름에서는 안정성과 비용 대비 적절한 절충이다.

Current watch list:

```text
https://arca.live/b/forgettingeve?category=%EC%A0%95%EB%B3%B4
https://arca.live/b/forgettingeve?category=dwrr
```

Behavior:

- If `ARCA_LIST_URLS` is missing, the scheduled monitor exits without changing anything. If `ARCA_DEDUPE` is missing, monitored proposals fail closed and are not sent.
- Each run checks only the top `ARCA_LIST_SCAN_LIMIT` posts per list.
- Each run sends at most `ARCA_MAX_PROPOSALS_PER_RUN` Discord approval requests.
- A post is saved to KV only after the Discord approval message is created successfully.
- If the detail page remains unavailable after retries, the Worker sends the proposal with the list title, URL, and thumbnail first.
- Each later Cron checks up to `ARCA_DESCRIPTION_BACKFILL_LIMIT` approved Arca links with empty descriptions on the open pending branch and `main`, then fills their descriptions when the detail page becomes available.
- Automatic monitoring only creates approval requests. Updating `data/resource_links.json` still requires Discord approval.

## Gift code scheduled monitor

The Gift Code monitor is currently disabled by default while scheduled-task reliability is being verified. Set `GIFT_CODE_MONITOR_ENABLED=true` in the Worker only when it is ready to be resumed.

When enabled, the scheduled Worker reads the mirrored official gift-code channel and writes newly detected codes directly to `data/resource_links.json` on `main`.

Required setup:

- Keep the existing `RESOURCE_LINK_STATE` KV binding for message deduplication.
- Add a Cron Trigger. `*/10 * * * *` is sufficient.
- Give the bot `View Channel` and `Read Message History` permissions in the alert channel.
- Enable `Message Content Intent` in the Discord Developer Portal.

The configured alert channel is `1529856105562247358`. `GIFT_CODE_CHANNEL_ID` can be changed later if the alert channel moves. The monitor only accepts messages that include a code-related notice and a code-shaped value, so ordinary chat messages are ignored.

## Discord interaction setup

In the Discord Developer Portal, set the Interactions Endpoint URL to:

```text
https://your-worker.your-subdomain.workers.dev/discord/interactions
```

The Worker validates `X-Signature-Ed25519` with `DISCORD_PUBLIC_KEY` and responds to Discord `PING` checks.

## Website config

After deploying the Worker, copy the Worker URL into:

```js
FEEDBACK_ENDPOINT_URL: 'https://your-worker.your-subdomain.workers.dev'
```

in `config/config.js`.

## Deploy and verify

`wrangler.jsonc`에는 `ArcaDedupObject`를 추가하는 `v1`과 `ResourceProposalObject`를 추가하는 `v2` SQLite migration이 모두 있어야 한다. 특히 기존 v1 배포에 proposal state를 추가할 때는 `v2`를 제거하거나 이름을 바꾸지 말고 다음과 같이 배포한다.

```bash
npx wrangler deploy
```

배포 과정에서 Wrangler가 미적용된 `v2` migration을 적용한다. 이미 적용된 migration tag는 재사용하거나 수정하지 말고, 이후 Durable Object 스키마 변경은 새 tag로 추가한다.

배포 후에는 다음을 점검한다.

- Worker bindings에 `RESOURCE_PROPOSAL_STATE`, `ARCA_DEDUPE`, `RESOURCE_LINK_STATE`, `RESOURCE_LINK_QUEUE`가 모두 표시되는지 확인한다.
- Durable Object migration 목록에 `v1`과 `v2`가 성공적으로 반영됐는지 확인한다.
- Cron Trigger가 `*/10 * * * *`, Queue consumer가 `max_batch_size: 1`과 `max_concurrency: 1`인지 확인한다.
- 테스트 제보를 하나 만들고 Discord에서 선택 변경 후 승인하여 상태가 유지되는지 확인한다.
- 승인 한 번에 Queue 작업과 `resource-links/pending` commit이 각각 하나만 생기는지 확인한다.
- 같은 감시 게시글 ID를 다시 수집해 Discord 메시지나 commit이 중복 생성되지 않는지 확인한다.
- 열린 PR이 하나만 유지되고 `/list` 조회와 `/push` 병합이 정상 동작하는지 확인한다.
- Worker 로그에 Durable Object, KV mirror, Queue 재시도, Discord 또는 GitHub 오류가 없는지 확인한다.

## Test payload

Feedback:

```bash
curl -X POST "https://your-worker.your-subdomain.workers.dev" \
  -H "Content-Type: application/json" \
  -d "{\"reporter\":\"test\",\"message\":\"feedback test\",\"sourceUrl\":\"https://morimenz-kr.github.io/Morimens.Info.kr/\"}"
```

Resource link proposal:

```bash
curl -X POST "https://your-worker.your-subdomain.workers.dev/resource-links" \
  -H "Content-Type: application/json" \
  -d "{\"url\":\"https://arca.live/b/forgettingeve/123\",\"title\":\"테스트 글\",\"desc\":\"테스트 설명\",\"image\":\"\",\"targets\":[\"category:newbie\"]}"
```

Category list:

```bash
curl "https://your-worker.your-subdomain.workers.dev/resource-links/categories"
```

## Resource link bookmarklet

Save this as a browser bookmark URL. It opens the Worker submit page in a new tab; the tab closes automatically after a successful Discord approval request.

```js
javascript:(function(){const endpoint='https://carriepigeon.khj613401.workers.dev/resource-links/submit';let c=document.querySelector('.article-content')||document.querySelector('.write_div')||document.body;let image='';let max=0;if(c){const imgs=c.querySelectorAll('img');for(let i=0;i<imgs.length;i++){const img=imgs[i];if(img.classList.contains('arcon')||img.src.includes('smilies')||img.src.includes('/e/')||img.src.includes('emoticon'))continue;const w=parseInt(img.getAttribute('width'))||img.naturalWidth||1;const h=parseInt(img.getAttribute('height'))||img.naturalHeight||1;const area=w*h;if(area>max){max=area;image=img.src;}}}if(!image)image=document.querySelector('meta[property="og:image"]')?.content||'';if(image&&image.startsWith('//'))image='https:'+image;const rawTitle=document.querySelector('meta[property="og:title"]')?.content||document.title;const title=rawTitle.replace(/\s*[-–—|]\s*망각전야\s*채널\s*$/i,'').trim();let url=window.location.href;const shortLink=document.querySelector('a[title="게시물 주소"]');if(shortLink&&shortLink.href)url=shortLink.href;const payload={url,title,desc:document.querySelector('meta[property="og:description"]')?.content||'',image,sourceTab:document.querySelector('.badge,.category,.article-category')?.textContent?.trim()||'',submittedBy:'bookmarklet',submittedAt:new Date().toISOString()};const json=JSON.stringify(payload);let binary='';const bytes=new TextEncoder().encode(json);for(const b of bytes)binary+=String.fromCharCode(b);const encoded=btoa(binary).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');window.open(endpoint+'#'+encoded,'_blank','noopener');})();
```
