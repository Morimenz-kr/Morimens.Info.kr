const DEFAULT_ALLOWED_ORIGIN = 'https://morimenz-kr.github.io';
const RESOURCE_LINKS_PATH = 'data/resource_links.json';
const RESOURCE_LINKS_PENDING_BRANCH = 'resource-links/pending';
const DEFAULT_BASE_BRANCH = 'main';
const RESOURCE_PROPOSAL_STATE_PREFIX = 'resource-link:proposal:';
const RESOURCE_PROPOSAL_RECOVERY_CURSOR_KEY = 'resource-link:recovery-cursor:v1';
const RESOURCE_PROCESSING_STALE_MS = 5 * 60 * 1000;
const DEFAULT_STALE_PROPOSAL_SCAN_LIMIT = 5;
const INTERACTION_PING = 1;
const INTERACTION_APPLICATION_COMMAND = 2;
const INTERACTION_MESSAGE_COMPONENT = 3;
const RESPONSE_PONG = 1;
const RESPONSE_CHANNEL_MESSAGE = 4;
const RESPONSE_DEFERRED_CHANNEL_MESSAGE = 5;
const RESPONSE_DEFERRED_UPDATE = 6;
const DEFAULT_ACTIVE_RELEMS = 'chaos';
const DEFAULT_ARCA_LIST_SCAN_LIMIT = 20;
const DEFAULT_ARCA_MAX_PROPOSALS_PER_RUN = 5;
const DEFAULT_ARCA_PENDING_WRITES_PER_FEED = 5;
const DEFAULT_ARCA_DESCRIPTION_BACKFILL_LIMIT = 5;
const DEFAULT_ARCA_FETCH_TIMEOUT_MS = 10 * 1000;
const ARCA_SEEN_KEY_PREFIX = 'arca:seen:';
const ARCA_PENDING_KEY_PREFIX = 'arca:pending:';
const ARCA_FEED_STATE_KEY_PREFIX = 'arca:feed:';
const CRON_WATCHDOG_STATE_KEY = 'cron:watchdog-state:v1';
const CRON_STATUS_KEY = 'cron:status:v1';
const DEFAULT_CRON_STALE_MS = 30 * 60 * 1000;
const DEFAULT_CRON_TASK_TIMEOUT_MS = 75 * 1000;
const GIFT_CODE_SEEN_KEY_PREFIX = 'gift-code:seen:';
const GIFT_CODE_NOTIFICATION_KEY_PREFIX = 'gift-code:notification:';
const DEFAULT_GIFT_CODE_CHANNEL_ID = '1529856105562247358';
const DEFAULT_GIFT_CODE_SCAN_LIMIT = 25;
const DEFAULT_GIFT_CODE_MONITOR_ENABLED = false;
const DEFAULT_GIFT_CODE_RESOURCE_URL = 'https://morimenz-kr.github.io/Morimens.Info.kr/data/resource_links.json';
const DISCORD_RESOURCE_COMMANDS_STATE_KEY = 'discord:resource-commands:v1';
const DISCORD_RESOURCE_COMMANDS = [
    { name: 'list', description: '열린 리소스 링크 대기 목록을 표시합니다.' },
    { name: 'push', description: '대기 중인 리소스 링크를 main에 병합합니다.' }
];
const ARCA_FETCH_USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';

const ARCA_CLAIM_LEASE_MS = 2 * 60 * 1000;

export class ArcaDedupObject {
    constructor(state) {
        this.state = state;
        this.storage = state.storage;
    }

    async fetch(request) {
        const run = () => this.handleRequest(request);
        return typeof this.state.blockConcurrencyWhile === 'function'
            ? this.state.blockConcurrencyWhile(run)
            : run();
    }

    async handleRequest(request) {
        if (request.method !== 'POST') return new Response('Method not allowed', { status: 405 });
        const body = await request.json().catch(() => ({}));
        const action = String(body.action || '');
        const postId = String(body.postId || '');
        if (!postId || !['claim', 'sent', 'release'].includes(action)) {
            return Response.json({ ok: false, error: 'invalid request' }, { status: 400 });
        }

        const current = await this.storage.get('state');
        const now = Date.now();
        if (action === 'claim') {
            if (current?.status === 'sent') return Response.json({ ok: false, reason: 'sent' });
            if (current?.status === 'claimed' && Number(current.leaseUntil) > now) {
                return Response.json({ ok: false, reason: 'claimed' });
            }
            const token = crypto.randomUUID();
            await this.storage.put('state', {
                postId,
                status: 'claimed',
                token,
                leaseUntil: now + Math.max(30_000, Number(body.leaseMs) || ARCA_CLAIM_LEASE_MS),
                claimedAt: new Date(now).toISOString()
            });
            return Response.json({ ok: true, token });
        }

        if (current?.token !== String(body.token || '')) {
            return Response.json({ ok: false, reason: 'claim-mismatch' }, { status: 409 });
        }
        if (action === 'sent') {
            await this.storage.put('state', {
                ...current,
                status: 'sent',
                sentAt: new Date(now).toISOString(),
                discordMessageId: body.discordMessageId || null
            });
        } else {
            await this.storage.delete('state');
        }
        return Response.json({ ok: true });
    }
}

const RESOURCE_CATEGORIES = [
    'event',
    'weekly_yungjae',
    'newbie',
    'system',
    'weapon',
    'dreamdive',
    'myeongryun',
    'covenant',
    'code',
    'faction',
    'silverkey',
    'chess',
    'etc'
];

const RESOURCE_CATEGORY_LABELS = {
    event: '2.5주년 + 이벤트',
    weekly_yungjae: '진행중인 융재금구 팁',
    newbie: '뉴비 팁',
    system: '시스템 정보',
    weapon: '융재금구 정보',
    dreamdive: '환몽심잠 정보',
    myeongryun: '명륜 정보',
    covenant: '비밀계약 정보',
    code: '교환 코드',
    faction: '계역별 정보',
    silverkey: '은열쇠 정보',
    chess: '페이즈 체스',
    etc: '기타'
};

const RELEMS_ORDER = ['chaos', 'aequor', 'caro', 'ultra'];
const RELEMS_LABELS = {
    chaos: '혼돈',
    aequor: '심해',
    caro: '혈육',
    ultra: '초차원'
};

const RESOURCE_CHARACTERS = [
    { id: '24', name: '「24」', relems: 'chaos' },
    { id: 'nymphaea', name: '님피아', relems: 'chaos' },
    { id: 'nautila', name: '노틸라', relems: 'chaos' },
    { id: 'ryker', name: '라이커', relems: 'chaos' },
    { id: 'lily', name: '릴리', relems: 'chaos' },
    { id: 'mouchette', name: '모샤', relems: 'chaos' },
    { id: 'doll_inferno', name: '융해 · 돌', relems: 'chaos' },
    { id: 'alva', name: '엘바', relems: 'chaos' },
    { id: 'lotan_cetarchon', name: '침식 · 로탄', relems: 'chaos' },
    { id: 'karen', name: '카렌', relems: 'chaos' },
    { id: 'kathigu-ra', name: '카티구라', relems: 'chaos' },
    { id: 'tawil', name: '타비', relems: 'chaos' },
    { id: 'pandia', name: '판디아', relems: 'chaos' },
    { id: 'hameln', name: '하멜른', relems: 'chaos' },
    { id: 'goliath', name: '골리아', relems: 'aequor' },
    { id: 'coporsant', name: '코퍼산트', relems: 'aequor' },
    { id: 'murphy', name: '머피', relems: 'aequor' },
    { id: 'miryam', name: '미리암', relems: 'aequor' },
    { id: 'sanga', name: '산', relems: 'aequor' },
    { id: 'celeste', name: '셀레스트', relems: 'aequor' },
    { id: 'aurita', name: '오레타', relems: 'aequor' },
    { id: 'caecus', name: '카이커스', relems: 'aequor' },
    { id: 'Murphy_Fauxborn', name: '탄망 · 머피', relems: 'aequor' },
    { id: 'tulu', name: '툴루', relems: 'aequor' },
    { id: 'faros', name: '파로스', relems: 'aequor' },
    { id: 'vortice', name: '모스', relems: 'aequor' },
    { id: 'pontos', name: '폰토스', relems: 'aequor' },
    { id: 'doresain', name: '도어세인', relems: 'caro' },
    { id: 'leigh', name: '레이아', relems: 'caro' },
    { id: 'salvador', name: '살바도르', relems: 'caro' },
    { id: 'xu', name: '서', relems: 'caro' },
    { id: 'sorel', name: '소렐', relems: 'caro' },
    { id: 'agrippa', name: '아그리파', relems: 'caro' },
    { id: 'aigis', name: '아이기스', relems: 'caro' },
    { id: 'uvhash', name: '유우하시', relems: 'caro' },
    { id: 'thais', name: '타이스', relems: 'caro' },
    { id: 'faint', name: '파인트', relems: 'caro' },
    { id: 'pickman', name: '픽맨', relems: 'caro' },
    { id: 'helot_catena', name: '혈쇄 · 히로', relems: 'caro' },
    { id: 'saya', name: '사야', relems: 'caro' },
    { id: 'helot', name: '히로', relems: 'caro' },
    { id: 'dafoodil', name: '다포딜', relems: 'ultra' },
    { id: 'liz', name: '리즈', relems: 'ultra' },
    { id: 'winkle', name: '웬코르', relems: 'ultra' },
    { id: 'erica', name: '에리카', relems: 'ultra' },
    { id: 'horla', name: '오를라', relems: 'ultra' },
    { id: 'wanda', name: '완다', relems: 'ultra' },
    { id: 'jenkin', name: '젠킨', relems: 'ultra' },
    { id: 'castor', name: '카스토르', relems: 'ultra' },
    { id: 'casiah', name: '카시아', relems: 'ultra' },
    { id: 'clementine', name: '클레멘타인', relems: 'ultra' },
    { id: 'tinct', name: '틴커트', relems: 'ultra' },
    { id: 'pollux', name: '폴룩스', relems: 'ultra' },
    { id: 'arachne', name: '아라크네', relems: 'ultra' },
    { id: 'doll', name: '돌', relems: 'chaos' },
    { id: 'ramona', name: '라모나', relems: 'chaos' },
    { id: 'lotan', name: '로탄', relems: 'chaos' },
    { id: 'ogier', name: '오지에', relems: 'chaos' },
    { id: 'ramona_timeworn', name: '환행 · 라모나', relems: 'chaos' }
];

const RESOURCE_CHARACTER_BY_ID = Object.fromEntries(RESOURCE_CHARACTERS.map(character => [character.id, character]));

export default {
    async fetch(request, env, ctx) {
        try {
            const url = new URL(request.url);
            const origin = request.headers.get('Origin') || '';
            const corsHeaders = getCorsHeaders(origin, env);

            if (request.method === 'OPTIONS') {
                return new Response(null, { status: 204, headers: corsHeaders });
            }

            if (url.pathname === '/discord/interactions') {
                return await handleDiscordInteraction(request, env, ctx);
            }

            if (url.pathname === '/cron-watchdog' && request.method === 'POST') {
                return await handleCronWatchdog(request, env, corsHeaders);
            }

            if (url.pathname === '/deployment-complete' && request.method === 'POST') {
                return await handleDeploymentComplete(request, env, corsHeaders);
            }

            if (request.method === 'GET') {
                return handleGet(url, env, corsHeaders);
            }

            if (request.method !== 'POST') {
                return jsonResponse({ error: 'Method not allowed' }, 405, corsHeaders);
            }

            if (url.pathname === '/resource-links') {
                return await handleResourceLinkProposal(request, env, corsHeaders);
            }

            return await handleFeedback(request, env, corsHeaders);
        } catch (error) {
            console.error(error);
            return jsonResponse({ error: error.message || 'Worker failed' }, 500, {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type'
            });
        }
    },

    async scheduled(event, env, ctx) {
        ctx.waitUntil(runScheduledMaintenance(env));
    },

    async queue(batch, env) {
        for (const message of batch.messages) {
            await processQueuedResourceUpdate(env, message);
        }
    }
};

async function runScheduledMaintenance(env, scheduledTasks = null) {
    const startedAt = new Date().toISOString();
    const tasks = scheduledTasks ? [...scheduledTasks] : [
        { name: 'discord-commands', run: () => ensureDiscordResourceCommands(env) },
        { name: 'arca-resource-maintenance', run: () => runArcaResourceMaintenance(env) },
        { name: 'stale-proposal-recovery', run: () => recoverStaleResourceProposals(env) }
    ];
    if (isGiftCodeMonitorEnabled(env)) {
        tasks.push({ name: 'gift-code-monitor', run: () => handleGiftCodeMonitor(env) });
    }

    const results = await Promise.all(tasks.map(task => runScheduledTask(env, task)));
    const resultFor = (name, skipped = false) => {
        const result = results.find(item => item.name === name);
        if (!result) return skipped ? { ok: true, skipped: 'disabled' } : { ok: false, error: 'missing task result' };
        return result.status === 'completed'
            ? { ok: true, result: result.result }
            : { ok: false, error: result.error };
    };
    const completedAt = new Date().toISOString();
    const cronStatus = {
        startedAt,
        completedAt,
        ok: results.every(result => result.status === 'completed'),
        commands: resultFor('discord-commands'),
        arca: resultFor('arca-resource-maintenance'),
        giftCodes: resultFor('gift-code-monitor', true),
        recovery: resultFor('stale-proposal-recovery'),
        tasks: results
    };

    if (env.RESOURCE_LINK_STATE) {
        await env.RESOURCE_LINK_STATE.put(CRON_STATUS_KEY, JSON.stringify(cronStatus))
            .catch(error => console.error('Cron status write failed', error));
    }
    console.log('Scheduled maintenance completed', cronStatus);
    return cronStatus;
}

export class ResourceProposalObject {
    constructor(state) {
        this.state = state;
        this.storage = state.storage;
    }

    async fetch(request) {
        const run = () => this.handleRequest(request);
        return typeof this.state.blockConcurrencyWhile === 'function'
            ? this.state.blockConcurrencyWhile(run)
            : run();
    }

    async handleRequest(request) {
        if (request.method !== 'POST') return new Response('Method not allowed', { status: 405 });
        const body = await request.json().catch(() => ({}));
        const action = String(body.action || '');
        const current = await this.storage.get('state');

        if (action === 'get') {
            return current
                ? Response.json({ ok: true, state: current })
                : Response.json({ ok: false, reason: 'not-found' }, { status: 404 });
        }

        if (action === 'delete') {
            await this.storage.delete('state');
            return Response.json({ ok: true });
        }

        const nextState = body.state;
        if (!nextState?.id || !nextState?.proposal) {
            return Response.json({ ok: false, error: 'invalid proposal state' }, { status: 400 });
        }

        if (action === 'create') {
            if (current && current.deliveryStatus !== 'confirmed_failed') {
                return Response.json({ ok: false, reason: 'already-exists', state: current }, { status: 409 });
            }
            await this.storage.put('state', nextState);
            return Response.json({ ok: true, state: nextState, retried: Boolean(current) });
        }

        if (action === 'transition') {
            const expectedStatuses = Array.isArray(body.expectedStatuses)
                ? body.expectedStatuses.map(String)
                : [];
            if (!current) {
                return Response.json({ ok: false, reason: 'not-found' }, { status: 404 });
            }
            if (expectedStatuses.length > 0 && !expectedStatuses.includes(String(current.status))) {
                return Response.json({ ok: false, reason: 'status-mismatch', state: current }, { status: 409 });
            }
            if (Object.hasOwn(body, 'expectedProcessingToken')
                && String(current.processingToken || '') !== String(body.expectedProcessingToken || '')) {
                return Response.json({ ok: false, reason: 'processing-token-mismatch', state: current }, { status: 409 });
            }
            if (Object.hasOwn(body, 'expectedSelectionRevision')
                && normalizeResourceSelectionRevision(current.selection?.revision)
                    !== normalizeResourceSelectionRevision(body.expectedSelectionRevision)) {
                return Response.json({ ok: false, reason: 'selection-revision-mismatch', state: current }, { status: 409 });
            }
        } else if (action !== 'put') {
            return Response.json({ ok: false, error: 'invalid action' }, { status: 400 });
        }

        await this.storage.put('state', nextState);
        return Response.json({ ok: true, state: nextState });
    }
}

function isGiftCodeMonitorEnabled(env) {
    const value = String(env.GIFT_CODE_MONITOR_ENABLED ?? DEFAULT_GIFT_CODE_MONITOR_ENABLED).trim().toLowerCase();
    return value === 'true' || value === '1' || value === 'yes';
}

function getCronTaskTimeoutMs(env, taskName) {
    const key = `CRON_${String(taskName).replace(/[^a-z0-9]+/gi, '_').toUpperCase()}_TIMEOUT_SECONDS`;
    return getPositiveIntegerEnv(env[key], DEFAULT_CRON_TASK_TIMEOUT_MS / 1000, 10, 240) * 1000;
}

async function runScheduledTask(env, task) {
    const startedAt = new Date().toISOString();
    const timeoutMs = getCronTaskTimeoutMs(env, task.name);

    let timeoutId;
    try {
        const result = await Promise.race([
            Promise.resolve().then(task.run),
            new Promise((_, reject) => {
                timeoutId = setTimeout(() => reject(new Error(`Timed out after ${timeoutMs}ms`)), timeoutMs);
            })
        ]);
        const completedAt = new Date().toISOString();
        return { name: task.name, status: 'completed', startedAt, completedAt, timeoutMs, result };
    } catch (error) {
        const failedAt = new Date().toISOString();
        const message = error?.message || String(error);
        console.error(`Scheduled task failed: ${task.name}`, error);
        return { name: task.name, status: 'failed', startedAt, failedAt, timeoutMs, error: message };
    } finally {
        if (timeoutId) clearTimeout(timeoutId);
    }
}

async function handleCronWatchdog(request, env, corsHeaders) {
    const expectedToken = String(env.WATCHDOG_TOKEN || '');
    const suppliedToken = String(request.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
    if (!expectedToken || !suppliedToken || suppliedToken !== expectedToken) {
        return jsonResponse({ error: 'Unauthorized' }, 401, corsHeaders);
    }
    if (!env.RESOURCE_LINK_STATE) {
        return jsonResponse({ error: 'RESOURCE_LINK_STATE KV binding is missing' }, 503, corsHeaders);
    }

    const staleMs = getPositiveIntegerEnv(
        env.CRON_WATCHDOG_STALE_MINUTES,
        DEFAULT_CRON_STALE_MS / 60000,
        30,
        120
    ) * 60 * 1000;
    const now = new Date();
    const [status, watchdogState] = await Promise.all([
        env.RESOURCE_LINK_STATE.get(CRON_STATUS_KEY, 'json'),
        env.RESOURCE_LINK_STATE.get(CRON_WATCHDOG_STATE_KEY, 'json')
    ]);
    const freshness = getCronHealth(status?.completedAt, now, staleMs);
    const tasksHealthy = status?.ok !== false;
    const health = {
        ...freshness,
        healthy: freshness.healthy && tasksHealthy,
        tasksHealthy
    };

    if (!health.healthy && !watchdogState?.alertActive) {
        const failedTasks = Array.isArray(status?.tasks)
            ? status.tasks.filter(task => task.status === 'failed').map(task => task.name).join(', ')
            : '';
        await publishCronWatchdogTransition(env, {
            id: `cron-watchdog:down:${health.lastCompletedAt || 'never'}`,
            content: [
                '🚨 정보글 자동 수집 크론이 멈췄거나 작업에 실패했습니다.',
                `마지막 실행 완료: ${health.lastCompletedAt || '기록 없음'}`,
                `경과 시간: ${health.ageMinutes ?? '알 수 없음'}분`,
                failedTasks ? `실패 작업: ${failedTasks}` : null
            ].filter(Boolean).join('\n'),
            state: {
                alertActive: true,
                alertedAt: now.toISOString(),
                lastCompletedAt: health.lastCompletedAt
            }
        });
    } else if (health.healthy && watchdogState?.alertActive) {
        await publishCronWatchdogTransition(env, {
            id: `cron-watchdog:up:${watchdogState.lastCompletedAt || 'never'}`,
            content: `✅ 정보글 자동 수집 크론이 정상화되었습니다.\n최근 정상 완료: ${health.lastCompletedAt}`,
            state: {
                alertActive: false,
                recoveredAt: now.toISOString(),
                lastCompletedAt: health.lastCompletedAt
            }
        });
    }

    return jsonResponse({ ...health, status: status || null }, health.healthy ? 200 : 503, corsHeaders);
}

async function publishCronWatchdogTransition(env, transition) {
    const claim = await callArcaDedup(env, 'claim', transition.id, null, {
        leaseMs: ARCA_CLAIM_LEASE_MS
    });
    if (claim && !claim.ok) {
        if (claim.reason === 'sent') {
            await env.RESOURCE_LINK_STATE.put(CRON_WATCHDOG_STATE_KEY, JSON.stringify(transition.state));
        }
        return { sent: false, reason: claim.reason };
    }

    let discordMessage;
    try {
        discordMessage = await sendCronWatchdogDiscordMessage(env, transition.content);
        if (claim?.token) {
            await callArcaDedup(env, 'sent', transition.id, claim.token, {
                discordMessageId: discordMessage?.id || null
            });
        }
        await env.RESOURCE_LINK_STATE.put(CRON_WATCHDOG_STATE_KEY, JSON.stringify(transition.state));
        return { sent: true };
    } catch (error) {
        if (claim?.token && !discordMessage) {
            await callArcaDedup(env, 'release', transition.id, claim.token).catch(releaseError => {
                console.error('Cron watchdog claim release failed', releaseError);
            });
        }
        throw error;
    }
}

function getCronHealth(lastCompletedAt, now = new Date(), staleMs = DEFAULT_CRON_STALE_MS) {
    const completedTime = Date.parse(String(lastCompletedAt || ''));
    const nowTime = new Date(now).getTime();
    const ageMs = Number.isFinite(completedTime) ? Math.max(0, nowTime - completedTime) : null;
    return {
        healthy: ageMs !== null && ageMs <= staleMs,
        lastCompletedAt: Number.isFinite(completedTime) ? new Date(completedTime).toISOString() : null,
        checkedAt: new Date(nowTime).toISOString(),
        ageMinutes: ageMs === null ? null : Math.floor(ageMs / 60000),
        staleAfterMinutes: Math.floor(staleMs / 60000)
    };
}

async function sendCronWatchdogDiscordMessage(env, content) {
    requireEnv(env, ['DISCORD_BOT_TOKEN', 'DISCORD_CHANNEL_ID']);
    const response = await fetch(`https://discord.com/api/v10/channels/${env.DISCORD_CHANNEL_ID}/messages`, {
        method: 'POST',
        headers: discordBotHeaders(env),
        body: JSON.stringify({ content, allowed_mentions: { parse: [] } })
    });
    if (!response.ok) {
        const detail = await response.text();
        throw new Error(`Discord watchdog notification failed: ${response.status} ${detail.slice(0, 300)}`);
    }
    return response.json().catch(() => null);
}

async function runArcaResourceMaintenance(env) {
    await handleArcaMonitor(env);
    await backfillArcaResourceDescriptions(env);
}

function handleGet(url, env, corsHeaders) {
    if (url.pathname === '/resource-links/submit') {
        return htmlResponse(getResourceLinkSubmitHtml(), 200, corsHeaders);
    }

    if (url.pathname === '/resource-links/categories') {
        return jsonResponse({
            categories: RESOURCE_CATEGORIES.map(id => ({
                id,
                label: RESOURCE_CATEGORY_LABELS[id] || id
            }))
        }, 200, corsHeaders);
    }

    return jsonResponse({
        ok: true,
        service: 'morimens-feedback-worker',
        routes: {
            feedback: 'POST /',
            resourceLinks: 'POST /resource-links',
            discordInteractions: 'POST /discord/interactions'
        },
        hasGitHubOwner: Boolean(env.GITHUB_OWNER),
        hasGitHubRepo: Boolean(env.GITHUB_REPO),
        hasGitHubToken: Boolean(env.GITHUB_TOKEN),
        hasDiscordWebhook: Boolean(env.DISCORD_WEBHOOK_URL),
        hasDiscordBotToken: Boolean(env.DISCORD_BOT_TOKEN),
        hasDiscordApplicationId: Boolean(env.DISCORD_APPLICATION_ID),
        discordApplicationId: env.DISCORD_APPLICATION_ID || null,
        discordPublicKeyPrefix: String(env.DISCORD_PUBLIC_KEY || '').slice(0, 12),
        hasDiscordChannelId: Boolean(env.DISCORD_CHANNEL_ID),
        hasDiscordPublicKey: Boolean(env.DISCORD_PUBLIC_KEY),
        hasArcaListUrls: Boolean(env.ARCA_LIST_URLS),
        hasResourceLinkState: Boolean(env.RESOURCE_LINK_STATE),
        hasGiftCodeChannelId: Boolean(env.GIFT_CODE_CHANNEL_ID || DEFAULT_GIFT_CODE_CHANNEL_ID)
    }, 200, corsHeaders);
}

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
      detailEl.textContent = result.discordMessageId ? 'Discord message ID: ' + result.discordMessageId : '';
      setTimeout(() => window.close(), 1200);
    })().catch(error => {
      statusEl.textContent = '승인 요청 실패';
      detailEl.textContent = error.message;
    });
  </script>
</body>
</html>`;
}

async function handleFeedback(request, env, corsHeaders) {
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

    const issue = await createFeedbackIssue(env, normalized);
    await notifyDiscord(env, normalized, issue);

    return jsonResponse({ ok: true, issueUrl: issue.html_url }, 200, corsHeaders);
}

async function handleResourceLinkProposal(request, env, corsHeaders) {
    requireEnv(env, ['GITHUB_TOKEN', 'GITHUB_OWNER', 'GITHUB_REPO', 'DISCORD_BOT_TOKEN', 'DISCORD_CHANNEL_ID']);

    let payload;
    try {
        payload = await request.json();
    } catch (error) {
        return jsonResponse({ error: 'Invalid JSON' }, 400, corsHeaders);
    }

    const proposal = normalizeResourceProposal(payload);
    if (!proposal.link.url || !proposal.link.title) {
        return jsonResponse({ error: 'link.url and link.title are required' }, 400, corsHeaders);
    }

    const { proposalState, discordMessage } = await createResourceProposalMessage(env, proposal);

    return jsonResponse({
        ok: true,
        proposalId: proposalState.id,
        discordMessageId: discordMessage.id,
        suggestedTargets: proposal.targets
    }, 200, corsHeaders);
}

async function handleArcaMonitor(env) {
    const listUrls = parseArcaListUrls(env.ARCA_LIST_URLS);
    if (listUrls.length === 0) {
        console.log('Arca monitor skipped: ARCA_LIST_URLS is empty');
        return { ok: true, skipped: 'missing ARCA_LIST_URLS' };
    }

    if (!env.RESOURCE_LINK_STATE) {
        console.log('Arca monitor skipped: RESOURCE_LINK_STATE KV binding is missing');
        return { ok: true, skipped: 'missing RESOURCE_LINK_STATE binding' };
    }

    requireEnv(env, ['GITHUB_TOKEN', 'GITHUB_OWNER', 'GITHUB_REPO', 'DISCORD_BOT_TOKEN', 'DISCORD_CHANNEL_ID']);

    const scanLimit = getPositiveIntegerEnv(env.ARCA_LIST_SCAN_LIMIT, DEFAULT_ARCA_LIST_SCAN_LIMIT, 1, 50);
    const maxProposals = getPositiveIntegerEnv(env.ARCA_MAX_PROPOSALS_PER_RUN, DEFAULT_ARCA_MAX_PROPOSALS_PER_RUN, 1, 10);
    const seenIds = await getSeenArcaPostIds(env);
    // GitHub is the authoring authority. If this lookup fails, fail closed instead of
    // sending a proposal that may already be in main or the pending PR.
    const registeredLinkIdentities = await getRegisteredResourceLinkIdentities(env);
    const result = {
        ok: true,
        lists: listUrls.length,
        scanned: 0,
        discovered: 0,
        proposed: 0,
        failed: 0
    };

    const delivery = await processPendingArcaPosts(
        env,
        seenIds,
        maxProposals,
        registeredLinkIdentities
    );
    result.proposed = delivery.proposed;
    result.failed += delivery.failed;
    result.skippedRegistered = delivery.skippedRegistered;

    const pendingIds = await getPendingArcaPostIds(env);
    for (const listUrl of listUrls) {
        try {
            const discovery = await scanArcaFeedPage(
                env,
                listUrl,
                scanLimit,
                seenIds,
                pendingIds,
                registeredLinkIdentities
            );
            result.scanned += discovery.scanned;
            result.discovered += discovery.discovered;
        } catch (error) {
            result.failed += 1;
            console.warn(`Arca feed scan failed: ${listUrl}`, error);
        }
    }

    console.log('Arca monitor result', result);
    return result;
}

async function scanArcaFeedPage(
    env,
    listUrl,
    scanLimit,
    seenIds,
    pendingIds,
    registeredLinkIdentities = new Set()
) {
    const stateKey = getArcaFeedStateKey(listUrl);
    const savedState = await env.RESOURCE_LINK_STATE.get(stateKey, 'json');
    const state = normalizeArcaFeedState(savedState);
    const writeLimit = getPositiveIntegerEnv(
        env.ARCA_PENDING_WRITES_PER_FEED,
        DEFAULT_ARCA_PENDING_WRITES_PER_FEED,
        1,
        10
    );

    if (state.scan?.bufferedPosts.length > 0) {
        const bufferResult = await persistPendingArcaPosts(
            env,
            state.scan.bufferedPosts,
            pendingIds,
            writeLimit,
            listUrl,
            registeredLinkIdentities
        );
        const nextState = bufferResult.remaining.length > 0
            ? {
                ...state,
                scan: {
                    ...state.scan,
                    bufferedPosts: bufferResult.remaining
                }
            }
            : state.scan.finishAfterBuffer
                ? buildCompletedArcaFeedState(
                    state,
                    state.scan.targetHighWatermarkId || state.checkpointId
                )
                : {
                    ...state,
                    scan: {
                        ...state.scan,
                        bufferedPosts: [],
                        finishAfterBuffer: false
                    }
                };
        await putArcaFeedStateIfChanged(env, stateKey, state, nextState);
        return {
            scanned: 0,
            discovered: bufferResult.persisted,
            pageNumber: state.scan.nextPage,
            reachedBoundary: Boolean(state.scan.finishAfterBuffer && bufferResult.remaining.length === 0),
            checkpointId: nextState.checkpointId || null,
            buffered: bufferResult.remaining.length
        };
    }

    const pageNumber = state.scan?.nextPage || 1;
    const pageUrl = buildArcaListPageUrl(listUrl, pageNumber);
    const html = await fetchText(pageUrl);
    const posts = extractArcaPostsFromList(html, listUrl).slice(0, scanLimit);
    const targetHighWatermarkId = state.scan?.targetHighWatermarkId
        || getHighestArcaPostId(posts)
        || state.checkpointId;
    const isBootstrap = !state.checkpointId;
    let reachedBoundary = posts.length < scanLimit;
    const candidates = [];

    for (const post of posts) {
        if (targetHighWatermarkId && compareArcaPostIds(post.id, targetHighWatermarkId) > 0) continue;
        if (state.checkpointId && compareArcaPostIds(post.id, state.checkpointId) <= 0) {
            reachedBoundary = true;
            continue;
        }
        if (isBootstrap && seenIds.has(post.id)) {
            reachedBoundary = true;
            continue;
        }
        if (seenIds.has(post.id) || pendingIds.has(post.id)) continue;
        candidates.push(post);
    }

    candidates.sort((left, right) => compareArcaPostIds(left.id, right.id));
    const pendingResult = await persistPendingArcaPosts(
        env,
        candidates,
        pendingIds,
        writeLimit,
        listUrl,
        registeredLinkIdentities
    );

    const nextState = pendingResult.remaining.length > 0
        ? {
            ...state,
            scan: {
                targetHighWatermarkId,
                nextPage: reachedBoundary ? pageNumber : pageNumber + 1,
                startedAt: state.scan?.startedAt || new Date().toISOString(),
                bufferedPosts: pendingResult.remaining,
                finishAfterBuffer: reachedBoundary
            }
        }
        : reachedBoundary
        ? buildCompletedArcaFeedState(state, targetHighWatermarkId || state.checkpointId)
        : {
            ...state,
            scan: {
                targetHighWatermarkId,
                nextPage: pageNumber + 1,
                startedAt: state.scan?.startedAt || new Date().toISOString(),
                bufferedPosts: [],
                finishAfterBuffer: false
            }
        };
    await putArcaFeedStateIfChanged(env, stateKey, state, nextState);

    return {
        scanned: posts.length,
        discovered: pendingResult.persisted,
        pageNumber,
        reachedBoundary,
        checkpointId: nextState.checkpointId || null,
        buffered: pendingResult.remaining.length
    };
}

function buildCompletedArcaFeedState(state, checkpointId) {
    const normalizedCheckpointId = /^\d+$/.test(String(checkpointId || ''))
        ? String(checkpointId)
        : null;
    const changed = normalizedCheckpointId !== state.checkpointId || Boolean(state.scan);
    return {
        checkpointId: normalizedCheckpointId,
        checkpointUpdatedAt: changed ? new Date().toISOString() : state.checkpointUpdatedAt,
        scan: null
    };
}

async function putArcaFeedStateIfChanged(env, stateKey, currentState, nextState) {
    const current = normalizeArcaFeedState(currentState);
    const next = normalizeArcaFeedState(nextState);
    if (JSON.stringify(current) === JSON.stringify(next)) return false;
    await env.RESOURCE_LINK_STATE.put(stateKey, JSON.stringify(next));
    return true;
}

async function persistPendingArcaPosts(
    env,
    posts,
    pendingIds,
    limit,
    listUrl,
    registeredLinkIdentities = new Set()
) {
    const candidates = posts.filter(post => {
        if (!post?.id || pendingIds.has(String(post.id))) return false;
        return !registeredLinkIdentities.has(canonicalizeResourceUrl(post.url));
    });
    const selected = candidates.slice(0, limit);
    for (const post of selected) {
        const postId = String(post.id);
        await env.RESOURCE_LINK_STATE.put(
            `${ARCA_PENDING_KEY_PREFIX}${postId}`,
            JSON.stringify({
                ...post,
                id: postId,
                sourceListUrl: post.sourceListUrl || listUrl,
                discoveredAt: post.discoveredAt || new Date().toISOString()
            })
        );
        pendingIds.add(postId);
    }
    return {
        persisted: selected.length,
        remaining: candidates.slice(selected.length)
    };
}

async function processPendingArcaPosts(
    env,
    seenIds,
    maxProposals,
    registeredLinkIdentities = new Set()
) {
    if (!env.ARCA_DEDUPE) {
        throw new Error('ARCA_DEDUPE binding is required before sending monitored posts');
    }
    if (!env.RESOURCE_PROPOSAL_STATE) {
        throw new Error('RESOURCE_PROPOSAL_STATE binding is required before sending monitored posts');
    }
    const page = await env.RESOURCE_LINK_STATE.list({
        prefix: ARCA_PENDING_KEY_PREFIX,
        limit: 1000
    });
    const keys = [...page.keys].sort((left, right) => compareArcaPostIds(
        left.name.slice(ARCA_PENDING_KEY_PREFIX.length),
        right.name.slice(ARCA_PENDING_KEY_PREFIX.length)
    ));
    const result = { proposed: 0, failed: 0, skippedRegistered: 0 };

    for (const key of keys) {
        if (result.proposed >= maxProposals) break;
        const postId = key.name.slice(ARCA_PENDING_KEY_PREFIX.length);
        if (seenIds.has(postId)) {
            await env.RESOURCE_LINK_STATE.delete(key.name);
            continue;
        }

        const post = await env.RESOURCE_LINK_STATE.get(key.name, 'json');
        if (!post?.url || !post?.title) {
            await env.RESOURCE_LINK_STATE.delete(key.name);
            continue;
        }

        const claim = await claimArcaPost(env, postId);
        if (claim && !claim.ok) {
            if (claim.reason === 'sent') await env.RESOURCE_LINK_STATE.delete(key.name);
            continue;
        }

        try {
            const linkIdentity = canonicalizeResourceUrl(post.url);
            if (linkIdentity && registeredLinkIdentities.has(linkIdentity)) {
                await env.RESOURCE_LINK_STATE.put(`${ARCA_SEEN_KEY_PREFIX}${postId}`, JSON.stringify({
                    id: postId,
                    url: post.url,
                    title: post.title,
                    sourceListUrl: post.sourceListUrl,
                    proposalId: null,
                    discordMessageId: null,
                    firstSeenAt: post.discoveredAt || new Date().toISOString(),
                    registeredAt: new Date().toISOString()
                }));
                await markArcaPostSent(env, postId, claim?.token, null);
                await env.RESOURCE_LINK_STATE.delete(key.name);
                seenIds.add(postId);
                result.skippedRegistered += 1;
                continue;
            }

            let detail;
            try {
                detail = await fetchArcaPostDetail(post, post.sourceListUrl);
            } catch (error) {
                detail = buildArcaListFallbackDetail(post, post.sourceListUrl);
                console.warn(`Arca detail unavailable; proposing link first: ${post.url}`, error);
            }
            const submittedAt = new Date().toISOString();
            const proposal = normalizeResourceProposal({
                url: detail.url,
                title: detail.title,
                desc: detail.desc,
                image: detail.image,
                sourceTab: detail.sourceTab,
                submittedBy: 'arca-monitor',
                submittedAt
            });
            const canonicalProposalId = await createCanonicalResourceProposalId(
                canonicalizeResourceUrl(proposal.link.url)
            );
            let proposalDelivery;
            try {
                proposalDelivery = await createResourceProposalMessage(
                    env,
                    proposal,
                    canonicalProposalId
                );
            } catch (error) {
                if (error.code !== 'RESOURCE_PROPOSAL_ALREADY_EXISTS') throw error;
                await env.RESOURCE_LINK_STATE.put(`${ARCA_SEEN_KEY_PREFIX}${postId}`, JSON.stringify({
                    id: postId,
                    url: proposal.link.url,
                    title: proposal.link.title,
                    sourceListUrl: post.sourceListUrl,
                    proposalId: canonicalProposalId,
                    discordMessageId: error.currentState?.discordMessageId || null,
                    firstSeenAt: post.discoveredAt || submittedAt,
                    duplicateProposalAt: new Date().toISOString()
                }));
                await markArcaPostSent(
                    env,
                    postId,
                    claim?.token,
                    error.currentState?.discordMessageId || null
                );
                await env.RESOURCE_LINK_STATE.delete(key.name);
                seenIds.add(postId);
                result.skippedRegistered += 1;
                continue;
            }
            const { proposalState, discordMessage } = proposalDelivery;
            try {
                await env.RESOURCE_LINK_STATE.put(`${ARCA_SEEN_KEY_PREFIX}${postId}`, JSON.stringify({
                    id: postId,
                    url: proposal.link.url,
                    title: proposal.link.title,
                    sourceListUrl: post.sourceListUrl,
                    proposalId: proposalState.id,
                    discordMessageId: discordMessage.id,
                    firstSeenAt: post.discoveredAt || submittedAt,
                    notifiedAt: new Date().toISOString()
                }));
            } catch (error) {
                let deleted = false;
                await deleteDiscordResourceMessage(env, discordMessage.id).then(() => {
                    deleted = true;
                }).catch(deleteError => {
                    console.error('Failed to roll back untracked Discord proposal', deleteError);
                });
                if (!deleted) {
                    error.deliveryStatusUnknown = true;
                    error.proposalId = proposalState.id;
                    error.discordMessageId = discordMessage.id;
                }
                throw error;
            }
            try {
                await markArcaPostSent(env, postId, claim?.token, discordMessage.id);
            } catch (error) {
                let deleted = false;
                await deleteDiscordResourceMessage(env, discordMessage.id).then(() => {
                    deleted = true;
                }).catch(deleteError => {
                    console.error('Failed to roll back untracked Discord proposal', deleteError);
                });
                if (deleted) {
                    await env.RESOURCE_LINK_STATE.delete(`${ARCA_SEEN_KEY_PREFIX}${postId}`);
                } else {
                    error.deliveryStatusUnknown = true;
                    error.proposalId = proposalState.id;
                    error.discordMessageId = discordMessage.id;
                }
                throw error;
            }
            await env.RESOURCE_LINK_STATE.delete(key.name);
            seenIds.add(postId);
            result.proposed += 1;
        } catch (error) {
            if (error.deliveryStatusUnknown) {
                await env.RESOURCE_LINK_STATE.put(`${ARCA_SEEN_KEY_PREFIX}${postId}`, JSON.stringify({
                    id: postId,
                    url: post.url,
                    title: post.title,
                    sourceListUrl: post.sourceListUrl,
                    proposalId: error.proposalId || null,
                    discordMessageId: error.discordMessageId || null,
                    firstSeenAt: post.discoveredAt || new Date().toISOString(),
                    deliveryStatus: 'unknown',
                    suppressedAt: new Date().toISOString()
                })).catch(stateError => {
                    console.error('Failed to preserve uncertain Arca delivery in KV', stateError);
                });
                await markArcaPostSent(
                    env,
                    postId,
                    claim?.token,
                    error.discordMessageId || null
                ).catch(stateError => {
                    console.error('Failed to preserve uncertain Arca delivery in Durable Object', stateError);
                });
            } else if (claim?.token) {
                await releaseArcaPost(env, postId, claim.token);
            }
            result.failed += 1;
            console.warn(`Pending Arca post proposal failed: ${post.url}`, error);
            break;
        }
    }

    return result;
}

async function callArcaDedup(env, action, postId, token, extra = {}) {
    if (!env.ARCA_DEDUPE) return null;
    const id = env.ARCA_DEDUPE.idFromName(String(postId));
    const stub = env.ARCA_DEDUPE.get(id);
    const response = await stub.fetch('https://arca-dedupe.local/', {
        method: 'POST',
        body: JSON.stringify({ action, postId: String(postId), token, ...extra })
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || `Arca dedupe request failed: ${response.status}`);
    return result;
}

async function claimArcaPost(env, postId) {
    return callArcaDedup(env, 'claim', postId, null, { leaseMs: ARCA_CLAIM_LEASE_MS });
}

async function markArcaPostSent(env, postId, token, discordMessageId) {
    if (!token) return null;
    return callArcaDedup(env, 'sent', postId, token, { discordMessageId });
}

async function releaseArcaPost(env, postId, token) {
    if (!token) return null;
    return callArcaDedup(env, 'release', postId, token);
}

function normalizeArcaFeedState(state) {
    const checkpointId = /^\d+$/.test(String(state?.checkpointId || ''))
        ? String(state.checkpointId)
        : null;
    const targetHighWatermarkId = /^\d+$/.test(String(state?.scan?.targetHighWatermarkId || ''))
        ? String(state.scan.targetHighWatermarkId)
        : null;
    const nextPage = Number.isInteger(Number(state?.scan?.nextPage)) && Number(state.scan.nextPage) > 0
        ? Number(state.scan.nextPage)
        : 1;
    return {
        checkpointId,
        checkpointUpdatedAt: state?.checkpointUpdatedAt || null,
        scan: targetHighWatermarkId
            ? {
                targetHighWatermarkId,
                nextPage,
                startedAt: state?.scan?.startedAt || null,
                bufferedPosts: Array.isArray(state?.scan?.bufferedPosts)
                    ? state.scan.bufferedPosts.filter(post => post?.id && post?.url).slice(0, 50)
                    : [],
                finishAfterBuffer: Boolean(state?.scan?.finishAfterBuffer)
            }
            : null
    };
}

function getArcaFeedStateKey(listUrl) {
    const encoded = utf8ToBase64(String(listUrl))
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/g, '');
    return `${ARCA_FEED_STATE_KEY_PREFIX}${encoded}`;
}

function buildArcaListPageUrl(listUrl, pageNumber) {
    const url = new URL(listUrl);
    url.searchParams.set('p', String(pageNumber));
    return url.toString();
}

function getHighestArcaPostId(posts) {
    return posts.map(post => String(post.id || ''))
        .filter(id => /^\d+$/.test(id))
        .sort(compareArcaPostIds)
        .at(-1) || null;
}

function compareArcaPostIds(left, right) {
    const leftId = BigInt(/^\d+$/.test(String(left || '')) ? String(left) : '0');
    const rightId = BigInt(/^\d+$/.test(String(right || '')) ? String(right) : '0');
    return leftId < rightId ? -1 : leftId > rightId ? 1 : 0;
}

function buildArcaListFallbackDetail(post, listUrl) {
    return {
        url: post.url,
        title: cleanResourceTitle(post.title || post.id),
        desc: '',
        image: normalizeImageUrl(post.image || '', listUrl),
        sourceTab: post.sourceTab || getArcaSourceTab(listUrl)
    };
}

async function backfillArcaResourceDescriptions(env) {
    if (!env.GITHUB_TOKEN || !env.GITHUB_OWNER || !env.GITHUB_REPO) {
        return { ok: true, skipped: 'missing GitHub configuration' };
    }

    const limit = getPositiveIntegerEnv(
        env.ARCA_DESCRIPTION_BACKFILL_LIMIT,
        DEFAULT_ARCA_DESCRIPTION_BACKFILL_LIMIT,
        1,
        20
    );
    const baseBranch = getBaseBranch(env);
    const openPr = await findOpenResourceLinksPullRequest(env);
    const branches = openPr
        ? [RESOURCE_LINKS_PENDING_BRANCH, baseBranch]
        : [baseBranch];
    const result = { ok: true, checked: 0, updated: 0, failed: 0, branches: [] };

    for (const branch of [...new Set(branches)]) {
        const branchResult = await backfillArcaResourceDescriptionsOnBranch(env, branch, limit);
        result.checked += branchResult.checked;
        result.updated += branchResult.updated;
        result.failed += branchResult.failed;
        result.branches.push(branchResult);
    }

    console.log('Arca description backfill result', result);
    return result;
}

async function backfillArcaResourceDescriptionsOnBranch(env, branch, limit) {
    for (let attempt = 0; attempt < 2; attempt += 1) {
        const file = await getGitHubFile(env, RESOURCE_LINKS_PATH, branch);
        const candidates = collectEmptyArcaResourceDescriptions(file.content).slice(0, limit);
        let content = file.content;
        let updated = 0;
        let failed = 0;

        for (const candidate of candidates) {
            try {
                const detail = await fetchArcaPostDetail(candidate, candidate.url);
                const change = buildResourceLinkDescriptionBackfill(content, candidate.url, detail.desc);
                content = change.content;
                updated += change.updated;
            } catch (error) {
                failed += 1;
                console.warn(`Arca description backfill failed: ${candidate.url}`, error);
            }
        }

        if (content === file.content) {
            return { branch, checked: candidates.length, updated: 0, failed };
        }

        try {
            await putGitHubFile(env, RESOURCE_LINKS_PATH, {
                message: `Backfill resource link descriptions (${updated})`,
                content,
                sha: file.sha,
                branch
            });
            return { branch, checked: candidates.length, updated, failed };
        } catch (error) {
            if ((error.status === 409 || error.status === 422) && attempt === 0) continue;
            throw error;
        }
    }

    throw new Error(`resource link description backfill failed after retry: ${branch}`);
}

function collectEmptyArcaResourceDescriptions(content) {
    const db = JSON.parse(content);
    const results = [];
    const seenUrls = new Set();

    function visit(value) {
        if (Array.isArray(value)) {
            value.forEach(visit);
            return;
        }
        if (!value || typeof value !== 'object') return;

        const url = String(value.url || '').trim();
        if (url.startsWith('https://arca.live/b/') && !String(value.desc || '').trim() && !seenUrls.has(url)) {
            seenUrls.add(url);
            results.push({
                url,
                title: String(value.title || '').trim(),
                image: String(value.image || '').trim()
            });
        }
        Object.values(value).forEach(visit);
    }

    visit(db);
    return results;
}

function buildResourceLinkDescriptionBackfill(content, url, desc) {
    const urlPattern = new RegExp(`"url"\\s*:\\s*${escapeRegExp(JSON.stringify(url))}`, 'g');
    const replacements = [];
    let match;

    while ((match = urlPattern.exec(content)) !== null) {
        const objectStart = content.lastIndexOf('{', match.index);
        const objectEnd = findMatchingJsonDelimiter(content, objectStart, '{', '}');
        if (objectStart < 0 || objectEnd < 0) continue;

        const objectText = content.slice(objectStart, objectEnd + 1);
        const descMatch = /("desc"\s*:\s*)""/.exec(objectText);
        if (!descMatch) continue;
        replacements.push({
            start: objectStart + descMatch.index,
            end: objectStart + descMatch.index + descMatch[0].length,
            value: `${descMatch[1]}${JSON.stringify(desc)}`
        });
    }

    let updatedContent = content;
    for (const replacement of replacements.reverse()) {
        updatedContent = `${updatedContent.slice(0, replacement.start)}${replacement.value}${updatedContent.slice(replacement.end)}`;
    }

    return { content: updatedContent, updated: replacements.length };
}

async function handleGiftCodeMonitor(env) {
    const channelId = String(env.GIFT_CODE_CHANNEL_ID || DEFAULT_GIFT_CODE_CHANNEL_ID).trim();
    if (!channelId) {
        console.log('Gift code monitor skipped: GIFT_CODE_CHANNEL_ID is empty');
        return { ok: true, skipped: 'missing GIFT_CODE_CHANNEL_ID' };
    }

    if (!env.RESOURCE_LINK_STATE) {
        console.log('Gift code monitor skipped: RESOURCE_LINK_STATE KV binding is missing');
        return { ok: true, skipped: 'missing RESOURCE_LINK_STATE binding' };
    }

    requireEnv(env, ['GITHUB_TOKEN', 'GITHUB_OWNER', 'GITHUB_REPO', 'DISCORD_BOT_TOKEN']);

    let recovered = null;
    try {
        recovered = await flushPendingGiftCodeNotifications(env, channelId);
    } catch (error) {
        recovered = { ok: false, error: error?.message || String(error) };
        console.warn('Pending gift code notification recovery failed', error);
    }

    const scanLimit = getPositiveIntegerEnv(env.GIFT_CODE_SCAN_LIMIT, DEFAULT_GIFT_CODE_SCAN_LIMIT, 1, 100);
    const messages = await fetchDiscordChannelMessages(env, channelId, scanLimit);
    const result = { ok: true, recovered, scanned: messages.length, skippedSeen: 0, added: 0, pending: 0, failed: 0 };

    for (const message of messages) {
        const seenKey = `${GIFT_CODE_SEEN_KEY_PREFIX}${message.id}`;
        if (await env.RESOURCE_LINK_STATE.get(seenKey)) {
            result.skippedSeen += 1;
            continue;
        }

        try {
            const codes = extractGiftCodesFromDiscordMessage(message);
            const commits = [];
            for (const code of codes) {
                const notificationKey = `${GIFT_CODE_NOTIFICATION_KEY_PREFIX}${message.id}:${code.title}`;
                const pendingNotification = await env.RESOURCE_LINK_STATE.get(notificationKey);
                const update = await updateGiftCodeLinks(env, code);
                if (update.added) {
                    commits.push(update.commitUrl);
                    await env.RESOURCE_LINK_STATE.put(notificationKey, JSON.stringify({
                        code,
                        channelId,
                        commitUrl: update.commitUrl,
                        createdAt: new Date().toISOString()
                    }));
                    result.pending += 1;
                } else if (pendingNotification) {
                    result.pending += 1;
                }
            }

            await env.RESOURCE_LINK_STATE.put(seenKey, JSON.stringify({
                messageId: message.id,
                processedAt: new Date().toISOString(),
                codeCount: codes.length,
                commits
            }));
            result.added += commits.length;
        } catch (error) {
            result.failed += 1;
            console.warn(`Gift code processing failed: ${message.id}`, error);
        }
    }

    console.log('Gift code monitor result', result);
    return result;
}

async function handleDeploymentComplete(request, env, corsHeaders) {
    const expectedToken = String(env.DEPLOYMENT_CALLBACK_TOKEN || '');
    const suppliedToken = String(request.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
    if (!expectedToken || !suppliedToken || suppliedToken !== expectedToken) {
        return jsonResponse({ error: 'Unauthorized' }, 401, corsHeaders);
    }
    if (!env.RESOURCE_LINK_STATE) {
        return jsonResponse({ error: 'RESOURCE_LINK_STATE KV binding is missing' }, 503, corsHeaders);
    }

    const channelId = String(env.GIFT_CODE_CHANNEL_ID || DEFAULT_GIFT_CODE_CHANNEL_ID).trim();
    const result = await flushPendingGiftCodeNotifications(env, channelId);
    return jsonResponse(result, result.ok ? 200 : 503, corsHeaders);
}

async function flushPendingGiftCodeNotifications(env, defaultChannelId) {
    if (!env.RESOURCE_LINK_STATE) {
        throw new Error('RESOURCE_LINK_STATE KV binding is missing');
    }

    const pendingKeys = await listGiftCodeNotificationKeys(env);
    if (pendingKeys.length === 0) {
        return { ok: true, pending: 0, published: 0, notified: 0, retained: 0, failed: 0 };
    }

    const publishedCodes = await fetchPublishedGiftCodeTitles(env);
    const result = { ok: true, pending: pendingKeys.length, published: 0, notified: 0, retained: 0, failed: 0 };
    for (const key of pendingKeys) {
        const notification = await env.RESOURCE_LINK_STATE.get(key, 'json');
        const code = notification?.code;
        const normalizedTitle = normalizeGiftCodeTitle(code?.title);
        if (!normalizedTitle || !publishedCodes.has(normalizedTitle)) {
            result.retained += 1;
            continue;
        }
        result.published += 1;

        const claimId = `gift-notification:${key}`;
        let claim = null;
        let discordMessage = null;
        try {
            claim = await callArcaDedup(env, 'claim', claimId, null, { leaseMs: ARCA_CLAIM_LEASE_MS });
            if (claim && !claim.ok) {
                if (claim.reason === 'sent') {
                    await env.RESOURCE_LINK_STATE.delete(key);
                } else {
                    result.retained += 1;
                }
                continue;
            }

            discordMessage = await sendGiftCodePublishedMessage(
                env,
                String(notification.channelId || defaultChannelId || DEFAULT_GIFT_CODE_CHANNEL_ID),
                code
            );
            if (claim?.token) {
                await callArcaDedup(env, 'sent', claimId, claim.token, {
                    discordMessageId: discordMessage?.id || null
                });
            }
            await env.RESOURCE_LINK_STATE.delete(key);
            result.notified += 1;
        } catch (error) {
            result.failed += 1;
            console.warn(`Pending gift code notification failed: ${normalizedTitle || key}`, error);
            if (claim?.token && !discordMessage) {
                await callArcaDedup(env, 'release', claimId, claim.token).catch(releaseError => {
                    console.warn(`Gift code notification claim release failed: ${normalizedTitle || key}`, releaseError);
                });
            }
        }
    }
    result.ok = result.failed === 0;
    return result;
}

async function listGiftCodeNotificationKeys(env) {
    const keys = [];
    let cursor;
    do {
        const options = { prefix: GIFT_CODE_NOTIFICATION_KEY_PREFIX, limit: 1000 };
        if (cursor) options.cursor = cursor;
        const page = await env.RESOURCE_LINK_STATE.list(options);
        keys.push(...page.keys.map(key => key.name));
        cursor = page.list_complete ? null : page.cursor;
    } while (cursor);
    return keys;
}

async function fetchPublishedGiftCodeTitles(env) {
    const resourceUrl = String(env.GIFT_CODE_RESOURCE_URL || DEFAULT_GIFT_CODE_RESOURCE_URL).trim();
    const url = new URL(resourceUrl);
    url.searchParams.set('deployment-complete', `${Date.now()}-${crypto.randomUUID()}`);
    const response = await fetch(url, {
        cache: 'no-store',
        headers: {
            'Cache-Control': 'no-cache, no-store',
            Pragma: 'no-cache'
        },
        cf: { cacheTtl: 0, cacheEverything: false }
    });
    if (!response.ok) {
        const detail = await response.text();
        throw new Error(`Published resource links fetch failed: ${response.status} ${detail.slice(0, 300)}`);
    }
    const db = await response.json();
    const links = Array.isArray(db.categories?.code?.links) ? db.categories.code.links : [];
    return new Set(links.map(link => normalizeGiftCodeTitle(link?.title)).filter(Boolean));
}

function normalizeGiftCodeTitle(value) {
    return String(value || '').trim().toUpperCase();
}

async function fetchDiscordChannelMessages(env, channelId, limit) {
    const response = await fetch(`https://discord.com/api/v10/channels/${channelId}/messages?limit=${limit}`, {
        headers: discordBotHeaders(env)
    });
    if (!response.ok) {
        const detail = await response.text();
        throw new Error(`Discord channel fetch failed: ${response.status} ${detail.slice(0, 300)}`);
    }
    return response.json();
}

function extractGiftCodesFromDiscordMessage(message) {
    const text = getDiscordMessageText(message);
    if (!/(?:gift|redeem|coupon|code|교환|코드|兑换|礼包)/i.test(text)) return [];

    const candidates = new Set();
    const lines = text.split(/\r?\n/);
    const pattern = /\b(?:[A-Z0-9]{4,}(?:-[A-Z0-9]{4,})+|[A-Z][A-Za-z0-9]{5,31})\b/g;
    for (const match of text.matchAll(pattern)) {
        const code = match[0];
        if (!/^[A-Z0-9-]+$/.test(code) && !/^[A-Za-z][A-Za-z0-9]+$/.test(code)) continue;
        if (/^(?:DISCORD|MORIMENS|OFFICIAL|REDEEM|REDEMPTION|COUPON|REWARDS?|GIFT|CODE|CONTENTS|EXPIRY|EXPIRES|VALID|UNTIL|SILVER)$/i.test(code)) continue;
        const codeLine = lines.find(line => line.includes(code)) || '';
        const labeledCode = new RegExp(`(?:gift\\s*code|redemption\\s*code|redeem\\s*code|coupon|code|교환\\s*코드|兑换码)\\s*[:：]\\s*${escapeRegExp(code)}\\b`, 'i');
        if (!code.includes('-') && !labeledCode.test(codeLine)) continue;
        candidates.add(code);
    }

    const expiry = extractGiftCodeExpiry(text, message.timestamp);
    const desc = extractGiftCodeReward(text);
    return [...candidates].map(title => ({ title, desc, expiry }));
}

function getDiscordMessageText(message) {
    const messages = [
        message,
        ...(message.message_snapshots || []).map(snapshot => snapshot?.message).filter(Boolean)
    ];
    return messages.map(getDiscordMessageOwnText).filter(Boolean).join('\n');
}

function getDiscordMessageOwnText(message) {
    const embedText = (message.embeds || []).flatMap(embed => [
        embed.title,
        embed.description,
        ...(embed.fields || []).flatMap(field => [field.name, field.value])
    ]).filter(Boolean);
    return [message.content, ...embedText].filter(Boolean).join('\n');
}

function extractGiftCodeExpiry(text, timestamp) {
    const expiryText = text.split(/\r?\n/)
        .filter(line => /(?:expire|expiry|valid|until|기한|만료|종료|마감)/i.test(line))
        .join('\n');
    if (!expiryText) return null;

    const discordTimestampMatch = expiryText.match(/<t:(\d{9,12})(?::[tTdDfFR])?>/);
    if (discordTimestampMatch) {
        const unixSeconds = Number(discordTimestampMatch[1]);
        const koreanTime = new Date((unixSeconds + (9 * 60 * 60)) * 1000);
        if (!Number.isNaN(koreanTime.getTime())) return koreanTime.toISOString().slice(0, 10);
    }

    const isoMatch = expiryText.match(/\b(20\d{2})[.\-/년\s]+(\d{1,2})[.\-/월\s]+(\d{1,2})(?:일)?\b/);
    if (isoMatch) return formatIsoDate(isoMatch[1], isoMatch[2], isoMatch[3]);

    const koreanMatch = expiryText.match(/\b(\d{1,2})월\s*(\d{1,2})일\b/);
    if (!koreanMatch) return null;

    const year = new Date(timestamp || Date.now()).getUTCFullYear();
    return formatIsoDate(year, koreanMatch[1], koreanMatch[2]);
}

function formatIsoDate(year, month, day) {
    const value = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
    if (value.getUTCFullYear() !== Number(year) || value.getUTCMonth() !== Number(month) - 1 || value.getUTCDate() !== Number(day)) return null;
    return value.toISOString().slice(0, 10);
}

function extractGiftCodeReward(text) {
    const lines = text.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
    const preferred = lines.find(line => /(?:gift\s*contents?|rewards?\s*:)/i.test(line));
    const fallback = lines.find(line => /(?:礼包(?:内容)?|보상|은심|은핵|약재|인장|재화|item|银芯|无垢之芯)/i.test(line));
    return normalizeGiftCodeReward(preferred || fallback || '');
}

function normalizeGiftCodeReward(value) {
    const reward = String(value || '')
        .replace(/^(?:gift\s*contents?|rewards?|礼包内容|礼包|보상)\s*[:：]?\s*/i, '')
        .replace(/Pure Core/gi, '무구의 은핵')
        .replace(/Louminous Core/gi, '광휘의 은핵')
        .replace(/Silver/gi, '은심')
        .replace(/无垢之芯/g, '무구의 은핵')
        .replace(/银芯/g, '은심')
        .replace(/×\s*(\d+)/g, '$1개')
        .replace(/\s+/g, ' ')
        .trim();
    return reward.slice(0, 240) || '공식 디스코드 공지 참조';
}

async function updateGiftCodeLinks(env, code) {
    const branch = getBaseBranch(env);
    for (let attempt = 0; attempt < 2; attempt += 1) {
        const file = await getGitHubFile(env, RESOURCE_LINKS_PATH, branch);
        const update = buildGiftCodeLinksUpdate(file.content, code);
        if (!update.added) return { ...update, commitUrl: 'no changes' };

        try {
            const commit = await putGitHubFile(env, RESOURCE_LINKS_PATH, {
                message: `Add redeem code: ${code.title}`,
                content: update.content,
                sha: file.sha,
                branch
            });
            return {
                ...update,
                commitUrl: commit.commit?.html_url || commit.content?.html_url || 'unknown'
            };
        } catch (error) {
            if (error.status === 409 && attempt === 0) continue;
            throw error;
        }
    }
    throw new Error('gift code update failed after retry');
}

function buildGiftCodeLinksUpdate(content, code) {
    const db = JSON.parse(content);
    const links = db.categories?.code?.links;
    if (!Array.isArray(links)) throw new Error('Gift code category is missing');
    if (links.some(link => String(link?.title || '').toUpperCase() === code.title.toUpperCase())) {
        return { added: false, content };
    }

    links.push({
        title: code.title,
        desc: code.desc,
        expiry: code.expiry
    });
    links.sort(compareGiftCodeExpiry);
    const updatedContent = replaceResourceTargetArray(content, { type: 'category', id: 'code' }, links);
    if (!updatedContent) throw new Error('Gift code category insertion point is missing');
    return { added: true, content: updatedContent };
}

function compareGiftCodeExpiry(left, right) {
    const leftExpiry = String(left?.expiry || '');
    const rightExpiry = String(right?.expiry || '');
    if (!leftExpiry && !rightExpiry) return 0;
    if (!leftExpiry) return -1;
    if (!rightExpiry) return 1;
    return leftExpiry.localeCompare(rightExpiry);
}

function replaceResourceTargetArray(content, target, items) {
    const listInfo = findTargetArray(content, target);
    if (!listInfo || listInfo.arrayEnd < 0) return null;

    const lineStart = content.lastIndexOf('\n', listInfo.arrayStart) + 1;
    const arrayIndent = content.slice(lineStart, listInfo.arrayStart).match(/^\s*/)?.[0] || '';
    const itemIndent = `${arrayIndent}  `;
    const itemText = items.map(item => JSON.stringify(item, null, 2)
        .split('\n')
        .map(line => `${itemIndent}${line}`)
        .join('\n'))
        .join(',\n');
    const replacement = itemText ? `[\n${itemText}\n${arrayIndent}]` : '[]';
    return `${content.slice(0, listInfo.arrayStart)}${replacement}${content.slice(listInfo.arrayEnd + 1)}`;
}

function buildGiftCodePublishedMessage(code, now = new Date()) {
    const daysRemaining = getGiftCodeDaysRemaining(code.expiry, now);
    const remainingText = daysRemaining === null ? '기한 없음' : `${daysRemaining}일 남음`;
    return `${code.title} | ${code.desc}, ${remainingText}`;
}

function getGiftCodeDaysRemaining(expiry, now = new Date()) {
    if (!/^20\d{2}-\d{2}-\d{2}$/.test(String(expiry || ''))) return null;
    const expiryDay = Date.parse(`${expiry}T00:00:00.000Z`);
    const koreanToday = new Date(new Date(now).getTime() + (9 * 60 * 60 * 1000)).toISOString().slice(0, 10);
    const today = Date.parse(`${koreanToday}T00:00:00.000Z`);
    if (Number.isNaN(expiryDay) || Number.isNaN(today)) return null;
    return Math.max(0, Math.round((expiryDay - today) / (24 * 60 * 60 * 1000)));
}

async function sendGiftCodePublishedMessage(env, channelId, code) {
    const response = await fetch(`https://discord.com/api/v10/channels/${channelId}/messages`, {
        method: 'POST',
        headers: discordBotHeaders(env),
        body: JSON.stringify({
            content: buildGiftCodePublishedMessage(code),
            allowed_mentions: { parse: [] }
        })
    });
    if (!response.ok) {
        const detail = await response.text();
        throw new Error(`Discord gift code notification failed: ${response.status} ${detail.slice(0, 300)}`);
    }
    return response.json();
}

function parseArcaListUrls(value) {
    return String(value || '')
        .split(/[\n,]/)
        .map(url => url.trim())
        .filter(Boolean)
        .map(url => {
            try {
                return new URL(url).toString();
            } catch (error) {
                return null;
            }
        })
        .filter(Boolean);
}

async function fetchText(url, timeoutMs = DEFAULT_ARCA_FETCH_TIMEOUT_MS) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
        controller.abort(new DOMException(`Fetch timed out after ${timeoutMs}ms`, 'TimeoutError'));
    }, timeoutMs);
    try {
        const response = await fetch(url, {
            headers: {
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7',
                'User-Agent': ARCA_FETCH_USER_AGENT
            },
            signal: controller.signal
        });
        if (!response.ok) {
            throw new HttpError(`Fetch failed: ${response.status}`, response.status);
        }
        return response.text();
    } finally {
        clearTimeout(timeoutId);
    }
}

async function fetchTextWithRetry(url, attempts = 3) {
    let lastError;
    for (let attempt = 0; attempt < attempts; attempt += 1) {
        try {
            return await fetchText(url);
        } catch (error) {
            lastError = error;
            const retryable = [429, 500, 502, 503, 504].includes(error.status)
                || error.name === 'AbortError'
                || error.name === 'TimeoutError';
            if (!retryable || attempt === attempts - 1) break;
            await new Promise(resolve => setTimeout(resolve, 500 * (attempt + 1)));
        }
    }
    throw lastError;
}

function extractArcaPostsFromList(html, listUrl) {
    const posts = [];
    const seenIds = new Set();
    const anchorRegex = /<a\b([^>]*?)href=["']([^"']+)["']([^>]*)>([\s\S]*?)<\/a>/gi;
    let match;

    while ((match = anchorRegex.exec(html)) !== null) {
        const attributes = `${match[1] || ''} ${match[3] || ''}`;
        const className = getHtmlAttribute(attributes, 'class');
        const classes = new Set(className.split(/\s+/).filter(Boolean));
        if (!classes.has('vrow') || classes.has('notice')) continue;

        let url;
        try {
            url = new URL(decodeHtmlEntities(match[2]), listUrl);
        } catch (error) {
            continue;
        }

        if (url.hostname !== 'arca.live') continue;
        const idMatch = url.pathname.match(/^\/b\/forgettingeve\/(\d+)\/?$/);
        if (!idMatch) continue;

        const id = idMatch[1];
        if (seenIds.has(id)) continue;
        seenIds.add(id);

        posts.push({
            id,
            url: `https://arca.live${url.pathname}`,
            title: cleanResourceTitle(extractArcaListTitle(match[4] || '')),
            image: extractArcaListImage(match[4] || '', listUrl),
            sourceTab: getArcaSourceTab(listUrl)
        });
    }

    return posts;
}

function getHtmlAttribute(attributes, name) {
    const escapedName = escapeRegExp(name);
    const match = String(attributes || '').match(
        new RegExp(`\\b${escapedName}\\s*=\\s*(["'])([\\s\\S]*?)\\1`, 'i')
    );
    return match ? decodeHtmlEntities(match[2]) : '';
}

function extractArcaListTitle(anchorHtml) {
    const html = String(anchorHtml || '');
    const titleStart = html.search(/<span\b[^>]*class=["']title["'][^>]*>/i);
    if (titleStart >= 0) {
        const titleHtml = html.slice(titleStart).replace(/^[\s\S]*?>/, '');
        const infoStart = titleHtml.search(/<span\b[^>]*class=["'][^"']*\binfo\b[^"']*["'][^>]*>/i);
        return stripHtml(infoStart >= 0 ? titleHtml.slice(0, infoStart) : titleHtml);
    }
    return stripHtml(html);
}

function extractArcaListImage(anchorHtml, listUrl) {
    const html = String(anchorHtml || '');
    const imageMatch = html.match(/<img\b[^>]*\bsrc=["']([^"']+)["'][^>]*>/i);
    return imageMatch
        ? normalizeImageUrl(decodeHtmlEntities(imageMatch[1]), listUrl)
        : '';
}

async function fetchArcaPostDetail(post, listUrl) {
    try {
        const html = await fetchTextWithRetry(post.url);
        const title = cleanResourceTitle(
            extractMetaContent(html, 'property', 'og:title') ||
            extractTitle(html) ||
            post.title ||
            post.id
        );
        const image = normalizeImageUrl(extractMetaContent(html, 'property', 'og:image') || '', post.url);

        const desc = decodeHtmlEntities(extractMetaContent(html, 'property', 'og:description') || '').trim();
        if (!desc) {
            throw new Error(`Arca post description is empty: ${post.url}`);
        }

        return {
            url: post.url,
            title,
            desc,
            image,
            sourceTab: post.sourceTab || getArcaSourceTab(listUrl)
        };
    } catch (error) {
        console.warn(`Arca detail fetch failed: ${post.url}`, error);
        throw error;
    }
}

function getArcaSourceTab(listUrl) {
    try {
        const category = new URL(listUrl).searchParams.get('category') || '';
        if (category === 'dwrr') return '진행중인 융재금구 팁';
        return decodeHtmlEntities(category);
    } catch (error) {
        return '';
    }
}

function extractMetaContent(html, attrName, attrValue) {
    const escapedAttr = escapeRegExp(attrValue);
    const regex = new RegExp(`<meta\\b(?=[^>]*\\b${attrName}=["']${escapedAttr}["'])([^>]*)>`, 'i');
    const match = html.match(regex);
    if (!match) return '';
    const contentMatch = match[1].match(/\bcontent=["']([^"']*)["']/i);
    return contentMatch ? decodeHtmlEntities(contentMatch[1]) : '';
}

function extractTitle(html) {
    const match = html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i);
    return match ? decodeHtmlEntities(stripHtml(match[1])) : '';
}

function cleanResourceTitle(title) {
    return String(title || '')
        .replace(/\s*[-–—|]\s*망각전야\s*채널\s*$/i, '')
        .trim();
}

function normalizeImageUrl(value, baseUrl) {
    const image = String(value || '').trim();
    if (!image) return '';
    try {
        return new URL(image, baseUrl).toString();
    } catch (error) {
        return image.startsWith('//') ? `https:${image}` : image;
    }
}

function stripHtml(value) {
    return decodeHtmlEntities(String(value || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim());
}

function decodeHtmlEntities(value) {
    return String(value || '')
        .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
        .replace(/&#(\d+);/g, (_, decimal) => String.fromCodePoint(parseInt(decimal, 10)))
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&apos;/g, "'");
}

function getPositiveIntegerEnv(value, fallback, min, max) {
    const number = Number.parseInt(value, 10);
    if (!Number.isFinite(number)) return fallback;
    return Math.min(max, Math.max(min, number));
}

function escapeRegExp(value) {
    return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

async function handleDiscordInteraction(request, env, ctx) {
    const rawBody = await request.text();
    const isVerified = await verifyDiscordRequest(request, rawBody, env);
    if (!isVerified) {
        console.warn('Discord interaction signature rejected', {
            applicationId: env.DISCORD_APPLICATION_ID || null,
            publicKeyPrefix: String(env.DISCORD_PUBLIC_KEY || '').slice(0, 12)
        });
        return new Response('invalid request signature', { status: 401 });
    }

    let interaction;
    try {
        interaction = JSON.parse(rawBody);
    } catch (error) {
        return interactionResponse(RESPONSE_CHANNEL_MESSAGE, {
            content: '잘못된 Discord interaction payload입니다.',
            flags: 64
        });
    }

    console.log('Discord interaction received', {
        type: interaction.type,
        command: interaction.data?.name || null,
        customId: interaction.data?.custom_id || null,
        channelId: interaction.channel_id || interaction.channel?.id || null,
        messageId: interaction.message?.id || null
    });

    if (interaction.type === INTERACTION_PING) {
        return interactionResponse(RESPONSE_PONG);
    }

    if (interaction.type === INTERACTION_APPLICATION_COMMAND) {
        if (!isAllowedApprover(interaction, env)) {
            return interactionResponse(RESPONSE_CHANNEL_MESSAGE, {
                content: '이 명령을 실행할 권한이 없습니다.',
                flags: 64
            });
        }

        const command = parseResourceCommand(interaction);
        if (!command) {
            return interactionResponse(RESPONSE_CHANNEL_MESSAGE, {
                content: '지원하지 않는 명령입니다.',
                flags: 64
            });
        }

        ctx.waitUntil(processResourceCommand(env, interaction, command));
        return interactionResponse(RESPONSE_DEFERRED_CHANNEL_MESSAGE, { flags: 64 });
    }

    if (interaction.type !== INTERACTION_MESSAGE_COMPONENT) {
        return interactionResponse(RESPONSE_CHANNEL_MESSAGE, {
            content: '지원하지 않는 interaction입니다.',
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

function normalizeResourceProposal(payload) {
    const link = payload.link || payload;
    const normalized = {
        link: {
            url: String(link.url || '').trim().slice(0, 800),
            title: String(link.title || '').trim().slice(0, 240),
            desc: String(link.desc || '').trim().slice(0, 1200),
            image: String(link.image || '').trim().slice(0, 1000)
        },
        targets: normalizeTargets(payload.targets || []),
        sourceTab: String(payload.sourceTab || '').trim().slice(0, 80),
        submittedBy: String(payload.submittedBy || 'bookmarklet').trim().slice(0, 80),
        submittedAt: payload.submittedAt || new Date().toISOString()
    };

    if (normalized.targets.length === 0) {
        normalized.targets = suggestTargets(normalized);
    }

    return normalized;
}

function canonicalizeResourceUrl(value) {
    const raw = String(value || '').trim();
    if (!raw) return '';

    try {
        const url = new URL(raw);
        const hostname = url.hostname.toLowerCase().replace(/\.$/, '').replace(/^www\./, '');
        let decodedPathname;
        try {
            decodedPathname = decodeURIComponent(url.pathname);
        } catch (error) {
            decodedPathname = url.pathname;
        }
        const pathname = decodedPathname.replace(/\/+$/, '') || '/';
        const arcaPost = hostname === 'arca.live'
            ? pathname.match(/^\/b\/([^/]+)\/(\d+)$/i)
            : null;
        if (arcaPost) {
            return `arca:${arcaPost[1].toLowerCase()}:${arcaPost[2]}`;
        }
        return raw;
    } catch (error) {
        return raw;
    }
}

async function createCanonicalResourceProposalId(linkIdentity) {
    const digest = await crypto.subtle.digest(
        'SHA-256',
        new TextEncoder().encode(`resource-link:${linkIdentity}`)
    );
    return [...new Uint8Array(digest)]
        .map(byte => byte.toString(16).padStart(2, '0'))
        .join('')
        .slice(0, 32);
}

function collectResourceLinkIdentities(database) {
    const identities = new Set();
    const addLinks = links => {
        if (!Array.isArray(links)) return;
        for (const link of links) {
            const identity = canonicalizeResourceUrl(link?.url);
            if (identity) identities.add(identity);
        }
    };

    for (const category of Object.values(database?.categories || {})) {
        addLinks(category?.links);
    }
    for (const links of Object.values(database?.characters || {})) {
        addLinks(links);
    }
    return identities;
}

async function getRegisteredResourceLinkIdentities(env) {
    const baseBranch = getBaseBranch(env);
    const [baseFile, openPendingPullRequest] = await Promise.all([
        getGitHubFile(env, RESOURCE_LINKS_PATH, baseBranch),
        findOpenResourceLinksPullRequest(env)
    ]);
    const files = [baseFile];
    if (openPendingPullRequest) {
        files.push(await getGitHubFile(env, RESOURCE_LINKS_PATH, RESOURCE_LINKS_PENDING_BRANCH));
    }

    const identities = new Set();
    for (const file of files) {
        const current = collectResourceLinkIdentities(JSON.parse(file.content));
        for (const identity of current) identities.add(identity);
    }
    return identities;
}

function normalizeTargets(targets) {
    const result = [];
    const seen = new Set();

    for (const target of targets) {
        const normalized = normalizeTarget(target);
        if (!normalized) continue;

        const key = `${normalized.type}:${normalized.id}`;
        if (seen.has(key)) continue;
        seen.add(key);
        result.push(normalized);
    }

    return result.slice(0, 80);
}

function normalizeTarget(target) {
    if (typeof target === 'string') {
        if (RESOURCE_CATEGORIES.includes(target)) return { type: 'category', id: target };
        if (target.startsWith('category:')) {
            const id = target.slice('category:'.length);
            if (RESOURCE_CATEGORIES.includes(id)) return { type: 'category', id };
        }
        if (target.startsWith('character:')) {
            const id = target.slice('character:'.length).trim();
            if (id) return { type: 'character', id };
        }
        return null;
    }

    if (!target || typeof target !== 'object') return null;
    const type = String(target.type || '').trim();
    const id = String(target.id || '').trim();

    if (type === 'category' && RESOURCE_CATEGORIES.includes(id)) return { type, id };
    if (type === 'character' && id) return { type, id };
    return null;
}

function suggestTargets(proposal) {
    const text = `${proposal.sourceTab} ${proposal.link.title} ${proposal.link.desc}`.toLowerCase();
    const targets = [];

    const add = id => targets.push({ type: 'category', id });

    if (hasAny(text, ['쿠폰', '코드', 'coupon', 'giftcode', 'redeem'])) add('code');
    if (hasAny(text, ['은열쇠', '실버키', '열쇠'])) add('silverkey');
    if (hasAny(text, ['명륜'])) add('myeongryun');
    if (hasAny(text, ['비밀계약', '계약', '밀계'])) add('covenant');
    if (hasAny(text, ['융재', '융재금구', '융재 금구', '금구'])) add('weapon');
    if (hasAny(text, ['융재 후기', '이번주 융재', '융재 금구', '금구', '융재'])) add('weekly_yungjae');
    if (hasAny(text, ['뉴비', '초보', '유입', '입문'])) add('newbie');
    if (hasAny(text, ['체스'])) add('chess');
    if (hasAny(text, ['환몽심잠', '환몽 심잠'])) add('dreamdive');
    if (hasAny(text, ['이벤트', 'event'])) add('event');

    return normalizeTargets(targets);
}

function hasAny(text, keywords) {
    return keywords.some(keyword => text.includes(keyword.toLowerCase()));
}

async function createFeedbackIssue(env, feedback) {
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

    return createGitHubIssueWithOptionalLabels(env, {
        title,
        body,
        labels: ['feedback:new']
    });
}

async function createGitHubIssueWithOptionalLabels(env, issuePayload) {
    let response = await githubJsonFetch(env, '/issues', {
        method: 'POST',
        body: issuePayload
    });

    if (response.status === 422 && issuePayload.labels) {
        const fallback = { ...issuePayload };
        delete fallback.labels;
        response = await githubJsonFetch(env, '/issues', {
            method: 'POST',
            body: fallback
        });
    }

    if (!response.ok) {
        const detail = await response.text();
        throw new Error(`GitHub issue creation failed: ${response.status} ${detail.slice(0, 300)}`);
    }

    return response.json();
}

async function sendResourceProposalMessage(env, proposal, proposalId) {
    const targetText = proposal.targets.length > 0
        ? proposal.targets.map(formatTarget).join('\n')
        : '추천 대상 없음';

    const payload = {
        content: buildResourceMessageContent(defaultResourceSelection()),
        allowed_mentions: { parse: [] },
        embeds: [{
            title: proposal.link.title,
            url: proposal.link.url,
            description: proposal.link.desc || '설명 없음',
            color: 0x3498DB,
            image: proposal.link.image ? { url: proposal.link.image } : undefined,
            fields: [
                { name: '추천 등록 대상', value: targetText.slice(0, 1024), inline: false }
            ],
            footer: { text: `Submitted by ${proposal.submittedBy}` },
            timestamp: new Date().toISOString()
        }],
        components: buildResourceComponents(proposalId, false, defaultResourceSelection())
    };

    const response = await fetch(`https://discord.com/api/v10/channels/${env.DISCORD_CHANNEL_ID}/messages`, {
        method: 'POST',
        headers: discordBotHeaders(env),
        body: JSON.stringify(payload)
    });

    if (!response.ok) {
        const detail = await response.text();
        throw new HttpError(`Discord resource proposal failed: ${response.status} ${detail.slice(0, 300)}`, response.status);
    }

    return response.json();
}

async function deleteDiscordResourceMessage(env, messageId) {
    const response = await fetch(
        `https://discord.com/api/v10/channels/${env.DISCORD_CHANNEL_ID}/messages/${messageId}`,
        {
            method: 'DELETE',
            headers: discordBotHeaders(env)
        }
    );
    if (!response.ok && response.status !== 404) {
        const detail = await response.text();
        throw new Error(`Discord proposal rollback failed: ${response.status} ${detail.slice(0, 300)}`);
    }
}

function buildResourceComponents(
    proposalId,
    disabled = false,
    selection = defaultResourceSelection(),
    proposalStatus = 'pending'
) {
    const activeRelems = normalizeRelems(selection.activeRelems);
    const selectedKeys = new Set(normalizeTargets(selection.targets || []).map(target => `${target.type}:${target.id}`));
    const activeCharacters = RESOURCE_CHARACTERS.filter(character => character.relems === activeRelems);
    const selectionRevision = normalizeResourceSelectionRevision(selection.revision);
    const isHeld = proposalStatus === 'held';
    const selectionDisabled = disabled || isHeld;
    const actionComponents = [
        {
            type: 2,
            style: 3,
            label: '추천대로 OK',
            custom_id: `rl:approve:${proposalId}`,
            disabled: selectionDisabled
        },
        {
            type: 2,
            style: 1,
            label: '선택 반영',
            custom_id: `rl:approve-selected:${proposalId}:${selectionRevision}`,
            disabled: selectionDisabled
        },
        {
            type: 2,
            style: 2,
            label: '선택 초기화',
            custom_id: `rl:clear-selection:${proposalId}`,
            disabled: selectionDisabled
        },
        {
            type: 2,
            style: 2,
            label: '보류',
            custom_id: `rl:hold:${proposalId}`,
            disabled: selectionDisabled
        }
    ];

    if (isHeld) {
        actionComponents.push({
            type: 2,
            style: 1,
            label: '보류 해제',
            custom_id: `rl:unhold:${proposalId}`,
            disabled
        });
    }

    return [
        {
            type: 1,
            components: actionComponents
        },
        {
            type: 1,
            components: [
                {
                    type: 3,
                    custom_id: `rl:categories:${proposalId}`,
                    placeholder: '일반 카테고리 선택',
                    min_values: 0,
                    max_values: RESOURCE_CATEGORIES.length,
                    disabled: selectionDisabled,
                    options: RESOURCE_CATEGORIES.map(id => ({
                        label: RESOURCE_CATEGORY_LABELS[id] || id,
                        value: `category:${id}`,
                        description: id,
                        default: selectedKeys.has(`category:${id}`)
                    }))
                }
            ]
        },
        {
            type: 1,
            components: RELEMS_ORDER.map(relems => ({
                type: 2,
                style: relems === activeRelems ? 1 : 2,
                label: RELEMS_LABELS[relems] || relems,
                custom_id: `rl:relems:${relems}:${proposalId}`,
                disabled: selectionDisabled
            }))
        },
        {
            type: 1,
            components: [
                {
                    type: 3,
                    custom_id: `rl:characters:${activeRelems}:${proposalId}`,
                    placeholder: `${RELEMS_LABELS[activeRelems] || activeRelems} 캐릭터 선택`,
                    min_values: 0,
                    max_values: activeCharacters.length,
                    disabled: selectionDisabled,
                    options: activeCharacters.map(character => ({
                        label: character.name || character.id,
                        value: `character:${character.id}`,
                        description: character.id,
                        default: selectedKeys.has(`character:${character.id}`)
                    }))
                }
            ]
        }
    ];
}

function buildResourceMessageContent(selection = defaultResourceSelection()) {
    return [
        'resource_links 등록 승인이 필요합니다.',
        `현재 선택: ${formatSelectionSummary(selection)}`,
        `캐릭터 탭: ${RELEMS_LABELS[normalizeRelems(selection.activeRelems)]}`
    ].join('\n');
}

function formatSelectionSummary(selection) {
    const targets = normalizeTargets(selection.targets || []);
    if (targets.length === 0) return '없음';

    const labels = targets.map(formatTargetLabel);
    const visible = labels.slice(0, 20).join(', ');
    const hiddenCount = labels.length - 20;
    return hiddenCount > 0 ? `${visible} 외 ${hiddenCount}개` : visible;
}

function formatTargetLabel(target) {
    if (!target) return 'unknown';
    if (target.type === 'category') return RESOURCE_CATEGORY_LABELS[target.id] || target.id;
    if (target.type === 'character') return RESOURCE_CHARACTER_BY_ID[target.id]?.name || target.id;
    return formatTarget(target);
}

function defaultResourceSelection() {
    return {
        targets: [],
        activeRelems: DEFAULT_ACTIVE_RELEMS,
        revision: '0'
    };
}

function normalizeResourceSelection(selection) {
    return {
        targets: normalizeTargets(selection?.targets || []),
        activeRelems: normalizeRelems(selection?.activeRelems),
        revision: normalizeResourceSelectionRevision(selection?.revision),
        updatedAt: selection?.updatedAt || null,
        updatedBy: selection?.updatedBy || null
    };
}

function normalizeResourceSelectionRevision(revision) {
    const value = String(revision || '0');
    return /^[a-f0-9]{1,16}$/.test(value) ? value : '0';
}

function createResourceSelectionRevision() {
    return crypto.randomUUID().replaceAll('-', '').slice(0, 16);
}

function normalizeRelems(relems) {
    return RELEMS_ORDER.includes(relems) ? relems : DEFAULT_ACTIVE_RELEMS;
}

function replaceTargetsByType(currentTargets, type, replacementTargets) {
    return normalizeTargets([
        ...normalizeTargets(currentTargets || []).filter(target => target.type !== type),
        ...normalizeTargets(replacementTargets || []).filter(target => target.type === type)
    ]);
}

function replaceCharacterTargetsByRelems(currentTargets, relems, replacementTargets) {
    const normalizedRelems = normalizeRelems(relems);
    const retainedTargets = normalizeTargets(currentTargets || []).filter(target => {
        if (target.type !== 'character') return true;
        return RESOURCE_CHARACTER_BY_ID[target.id]?.relems !== normalizedRelems;
    });
    const selectedTargets = normalizeTargets(replacementTargets || []).filter(target => {
        return target.type === 'character' && RESOURCE_CHARACTER_BY_ID[target.id]?.relems === normalizedRelems;
    });

    return normalizeTargets([...retainedTargets, ...selectedTargets]);
}

function createResourceProposalId() {
    return crypto.randomUUID().replaceAll('-', '');
}

function getResourceProposalStateKey(proposalId) {
    return `${RESOURCE_PROPOSAL_STATE_PREFIX}${proposalId}`;
}

function createResourceProposalState(proposal, proposalId = createResourceProposalId()) {
    return {
        id: proposalId,
        proposal,
        selection: defaultResourceSelection(),
        status: 'pending',
        deliveryStatus: 'sending',
        createdAt: new Date().toISOString(),
        discordMessageId: null
    };
}

function normalizeStoredResourceProposalState(proposalId, state) {
    return {
        ...state,
        id: proposalId,
        selection: normalizeResourceSelection(state.selection),
        updatedAt: new Date().toISOString()
    };
}

async function callResourceProposalObject(env, proposalId, action, payload = {}) {
    if (!env.RESOURCE_PROPOSAL_STATE) return null;
    const id = env.RESOURCE_PROPOSAL_STATE.idFromName(String(proposalId));
    const stub = env.RESOURCE_PROPOSAL_STATE.get(id);
    const response = await stub.fetch('https://resource-proposal.local/', {
        method: 'POST',
        body: JSON.stringify({ action, ...payload })
    });
    const result = await response.json();
    if (!response.ok && ![404, 409].includes(response.status)) {
        throw new Error(result.error || `Resource proposal state request failed: ${response.status}`);
    }
    return { ...result, status: response.status };
}

async function mirrorResourceProposalState(env, proposalId, state) {
    if (!env.RESOURCE_LINK_STATE) return false;
    await env.RESOURCE_LINK_STATE.put(
        getResourceProposalStateKey(proposalId),
        JSON.stringify(state)
    );
    return true;
}

async function deleteResourceProposalState(env, proposalId) {
    await callResourceProposalObject(env, proposalId, 'delete').catch(error => {
        console.error('Failed to delete durable proposal state', { proposalId, error });
    });
    await env.RESOURCE_LINK_STATE?.delete(getResourceProposalStateKey(proposalId)).catch(error => {
        console.error('Failed to delete mirrored proposal state', { proposalId, error });
    });
}

async function createResourceProposalMessage(env, proposal, proposalId = createResourceProposalId()) {
    if (!env.RESOURCE_PROPOSAL_STATE && !env.RESOURCE_LINK_STATE) {
        throw new Error('RESOURCE_PROPOSAL_STATE or RESOURCE_LINK_STATE binding is required for resource link proposals');
    }

    const state = createResourceProposalState(proposal, proposalId);
    if (env.RESOURCE_PROPOSAL_STATE) {
        const created = await callResourceProposalObject(env, state.id, 'create', { state });
        if (!created?.ok) {
            const error = new Error('동일한 링크 제보가 이미 처리 중이거나 처리되었습니다.');
            error.code = created?.reason === 'already-exists'
                ? 'RESOURCE_PROPOSAL_ALREADY_EXISTS'
                : 'RESOURCE_PROPOSAL_CREATE_FAILED';
            error.currentState = created?.state || null;
            throw error;
        }
    }

    let discordMessage;
    try {
        discordMessage = await sendResourceProposalMessage(env, proposal, state.id);
    } catch (error) {
        if (Number.isFinite(error.status)) {
            await updateResourceProposalState(env, state.id, {
                ...state,
                status: 'delivery_failed',
                deliveryStatus: 'confirmed_failed',
                deliveryError: error.message || 'known HTTP error'
            }).catch(stateError => {
                console.error('Failed to release confirmed Discord delivery failure', {
                    proposalId: state.id,
                    stateError
                });
            });
        } else if (env.RESOURCE_PROPOSAL_STATE) {
            await updateResourceProposalState(env, state.id, {
                ...state,
                deliveryStatus: 'unknown',
                deliveryError: error.message || 'unknown error'
            }).catch(stateError => {
                console.error('Failed to preserve uncertain Discord delivery state', {
                    proposalId: state.id,
                    stateError
                });
            });
        } else {
            await deleteResourceProposalState(env, state.id);
        }
        if (!Number.isFinite(error.status)) {
            error.deliveryStatusUnknown = true;
            error.proposalId = state.id;
        }
        throw error;
    }
    const proposalState = {
        ...state,
        deliveryStatus: 'delivered',
        discordMessageId: discordMessage.id
    };

    try {
        await updateResourceProposalState(env, state.id, proposalState);
    } catch (error) {
        let deleted = false;
        await deleteDiscordResourceMessage(env, discordMessage.id).then(() => {
            deleted = true;
        }).catch(deleteError => {
            console.error('Failed to roll back orphaned Discord proposal', deleteError);
        });
        if (deleted) {
            await updateResourceProposalState(env, state.id, {
                ...state,
                status: 'delivery_failed',
                deliveryStatus: 'confirmed_failed',
                deliveryError: error.message || 'proposal state persistence failed after Discord rollback'
            }).catch(stateError => {
                console.error('Failed to release rolled back Discord delivery', {
                    proposalId: state.id,
                    stateError
                });
            });
        } else {
            error.deliveryStatusUnknown = true;
            error.proposalId = state.id;
            error.discordMessageId = discordMessage.id;
        }
        throw error;
    }

    return { proposalState, discordMessage };
}

async function getResourceProposalState(env, proposalId) {
    if (!env.RESOURCE_PROPOSAL_STATE && !env.RESOURCE_LINK_STATE) {
        throw new Error('RESOURCE_PROPOSAL_STATE or RESOURCE_LINK_STATE binding is required for resource link proposals');
    }

    const durable = await callResourceProposalObject(env, proposalId, 'get');
    if (durable?.ok && durable.state?.proposal && durable.state?.id) {
        return {
            ...durable.state,
            selection: normalizeResourceSelection(durable.state.selection)
        };
    }

    const state = await env.RESOURCE_LINK_STATE?.get(getResourceProposalStateKey(proposalId), 'json');
    if (!state?.proposal || !state?.id) {
        const error = new Error('만료되었거나 복구할 수 없는 링크 제보입니다. 새 제보를 생성해주세요.');
        error.code = 'RESOURCE_PROPOSAL_NOT_FOUND';
        throw error;
    }
    if (env.RESOURCE_PROPOSAL_STATE) {
        await callResourceProposalObject(env, proposalId, 'create', {
            state: normalizeStoredResourceProposalState(proposalId, state)
        }).catch(error => console.error('Failed to migrate proposal state from KV', { proposalId, error }));
    }
    return {
        ...state,
        selection: normalizeResourceSelection(state.selection)
    };
}

async function updateResourceProposalState(env, proposalId, state) {
    if (!env.RESOURCE_PROPOSAL_STATE && !env.RESOURCE_LINK_STATE) {
        throw new Error('RESOURCE_PROPOSAL_STATE or RESOURCE_LINK_STATE binding is required for resource link proposals');
    }

    const normalizedState = normalizeStoredResourceProposalState(proposalId, state);
    if (env.RESOURCE_PROPOSAL_STATE) {
        const result = await callResourceProposalObject(env, proposalId, 'put', { state: normalizedState });
        if (!result?.ok) throw new Error('링크 제보 상태 저장에 실패했습니다.');
        await mirrorResourceProposalState(env, proposalId, normalizedState).catch(error => {
            console.error('Proposal KV mirror write failed', { proposalId, error });
        });
        return normalizedState;
    }
    await mirrorResourceProposalState(env, proposalId, normalizedState);
    return normalizedState;
}

async function claimResourceProposalProcessing(env, proposalId, state) {
    return transitionResourceProposalState(
        env,
        proposalId,
        state,
        ['pending'],
        undefined,
        state.selection?.revision
    );
}

async function transitionResourceProposalState(
    env,
    proposalId,
    state,
    expectedStatuses,
    expectedProcessingToken,
    expectedSelectionRevision
) {
    const normalizedState = normalizeStoredResourceProposalState(proposalId, state);
    if (!env.RESOURCE_PROPOSAL_STATE) {
        await updateResourceProposalState(env, proposalId, normalizedState);
        return { ok: true, state: normalizedState };
    }

    const payload = {
        expectedStatuses,
        state: normalizedState
    };
    if (expectedProcessingToken !== undefined) {
        payload.expectedProcessingToken = expectedProcessingToken;
    }
    if (expectedSelectionRevision !== undefined) {
        payload.expectedSelectionRevision = expectedSelectionRevision;
    }
    const result = await callResourceProposalObject(env, proposalId, 'transition', {
        ...payload
    });
    if (!result?.ok) return result;
    await mirrorResourceProposalState(env, proposalId, normalizedState).catch(error => {
        console.error('Proposal KV mirror write failed after processing claim', { proposalId, error });
    });
    return result;
}

async function transitionResourceProposalFromSnapshot(env, proposalId, currentState, nextState) {
    return transitionResourceProposalState(
        env,
        proposalId,
        nextState,
        [currentState.status],
        currentState.status === 'processing' ? currentState.processingToken : undefined,
        currentState.selection?.revision
    );
}

function requireResourceProposalTransition(result) {
    if (result?.ok) return result.state;
    const error = new Error('제보 상태가 다른 요청에서 변경되었습니다. 최신 메시지에서 다시 시도해주세요.');
    error.code = 'RESOURCE_PROPOSAL_STATE_CHANGED';
    error.currentState = result?.state || null;
    throw error;
}

async function notifyDiscord(env, feedback, issue) {
    if (!env.DISCORD_WEBHOOK_URL) return;

    const response = await fetch(env.DISCORD_WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            username: 'Morimens Wiki Bot',
            allowed_mentions: { parse: [] },
            embeds: [{
                title: '새 피드백이 접수되었습니다',
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

function parseResourceDecision(interaction) {
    const customId = interaction.data?.custom_id || '';
    const parts = customId.split(':');
    if (parts[0] !== 'rl') return null;

    const action = parts[1];

    if (['approve', 'approve-selected', 'clear-selection', 'hold', 'unhold', 'categories'].includes(action)) {
        const proposalId = parts[2];
        if (!/^[a-f0-9]{32}$/.test(proposalId || '')) return null;
        return {
            action,
            proposalId,
            selectionRevision: action === 'approve-selected'
                ? normalizeResourceSelectionRevision(parts[3])
                : null,
            targets: action === 'categories' ? normalizeTargets(interaction.data?.values || []) : []
        };
    }

    if (action === 'relems') {
        const relems = normalizeRelems(parts[2]);
        const proposalId = parts[3];
        if (!/^[a-f0-9]{32}$/.test(proposalId || '')) return null;
        return { action, proposalId, relems };
    }

    if (action === 'characters') {
        const relems = normalizeRelems(parts[2]);
        const proposalId = parts[3];
        if (!/^[a-f0-9]{32}$/.test(proposalId || '')) return null;
        return {
            action,
            proposalId,
            relems,
            targets: normalizeTargets(interaction.data?.values || [])
        };
    }

    return null;
}

async function processResourceDecision(env, interaction, decision) {
    try {
        const proposalState = await getResourceProposalState(env, decision.proposalId);
        const proposal = proposalState.proposal;
        const selection = proposalState.selection;

        if (proposalState.status === 'processing') {
            await editDiscordMessage(env, interaction, {
                content: 'resource_links 반영을 처리 중입니다. 잠시만 기다려주세요.',
                components: buildResourceComponents(decision.proposalId, true, selection)
            });
            return;
        }

        if (decision.action === 'unhold') {
            if (proposalState.status !== 'held') {
                await editDiscordMessage(env, interaction, {
                    content: `보류 상태가 아닙니다. (상태: ${proposalState.status})`,
                    components: buildResourceComponents(
                        decision.proposalId,
                        proposalState.status !== 'pending',
                        selection,
                        proposalState.status
                    )
                });
                return;
            }

            const updatedState = {
                ...proposalState,
                status: 'pending',
                unheldBy: getInteractionUserLabel(interaction)
            };
            requireResourceProposalTransition(await transitionResourceProposalFromSnapshot(
                env,
                decision.proposalId,
                proposalState,
                updatedState
            ));
            await editDiscordMessage(env, interaction, {
                content: [
                    '보류가 해제되었습니다. 다시 등록 대상을 선택하고 승인할 수 있습니다.',
                    buildResourceMessageContent(selection)
                ].join('\n'),
                components: buildResourceComponents(decision.proposalId, false, selection)
            });
            return;
        }

        if (proposalState.status !== 'pending') {
            await editDiscordMessage(env, interaction, {
                content: `이미 처리된 제보입니다. (상태: ${proposalState.status})`,
                components: buildResourceComponents(
                    decision.proposalId,
                    proposalState.status !== 'held',
                    selection,
                    proposalState.status
                )
            });
            return;
        }

        if (decision.action === 'hold') {
            requireResourceProposalTransition(await transitionResourceProposalFromSnapshot(
                env,
                decision.proposalId,
                proposalState,
                {
                    ...proposalState,
                    status: 'held',
                    handledBy: getInteractionUserLabel(interaction)
                }
            ));
            await editDiscordMessage(env, interaction, {
                content: `보류 처리됨: resource_links를 변경하지 않았습니다. (${getInteractionUserLabel(interaction)})`,
                components: buildResourceComponents(decision.proposalId, false, selection, 'held')
            });
            return;
        }

        if (decision.action === 'categories') {
            const updatedSelection = {
                ...selection,
                targets: replaceTargetsByType(selection.targets, 'category', decision.targets),
                revision: createResourceSelectionRevision(),
                updatedAt: new Date().toISOString(),
                updatedBy: getInteractionUserLabel(interaction)
            };
            requireResourceProposalTransition(await transitionResourceProposalFromSnapshot(
                env, decision.proposalId, proposalState, { ...proposalState, selection: updatedSelection }
            ));
            await editDiscordMessage(env, interaction, {
                content: buildResourceMessageContent(updatedSelection),
                components: buildResourceComponents(decision.proposalId, false, updatedSelection)
            });
            return;
        }

        if (decision.action === 'relems') {
            const updatedSelection = {
                ...selection,
                activeRelems: decision.relems,
                revision: createResourceSelectionRevision(),
                updatedAt: new Date().toISOString(),
                updatedBy: getInteractionUserLabel(interaction)
            };
            requireResourceProposalTransition(await transitionResourceProposalFromSnapshot(
                env, decision.proposalId, proposalState, { ...proposalState, selection: updatedSelection }
            ));
            await editDiscordMessage(env, interaction, {
                content: buildResourceMessageContent(updatedSelection),
                components: buildResourceComponents(decision.proposalId, false, updatedSelection)
            });
            return;
        }

        if (decision.action === 'characters') {
            const updatedSelection = {
                ...selection,
                activeRelems: decision.relems,
                targets: replaceCharacterTargetsByRelems(selection.targets, decision.relems, decision.targets),
                revision: createResourceSelectionRevision(),
                updatedAt: new Date().toISOString(),
                updatedBy: getInteractionUserLabel(interaction)
            };
            requireResourceProposalTransition(await transitionResourceProposalFromSnapshot(
                env, decision.proposalId, proposalState, { ...proposalState, selection: updatedSelection }
            ));
            await editDiscordMessage(env, interaction, {
                content: buildResourceMessageContent(updatedSelection),
                components: buildResourceComponents(decision.proposalId, false, updatedSelection)
            });
            return;
        }

        if (decision.action === 'clear-selection') {
            const updatedSelection = {
                ...selection,
                targets: [],
                revision: createResourceSelectionRevision(),
                updatedAt: new Date().toISOString(),
                updatedBy: getInteractionUserLabel(interaction)
            };
            requireResourceProposalTransition(await transitionResourceProposalFromSnapshot(
                env, decision.proposalId, proposalState, { ...proposalState, selection: updatedSelection }
            ));
            await editDiscordMessage(env, interaction, {
                content: buildResourceMessageContent(updatedSelection),
                components: buildResourceComponents(decision.proposalId, false, updatedSelection)
            });
            return;
        }

        if (decision.action === 'approve-selected'
            && decision.selectionRevision !== normalizeResourceSelectionRevision(selection.revision)) {
            await editDiscordMessage(env, interaction, {
                content: '선택 상태를 동기화하는 중입니다. 잠시 후 `선택 반영`을 다시 눌러주세요.'
            });
            return;
        }

        const targets = decision.action === 'approve-selected'
            ? selection.targets
            : proposal.targets;
        if (!targets || targets.length === 0) {
            await editDiscordMessage(env, interaction, {
                content: '처리 안 됨: 선택된 등록 대상이 없습니다. resource_links를 변경하지 않았습니다.',
                components: buildResourceComponents(decision.proposalId, false, selection)
            });
            return;
        }

        const processingToken = createResourceProposalId();
        const processingState = {
            ...proposalState,
            status: 'processing',
            selection,
            handledBy: getInteractionUserLabel(interaction),
            processingStartedAt: new Date().toISOString(),
            processingToken
        };

        try {
            const claim = await claimResourceProposalProcessing(env, decision.proposalId, processingState);
            if (!claim?.ok) {
                const current = claim?.state;
                await editDiscordMessage(env, interaction, {
                    content: current?.status === 'processing'
                        ? 'resource_links 반영을 이미 처리 중입니다. 잠시만 기다려주세요.'
                        : `이미 처리 상태가 변경된 제보입니다. (상태: ${current?.status || 'unknown'})`,
                    components: buildResourceComponents(
                        decision.proposalId,
                        true,
                        current?.selection || selection,
                        current?.status || 'processing'
                    )
                });
                return;
            }
            await editDiscordMessage(env, interaction, {
                content: 'resource_links 반영을 처리 중입니다. 잠시만 기다려주세요.',
                components: buildResourceComponents(decision.proposalId, true, selection)
            });
            await enqueueResourceUpdate(env, {
                proposalId: decision.proposalId,
                targets,
                channelId: interaction.channel_id || interaction.channel?.id || interaction.message?.channel_id,
                messageId: interaction.message?.id,
                handledBy: processingState.handledBy,
                processingToken
            });
        } catch (error) {
            await transitionResourceProposalState(
                env,
                decision.proposalId,
                {
                    ...proposalState,
                    status: 'pending',
                    selection,
                    processingToken: null,
                    lastError: error.message || 'unknown error'
                },
                ['processing'],
                processingToken,
                selection.revision
            );
            throw error;
        }
    } catch (error) {
        console.error(error);
        await editDiscordMessage(env, interaction, {
            content: `처리 실패: ${error.message}`,
            components: error.code === 'RESOURCE_PROPOSAL_NOT_FOUND'
                ? disableDiscordComponents(interaction.message?.components || [])
                : interaction.message?.components || []
        });
    }
}

function disableDiscordComponents(components) {
    return (components || []).map(row => ({
        ...row,
        components: (row.components || []).map(component => ({ ...component, disabled: true }))
    }));
}

async function enqueueResourceUpdate(env, job) {
    if (!env.RESOURCE_LINK_QUEUE) {
        throw new Error('RESOURCE_LINK_QUEUE binding is required');
    }
    await env.RESOURCE_LINK_QUEUE.send(job);
}

async function processQueuedResourceUpdate(env, message) {
    const job = message.body || {};
    if (!/^[a-f0-9]{32}$/.test(job.proposalId || '')) {
        console.error('Invalid resource update queue job', job);
        message.ack();
        return;
    }

    let proposalState;
    let processingToken = String(job.processingToken || '');
    try {
        proposalState = await getResourceProposalState(env, job.proposalId);
        if (proposalState.status === 'pending' && job.retryPending) {
            processingToken = processingToken || createResourceProposalId();
            proposalState = {
                ...proposalState,
                status: 'processing',
                processingStartedAt: new Date().toISOString(),
                processingToken,
                automaticRetryCount: Number(proposalState.automaticRetryCount || 0) + 1
            };
            const transition = await transitionResourceProposalFromSnapshot(
                env, job.proposalId, { ...proposalState, status: 'pending', processingToken: null }, proposalState
            );
            if (!transition?.ok) {
                message.ack();
                return;
            }
            proposalState = transition.state;
        }
        if (proposalState.status !== 'processing') {
            message.ack();
            return;
        }
        if (proposalState.processingToken) {
            if (!processingToken || processingToken !== proposalState.processingToken) {
                message.ack();
                return;
            }
        } else {
            processingToken = processingToken || createResourceProposalId();
            const nextState = { ...proposalState, processingToken };
            const transition = await transitionResourceProposalFromSnapshot(
                env, job.proposalId, proposalState, nextState
            );
            if (!transition?.ok) {
                message.ack();
                return;
            }
            proposalState = transition.state;
        }

        const targets = normalizeTargets(job.targets?.length ? job.targets : proposalState.selection.targets);
        const result = await updateResourceLinks(env, proposalState.proposal.link, targets);
        const { content: _updatedContent, ...storedResult } = result;
        const completedState = {
            ...proposalState,
            status: 'completed',
            handledBy: job.handledBy || proposalState.handledBy,
            completedAt: new Date().toISOString(),
            processingToken: null,
            lastError: null,
            failedAt: null,
            result: storedResult
        };
        requireResourceProposalTransition(await transitionResourceProposalFromSnapshot(
            env, job.proposalId, proposalState, completedState
        ));
        await editResourceProposalMessage(env, job, {
            content: buildResourceUpdateResultMessage(storedResult),
            components: buildResourceComponents(job.proposalId, true, completedState.selection)
        }).catch(error => console.error('Failed to show completed resource update', error));
        message.ack();
    } catch (error) {
        console.error('Queued resource update failed', error);
        if (proposalState) {
            const currentState = await getResourceProposalState(env, job.proposalId).catch(() => null);
            const stillOwnsProcessing = currentState?.status === 'processing'
                && (!currentState.processingToken || currentState.processingToken === processingToken);
            if (!stillOwnsProcessing) {
                message.ack();
                return;
            }
            const pendingState = {
                ...currentState,
                status: 'pending',
                processingToken: null,
                lastError: error.message || 'unknown error',
                failedAt: new Date().toISOString()
            };
            const transition = await transitionResourceProposalFromSnapshot(
                env, job.proposalId, currentState, pendingState
            );
            if (!transition?.ok) {
                message.ack();
                return;
            }
            await editResourceProposalMessage(env, job, {
                content: `처리 실패: ${error.message}. 선택을 확인한 뒤 다시 눌러주세요.`,
                components: buildResourceComponents(job.proposalId, false, pendingState.selection)
            }).catch(editError => console.error('Failed to restore Discord proposal message', editError));
        }
        message.ack();
    }
}

async function editResourceProposalMessage(env, job, payload) {
    return editDiscordMessage(env, {
        channel_id: job.channelId || env.DISCORD_CHANNEL_ID,
        message: { id: job.messageId }
    }, payload);
}

async function recoverStaleResourceProposals(env) {
    if (!env.RESOURCE_LINK_STATE || !env.RESOURCE_LINK_QUEUE) return;

    const scanLimit = getPositiveIntegerEnv(
        env.STALE_PROPOSAL_SCAN_LIMIT,
        DEFAULT_STALE_PROPOSAL_SCAN_LIMIT,
        1,
        20
    );
    let savedCursor = await env.RESOURCE_LINK_STATE.get(RESOURCE_PROPOSAL_RECOVERY_CURSOR_KEY);
    const listOptions = {
        prefix: RESOURCE_PROPOSAL_STATE_PREFIX,
        limit: scanLimit
    };
    if (savedCursor) listOptions.cursor = savedCursor;

    let page;
    try {
        page = await env.RESOURCE_LINK_STATE.list(listOptions);
    } catch (error) {
        if (!savedCursor) throw error;
        console.warn('Stale proposal recovery cursor was invalid; restarting scan');
        await env.RESOURCE_LINK_STATE.delete(RESOURCE_PROPOSAL_RECOVERY_CURSOR_KEY);
        savedCursor = null;
        page = await env.RESOURCE_LINK_STATE.list({
            prefix: RESOURCE_PROPOSAL_STATE_PREFIX,
            limit: scanLimit
        });
    }

    let requeued = 0;
    for (const key of page.keys) {
        const mirroredState = await env.RESOURCE_LINK_STATE.get(key.name, 'json');
        if (!mirroredState?.id) continue;
        const state = await getResourceProposalState(env, mirroredState.id).catch(error => {
            console.error('Failed to read canonical proposal during recovery', {
                proposalId: mirroredState.id,
                error
            });
            return null;
        });
        if (!state) continue;
        const retryFailedUpdate = state?.status === 'pending'
            && state.lastError
            && Number(state.automaticRetryCount || 0) < 1;
        if (state?.status !== 'processing' && !retryFailedUpdate) continue;

        const startedAt = Date.parse(
            retryFailedUpdate
                ? state.failedAt || state.updatedAt || 0
                : state.processingStartedAt || state.updatedAt || 0
        );
        if (Number.isFinite(startedAt) && Date.now() - startedAt < RESOURCE_PROCESSING_STALE_MS) continue;

        const processingToken = createResourceProposalId();
        const processingState = {
            ...state,
            status: 'processing',
            processingStartedAt: new Date().toISOString(),
            processingToken,
            recoveryCount: Number(state.recoveryCount || 0) + 1,
            automaticRetryCount: Number(state.automaticRetryCount || 0) + (retryFailedUpdate ? 1 : 0)
        };
        const transition = await transitionResourceProposalState(
            env,
            state.id,
            processingState,
            [state.status],
            state.status === 'processing' ? state.processingToken : undefined
        );
        if (!transition?.ok) continue;
        await enqueueResourceUpdate(env, {
            proposalId: state.id,
            targets: normalizeTargets(state.selection?.targets || state.proposal?.targets || []),
            channelId: env.DISCORD_CHANNEL_ID,
            messageId: state.discordMessageId,
            handledBy: state.handledBy || 'automatic recovery',
            processingToken
        });
        requeued += 1;
        console.log('Requeued stale resource proposal', { proposalId: state.id });
    }

    if (page.list_complete || !page.cursor) {
        if (savedCursor) {
            await env.RESOURCE_LINK_STATE.delete(RESOURCE_PROPOSAL_RECOVERY_CURSOR_KEY);
        }
    } else if (page.cursor !== savedCursor) {
        await env.RESOURCE_LINK_STATE.put(RESOURCE_PROPOSAL_RECOVERY_CURSOR_KEY, page.cursor);
    }

    console.log('Stale proposal recovery scan completed', {
        scanned: page.keys.length,
        requeued,
        cycleCompleted: Boolean(page.list_complete)
    });
}

async function getSeenArcaPostIds(env) {
    const ids = new Set();
    let cursor;
    do {
        const options = {
            prefix: ARCA_SEEN_KEY_PREFIX,
            limit: 1000
        };
        if (cursor) options.cursor = cursor;
        const page = await env.RESOURCE_LINK_STATE.list(options);
        for (const key of page.keys) {
            ids.add(key.name.slice(ARCA_SEEN_KEY_PREFIX.length));
        }
        cursor = page.list_complete ? undefined : page.cursor;
    } while (cursor);
    return ids;
}

async function getPendingArcaPostIds(env) {
    const ids = new Set();
    let cursor;
    do {
        const options = {
            prefix: ARCA_PENDING_KEY_PREFIX,
            limit: 1000
        };
        if (cursor) options.cursor = cursor;
        const page = await env.RESOURCE_LINK_STATE.list(options);
        for (const key of page.keys) {
            ids.add(key.name.slice(ARCA_PENDING_KEY_PREFIX.length));
        }
        cursor = page.list_complete ? undefined : page.cursor;
    } while (cursor);
    return ids;
}

async function updateResourceLinks(env, link, targets) {
    await ensureResourceLinksPendingBranch(env);

    for (let attempt = 0; attempt < 2; attempt += 1) {
        const file = await getGitHubFile(env, RESOURCE_LINKS_PATH, RESOURCE_LINKS_PENDING_BRANCH);
        const update = buildResourceLinksUpdate(file.content, link, targets);

        if (update.added.length === 0) {
            const pr = await findOpenResourceLinksPullRequest(env);
            return {
                ...update,
                commitUrl: 'no changes',
                prUrl: pr?.html_url || 'no open PR'
            };
        }

        try {
            const commit = await putGitHubFile(env, RESOURCE_LINKS_PATH, {
                message: `Update resource links: ${link.title.slice(0, 60)}`,
                content: update.content,
                sha: file.sha,
                branch: RESOURCE_LINKS_PENDING_BRANCH
            });
            const pr = await ensureResourceLinksPullRequest(env);
            if (!pr) {
                const baseBranch = getBaseBranch(env);
                const [baseFile, baseRef] = await Promise.all([
                    getGitHubFile(env, RESOURCE_LINKS_PATH, baseBranch),
                    getGitHubRef(env, baseBranch)
                ]);
                const baseCheck = buildResourceLinksUpdate(baseFile.content, link, targets);
                if (baseCheck.added.length === 0) {
                    return {
                        ...update,
                        commitUrl: commit.commit?.html_url || commit.content?.html_url || 'already merged',
                        prUrl: 'already merged into main'
                    };
                }
                if (baseRef && attempt === 0) {
                    await updateGitHubRef(env, RESOURCE_LINKS_PENDING_BRANCH, baseRef.object.sha, true);
                    continue;
                }
                throw new Error('resource_links pending branch has no PR diff and the link is not in main');
            }
            await appendResourceLinksPullRequestSummary(env, pr, link, update.added);

            return {
                ...update,
                commitUrl: commit.commit?.html_url || commit.content?.html_url || 'unknown',
                prUrl: pr.html_url
            };
        } catch (error) {
            if ((error.status === 409 || error.status === 422) && attempt === 0) continue;
            throw error;
        }
    }

    throw new Error('resource_links update failed after retry');
}

function buildResourceLinksUpdate(content, link, targets) {
    const db = JSON.parse(content);
    const uniqueTargets = normalizeTargets(targets);
    const result = { added: [], skipped: [], missing: [] };
    let updatedContent = content;

    for (const target of uniqueTargets) {
        const missingCharacterTarget = target.type === 'character'
            && !Array.isArray(db.characters?.[target.id]);
        const list = missingCharacterTarget ? [] : getTargetList(db, target);
        const targetArray = missingCharacterTarget ? null : findTargetArray(updatedContent, target);
        if (!list) {
            result.missing.push(target);
            continue;
        }
        if (!missingCharacterTarget && !targetArray) {
            result.missing.push(target);
            continue;
        }

        const incomingIdentity = canonicalizeResourceUrl(link.url);
        if (list.some(item => item && canonicalizeResourceUrl(item.url) === incomingIdentity)) {
            result.skipped.push(target);
            continue;
        }

        const normalizedLink = removeEmptyLinkFields(link);
        const insertion = missingCharacterTarget
            ? buildMissingCharacterLinkInsertion(updatedContent, target, normalizedLink)
            : buildResourceLinkInsertion(updatedContent, target, normalizedLink, targetArray);
        if (!insertion) {
            result.missing.push(target);
            continue;
        }

        updatedContent = insertion;
        if (missingCharacterTarget) {
            if (!db.characters) db.characters = {};
            db.characters[target.id] = [normalizedLink];
        } else {
            list.unshift(normalizedLink);
        }
        result.added.push(target);
    }

    return {
        ...result,
        content: updatedContent
    };
}

function buildResourceUpdateResultMessage(result) {
    const lines = [];

    if (result.added.length > 0) {
        lines.push('resource_links 배치 PR 업데이트 완료');
    } else if (result.missing.length > 0) {
        lines.push('resource_links 업데이트 실패: 등록 대상을 찾지 못했습니다.');
    } else {
        lines.push('resource_links 변경 없음: 선택한 대상에 이미 등록되어 있습니다.');
    }

    if (result.prUrl && result.prUrl !== 'no open PR') {
        lines.push(`PR: ${result.prUrl}`);
    }
    lines.push(
        `추가: ${result.added.map(formatTarget).join(', ') || 'none'}`,
        `이미 존재: ${result.skipped.map(formatTarget).join(', ') || 'none'}`,
        `누락 대상: ${result.missing.map(formatTarget).join(', ') || 'none'}`
    );

    return lines.join('\n');
}

function buildResourceLinkInsertion(content, target, link, targetArray = null) {
    const listInfo = targetArray || findTargetArray(content, target);
    if (!listInfo) return null;

    const firstItemIndent = `${listInfo.indent}  `;
    const itemText = JSON.stringify(link, null, 2)
        .split('\n')
        .map((line, index) => index === 0 ? `${firstItemIndent}${line}` : `${firstItemIndent}${line}`)
        .join('\n');
    const comma = listInfo.hasItems ? ',\n' : '\n';

    return `${content.slice(0, listInfo.insertIndex)}${itemText}${comma}${content.slice(listInfo.insertIndex)}`;
}

function buildMissingCharacterLinkInsertion(content, target, link) {
    const charactersKey = content.indexOf('"characters"');
    if (charactersKey < 0) return null;

    const objectStart = content.indexOf('{', charactersKey);
    const objectEnd = findMatchingJsonDelimiter(content, objectStart, '{', '}');
    if (objectStart < 0 || objectEnd < 0) return null;

    const targetOrder = RESOURCE_CHARACTERS.findIndex(character => character.id === target.id);
    if (targetOrder >= 0) {
        for (const character of RESOURCE_CHARACTERS.slice(targetOrder + 1)) {
            const nextKeys = findJsonKeyPositions(content, character.id, objectStart, objectEnd);
            if (nextKeys.length > 1) {
                throw new Error(`resource_links에 중복 캐릭터 키가 있습니다: ${character.id}`);
            }
            if (nextKeys.length === 0) continue;

            const nextLineStart = content.lastIndexOf('\n', nextKeys[0]) + 1;
            const nextIndent = content.slice(nextLineStart, nextKeys[0]).match(/^\s*/)?.[0] || '    ';
            const valueText = JSON.stringify([link], null, 2)
                .split('\n')
                .map((line, index) => index === 0 ? line : `${nextIndent}${line}`)
                .join('\n');
            const propertyText = `${nextIndent}"${escapeJsonString(target.id)}": ${valueText},\n`;
            return `${content.slice(0, nextLineStart)}${propertyText}${content.slice(nextLineStart)}`;
        }
    }

    let bodyEnd = objectEnd;
    while (bodyEnd > objectStart + 1 && /\s/.test(content[bodyEnd - 1])) {
        bodyEnd -= 1;
    }

    const lineStart = content.lastIndexOf('\n', charactersKey) + 1;
    const objectIndent = content.slice(lineStart, charactersKey).match(/^\s*/)?.[0] || '';
    const propertyIndent = `${objectIndent}  `;
    const valueText = JSON.stringify([link], null, 2)
        .split('\n')
        .map((line, index) => index === 0 ? line : `${propertyIndent}${line}`)
        .join('\n');
    const propertyText = `${propertyIndent}"${escapeJsonString(target.id)}": ${valueText}`;
    const hasProperties = content.slice(objectStart + 1, bodyEnd).trim().length > 0;
    const trailingWhitespace = content.slice(bodyEnd, objectEnd) || `\n${objectIndent}`;

    return [
        content.slice(0, bodyEnd),
        hasProperties ? ',\n' : '\n',
        propertyText,
        trailingWhitespace,
        content.slice(objectEnd)
    ].join('');
}

function findMatchingJsonDelimiter(content, startIndex, openChar, closeChar) {
    if (startIndex < 0 || content[startIndex] !== openChar) return -1;

    let depth = 0;
    let inString = false;
    let escaped = false;

    for (let index = startIndex; index < content.length; index += 1) {
        const char = content[index];
        if (inString) {
            if (escaped) {
                escaped = false;
            } else if (char === '\\') {
                escaped = true;
            } else if (char === '"') {
                inString = false;
            }
            continue;
        }

        if (char === '"') {
            inString = true;
        } else if (char === openChar) {
            depth += 1;
        } else if (char === closeChar) {
            depth -= 1;
            if (depth === 0) return index;
        }
    }

    return -1;
}

function findTargetArray(content, target) {
    if (target.type === 'category') {
        const categoriesKey = content.indexOf('"categories"');
        if (categoriesKey < 0) return null;
        const categoriesStart = content.indexOf('{', categoriesKey);
        const categoriesEnd = findMatchingJsonDelimiter(content, categoriesStart, '{', '}');
        const categoryKeys = findJsonKeyPositions(content, target.id, categoriesStart, categoriesEnd);
        if (categoryKeys.length > 1) {
            throw new Error(`resource_links에 중복 카테고리 키가 있습니다: ${target.id}`);
        }
        const categoryKey = categoryKeys[0];
        if (categoryKey === undefined) return null;
        const categoryObjectStart = content.indexOf('{', categoryKey);
        const categoryObjectEnd = findMatchingJsonDelimiter(content, categoryObjectStart, '{', '}');
        const linksKeys = findJsonKeyPositions(content, 'links', categoryObjectStart, categoryObjectEnd);
        if (linksKeys.length !== 1) return null;
        const linksKey = linksKeys[0];
        return getArrayInsertionInfo(content, content.indexOf('[', linksKey));
    }

    if (target.type === 'character') {
        const charactersKey = content.indexOf('"characters"');
        if (charactersKey < 0) return null;
        const objectStart = content.indexOf('{', charactersKey);
        const objectEnd = findMatchingJsonDelimiter(content, objectStart, '{', '}');
        const characterKeys = findJsonKeyPositions(content, target.id, objectStart, objectEnd);
        if (characterKeys.length > 1) {
            throw new Error(`resource_links에 중복 캐릭터 키가 있습니다: ${target.id}`);
        }
        const characterKey = characterKeys[0];
        if (characterKey === undefined) return null;
        return getArrayInsertionInfo(content, content.indexOf('[', characterKey));
    }

    return null;
}

function findJsonKeyPositions(content, key, startIndex, endIndex) {
    const positions = [];
    const needle = `"${escapeJsonString(key)}"`;
    let cursor = Math.max(0, startIndex);
    const limit = endIndex < 0 ? content.length : endIndex;

    while (cursor < limit) {
        const position = content.indexOf(needle, cursor);
        if (position < 0 || position >= limit) break;
        let afterKey = position + needle.length;
        while (afterKey < limit && /\s/.test(content[afterKey])) afterKey += 1;
        if (content[afterKey] === ':') positions.push(position);
        cursor = position + needle.length;
    }

    return positions;
}

function getArrayInsertionInfo(content, arrayStart) {
    if (arrayStart < 0) return null;
    let cursor = arrayStart + 1;

    while (cursor < content.length && /\s/.test(content[cursor])) {
        cursor += 1;
    }

    const lineStart = content.lastIndexOf('\n', arrayStart) + 1;
    const indent = content.slice(lineStart, arrayStart).match(/^\s*/)?.[0] || '';

    return {
        arrayStart,
        arrayEnd: findMatchingJsonDelimiter(content, arrayStart, '[', ']'),
        insertIndex: cursor,
        hasItems: content[cursor] !== ']',
        indent
    };
}

function getTargetList(db, target) {
    if (target.type === 'category') {
        const category = db.categories?.[target.id];
        if (!category) return null;
        if (!Array.isArray(category.links)) category.links = [];
        return category.links;
    }

    if (target.type === 'character') {
        if (!db.characters) db.characters = {};
        if (!Array.isArray(db.characters[target.id])) db.characters[target.id] = [];
        return db.characters[target.id];
    }

    return null;
}

function removeEmptyLinkFields(link) {
    const result = {
        url: link.url,
        title: link.title,
        desc: link.desc || ''
    };
    if (link.image) result.image = link.image;
    return result;
}

function escapeJsonString(value) {
    return String(value).replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

async function ensureResourceLinksPendingBranch(env) {
    const baseBranch = getBaseBranch(env);
    const openPr = await findOpenResourceLinksPullRequest(env);
    const pendingRef = await getGitHubRef(env, RESOURCE_LINKS_PENDING_BRANCH);
    const baseRef = await getGitHubRef(env, baseBranch);
    if (!baseRef) {
        throw new Error(`Base branch not found: ${baseBranch}`);
    }

    if (pendingRef && openPr) return pendingRef;
    if (pendingRef) {
        if (pendingRef.object.sha === baseRef.object.sha) return pendingRef;

        const [baseFile, pendingFile] = await Promise.all([
            getGitHubFile(env, RESOURCE_LINKS_PATH, baseBranch),
            getGitHubFile(env, RESOURCE_LINKS_PATH, RESOURCE_LINKS_PENDING_BRANCH)
        ]);
        const pendingAdditions = collectPendingResourceLinkAdditions(
            JSON.parse(baseFile.content),
            JSON.parse(pendingFile.content)
        );

        if (pendingAdditions.length === 0) {
            return updateGitHubRef(env, RESOURCE_LINKS_PENDING_BRANCH, baseRef.object.sha, true);
        }

        const pullRequest = await ensureResourceLinksPullRequest(env);
        if (!pullRequest) {
            const latestBaseRef = await getGitHubRef(env, baseBranch);
            if (!latestBaseRef) throw new Error(`Base branch not found: ${baseBranch}`);
            return updateGitHubRef(env, RESOURCE_LINKS_PENDING_BRANCH, latestBaseRef.object.sha, true);
        }
        await updateResourceLinksPullRequestSummary(env, pullRequest, pendingFile.content);
        return pendingRef;
    }

    return createGitHubRef(env, RESOURCE_LINKS_PENDING_BRANCH, baseRef.object.sha);
}

async function ensureResourceLinksPullRequest(env) {
    const existing = await findOpenResourceLinksPullRequest(env);
    if (existing) return existing;

    const baseBranch = getBaseBranch(env);
    const response = await githubJsonFetch(env, '/pulls', {
        method: 'POST',
        body: {
            title: 'Update resource links',
            head: RESOURCE_LINKS_PENDING_BRANCH,
            base: baseBranch,
            body: [
                'Automated batch PR for approved resource_links updates.',
                '',
                '- Source: Discord approval workflow',
                `- Branch: ${RESOURCE_LINKS_PENDING_BRANCH}`,
                '- Merge this PR manually after review.'
            ].join('\n')
        }
    });

    let errorDetail = '';
    if (response.status === 422) {
        errorDetail = await response.text();
        const retry = await findOpenResourceLinksPullRequest(env);
        if (retry) return retry;
        if (isNoCommitsPullRequestError(errorDetail)) return null;
    }

    if (!response.ok) {
        const detail = errorDetail || await response.text();
        throw new Error(`GitHub PR creation failed: ${response.status} ${detail.slice(0, 300)}`);
    }

    return response.json();
}

function isNoCommitsPullRequestError(detail) {
    return /No commits between\s+[^\s]+\s+and\s+[^"}]+/i.test(String(detail || ''));
}

function parseResourceCommand(interaction) {
    const name = String(interaction.data?.name || '').trim().toLowerCase();
    if (name === 'list' || name === 'push') return { action: name };
    return null;
}

async function processResourceCommand(env, interaction, command) {
    try {
        const pullRequest = await findOpenResourceLinksPullRequest(env);
        if (!pullRequest) {
            await editDeferredInteractionResponse(env, interaction, {
                content: `열린 ${RESOURCE_LINKS_PENDING_BRANCH} PR이 없습니다.`
            });
            return;
        }

        if (command.action === 'list') {
            const content = await buildPendingResourceLinksDiscordMessage(env, pullRequest);
            await editDeferredInteractionResponse(env, interaction, { content });
            return;
        }

        const result = await mergeResourceLinksPullRequest(env, pullRequest);
        await editDeferredInteractionResponse(env, interaction, {
            content: [
                `main 병합 완료: ${pullRequest.html_url}`,
                `병합 커밋: ${result.sha || 'GitHub에서 확인'}`,
                'GitHub Pages 배포는 main 반영 후 자동으로 진행됩니다.'
            ].join('\n')
        });
    } catch (error) {
        console.error(error);
        await editDeferredInteractionResponse(env, interaction, {
            content: `처리 실패: ${error.message || 'unknown error'}`
        });
    }
}

async function buildPendingResourceLinksDiscordMessage(env, pullRequest) {
    const baseBranch = getBaseBranch(env);
    const [baseFile, pendingFile] = await Promise.all([
        getGitHubFile(env, RESOURCE_LINKS_PATH, baseBranch),
        getGitHubFile(env, RESOURCE_LINKS_PATH, RESOURCE_LINKS_PENDING_BRANCH)
    ]);
    const additions = collectPendingResourceLinkAdditions(
        JSON.parse(baseFile.content),
        JSON.parse(pendingFile.content)
    );
    const lines = [
        `대기 중인 링크 ${additions.length}개`,
        `PR: ${pullRequest.html_url}`,
        ''
    ];
    const maxLength = 1900;
    let listedCount = 0;

    for (const addition of additions) {
        const title = String(addition.link.title || addition.link.url).replace(/[\r\n]+/g, ' ').trim();
        const target = getResourceTargetLabel(addition.target);
        const line = `- ${title} (${target})\n  ${addition.link.url}`;
        if (lines.join('\n').length + line.length + 1 > maxLength) break;
        lines.push(line);
        listedCount += 1;
    }

    if (additions.length === 0) {
        lines.push('main과 비교해 새로 추가된 링크가 없습니다.');
    } else if (listedCount < additions.length) {
        lines.push(`... 외 ${additions.length - listedCount}개는 PR의 Files changed에서 확인하세요.`);
    }

    return lines.join('\n');
}

async function mergeResourceLinksPullRequest(env, pullRequest) {
    const response = await githubJsonFetch(env, `/pulls/${pullRequest.number}/merge`, {
        method: 'PUT',
        body: {
            commit_title: 'Merge resource link updates',
            merge_method: 'merge'
        }
    });
    const result = await response.json();
    if (!response.ok || !result.merged) {
        throw new Error(`GitHub PR merge failed: ${response.status} ${result.message || 'not merged'}`);
    }
    return result;
}

async function updateResourceLinksPullRequestSummary(env, pullRequest, pendingContent = null) {
    const baseBranch = getBaseBranch(env);
    const baseFile = await getGitHubFile(env, RESOURCE_LINKS_PATH, baseBranch);
    const resolvedPendingContent = pendingContent
        || (await getGitHubFile(env, RESOURCE_LINKS_PATH, RESOURCE_LINKS_PENDING_BRANCH)).content;
    const body = buildResourceLinksPullRequestBody(baseFile.content, resolvedPendingContent);
    const response = await githubJsonFetch(env, `/pulls/${pullRequest.number}`, {
        method: 'PATCH',
        body: { body }
    });
    if (!response.ok) {
        const detail = await response.text();
        throw new Error(`GitHub PR update failed: ${response.status} ${detail.slice(0, 300)}`);
    }
    return response.json();
}

async function appendResourceLinksPullRequestSummary(env, pullRequest, link, targets) {
    const lines = String(pullRequest.body || '').split('\n');
    const addedLines = targets.map(target => {
        const title = escapeMarkdownText(link.title || link.url);
        const label = escapeMarkdownText(getResourceTargetLabel(target));
        return `- [${title}](${link.url}) - ${label}`;
    });
    for (const line of addedLines) {
        if (!lines.includes(line)) lines.push(line);
    }

    const count = lines.filter(line => /^- \[[^\]]+\]\(https?:\/\//.test(line)).length;
    const countIndex = lines.findIndex(line => /^\d+개 링크가 /.test(line));
    if (countIndex >= 0) {
        lines[countIndex] = `${count}개 링크가 ${RESOURCE_LINKS_PENDING_BRANCH}에 추가되었습니다.`;
    }

    const response = await githubJsonFetch(env, `/pulls/${pullRequest.number}`, {
        method: 'PATCH',
        body: { body: lines.join('\n') }
    });
    if (!response.ok) {
        const detail = await response.text();
        throw new Error(`GitHub PR update failed: ${response.status} ${detail.slice(0, 300)}`);
    }
    return response.json();
}

function buildResourceLinksPullRequestBody(baseContent, pendingContent) {
    const base = JSON.parse(baseContent);
    const pending = JSON.parse(pendingContent);
    const additions = collectPendingResourceLinkAdditions(base, pending);
    const lines = [
        '## Pending Resource Links',
        '',
        `${additions.length}개 링크가 ${RESOURCE_LINKS_PENDING_BRANCH}에 추가되었습니다.`,
        '',
        '이 목록을 검토한 뒤 이 PR을 `main`에 병합하세요.',
        '',
        '### Added Links',
        ''
    ];

    let length = lines.join('\n').length;
    let listedCount = 0;
    for (const addition of additions) {
        const title = escapeMarkdownText(addition.link.title || addition.link.url);
        const target = escapeMarkdownText(getResourceTargetLabel(addition.target));
        const line = `- [${title}](${addition.link.url}) - ${target}`;
        if (length + line.length + 1 > 60000) {
            lines.push(`- 목록이 길어 나머지 ${additions.length - listedCount}개는 Files changed에서 확인하세요.`);
            break;
        }
        lines.push(line);
        length += line.length + 1;
        listedCount += 1;
    }

    return lines.join('\n');
}

function collectPendingResourceLinkAdditions(base, pending) {
    const additions = [];
    const categoryIds = [...new Set([
        ...RESOURCE_CATEGORIES,
        ...Object.keys(pending.categories || {})
    ])];

    for (const id of categoryIds) {
        const before = base.categories?.[id]?.links || [];
        const current = pending.categories?.[id]?.links || [];
        collectTargetAdditions(additions, { type: 'category', id }, before, current);
    }

    const characterIds = new Set([
        ...Object.keys(base.characters || {}),
        ...Object.keys(pending.characters || {})
    ]);
    for (const id of characterIds) {
        collectTargetAdditions(additions, { type: 'character', id }, base.characters?.[id] || [], pending.characters?.[id] || []);
    }

    return additions;
}

function collectTargetAdditions(result, target, before, current) {
    const existingUrls = new Set(before.map(link => link?.url).filter(Boolean));
    for (const link of current) {
        if (!link?.url || existingUrls.has(link.url)) continue;
        result.push({ target, link });
    }
}

function getResourceTargetLabel(target) {
    if (target.type === 'category') return RESOURCE_CATEGORY_LABELS[target.id] || target.id;
    return RESOURCE_CHARACTER_BY_ID[target.id]?.name || target.id;
}

function escapeMarkdownText(value) {
    return String(value).replace(/[\[\]\\]/g, '\\$&');
}

async function findOpenResourceLinksPullRequest(env) {
    const baseBranch = getBaseBranch(env);
    const params = new URLSearchParams({
        state: 'open',
        head: `${env.GITHUB_OWNER}:${RESOURCE_LINKS_PENDING_BRANCH}`,
        base: baseBranch,
        per_page: '10'
    });
    const response = await githubJsonFetch(env, `/pulls?${params.toString()}`, { method: 'GET' });
    if (!response.ok) {
        const detail = await response.text();
        throw new Error(`GitHub PR search failed: ${response.status} ${detail.slice(0, 300)}`);
    }

    const pulls = await response.json();
    return pulls[0] || null;
}

async function ensureDiscordResourceCommands(env) {
    if (!env.RESOURCE_LINK_STATE || !env.DISCORD_APPLICATION_ID || !env.DISCORD_BOT_TOKEN) return;

    const alreadyRegistered = await env.RESOURCE_LINK_STATE.get(DISCORD_RESOURCE_COMMANDS_STATE_KEY);
    if (alreadyRegistered === 'registered') return;

    const endpoint = `https://discord.com/api/v10/applications/${env.DISCORD_APPLICATION_ID}/commands`;
    const existingResponse = await fetch(endpoint, {
        headers: discordBotHeaders(env)
    });
    if (!existingResponse.ok) {
        const detail = await existingResponse.text();
        throw new Error(`Discord command list failed: ${existingResponse.status} ${detail.slice(0, 300)}`);
    }

    const existingCommands = await existingResponse.json();
    const existingNames = new Set(existingCommands.map(command => String(command.name || '').toLowerCase()));
    const missingCommands = DISCORD_RESOURCE_COMMANDS.filter(command => !existingNames.has(command.name));

    for (const command of missingCommands) {
        const response = await fetch(endpoint, {
            method: 'POST',
            headers: discordBotHeaders(env),
            body: JSON.stringify(command)
        });
        if (!response.ok) {
            const detail = await response.text();
            throw new Error(`Discord command registration failed: ${response.status} ${detail.slice(0, 300)}`);
        }
    }

    await env.RESOURCE_LINK_STATE.put(DISCORD_RESOURCE_COMMANDS_STATE_KEY, 'registered');
}

async function getGitHubRef(env, branch) {
    const response = await githubJsonFetch(env, `/git/ref/heads/${encodeURIComponentPath(branch)}`, { method: 'GET' });
    if (response.status === 404) return null;
    if (!response.ok) {
        const detail = await response.text();
        throw new Error(`GitHub ref fetch failed: ${response.status} ${detail.slice(0, 300)}`);
    }
    return response.json();
}

async function createGitHubRef(env, branch, sha) {
    const response = await githubJsonFetch(env, '/git/refs', {
        method: 'POST',
        body: {
            ref: `refs/heads/${branch}`,
            sha
        }
    });

    if (response.status === 422) {
        const ref = await getGitHubRef(env, branch);
        if (ref) return ref;
    }

    if (!response.ok) {
        const detail = await response.text();
        throw new Error(`GitHub ref creation failed: ${response.status} ${detail.slice(0, 300)}`);
    }

    return response.json();
}

async function updateGitHubRef(env, branch, sha, force) {
    const response = await githubJsonFetch(env, `/git/refs/heads/${encodeURIComponentPath(branch)}`, {
        method: 'PATCH',
        body: {
            sha,
            force
        }
    });

    if (!response.ok) {
        const detail = await response.text();
        throw new Error(`GitHub ref update failed: ${response.status} ${detail.slice(0, 300)}`);
    }

    return response.json();
}

async function getGitHubFile(env, path, ref) {
    const query = ref ? `?ref=${encodeURIComponent(ref)}` : '';
    const response = await githubJsonFetch(env, `/contents/${encodeURIComponentPath(path)}${query}`, { method: 'GET' });
    if (!response.ok) {
        const detail = await response.text();
        throw new Error(`GitHub file fetch failed: ${response.status} ${detail.slice(0, 300)}`);
    }

    const data = await response.json();
    let content;
    if (data.content) {
        content = base64ToUtf8(data.content);
    } else if (data.sha) {
        const blobResponse = await githubRawFetch(env, `/git/blobs/${encodeURIComponent(data.sha)}`);
        if (!blobResponse.ok) {
            const detail = await blobResponse.text();
            throw new Error(`GitHub blob fetch failed: ${blobResponse.status} ${detail.slice(0, 300)}`);
        }
        content = await blobResponse.text();
    } else {
        throw new Error('GitHub file content is empty and blob SHA is missing');
    }

    return {
        sha: data.sha,
        content
    };
}

async function putGitHubFile(env, path, data) {
    const ref = await getGitHubRef(env, data.branch);
    if (!ref?.object?.sha) throw new Error(`GitHub branch not found: ${data.branch}`);

    const commitResponse = await githubJsonFetch(env, `/git/commits/${encodeURIComponent(ref.object.sha)}`, {
        method: 'GET'
    });
    if (!commitResponse.ok) {
        const detail = await commitResponse.text();
        throw new Error(`GitHub commit fetch failed: ${commitResponse.status} ${detail.slice(0, 300)}`);
    }
    const parentCommit = await commitResponse.json();

    const blobResponse = await githubJsonFetch(env, '/git/blobs', {
        method: 'POST',
        body: {
            content: data.content,
            encoding: 'utf-8'
        }
    });
    if (!blobResponse.ok) {
        const detail = await blobResponse.text();
        if (blobResponse.status === 422 && detail.includes('input was too large')) {
            return putGitHubFileViaContentsApi(env, path, data);
        }
        throw new HttpError(`GitHub blob creation failed: ${blobResponse.status} ${detail.slice(0, 300)}`, blobResponse.status);
    }
    const blob = await blobResponse.json();

    const treeResponse = await githubJsonFetch(env, '/git/trees', {
        method: 'POST',
        body: {
            base_tree: parentCommit.tree.sha,
            tree: [{ path, mode: '100644', type: 'blob', sha: blob.sha }]
        }
    });
    if (!treeResponse.ok) {
        const detail = await treeResponse.text();
        throw new HttpError(`GitHub tree creation failed: ${treeResponse.status} ${detail.slice(0, 300)}`, treeResponse.status);
    }
    const tree = await treeResponse.json();

    const newCommitResponse = await githubJsonFetch(env, '/git/commits', {
        method: 'POST',
        body: {
            message: data.message,
            tree: tree.sha,
            parents: [ref.object.sha]
        }
    });
    if (!newCommitResponse.ok) {
        const detail = await newCommitResponse.text();
        throw new HttpError(`GitHub commit creation failed: ${newCommitResponse.status} ${detail.slice(0, 300)}`, newCommitResponse.status);
    }
    const commit = await newCommitResponse.json();

    const updateResponse = await githubJsonFetch(env, `/git/refs/heads/${encodeURIComponentPath(data.branch)}`, {
        method: 'PATCH',
        body: { sha: commit.sha, force: false }
    });
    if (!updateResponse.ok) {
        const detail = await updateResponse.text();
        throw new HttpError(`GitHub ref update failed: ${updateResponse.status} ${detail.slice(0, 300)}`, updateResponse.status);
    }

    return {
        commit: {
            sha: commit.sha,
            html_url: `https://github.com/${env.GITHUB_OWNER}/${env.GITHUB_REPO}/commit/${commit.sha}`
        }
    };
}

async function putGitHubFileViaContentsApi(env, path, data) {
    const response = await githubJsonFetch(env, `/contents/${encodeURIComponentPath(path)}`, {
        method: 'PUT',
        body: {
            message: data.message,
            content: utf8ToBase64(data.content),
            sha: data.sha,
            branch: data.branch
        }
    });
    if (!response.ok) {
        const detail = await response.text();
        throw new HttpError(`GitHub file update failed: ${response.status} ${detail.slice(0, 300)}`, response.status);
    }
    return response.json();
}

function githubRawFetch(env, path) {
    return fetch(`https://api.github.com/repos/${env.GITHUB_OWNER}/${env.GITHUB_REPO}${path}`, {
        method: 'GET',
        headers: {
            'Accept': 'application/vnd.github.raw+json',
            'Authorization': `Bearer ${env.GITHUB_TOKEN}`,
            'User-Agent': 'morimens-feedback-worker',
            'X-GitHub-Api-Version': '2022-11-28'
        }
    });
}

function githubJsonFetch(env, path, options) {
    return fetch(`https://api.github.com/repos/${env.GITHUB_OWNER}/${env.GITHUB_REPO}${path}`, {
        method: options.method,
        headers: {
            'Accept': 'application/vnd.github+json',
            'Authorization': `Bearer ${env.GITHUB_TOKEN}`,
            'Content-Type': 'application/json',
            'User-Agent': 'morimens-feedback-worker',
            'X-GitHub-Api-Version': '2022-11-28'
        },
        body: options.body ? JSON.stringify(options.body) : undefined
    });
}

async function editDiscordMessage(env, interaction, payload) {
    const safePayload = {
        allowed_mentions: { parse: [] },
        ...payload
    };

    if (env.DISCORD_APPLICATION_ID && interaction.token) {
        try {
            const result = await editDeferredInteractionResponse(env, interaction, safePayload);
            console.log('Discord message edited via interaction webhook', {
                messageId: interaction.message?.id || null
            });
            return result;
        } catch (error) {
            console.warn('Discord interaction webhook edit failed; falling back to bot message edit', error);
        }
    }

    const channelId = interaction.channel_id || interaction.channel?.id || interaction.message?.channel_id;
    const messageId = interaction.message?.id;
    if (!channelId || !messageId) {
        throw new Error('Discord message edit target is missing');
    }

    const response = await fetch(`https://discord.com/api/v10/channels/${channelId}/messages/${messageId}`, {
        method: 'PATCH',
        headers: discordBotHeaders(env),
        body: JSON.stringify(safePayload)
    });

    if (!response.ok) {
        const detail = await response.text();
        throw new Error(`Discord message edit failed: ${response.status} ${detail.slice(0, 300)}`);
    }

    return response.json();
}

async function editDeferredInteractionResponse(env, interaction, payload) {
    if (!env.DISCORD_APPLICATION_ID || !interaction.token) {
        throw new Error('Discord application ID or interaction token is missing');
    }

    const response = await fetch(
        `https://discord.com/api/v10/webhooks/${env.DISCORD_APPLICATION_ID}/${interaction.token}/messages/@original`,
        {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                allowed_mentions: { parse: [] },
                ...payload
            })
        }
    );
    if (!response.ok) {
        const detail = await response.text();
        throw new Error(`Discord interaction response edit failed: ${response.status} ${detail.slice(0, 300)}`);
    }
    return response.json();
}

async function verifyDiscordRequest(request, rawBody, env) {
    if (!env.DISCORD_PUBLIC_KEY) return false;

    const signature = request.headers.get('X-Signature-Ed25519');
    const timestamp = request.headers.get('X-Signature-Timestamp');
    if (!signature || !timestamp) return false;

    const key = await crypto.subtle.importKey(
        'raw',
        hexToBytes(env.DISCORD_PUBLIC_KEY),
        { name: 'Ed25519', namedCurve: 'Ed25519' },
        false,
        ['verify']
    );

    return crypto.subtle.verify(
        'Ed25519',
        key,
        hexToBytes(signature),
        new TextEncoder().encode(timestamp + rawBody)
    );
}

function isAllowedApprover(interaction, env) {
    const allowed = String(env.DISCORD_APPROVER_USER_IDS || '')
        .split(',')
        .map(value => value.trim())
        .filter(Boolean);

    if (allowed.length === 0) return true;

    const userId = interaction.member?.user?.id || interaction.user?.id || '';
    return allowed.includes(userId);
}

function getInteractionUserLabel(interaction) {
    const user = interaction.member?.user || interaction.user || {};
    return user.username ? `${user.username} (${user.id || 'unknown'})` : 'unknown';
}

function discordBotHeaders(env) {
    return {
        'Authorization': `Bot ${env.DISCORD_BOT_TOKEN}`,
        'Content-Type': 'application/json'
    };
}

function interactionResponse(type, data) {
    const body = data ? { type, data } : { type };
    return new Response(JSON.stringify(body), {
        status: 200,
        headers: { 'Content-Type': 'application/json; charset=utf-8' }
    });
}

function formatTarget(target) {
    if (!target) return 'unknown';
    if (target.type === 'category') {
        return `category:${target.id}`;
    }
    return `${target.type}:${target.id}`;
}

function makeIssueTitle(feedback) {
    const firstLine = feedback.message.split('\n').find(Boolean) || 'Feedback';
    return `[Feedback] ${firstLine.slice(0, 80)}`;
}

function getBaseBranch(env) {
    return String(env.GITHUB_BASE_BRANCH || DEFAULT_BASE_BRANCH).trim() || DEFAULT_BASE_BRANCH;
}

function getCorsHeaders(origin, env) {
    const allowedOrigins = (env.ALLOWED_ORIGINS || DEFAULT_ALLOWED_ORIGIN)
        .split(',')
        .map(value => value.trim())
        .filter(Boolean);
    const allowOrigin = allowedOrigins.includes(origin) ? origin : allowedOrigins[0];

    return {
        'Access-Control-Allow-Origin': allowOrigin,
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Vary': 'Origin'
    };
}

function requireEnv(env, names) {
    const missing = names.filter(name => !env[name]);
    if (missing.length > 0) {
        throw new Error(`Missing env vars: ${missing.join(', ')}`);
    }
}

class HttpError extends Error {
    constructor(message, status) {
        super(message);
        this.name = 'HttpError';
        this.status = status;
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

function htmlResponse(html, status, headers) {
    return new Response(html, {
        status,
        headers: {
            ...headers,
            'Content-Type': 'text/html; charset=utf-8'
        }
    });
}

function encodeURIComponentPath(path) {
    return path.split('/').map(encodeURIComponent).join('/');
}

function base64ToUtf8(value) {
    const binary = atob(value.replace(/\s/g, ''));
    const bytes = Uint8Array.from(binary, char => char.charCodeAt(0));
    return new TextDecoder().decode(bytes);
}

function utf8ToBase64(value) {
    const bytes = new TextEncoder().encode(value);
    const chunks = [];
    const chunkSize = 32766;
    for (let index = 0; index < bytes.length; index += chunkSize) {
        chunks.push(String.fromCharCode(...bytes.subarray(index, index + chunkSize)));
    }
    return btoa(chunks.join(''));
}

function hexToBytes(hex) {
    const bytes = new Uint8Array(hex.length / 2);
    for (let i = 0; i < bytes.length; i += 1) {
        bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
    }
    return bytes;
}
