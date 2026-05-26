# Feedback Worker Setup

This Worker receives website feedback, creates a GitHub Issue, and posts a Discord notification.

## Required Cloudflare secrets

Set these in the Cloudflare Worker dashboard.

```text
GITHUB_TOKEN=<fine-grained GitHub personal access token>
DISCORD_WEBHOOK_URL=<new Discord webhook URL>
```

## Required Cloudflare variables

Set these as plain environment variables.

```text
GITHUB_OWNER=Morimenz-kr
GITHUB_REPO=Morimens.Info.kr
ALLOWED_ORIGINS=https://morimenz-kr.github.io
```

## GitHub token permissions

Use a fine-grained personal access token scoped only to this repository.

```text
Repository: Morimenz-kr/Morimens.Info.kr
Issues: Read and write
Metadata: Read-only
```

The Worker tries to add the `feedback:new` label. If that label does not exist yet, it will still create the issue without the label. Create the label in GitHub if you want filtered automation later.

## Website config

After deploying the Worker, copy the Worker URL into:

```js
FEEDBACK_ENDPOINT_URL: 'https://your-worker.your-subdomain.workers.dev'
```

in `config/config.js`.

## Test payload

```bash
curl -X POST "https://your-worker.your-subdomain.workers.dev" \
  -H "Content-Type: application/json" \
  -d "{\"reporter\":\"test\",\"message\":\"feedback test\",\"sourceUrl\":\"https://morimenz-kr.github.io/Morimens.Info.kr/\"}"
```
