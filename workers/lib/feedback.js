import {
    SAFE_HTTPS_PROTOCOLS,
    assertPlainObject,
    createSubmissionKey,
    jsonResponse,
    normalizeHttpUrl,
    normalizeTextField,
    readJsonBody,
    requireEnv,
    sha256Hex,
    suppressGitHubMentions
} from './http.js';
import { getClientIdentity } from './security.js';
import { withSubmissionCoordinator } from './coordinator.js';
import { createGitHubIssueWithOptionalLabels } from './github-adapter.js';
import { postDiscordWebhook } from './discord-adapter.js';
import { SUBMISSION_MARKER, resolveSubmissionIssue } from './submission.js';

async function handleFeedback(request, env, corsHeaders) {
    const normalized = normalizeFeedback(await readJsonBody(request));
    const submissionKey = await createSubmissionKey(
        'feedback',
        {
            reporter: normalized.reporter,
            message: normalized.message,
            sourceUrl: normalized.sourceUrl,
            pageTitle: normalized.pageTitle,
            client: request.headers.get('Idempotency-Key')
                ? 'explicit-idempotency-key'
                : await sha256Hex(getClientIdentity(request))
        },
        request.headers.get('Idempotency-Key')
    );
    const result = await withSubmissionCoordinator(
        env,
        submissionKey,
        (previous, putRecord) => submitFeedback(env, normalized, submissionKey, previous, putRecord)
    );

    return jsonResponse({
        ok: true,
        issueUrl: result.issue.html_url,
        notificationSent: result.notificationSent,
        deduplicated: result.deduplicated
    }, 200, corsHeaders);
}

async function submitFeedback(env, normalized, submissionKey, previous, putRecord) {
    if (previous?.status === 'complete' && previous.issue?.html_url) {
        return {
            issue: previous.issue,
            notificationSent: Boolean(previous.notificationSent),
            deduplicated: true
        };
    }

    const issue = await resolveSubmissionIssue(
        env,
        submissionKey,
        previous,
        putRecord,
        () => createFeedbackIssue(env, normalized, submissionKey)
    );

    if (previous?.status === 'notifying') {
        await putRecord({
            status: 'complete',
            issue,
            notificationSent: false,
            notificationState: 'unknown-after-interrupted-delivery',
            completedAt: new Date().toISOString()
        });
        return { issue, notificationSent: false, deduplicated: true };
    }

    await putRecord({
        status: 'notifying',
        issue,
        notificationStartedAt: new Date().toISOString()
    });
    const notificationSent = await notifyDiscord(env, normalized, issue);
    await putRecord({
        status: 'complete',
        issue,
        notificationSent,
        completedAt: new Date().toISOString()
    });
    return { issue, notificationSent, deduplicated: Boolean(previous) };
}

function normalizeFeedback(feedback) {
    assertPlainObject(feedback, 'payload');
    return {
        reporter: normalizeTextField(feedback.reporter, 'reporter', {
            maxLength: 80,
            defaultValue: '익명(Anonymous)',
            forbidHtml: true
        }),
        message: normalizeTextField(feedback.message, 'message', {
            maxLength: 6000,
            required: true,
            multiline: true
        }),
        sourceUrl: normalizeHttpUrl(feedback.sourceUrl, 'sourceUrl', {
            maxLength: 500,
            required: false,
            protocols: SAFE_HTTPS_PROTOCOLS
        }),
        pageTitle: normalizeTextField(feedback.pageTitle, 'pageTitle', {
            maxLength: 200,
            forbidHtml: true
        }),
        userAgent: normalizeTextField(feedback.userAgent, 'userAgent', { maxLength: 500 }),
        submittedAt: new Date().toISOString()
    };
}

async function createFeedbackIssue(env, feedback, submissionKey) {
    requireEnv(env, ['GITHUB_TOKEN', 'GITHUB_OWNER', 'GITHUB_REPO']);

    const title = makeIssueTitle(feedback);
    const body = [
        '## Feedback',
        feedback.message,
        '',
        '## Metadata',
        `- Page: ${feedback.sourceUrl || 'unknown'}`,
        `- Title: ${feedback.pageTitle || 'unknown'}`,
        `- Submitted: ${feedback.submittedAt}`,
        '',
        `<!-- ${SUBMISSION_MARKER}:${submissionKey} -->`
    ].join('\n');

    return createGitHubIssueWithOptionalLabels(env, {
        title,
        body,
        labels: ['feedback:new']
    });
}

async function notifyDiscord(env, feedback, issue) {
    if (!env.DISCORD_WEBHOOK_URL) return false;

    try {
        const response = await postDiscordWebhook(env, {
                username: 'Morimens Wiki Bot',
                allowed_mentions: { parse: [] },
                embeds: [{
                    title: '새 피드백이 접수되었습니다',
                    description: feedback.message.slice(0, 4096),
                    color: 0xFF9F43,
                    fields: [
                        { name: '제보자', value: feedback.reporter, inline: true },
                        { name: '발생 페이지', value: feedback.sourceUrl || 'unknown', inline: false },
                        { name: 'GitHub Issue', value: issue.html_url, inline: false }
                    ],
                    footer: { text: 'Morimens Wiki Report System' },
                    timestamp: new Date().toISOString()
                }]
            });

        if (!response.ok) {
            console.warn(`Discord notification failed: ${response.status}`);
            return false;
        }
        return true;
    } catch (error) {
        console.warn('Discord notification failed', error);
        return false;
    }
}

function makeIssueTitle(feedback) {
    const firstLine = feedback.message.split('\n').find(Boolean) || 'Feedback';
    return suppressGitHubMentions(`[Feedback] ${firstLine.slice(0, 80)}`);
}

export { handleFeedback };
