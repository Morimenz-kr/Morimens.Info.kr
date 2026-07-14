import { HttpError, requireEnv, snapshotIssue } from './http.js';
import { githubJsonFetch } from './github-adapter.js';

export const SUBMISSION_MARKER = 'submission-id';

const SUBMISSION_RECOVERY_GRACE_MS = 10 * 60 * 1000;

const SUBMISSION_RECOVERY_PAGE_LIMIT = 10;

async function resolveSubmissionIssue(env, submissionKey, previous, putRecord, createIssue) {
    if (previous?.issue?.html_url) return previous.issue;

    if (previous?.status === 'creating') {
        const recovered = await findSubmissionIssue(env, submissionKey);
        if (recovered) {
            await putRecord({
                status: 'issue-created',
                issue: recovered,
                recoveredAt: new Date().toISOString()
            });
            return recovered;
        }

        const startedAt = Date.parse(previous.startedAt || previous.updatedAt || '');
        if (Number.isFinite(startedAt) && Date.now() - startedAt < SUBMISSION_RECOVERY_GRACE_MS) {
            throw new HttpError('Submission recovery is still in progress', 409, {
                expose: true,
                code: 'submission_recovery_pending',
                headers: { 'Retry-After': '300' }
            });
        }
    }

    const startedAt = previous?.startedAt || new Date().toISOString();
    await putRecord({ status: 'creating', startedAt });
    const issue = snapshotIssue(await createIssue());
    await putRecord({ status: 'issue-created', issue, startedAt });
    return issue;
}

async function findSubmissionIssue(env, submissionKey) {
    requireEnv(env, ['GITHUB_TOKEN', 'GITHUB_OWNER', 'GITHUB_REPO']);
    const marker = `<!-- ${SUBMISSION_MARKER}:${submissionKey} -->`;

    for (let page = 1; page <= SUBMISSION_RECOVERY_PAGE_LIMIT; page += 1) {
        const response = await githubJsonFetch(
            env,
            `/issues?state=all&sort=created&direction=desc&per_page=100&page=${page}`,
            { method: 'GET' }
        );
        if (!response.ok) {
            const detail = await response.text();
            throw new HttpError(`GitHub submission recovery failed: ${response.status} ${detail.slice(0, 300)}`, 502);
        }

        const issues = await response.json();
        if (!Array.isArray(issues)) {
            throw new HttpError('GitHub submission recovery returned an invalid response', 502);
        }
        const match = issues.find(issue => String(issue?.body || '').includes(marker));
        if (match) return snapshotIssue(match);
        if (issues.length < 100) return null;
    }

    throw new HttpError('Submission recovery is inconclusive; manual review is required', 503, {
        expose: true,
        code: 'submission_recovery_required'
    });
}

export { resolveSubmissionIssue };
