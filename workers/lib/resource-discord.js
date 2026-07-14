import {
    MAX_JSON_BODY_BYTES,
    readTextBodyWithLimit,
    safeErrorMessage
} from './http.js';
import { acquireWorkflowLock, releaseWorkflowLock } from './coordinator.js';
import {
    closeGitHubIssue,
    commentGitHubIssue,
    getGitHubIssue,
    updateGitHubIssueBody
} from './github-adapter.js';
import {
    editDiscordMessage,
    interactionResponse,
    verifyDiscordRequest
} from './discord-adapter.js';
import {
    RESOURCE_LINKS_PENDING_BRANCH,
    getResourceCharacterRegistry,
    updateResourceLinks
} from './resource-repository.js';
import {
    defaultResourceSelection,
    formatTarget,
    normalizeRelems,
    normalizeTargets,
    replaceCharacterTargetsByRelems,
    replaceTargetsByType
} from './resource-schema.js';
import {
    extractResourceProposal,
    extractResourceSelection,
    upsertResourceSelection
} from './resource-issue.js';
import {
    buildResourceComponents,
    buildResourceMessageContent
} from './resource-discord-view.js';

const INTERACTION_PING = 1;

const INTERACTION_MESSAGE_COMPONENT = 3;

const RESPONSE_PONG = 1;

const RESPONSE_CHANNEL_MESSAGE = 4;

const RESPONSE_DEFERRED_UPDATE = 6;

const SAFE_DISCORD_USER_ID_PATTERN = /^\d{15,25}$/;

async function handleDiscordInteraction(request, env, ctx) {
    const rawBody = await readTextBodyWithLimit(request, MAX_JSON_BODY_BYTES);
    const isVerified = await verifyDiscordRequest(request, rawBody, env);
    if (!isVerified) {
        return new Response('invalid request signature', { status: 401 });
    }

    let interaction;
    try {
        interaction = JSON.parse(rawBody);
    } catch {
        return interactionResponse(RESPONSE_CHANNEL_MESSAGE, {
            content: '잘못된 Discord interaction payload입니다.',
            flags: 64
        });
    }

    if (interaction.type === INTERACTION_PING) {
        return interactionResponse(RESPONSE_PONG);
    }

    if (interaction.type !== INTERACTION_MESSAGE_COMPONENT) {
        return interactionResponse(RESPONSE_CHANNEL_MESSAGE, {
            content: '지원하지 않는 interaction입니다.',
            flags: 64
        });
    }

    if (!env.DISCORD_CHANNEL_ID || String(interaction.channel_id || '') !== String(env.DISCORD_CHANNEL_ID)) {
        return interactionResponse(RESPONSE_CHANNEL_MESSAGE, {
            content: '승인 채널이 일치하지 않습니다.',
            flags: 64
        });
    }

    if (!isAllowedApprover(interaction, env)) {
        return interactionResponse(RESPONSE_CHANNEL_MESSAGE, {
            content: '이 작업을 승인할 권한이 없습니다.',
            flags: 64
        });
    }

    const decision = parseResourceDecision(interaction);
    if (!decision) {
        return interactionResponse(RESPONSE_CHANNEL_MESSAGE, {
            content: '알 수 없는 resource link 작업입니다.',
            flags: 64
        });
    }

    ctx.waitUntil(processResourceDecision(env, interaction, decision));
    return interactionResponse(RESPONSE_DEFERRED_UPDATE);
}

function parseResourceDecision(interaction) {
    const customId = interaction.data?.custom_id || '';
    const parts = customId.split(':');
    if (parts[0] !== 'rl') return null;

    const action = parts[1];

    if (action === 'approve') {
        const issueNumber = Number(parts[2]);
        if (!Number.isInteger(issueNumber) || issueNumber <= 0) return null;
        return { action, issueNumber, targets: null };
    }

    if (action === 'approve-selected') {
        const issueNumber = Number(parts[2]);
        if (!Number.isInteger(issueNumber) || issueNumber <= 0) return null;
        return { action, issueNumber, targets: null };
    }

    if (action === 'clear-selection') {
        const issueNumber = Number(parts[2]);
        if (!Number.isInteger(issueNumber) || issueNumber <= 0) return null;
        return { action, issueNumber, targets: [] };
    }

    if (action === 'hold') {
        const issueNumber = Number(parts[2]);
        if (!Number.isInteger(issueNumber) || issueNumber <= 0) return null;
        return { action, issueNumber, targets: [] };
    }

    if (action === 'categories') {
        const issueNumber = Number(parts[2]);
        if (!Number.isInteger(issueNumber) || issueNumber <= 0) return null;
        return {
            action,
            issueNumber,
            targets: normalizeTargets(interaction.data?.values || [])
        };
    }

    if (action === 'relems') {
        const relems = normalizeRelems(parts[2]);
        const issueNumber = Number(parts[3]);
        if (!Number.isInteger(issueNumber) || issueNumber <= 0) return null;
        return { action, issueNumber, relems };
    }

    if (action === 'characters') {
        const relems = normalizeRelems(parts[2]);
        const issueNumber = Number(parts[3]);
        if (!Number.isInteger(issueNumber) || issueNumber <= 0) return null;
        return {
            action,
            issueNumber,
            relems,
            targets: normalizeTargets(interaction.data?.values || [])
        };
    }

    return null;
}

async function processResourceDecision(env, interaction, decision) {
    const lockKey = `decision:${decision.issueNumber}`;
    let lock = null;

    try {
        lock = await acquireDecisionLock(env, lockKey);
        if (!lock) {
            await editDiscordMessage(env, interaction, {
                content: '동일 요청을 이미 처리 중입니다. 잠시 후 결과를 확인하세요.',
                components: interaction.message?.components || []
            });
            return;
        }

        const registry = await getResourceCharacterRegistry(env);
        const issue = await getGitHubIssue(env, decision.issueNumber);
        if (issue.state !== 'open') {
            await editDiscordMessage(env, interaction, {
                content: '이미 처리되어 닫힌 요청입니다.',
                components: buildResourceComponents(decision.issueNumber, true, defaultResourceSelection(), registry)
            });
            return;
        }

        const proposal = extractResourceProposal(issue.body || '', registry);
        const selection = extractResourceSelection(issue.body || '', registry);

        if (decision.action === 'hold') {
            await commentGitHubIssue(env, decision.issueNumber, `Held without updating resource_links. Handler: ${getInteractionUserLabel(interaction)}`);
            await closeGitHubIssue(env, decision.issueNumber);
            await editDiscordMessage(env, interaction, {
                content: `보류 처리됨: resource_links를 변경하지 않았습니다. (${getInteractionUserLabel(interaction)})`,
                components: buildResourceComponents(decision.issueNumber, true, selection, registry)
            });
            return;
        }

        if (decision.action === 'categories') {
            const updatedSelection = {
                ...selection,
                targets: replaceTargetsByType(selection.targets, 'category', decision.targets, registry),
                updatedAt: new Date().toISOString(),
                updatedBy: getInteractionUserLabel(interaction)
            };
            await updateResourceSelection(env, issue, updatedSelection, registry);
            await editDiscordMessage(env, interaction, {
                content: buildResourceMessageContent(updatedSelection, registry),
                components: buildResourceComponents(decision.issueNumber, false, updatedSelection, registry)
            });
            return;
        }

        if (decision.action === 'relems') {
            const updatedSelection = {
                ...selection,
                activeRelems: decision.relems,
                updatedAt: new Date().toISOString(),
                updatedBy: getInteractionUserLabel(interaction)
            };
            await updateResourceSelection(env, issue, updatedSelection, registry);
            await editDiscordMessage(env, interaction, {
                content: buildResourceMessageContent(updatedSelection, registry),
                components: buildResourceComponents(decision.issueNumber, false, updatedSelection, registry)
            });
            return;
        }

        if (decision.action === 'characters') {
            const updatedSelection = {
                ...selection,
                activeRelems: decision.relems,
                targets: replaceCharacterTargetsByRelems(selection.targets, decision.relems, decision.targets, registry),
                updatedAt: new Date().toISOString(),
                updatedBy: getInteractionUserLabel(interaction)
            };
            await updateResourceSelection(env, issue, updatedSelection, registry);
            await editDiscordMessage(env, interaction, {
                content: buildResourceMessageContent(updatedSelection, registry),
                components: buildResourceComponents(decision.issueNumber, false, updatedSelection, registry)
            });
            return;
        }

        if (decision.action === 'clear-selection') {
            const updatedSelection = {
                ...selection,
                targets: [],
                updatedAt: new Date().toISOString(),
                updatedBy: getInteractionUserLabel(interaction)
            };
            await updateResourceSelection(env, issue, updatedSelection, registry);
            await editDiscordMessage(env, interaction, {
                content: buildResourceMessageContent(updatedSelection, registry),
                components: buildResourceComponents(decision.issueNumber, false, updatedSelection, registry)
            });
            return;
        }

        const targets = decision.action === 'approve-selected'
            ? selection.targets
            : proposal.targets;
        if (!targets || targets.length === 0) {
            await editDiscordMessage(env, interaction, {
                content: '처리 안 됨: 선택된 등록 대상이 없습니다. resource_links를 변경하지 않았습니다.',
                components: buildResourceComponents(decision.issueNumber, false, selection, registry)
            });
            return;
        }

        const result = await updateResourceLinks(env, proposal.link, targets, registry);
        await commentGitHubIssue(env, decision.issueNumber, [
            `resource_links batch PR update complete. Handler: ${getInteractionUserLabel(interaction)}`,
            '',
            `Added: ${result.added.map(formatTarget).join(', ') || 'none'}`,
            `Already existed: ${result.skipped.map(formatTarget).join(', ') || 'none'}`,
            `Missing targets: ${result.missing.map(formatTarget).join(', ') || 'none'}`,
            `Branch: ${RESOURCE_LINKS_PENDING_BRANCH}`,
            `Commit: ${result.commitUrl}`,
            `PR: ${result.prUrl}`
        ].join('\n'));
        await closeGitHubIssue(env, decision.issueNumber);

        await editDiscordMessage(env, interaction, {
            content: [
                'resource_links 배치 PR 업데이트 완료',
                `PR: ${result.prUrl}`,
                `추가: ${result.added.map(formatTarget).join(', ') || 'none'}`,
                `이미 존재: ${result.skipped.map(formatTarget).join(', ') || 'none'}`,
                `누락 대상: ${result.missing.map(formatTarget).join(', ') || 'none'}`
            ].join('\n'),
            components: buildResourceComponents(decision.issueNumber, true, selection, registry)
        });
    } catch (error) {
        console.error(error);
        await editDiscordMessage(env, interaction, {
            content: `처리 실패: ${safeErrorMessage(error)}`,
            components: interaction.message?.components || []
        });
    } finally {
        if (lock) {
            try {
                await releaseDecisionLock(env, lock);
            } catch (error) {
                // A failed release keeps the Durable Object locked and prevents a double decision.
                console.error('Decision lock release failed; coordinator remains fail-closed', error);
            }
        }
    }
}

async function updateResourceSelection(env, issue, selection, registry) {
    const body = upsertResourceSelection(issue.body || '', selection, registry);
    await updateGitHubIssueBody(env, issue.number, body);
}

async function acquireDecisionLock(env, key) {
    const owner = crypto.randomUUID();
    const lock = await acquireWorkflowLock(env, key, owner);
    return lock.acquired ? { key, owner } : null;
}

async function releaseDecisionLock(env, lock) {
    await releaseWorkflowLock(env, lock.key, lock.owner);
}

function isAllowedApprover(interaction, env) {
    const allowed = String(env.DISCORD_APPROVER_USER_IDS || '')
        .split(',')
        .map(value => value.trim())
        .filter(value => SAFE_DISCORD_USER_ID_PATTERN.test(value));

    if (allowed.length === 0) {
        console.error('Discord approval denied: DISCORD_APPROVER_USER_IDS is missing or invalid');
        return false;
    }

    const userId = interaction.member?.user?.id || interaction.user?.id || '';
    return allowed.includes(userId);
}

function getInteractionUserLabel(interaction) {
    const user = interaction.member?.user || interaction.user || {};
    return user.username ? `${user.username} (${user.id || 'unknown'})` : 'unknown';
}

export {
    handleDiscordInteraction
};
