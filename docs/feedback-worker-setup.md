# Feedback Worker Setup

This Worker receives website feedback, creates a GitHub Issue, and posts a Discord notification.
It can also receive resource link proposals, ask for Discord approval with buttons/select menus, and batch approved canonical `data/resource_links.json` plus affected runtime-shard updates into a single PR.

## Worker module layout

`workers/feedback-worker.js` is the Wrangler entrypoint and contains only route dispatch,
health responses, scheduled-event delegation, and the required `WorkflowCoordinator`
re-export. Implementation dependencies point in one direction:

```text
feedback-worker.js
├─ lib/feedback.js
├─ lib/resource-links.js (resource facade)
│  ├─ lib/arca-monitor.js ──────── lib/resource-submission.js
│  ├─ lib/resource-submission.js ─ lib/resource-discord-view.js
│  ├─ lib/resource-discord.js ──── lib/resource-issue.js
│  ├─ lib/resource-repository.js ─ lib/github-adapter.js
│  └─ lib/resource-schema.js ───── lib/http.js
├─ lib/security.js
└─ lib/coordinator.js (WorkflowCoordinator Durable Object)
```

- `http.js` contains validation, bounded body reading, errors, encoding, and response helpers.
- `security.js` owns CORS/origin, API-key, public-gate, and rate-limit policy.
- `github-adapter.js` and `discord-adapter.js` encapsulate the GitHub and Discord transports.
- `submission.js` owns interrupted-side-effect recovery by submission marker.
- `resource-schema.js` owns pure proposal, target, selection, and character-manifest validation.
- `resource-repository.js` owns character-manifest reads and the pending-branch/file/PR update transaction.
- `resource-issue.js` owns the encoded proposal and selection markers stored in GitHub Issue bodies.
- `resource-discord-view.js` renders Discord content/components without side effects.
- `resource-discord.js` owns signature-gated interaction routing, authorization, decision locking,
  and approval execution.
- `resource-submission.js` owns proposal intake, idempotent Issue creation, and Discord notification;
  `arca-monitor.js` owns only the scheduled source adapter.
- `feedback.js` contains the feedback domain workflow; `resource-links.js` is a compatibility facade.
- `coordinator.js` exports the Durable Object and its client-side lock operations.

There are no circular imports or isolate-global state maps. Durable Object storage is the
authoritative distributed state; the character manifest is fetched per relevant request
instead of being held in a mutable module cache.

## Required Cloudflare secrets

Set these in the Cloudflare Worker dashboard.

```text
GITHUB_TOKEN=<fine-grained GitHub personal access token>
DISCORD_WEBHOOK_URL=<new Discord webhook URL>
DISCORD_BOT_TOKEN=<Discord bot token>
DISCORD_PUBLIC_KEY=<Discord application public key>
SUBMISSION_API_KEY=<high-entropy key for trusted non-browser submissions>
```

## Required Cloudflare variables

Set these as plain environment variables.

```text
GITHUB_OWNER=Morimenz-kr
GITHUB_REPO=Morimens.Info.kr
ALLOWED_ORIGINS=https://morimenz-kr.github.io
DISCORD_APPLICATION_ID=<Discord application id>
DISCORD_CHANNEL_ID=<Discord channel id for approval messages>
DISCORD_APPROVER_USER_IDS=<comma-separated Discord user ids allowed to approve>
GITHUB_BASE_BRANCH=main
ARCA_LIST_URLS=https://arca.live/b/forgettingeve?category=%EC%A0%95%EB%B3%B4
https://arca.live/b/forgettingeve?category=dwrr
ARCA_LIST_SCAN_LIMIT=20
ARCA_MAX_PROPOSALS_PER_RUN=5
ALLOW_ORIGINLESS_SUBMISSIONS=false
ALLOW_LOCALHOST_ORIGINS=false
ALLOW_PUBLIC_RESOURCE_LINKS=false
```

`ARCA_LIST_URLS` can be comma-separated or line-separated. If it is empty, the scheduled monitor does nothing and the existing feedback/resource-link endpoints keep working.

`ALLOWED_ORIGINS` is an exact browser-origin allowlist, not a URL-prefix list. It is only
a CORS policy; an `Origin` header is never treated as authentication. Keep the GitHub
Pages origin and only add origins that must submit directly. Requests without an Origin
header are rejected by default. For trusted CLI or server automation, send
`X-Submission-Key` with `SUBMISSION_API_KEY`. Set `ALLOW_ORIGINLESS_SUBMISSIONS=true`
only when anonymous direct submissions are an intentional operational requirement.
Only HTTPS origins are accepted in production. Local development may opt in to
`http://localhost`, `http://*.localhost`, `http://127.0.0.1`, or `http://[::1]` by setting
`ALLOW_LOCALHOST_ORIGINS=true` and explicitly listing that origin; arbitrary HTTP origins
remain invalid.

`ALLOW_PUBLIC_RESOURCE_LINKS` is `false` in the committed production config. Trusted
resource proposals can still use `X-Submission-Key`. Do not enable anonymous browser
resource proposals until an upstream bot challenge such as Cloudflare Turnstile or an
equivalent WAF rule is deployed and smoke-tested. The per-IP Worker rate limiter limits a
single source but cannot stop a distributed botnet.

## Required Cloudflare coordination and rate-limit bindings

Every feedback submission, resource-link proposal, and Discord approval decision uses a
Durable Object transaction as its single-owner boundary. Anonymous browser submissions
also require a Cloudflare Rate Limiting binding. There is deliberately no KV or
isolate-memory fallback: a missing or failing binding returns `503` before a mutation.

The repository's `wrangler.jsonc` is the deployment source for the mandatory bindings:

```jsonc
{
  "durable_objects": {
    "bindings": [
      {
        "name": "WORKFLOW_COORDINATOR",
        "class_name": "WorkflowCoordinator"
      }
    ]
  },
  "migrations": [
    {
      "tag": "workflow-coordinator-v1",
      "new_sqlite_classes": ["WorkflowCoordinator"]
    }
  ],
  "ratelimits": [
    {
      "name": "PUBLIC_SUBMISSION_RATE_LIMITER",
      "namespace_id": "1001",
      "simple": { "limit": 5, "period": 60 }
    }
  ]
}
```

Use a namespace ID unique within the account. The rate-limit key includes the submission
kind and the Cloudflare connecting IP. Cloudflare Rate Limiting is an abuse-control layer,
not strict accounting; trusted automation should still use `SUBMISSION_API_KEY`.

The coordinator's exclusive lock expires after five minutes; completed and recovery state
is retained for 24 hours. Before GitHub Issue creation, the Worker records a `creating`
state. An interrupted retry waits a ten-minute recovery grace period and scans up to the
1,000 most recent repository Issues for the exact `submission-id` marker before it may
create anything. If that scan is not conclusive, the request fails closed for manual
review. A failed Discord approval-message delivery is also treated as ambiguous and is
not automatically resent, because resending could create two active approval messages.

This is a deliberate availability tradeoff. A GitHub outage or an ambiguous external
response can return `409`, `502`, or `503` and delay retry. The 24-hour record window is
the idempotency guarantee; after it expires, an identical submission is treated as a new
submission. Operators should inspect GitHub/Discord before manually retrying a
`submission_recovery_required` response.

## Reproducible deployment procedure

Cloudflare Rate Limiting bindings require Wrangler 4.36.0 or later. The commands below
pin the minimum supported CLI version so a deployment does not silently use an older
configuration parser.

1. Confirm the target account and inspect the local bundle without deploying:

   ```powershell
   npx wrangler@4.36.0 whoami
   npx wrangler@4.36.0 deploy --dry-run
   ```

2. Set encrypted values. Wrangler deployments do not delete omitted secrets:

   ```powershell
   npx wrangler@4.36.0 secret put GITHUB_TOKEN
   npx wrangler@4.36.0 secret put DISCORD_WEBHOOK_URL
   npx wrangler@4.36.0 secret put DISCORD_BOT_TOKEN
   npx wrangler@4.36.0 secret put DISCORD_PUBLIC_KEY
   npx wrangler@4.36.0 secret put SUBMISSION_API_KEY
   ```

3. Verify the existing dashboard variables `DISCORD_APPLICATION_ID`,
   `DISCORD_CHANNEL_ID`, `DISCORD_APPROVER_USER_IDS`, and optional Arca monitor variables.
   `keep_vars: true` in `wrangler.jsonc` preserves account-specific dashboard variables
   that are intentionally absent from the repository. It does not preserve omitted KV or
   Cron bindings. The committed base config intentionally disables the optional Arca
   monitor; add the binding and trigger described below before deployment if it must stay
   enabled.

4. Deploy the same Worker name used by the configured website endpoint, then confirm the
   deployment and public health response:

   ```powershell
   npx wrangler@4.36.0 deploy
   npx wrangler@4.36.0 deployments list
   curl.exe -i https://carriepigeon.khj613401.workers.dev/
   ```

   The health body must be exactly
   `{"ok":true,"service":"morimens-feedback-worker"}` and must not expose binding or
   secret-presence metadata.

5. Run one explicitly authorized production smoke submission with a unique message and
   `X-Submission-Key`. It creates a real GitHub Issue and Discord notification, so do not
   run it as a read-only check. Confirm the response URL, the public Issue privacy
   boundary, the private Discord notification, and a deduplicated second request using
   the same payload.

Until step 5 succeeds against the deployed Worker, the live endpoint remains unverified
even if local tests and Wrangler's dry-run pass.

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

The Worker creates or reuses one open PR from `resource-links/pending` into `main`. It builds the canonical source and every approved target shard into one Git tree and advances the pending branch with one non-forced reference update. A tree/commit failure leaves the branch head unchanged; a concurrent reference conflict rebuilds the complete tree from the new head before one retry. PR lookup or creation happens only after that atomic branch update succeeds. Review and merge the PR manually.

The category IDs, Discord labels, and route titles are owned by `shared/resource-categories.js`. The shard generator requires the canonical category key set and titles to match it exactly, so adding or removing a category cannot silently drift between the website and Worker UI.

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

- Create a KV namespace and copy the returned account-specific ID:

  ```powershell
  npx wrangler@4.36.0 kv namespace create RESOURCE_LINK_STATE
  ```

- Add the following keys to `wrangler.jsonc`, replacing the placeholder with that ID:

  ```jsonc
  "kv_namespaces": [
    {
      "binding": "RESOURCE_LINK_STATE",
      "id": "REPLACE_WITH_THE_RETURNED_KV_NAMESPACE_ID"
    }
  ],
  "triggers": {
    "crons": ["*/30 * * * *"]
  }
  ```

- Set `ARCA_LIST_URLS` to the list pages to watch.

Current watch list:

```text
https://arca.live/b/forgettingeve?category=%EC%A0%95%EB%B3%B4
https://arca.live/b/forgettingeve?category=dwrr
```

Behavior:

- If `ARCA_LIST_URLS` or `RESOURCE_LINK_STATE` is missing, the scheduled monitor exits without changing anything.
- The committed `wrangler.jsonc` omits both optional keys, so a base deployment is fail-safe: no new Cron is installed, and any surviving external trigger exits when the KV binding is absent. Do not assume dashboard-only KV/Cron state survives a Wrangler deployment.
- Each run checks only the top `ARCA_LIST_SCAN_LIMIT` posts per list.
- Each run sends at most `ARCA_MAX_PROPOSALS_PER_RUN` Discord approval requests.
- A post is saved to KV only after the GitHub Issue and Discord approval message are created successfully.
- Automatic monitoring only creates approval requests. Updating `data/resource_links.json` still requires Discord approval.
- Submission idempotency and decision locks are held by `WORKFLOW_COORDINATOR`; KV is not used as a lock or rate counter.

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
  -H "X-Submission-Key: \$SUBMISSION_API_KEY" \
  -d "{\"reporter\":\"test\",\"message\":\"feedback test\",\"sourceUrl\":\"https://morimenz-kr.github.io/Morimens.Info.kr/\"}"
```

Resource link proposal:

```bash
curl -X POST "https://your-worker.your-subdomain.workers.dev/resource-links" \
  -H "Content-Type: application/json" \
  -H "X-Submission-Key: \$SUBMISSION_API_KEY" \
  -d "{\"url\":\"https://arca.live/b/forgettingeve/123\",\"title\":\"테스트 글\",\"desc\":\"테스트 설명\",\"image\":\"\",\"targets\":[\"category:newbie\"]}"
```

Category list:

```bash
curl "https://your-worker.your-subdomain.workers.dev/resource-links/categories"
```

The two POST examples use the API key because curl does not send a browser Origin
header. Browser feedback from an allowed origin does not need this header, but it is
accepted only when `PUBLIC_SUBMISSION_RATE_LIMITER` is healthy. Browser resource-link
submissions are additionally blocked while `ALLOW_PUBLIC_RESOURCE_LINKS=false`.

## Security behavior

- Feedback, resource proposals, and Discord interactions accept request bodies up to 24 KiB. The Worker enforces this while streaming, before JSON parsing or signature verification, and returns `413` when exceeded.
- Feedback, titles, descriptions, reporter names, target IDs, and URLs are validated and length-limited before GitHub or Discord calls.
- Feedback source URLs, resource destination URLs, image URLs, Discord webhooks, and production browser origins require HTTPS. Only explicitly opted-in localhost browser origins may use HTTP during development.
- An empty or invalid DISCORD_APPROVER_USER_IDS value denies every approval action.
- Discord interaction signatures must be valid and no older than five minutes.
- Anonymous submissions fail closed without the platform rate limiter; trusted submissions require the API key.
- Anonymous resource-link submissions are disabled by default; enabling them requires a separately deployed and verified distributed-bot control gate.
- Repeated submissions and approval decisions are serialized by Durable Object transactions across Worker isolates.
- Reporter/contact data is never included in the public GitHub Issue. If an API client supplies `reporter`, it is sent only to the maintainer Discord notification. Keep that Discord channel access-restricted. The website form does not collect contact information, strips query/fragment data from the source URL, and warns that the message and page URL can be public.
- Untrusted `@user`/`@team` strings are neutralized before GitHub Issue/comment creation, and every Discord message sets `allowed_mentions.parse` to an empty list.
- If the resource branch commit succeeds but PR creation fails, the branch is preserved and the next approval retries only the missing PR.

## Resource link bookmarklet

The committed production gate makes this bookmarklet read/prepare-only until
`ALLOW_PUBLIC_RESOURCE_LINKS=true`. Enable that flag only after the Turnstile/WAF gate
above is live; otherwise the submit page returns `resource_links_public_disabled`.

Save this as a browser bookmark URL. It opens the Worker submit page in a new tab; the tab closes automatically after a successful Discord approval request.

```js
javascript:(function(){const endpoint='https://carriepigeon.khj613401.workers.dev/resource-links/submit';let c=document.querySelector('.article-content')||document.querySelector('.write_div')||document.body;let image='';let max=0;if(c){const imgs=c.querySelectorAll('img');for(let i=0;i<imgs.length;i++){const img=imgs[i];if(img.classList.contains('arcon')||img.src.includes('smilies')||img.src.includes('/e/')||img.src.includes('emoticon'))continue;const w=parseInt(img.getAttribute('width'))||img.naturalWidth||1;const h=parseInt(img.getAttribute('height'))||img.naturalHeight||1;const area=w*h;if(area>max){max=area;image=img.src;}}}if(!image)image=document.querySelector('meta[property="og:image"]')?.content||'';if(image&&image.startsWith('//'))image='https:'+image;const rawTitle=document.querySelector('meta[property="og:title"]')?.content||document.title;const title=rawTitle.replace(/\s*[-–—|]\s*망각전야\s*채널\s*$/i,'').trim();let url=window.location.href;const shortLink=document.querySelector('a[title="게시물 주소"]');if(shortLink&&shortLink.href)url=shortLink.href;const payload={url,title,desc:document.querySelector('meta[property="og:description"]')?.content||'',image,sourceTab:document.querySelector('.badge,.category,.article-category')?.textContent?.trim()||'',submittedBy:'bookmarklet',submittedAt:new Date().toISOString()};const json=JSON.stringify(payload);let binary='';const bytes=new TextEncoder().encode(json);for(const b of bytes)binary+=String.fromCharCode(b);const encoded=btoa(binary).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');window.open(endpoint+'#'+encoded,'_blank','noopener');})();
```
