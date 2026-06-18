# Feedback Worker Setup

This Worker receives website feedback, creates a GitHub Issue, and posts a Discord notification.
It can also receive resource link proposals, ask for Discord approval with buttons/select menus, and batch approved `data/resource_links.json` updates into a single PR.

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
DISCORD_APPROVER_USER_IDS=<comma-separated Discord user ids allowed to approve>
GITHUB_BASE_BRANCH=main
ARCA_LIST_URLS=https://arca.live/b/forgettingeve?category=%EC%A0%95%EB%B3%B4
https://arca.live/b/forgettingeve?category=dwrr
ARCA_LIST_SCAN_LIMIT=20
ARCA_MAX_PROPOSALS_PER_RUN=5
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

The Worker tries to add the `feedback:new` label. If that label does not exist yet, it will still create the issue without the label. Create the label in GitHub if you want filtered automation later.
Resource link proposals use the optional `resource-link:pending` label.

Approved resource link updates are not committed directly to `main`. The Worker writes them to the automation branch:

```text
resource-links/pending
```

The Worker creates or reuses one open PR from `resource-links/pending` into `main`. Review and merge that PR manually.

## Resource link approval UI

Discord approval messages support both recommended targets and manual target selection.

- `추천대로 OK`: approve the Worker's suggested targets.
- `선택 반영`: approve the manually selected categories and characters.
- `선택 초기화`: clear manual selections without closing the GitHub Issue.
- `보류`: close the request without changing `resource_links`.

Manual selections are saved in the GitHub Issue body. Category selections and character selections do not update the PR by themselves; use `선택 반영` after choosing all targets. Character selections are grouped by relems tabs: `혼돈`, `심해`, `혈육`, `초차원`.

## Arca scheduled monitor

The Worker can periodically scan Arca list pages and send new posts to the same Discord approval workflow.

Required setup:

- Add a KV namespace and bind it to this Worker as `RESOURCE_LINK_STATE`.
- Add a Cron Trigger: `*/30 * * * *`.
- Set `ARCA_LIST_URLS` to the list pages to watch.

Current watch list:

```text
https://arca.live/b/forgettingeve?category=%EC%A0%95%EB%B3%B4
https://arca.live/b/forgettingeve?category=dwrr
```

Behavior:

- If `ARCA_LIST_URLS` or `RESOURCE_LINK_STATE` is missing, the scheduled monitor exits without changing anything.
- Each run checks only the top `ARCA_LIST_SCAN_LIMIT` posts per list.
- Each run sends at most `ARCA_MAX_PROPOSALS_PER_RUN` Discord approval requests.
- A post is saved to KV only after the GitHub Issue and Discord approval message are created successfully.
- Automatic monitoring only creates approval requests. Updating `data/resource_links.json` still requires Discord approval.

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
