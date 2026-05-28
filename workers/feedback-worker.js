const DEFAULT_ALLOWED_ORIGIN = 'https://morimenz-kr.github.io';

export default {
    async fetch(request, env) {
        try {
            const origin = request.headers.get('Origin') || '';
            const corsHeaders = getCorsHeaders(origin, env);

            if (request.method === 'GET') {
                return jsonResponse({
                    ok: true,
                    service: 'morimens-feedback-worker',
                    hasGitHubOwner: Boolean(env.GITHUB_OWNER),
                    hasGitHubRepo: Boolean(env.GITHUB_REPO),
                    hasGitHubToken: Boolean(env.GITHUB_TOKEN),
                    hasDiscordWebhook: Boolean(env.DISCORD_WEBHOOK_URL)
                }, 200, corsHeaders);
            }

            if (request.method === 'OPTIONS') {
                return new Response(null, { status: 204, headers: corsHeaders });
            }

            if (request.method !== 'POST') {
                return jsonResponse({ error: 'Method not allowed' }, 405, corsHeaders);
            }

            let feedback;
            try {
                feedback = await request.json();
            } catch (error) {
                return jsonResponse({ error: 'Invalid JSON' }, 400, corsHeaders);
            }

            const normalized = normalizeFeedback(feedback);
            if (!normalized.message) {
                return jsonResponse({ error: 'message is required' }, 400, corsHeaders);
            }

            const issue = await createGitHubIssue(env, normalized);
            await notifyDiscord(env, normalized, issue);

            return jsonResponse({ ok: true, issueUrl: issue.html_url }, 200, corsHeaders);
        } catch (error) {
            console.error(error);
            return jsonResponse({ error: error.message || 'Feedback worker failed' }, 500, {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'POST, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type'
            });
        }
    }
};

function getCorsHeaders(origin, env) {
    const allowedOrigins = (env.ALLOWED_ORIGINS || DEFAULT_ALLOWED_ORIGIN)
        .split(',')
        .map(value => value.trim())
        .filter(Boolean);
    const allowOrigin = allowedOrigins.includes(origin) ? origin : allowedOrigins[0];

    return {
        'Access-Control-Allow-Origin': allowOrigin,
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Vary': 'Origin'
    };
}

function normalizeFeedback(feedback) {
    return {
        reporter: String(feedback.reporter || '익명(Anonymous)').slice(0, 80),
        message: String(feedback.message || '').trim().slice(0, 6000),
        sourceUrl: String(feedback.sourceUrl || '').slice(0, 500),
        pageTitle: String(feedback.pageTitle || '').slice(0, 200),
        userAgent: String(feedback.userAgent || '').slice(0, 500),
        submittedAt: feedback.submittedAt || new Date().toISOString()
    };
}

async function createGitHubIssue(env, feedback) {
    requireEnv(env, ['GITHUB_TOKEN', 'GITHUB_OWNER', 'GITHUB_REPO']);

    const title = makeIssueTitle(feedback);
    const body = [
        '## Feedback',
        feedback.message,
        '',
        '## Metadata',
        `- Reporter: ${feedback.reporter}`,
        `- Page: ${feedback.sourceUrl || 'unknown'}`,
        `- Title: ${feedback.pageTitle || 'unknown'}`,
        `- Submitted: ${feedback.submittedAt}`,
        `- User Agent: ${feedback.userAgent || 'unknown'}`
    ].join('\n');

    const issuePayload = {
        title,
        body,
        labels: ['feedback:new']
    };

    let response = await fetch(`https://api.github.com/repos/${env.GITHUB_OWNER}/${env.GITHUB_REPO}/issues`, {
        method: 'POST',
        headers: {
            'Accept': 'application/vnd.github+json',
            'Authorization': `Bearer ${env.GITHUB_TOKEN}`,
            'Content-Type': 'application/json',
            'User-Agent': 'morimens-feedback-worker',
            'X-GitHub-Api-Version': '2022-11-28'
        },
        body: JSON.stringify(issuePayload)
    });

    if (response.status === 422) {
        delete issuePayload.labels;
        response = await fetch(`https://api.github.com/repos/${env.GITHUB_OWNER}/${env.GITHUB_REPO}/issues`, {
            method: 'POST',
            headers: {
                'Accept': 'application/vnd.github+json',
                'Authorization': `Bearer ${env.GITHUB_TOKEN}`,
                'Content-Type': 'application/json',
                'User-Agent': 'morimens-feedback-worker',
                'X-GitHub-Api-Version': '2022-11-28'
            },
            body: JSON.stringify(issuePayload)
        });
    }

    if (!response.ok) {
        const detail = await response.text();
        throw new Error(`GitHub issue creation failed: ${response.status} ${detail.slice(0, 300)}`);
    }

    return response.json();
}

async function notifyDiscord(env, feedback, issue) {
    if (!env.DISCORD_WEBHOOK_URL) return;

    const response = await fetch(env.DISCORD_WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            username: 'Morimens Wiki Bot',
            embeds: [{
                title: '새로운 제보가 도착했습니다',
                description: feedback.message,
                color: 0xFF9F43,
                fields: [
                    { name: '제보자', value: feedback.reporter, inline: true },
                    { name: '발생 페이지', value: feedback.sourceUrl || 'unknown', inline: false },
                    { name: 'GitHub Issue', value: issue.html_url, inline: false }
                ],
                footer: { text: 'Morimens Wiki Report System' },
                timestamp: new Date().toISOString()
            }]
        })
    });

    if (!response.ok) console.warn(`Discord notification failed: ${response.status}`);
}

function makeIssueTitle(feedback) {
    const firstLine = feedback.message.split('\n').find(Boolean) || '새 피드백';
    return `[Feedback] ${firstLine.slice(0, 80)}`;
}

function requireEnv(env, names) {
    const missing = names.filter(name => !env[name]);
    if (missing.length > 0) {
        throw new Error(`Missing env vars: ${missing.join(', ')}`);
    }
}

function jsonResponse(data, status, headers) {
    return new Response(JSON.stringify(data), {
        status,
        headers: {
            ...headers,
            'Content-Type': 'application/json; charset=utf-8'
        }
    });
}
