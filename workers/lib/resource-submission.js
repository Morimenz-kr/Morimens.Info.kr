import {
    HttpError,
    createSubmissionKey,
    jsonResponse,
    readJsonBody,
    requireEnv,
    safeErrorMessage,
    snapshotDiscordMessage,
    utf8ToBase64
} from './http.js';
import { withSubmissionCoordinator } from './coordinator.js';
import { createGitHubIssueWithOptionalLabels } from './github-adapter.js';
import { postDiscordChannelMessage } from './discord-adapter.js';
import { SUBMISSION_MARKER, resolveSubmissionIssue } from './submission.js';
import { RESOURCE_PROPOSAL_MARKER } from './resource-issue.js';
import {
    defaultResourceSelection,
    formatTarget,
    normalizeResourceProposal,
    resourceProposalFingerprint
} from './resource-schema.js';
import { getResourceCharacterRegistry } from './resource-repository.js';
import {
    buildResourceComponents,
    buildResourceMessageContent
} from './resource-discord-view.js';

function getResourceLinkSubmitHtml() {
    return `<!doctype html>
<html lang="ko">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>resource_links 승인 요청</title>
  <style>
    body{font-family:system-ui,-apple-system,Segoe UI,sans-serif;max-width:720px;margin:40px auto;padding:0 20px;line-height:1.5}
    code{word-break:break-all}
  </style>
</head>
<body>
  <h1>resource_links 승인 요청</h1>
  <p id="status">전송 중입니다...</p>
  <pre id="detail"></pre>
  <script>
    const statusEl = document.getElementById('status');
    const detailEl = document.getElementById('detail');
    const fromBase64Url = value => {
      const base64 = value.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(value.length / 4) * 4, '=');
      const binary = atob(base64);
      const bytes = Uint8Array.from(binary, char => char.charCodeAt(0));
      return new TextDecoder().decode(bytes);
    };

    (async () => {
      const encoded = location.hash.slice(1);
      if (!encoded) throw new Error('payload가 없습니다.');

      const payload = JSON.parse(fromBase64Url(encoded));
      const response = await fetch('/resource-links', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const result = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(result.error || 'HTTP ' + response.status);
      }

      statusEl.textContent = '승인 요청을 보냈습니다. Discord를 확인하세요. 이 창은 곧 닫힙니다.';
      detailEl.textContent = result.issueUrl || '';
      setTimeout(() => window.close(), 1200);
    })().catch(error => {
      statusEl.textContent = '승인 요청 실패';
      detailEl.textContent = error.message;
    });
  </script>
</body>
</html>`;
}

async function handleResourceLinkProposal(request, env, corsHeaders) {
    const preliminaryProposal = normalizeResourceProposal(await readJsonBody(request));
    requireEnv(env, ['GITHUB_TOKEN', 'GITHUB_OWNER', 'GITHUB_REPO', 'DISCORD_BOT_TOKEN', 'DISCORD_CHANNEL_ID']);
    const registry = await getResourceCharacterRegistry(env);
    const proposal = normalizeResourceProposal(preliminaryProposal, registry);
    const submissionKey = await createSubmissionKey(
        'resource-link',
        resourceProposalFingerprint(proposal),
        request.headers.get('Idempotency-Key')
    );
    const result = await submitResourceProposal(env, proposal, registry, submissionKey);

    return jsonResponse({
        ok: true,
        issueUrl: result.issue.html_url,
        discordMessageId: result.discordMessage.id,
        suggestedTargets: proposal.targets,
        deduplicated: result.deduplicated
    }, 200, corsHeaders);
}

async function createResourceProposalIssue(env, proposal, submissionKey) {
    const targetText = proposal.targets.length > 0
        ? proposal.targets.map(formatTarget).join(', ')
        : 'none';
    const body = [
        '## Resource Link Proposal',
        '',
        `- URL: ${proposal.link.url}`,
        `- Title: ${proposal.link.title}`,
        `- Suggested targets: ${targetText}`,
        `- Source tab: ${proposal.sourceTab || 'unknown'}`,
        `- Submitted by: ${proposal.submittedBy}`,
        `- Submitted: ${proposal.submittedAt}`,
        '',
        `<!-- ${RESOURCE_PROPOSAL_MARKER}:${utf8ToBase64(JSON.stringify(proposal))} -->`,
        `<!-- ${SUBMISSION_MARKER}:${submissionKey} -->`
    ].join('\n');

    return createGitHubIssueWithOptionalLabels(env, {
        title: `[Resource Link] ${proposal.link.title.slice(0, 80)}`,
        body,
        labels: ['resource-link:pending']
    });
}

async function submitResourceProposal(env, proposal, registry, submissionKey) {
    const result = await withSubmissionCoordinator(
        env,
        submissionKey,
        (previous, putRecord) => submitResourceProposalOnce(
            env, proposal, registry, submissionKey, previous, putRecord
        )
    );
    return result;
}

async function submitResourceProposalOnce(env, proposal, registry, submissionKey, previous, putRecord) {
    if (previous?.status === 'complete' && previous.issue?.html_url && previous.discordMessage?.id) {
        return {
            issue: previous.issue,
            discordMessage: previous.discordMessage,
            deduplicated: true
        };
    }

    const issue = await resolveSubmissionIssue(
        env,
        submissionKey,
        previous,
        putRecord,
        () => createResourceProposalIssue(env, proposal, submissionKey)
    );

    if (
        (previous?.status === 'notifying' || previous?.status === 'notification-ambiguous')
        && !previous.discordMessage?.id
    ) {
        const recoveryError = new HttpError(
            'Approval notification outcome is ambiguous; verify Discord before retrying',
            409,
            { expose: true, code: 'submission_recovery_required' }
        );
        recoveryError.releaseWorkflowLock = true;
        throw recoveryError;
    }

    let discordMessage = previous?.discordMessage?.id ? previous.discordMessage : null;
    if (!discordMessage) {
        await putRecord({
            status: 'notifying',
            issue,
            notificationStartedAt: new Date().toISOString()
        });
        try {
            discordMessage = snapshotDiscordMessage(await sendResourceProposalMessage(env, proposal, issue, registry));
            await putRecord({
                status: 'notified',
                issue,
                discordMessage
            });
        } catch (error) {
            console.error('Discord approval notification failed after issue creation', error);
            await putRecord({
                status: 'notification-ambiguous',
                issue,
                lastError: safeErrorMessage(error),
                updatedAt: new Date().toISOString()
            });
            const retryableError = new HttpError('Approval notification outcome is ambiguous; verify Discord before retrying', 502, {
                expose: true,
                code: 'submission_recovery_required'
            });
            retryableError.releaseWorkflowLock = true;
            throw retryableError;
        }
    }

    await putRecord({
        status: 'complete',
        issue,
        discordMessage,
        completedAt: new Date().toISOString()
    });

    return {
        issue,
        discordMessage,
        deduplicated: Boolean(previous)
    };
}

async function sendResourceProposalMessage(env, proposal, issue, registry) {
    const targetText = proposal.targets.length > 0
        ? proposal.targets.map(formatTarget).join('\n')
        : '추천 대상 없음';

    const payload = {
        content: buildResourceMessageContent(defaultResourceSelection(), registry),
        allowed_mentions: { parse: [] },
        embeds: [{
            title: proposal.link.title,
            url: proposal.link.url,
            description: proposal.link.desc || '설명 없음',
            color: 0x3498DB,
            image: proposal.link.image ? { url: proposal.link.image } : undefined,
            fields: [
                { name: '추천 등록 대상', value: targetText.slice(0, 1024), inline: false },
                { name: 'GitHub Issue', value: issue.html_url, inline: false }
            ],
            footer: { text: `Submitted by ${proposal.submittedBy}` },
            timestamp: new Date().toISOString()
        }],
        components: buildResourceComponents(issue.number, false, defaultResourceSelection(), registry)
    };

    return postDiscordChannelMessage(env, payload);
}

export {
    getResourceLinkSubmitHtml,
    handleResourceLinkProposal,
    submitResourceProposal
};
