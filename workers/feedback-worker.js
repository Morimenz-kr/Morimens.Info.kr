const DEFAULT_ALLOWED_ORIGIN = 'https://morimenz-kr.github.io';
const RESOURCE_LINKS_PATH = 'data/resource_links.json';
const RESOURCE_LINKS_PENDING_BRANCH = 'resource-links/pending';
const DEFAULT_BASE_BRANCH = 'main';
const RESOURCE_PROPOSAL_MARKER = 'resource-link-proposal';
const RESOURCE_SELECTION_MARKER = 'resource-link-selection';
const INTERACTION_PING = 1;
const INTERACTION_MESSAGE_COMPONENT = 3;
const RESPONSE_PONG = 1;
const RESPONSE_CHANNEL_MESSAGE = 4;
const RESPONSE_DEFERRED_UPDATE = 6;
const DEFAULT_ACTIVE_RELEMS = 'chaos';
const DEFAULT_ARCA_LIST_SCAN_LIMIT = 20;
const DEFAULT_ARCA_MAX_PROPOSALS_PER_RUN = 5;
const ARCA_SEEN_KEY_PREFIX = 'arca:seen:';

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
    { id: 'vortice', name: '모스크', relems: 'aequor' },
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
        ctx.waitUntil(handleArcaMonitor(env).catch(error => {
            console.error('Arca monitor failed', error);
        }));
    }
};

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
        hasDiscordChannelId: Boolean(env.DISCORD_CHANNEL_ID),
        hasDiscordPublicKey: Boolean(env.DISCORD_PUBLIC_KEY),
        hasArcaListUrls: Boolean(env.ARCA_LIST_URLS),
        hasResourceLinkState: Boolean(env.RESOURCE_LINK_STATE)
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

    const issue = await createResourceProposalIssue(env, proposal);
    const discordMessage = await sendResourceProposalMessage(env, proposal, issue);

    return jsonResponse({
        ok: true,
        issueUrl: issue.html_url,
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
    const submittedAt = new Date().toISOString();
    const seenThisRun = new Set();
    const result = {
        ok: true,
        lists: listUrls.length,
        scanned: 0,
        skippedSeen: 0,
        proposed: 0,
        failed: 0
    };

    for (const listUrl of listUrls) {
        if (result.proposed >= maxProposals) break;

        let posts;
        try {
            const html = await fetchText(listUrl);
            posts = extractArcaPostsFromList(html, listUrl).slice(0, scanLimit);
        } catch (error) {
            result.failed += 1;
            console.warn(`Arca list fetch failed: ${listUrl}`, error);
            continue;
        }

        for (const post of posts) {
            if (result.proposed >= maxProposals) break;
            if (seenThisRun.has(post.id)) continue;
            seenThisRun.add(post.id);
            result.scanned += 1;

            const seenKey = `${ARCA_SEEN_KEY_PREFIX}${post.id}`;
            const alreadySeen = await env.RESOURCE_LINK_STATE.get(seenKey);
            if (alreadySeen) {
                result.skippedSeen += 1;
                continue;
            }

            try {
                const detail = await fetchArcaPostDetail(post, listUrl);
                const proposal = normalizeResourceProposal({
                    url: detail.url,
                    title: detail.title,
                    desc: detail.desc,
                    image: detail.image,
                    sourceTab: detail.sourceTab,
                    submittedBy: 'arca-monitor',
                    submittedAt
                });

                if (!proposal.link.url || !proposal.link.title) continue;

                const issue = await createResourceProposalIssue(env, proposal);
                const discordMessage = await sendResourceProposalMessage(env, proposal, issue);
                await env.RESOURCE_LINK_STATE.put(seenKey, JSON.stringify({
                    id: post.id,
                    url: proposal.link.url,
                    title: proposal.link.title,
                    sourceListUrl: listUrl,
                    issueUrl: issue.html_url,
                    discordMessageId: discordMessage.id,
                    firstSeenAt: submittedAt,
                    notifiedAt: new Date().toISOString()
                }));
                result.proposed += 1;
            } catch (error) {
                result.failed += 1;
                console.warn(`Arca post proposal failed: ${post.url}`, error);
            }
        }
    }

    console.log('Arca monitor result', result);
    return result;
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

async function fetchText(url) {
    const response = await fetch(url, {
        headers: {
            'Accept': 'text/html,application/xhtml+xml',
            'User-Agent': 'morimens-resource-link-monitor/1.0'
        }
    });
    if (!response.ok) {
        throw new Error(`Fetch failed: ${response.status}`);
    }
    return response.text();
}

function extractArcaPostsFromList(html, listUrl) {
    const posts = [];
    const seenIds = new Set();
    const anchorRegex = /<a\b([^>]*?)href=["']([^"']+)["']([^>]*)>([\s\S]*?)<\/a>/gi;
    let match;

    while ((match = anchorRegex.exec(html)) !== null) {
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
            title: cleanResourceTitle(stripHtml(match[4] || '')),
            sourceTab: getArcaSourceTab(listUrl)
        });
    }

    return posts;
}

async function fetchArcaPostDetail(post, listUrl) {
    const html = await fetchText(post.url);
    const title = cleanResourceTitle(
        extractMetaContent(html, 'property', 'og:title') ||
        extractTitle(html) ||
        post.title ||
        post.id
    );
    const image = normalizeImageUrl(extractMetaContent(html, 'property', 'og:image') || '', post.url);

    return {
        url: post.url,
        title,
        desc: decodeHtmlEntities(extractMetaContent(html, 'property', 'og:description') || ''),
        image,
        sourceTab: post.sourceTab || getArcaSourceTab(listUrl)
    };
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

    if (interaction.type === INTERACTION_PING) {
        return interactionResponse(RESPONSE_PONG);
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

async function createResourceProposalIssue(env, proposal) {
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
        `<!-- ${RESOURCE_PROPOSAL_MARKER}:${utf8ToBase64(JSON.stringify(proposal))} -->`
    ].join('\n');

    return createGitHubIssueWithOptionalLabels(env, {
        title: `[Resource Link] ${proposal.link.title.slice(0, 80)}`,
        body,
        labels: ['resource-link:pending']
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

async function sendResourceProposalMessage(env, proposal, issue) {
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
                { name: '추천 등록 대상', value: targetText.slice(0, 1024), inline: false },
                { name: 'GitHub Issue', value: issue.html_url, inline: false }
            ],
            footer: { text: `Submitted by ${proposal.submittedBy}` },
            timestamp: new Date().toISOString()
        }],
        components: buildResourceComponents(issue.number, false, defaultResourceSelection())
    };

    const response = await fetch(`https://discord.com/api/v10/channels/${env.DISCORD_CHANNEL_ID}/messages`, {
        method: 'POST',
        headers: discordBotHeaders(env),
        body: JSON.stringify(payload)
    });

    if (!response.ok) {
        const detail = await response.text();
        throw new Error(`Discord resource proposal failed: ${response.status} ${detail.slice(0, 300)}`);
    }

    return response.json();
}

function buildResourceComponents(issueNumber, disabled = false, selection = defaultResourceSelection()) {
    const activeRelems = normalizeRelems(selection.activeRelems);
    const selectedKeys = new Set(normalizeTargets(selection.targets || []).map(target => `${target.type}:${target.id}`));
    const activeCharacters = RESOURCE_CHARACTERS.filter(character => character.relems === activeRelems);

    return [
        {
            type: 1,
            components: [
                {
                    type: 2,
                    style: 3,
                    label: '추천대로 OK',
                    custom_id: `rl:approve:${issueNumber}`,
                    disabled
                },
                {
                    type: 2,
                    style: 1,
                    label: '선택 반영',
                    custom_id: `rl:approve-selected:${issueNumber}`,
                    disabled
                },
                {
                    type: 2,
                    style: 2,
                    label: '선택 초기화',
                    custom_id: `rl:clear-selection:${issueNumber}`,
                    disabled
                },
                {
                    type: 2,
                    style: 2,
                    label: '보류',
                    custom_id: `rl:hold:${issueNumber}`,
                    disabled
                }
            ]
        },
        {
            type: 1,
            components: [
                {
                    type: 3,
                    custom_id: `rl:categories:${issueNumber}`,
                    placeholder: '일반 카테고리 선택',
                    min_values: 0,
                    max_values: RESOURCE_CATEGORIES.length,
                    disabled,
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
                custom_id: `rl:relems:${relems}:${issueNumber}`,
                disabled
            }))
        },
        {
            type: 1,
            components: [
                {
                    type: 3,
                    custom_id: `rl:characters:${activeRelems}:${issueNumber}`,
                    placeholder: `${RELEMS_LABELS[activeRelems] || activeRelems} 캐릭터 선택`,
                    min_values: 0,
                    max_values: activeCharacters.length,
                    disabled,
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
        activeRelems: DEFAULT_ACTIVE_RELEMS
    };
}

function normalizeResourceSelection(selection) {
    return {
        targets: normalizeTargets(selection?.targets || []),
        activeRelems: normalizeRelems(selection?.activeRelems),
        updatedAt: selection?.updatedAt || null,
        updatedBy: selection?.updatedBy || null
    };
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

function extractResourceSelection(body) {
    const encodedRegex = new RegExp(`<!--\\s*${RESOURCE_SELECTION_MARKER}:([A-Za-z0-9+/=]+)\\s*-->`);
    const encodedMatch = body.match(encodedRegex);
    if (!encodedMatch) return defaultResourceSelection();

    try {
        return normalizeResourceSelection(JSON.parse(base64ToUtf8(encodedMatch[1])));
    } catch (error) {
        return defaultResourceSelection();
    }
}

function upsertResourceSelection(body, selection) {
    const marker = `<!-- ${RESOURCE_SELECTION_MARKER}:${utf8ToBase64(JSON.stringify(normalizeResourceSelection(selection)))} -->`;
    const markerRegex = new RegExp(`<!--\\s*${RESOURCE_SELECTION_MARKER}:[A-Za-z0-9+/=]+\\s*-->`);
    if (markerRegex.test(body)) {
        return body.replace(markerRegex, marker);
    }
    return `${body}\n${marker}`;
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
    try {
        const issue = await getGitHubIssue(env, decision.issueNumber);
        const proposal = extractResourceProposal(issue.body || '');
        const selection = extractResourceSelection(issue.body || '');

        if (decision.action === 'hold') {
            await commentGitHubIssue(env, decision.issueNumber, `Held without updating resource_links. Handler: ${getInteractionUserLabel(interaction)}`);
            await closeGitHubIssue(env, decision.issueNumber);
            await editDiscordMessage(env, interaction, {
                content: `보류 처리됨: resource_links를 변경하지 않았습니다. (${getInteractionUserLabel(interaction)})`,
                components: buildResourceComponents(decision.issueNumber, true, selection)
            });
            return;
        }

        if (decision.action === 'categories') {
            const updatedSelection = {
                ...selection,
                targets: replaceTargetsByType(selection.targets, 'category', decision.targets),
                updatedAt: new Date().toISOString(),
                updatedBy: getInteractionUserLabel(interaction)
            };
            await updateResourceSelection(env, issue, updatedSelection);
            await editDiscordMessage(env, interaction, {
                content: buildResourceMessageContent(updatedSelection),
                components: buildResourceComponents(decision.issueNumber, false, updatedSelection)
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
            await updateResourceSelection(env, issue, updatedSelection);
            await editDiscordMessage(env, interaction, {
                content: buildResourceMessageContent(updatedSelection),
                components: buildResourceComponents(decision.issueNumber, false, updatedSelection)
            });
            return;
        }

        if (decision.action === 'characters') {
            const updatedSelection = {
                ...selection,
                activeRelems: decision.relems,
                targets: replaceCharacterTargetsByRelems(selection.targets, decision.relems, decision.targets),
                updatedAt: new Date().toISOString(),
                updatedBy: getInteractionUserLabel(interaction)
            };
            await updateResourceSelection(env, issue, updatedSelection);
            await editDiscordMessage(env, interaction, {
                content: buildResourceMessageContent(updatedSelection),
                components: buildResourceComponents(decision.issueNumber, false, updatedSelection)
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
            await updateResourceSelection(env, issue, updatedSelection);
            await editDiscordMessage(env, interaction, {
                content: buildResourceMessageContent(updatedSelection),
                components: buildResourceComponents(decision.issueNumber, false, updatedSelection)
            });
            return;
        }

        const targets = decision.action === 'approve-selected'
            ? selection.targets
            : proposal.targets;
        if (!targets || targets.length === 0) {
            await editDiscordMessage(env, interaction, {
                content: '처리 안 됨: 선택된 등록 대상이 없습니다. resource_links를 변경하지 않았습니다.',
                components: buildResourceComponents(decision.issueNumber, false, selection)
            });
            return;
        }

        const result = await updateResourceLinks(env, proposal.link, targets);
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
            components: buildResourceComponents(decision.issueNumber, true, selection)
        });
    } catch (error) {
        console.error(error);
        await editDiscordMessage(env, interaction, {
            content: `처리 실패: ${error.message}`,
            components: interaction.message?.components || []
        });
    }
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

            return {
                ...update,
                commitUrl: commit.commit?.html_url || commit.content?.html_url || 'unknown',
                prUrl: pr.html_url
            };
        } catch (error) {
            if (error.status === 409 && attempt === 0) continue;
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
        const list = getTargetList(db, target);
        if (!list) {
            result.missing.push(target);
            continue;
        }

        if (list.some(item => item && item.url === link.url)) {
            result.skipped.push(target);
            continue;
        }

        const insertion = buildResourceLinkInsertion(updatedContent, target, removeEmptyLinkFields(link));
        if (!insertion) {
            result.missing.push(target);
            continue;
        }

        updatedContent = insertion;
        list.unshift(removeEmptyLinkFields(link));
        result.added.push(target);
    }

    return {
        ...result,
        content: updatedContent
    };
}

function buildResourceLinkInsertion(content, target, link) {
    const listInfo = findTargetArray(content, target);
    if (!listInfo) return null;

    const lineStart = content.lastIndexOf('\n', listInfo.insertIndex - 1) + 1;
    const firstItemIndent = content.slice(lineStart, listInfo.insertIndex).match(/^\s*/)?.[0] || `${listInfo.indent}  `;
    const itemText = JSON.stringify(link, null, 2)
        .split('\n')
        .map((line, index) => index === 0 ? `${firstItemIndent}${line}` : `${firstItemIndent}${line}`)
        .join('\n');
    const comma = listInfo.hasItems ? ',\n' : '\n';

    return `${content.slice(0, listInfo.insertIndex)}${itemText}${comma}${content.slice(listInfo.insertIndex)}`;
}

function findTargetArray(content, target) {
    if (target.type === 'category') {
        const categoryKey = findJsonKey(content, target.id, content.indexOf('"categories"'));
        if (categoryKey < 0) return null;
        const categoryObjectStart = content.indexOf('{', categoryKey);
        const linksKey = findJsonKey(content, 'links', categoryObjectStart);
        if (linksKey < 0) return null;
        return getArrayInsertionInfo(content, content.indexOf('[', linksKey));
    }

    if (target.type === 'character') {
        const charactersKey = content.indexOf('"characters"');
        if (charactersKey < 0) return null;
        const characterKey = findJsonKey(content, target.id, charactersKey);
        if (characterKey < 0) return null;
        return getArrayInsertionInfo(content, content.indexOf('[', characterKey));
    }

    return null;
}

function findJsonKey(content, key, startIndex) {
    return content.indexOf(`"${escapeJsonString(key)}"`, Math.max(0, startIndex));
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

function extractResourceProposal(body) {
    const encodedRegex = new RegExp(`<!--\\s*${RESOURCE_PROPOSAL_MARKER}:([A-Za-z0-9+/=]+)\\s*-->`);
    const encodedMatch = body.match(encodedRegex);
    if (encodedMatch) {
        return normalizeResourceProposal(JSON.parse(base64ToUtf8(encodedMatch[1])));
    }

    const regex = new RegExp(`<!--\\s*${RESOURCE_PROPOSAL_MARKER}\\s*([\\s\\S]*?)\\s*-->`);
    const match = body.match(regex);
    if (!match) throw new Error('Resource proposal payload not found in issue body');
    return normalizeResourceProposal(JSON.parse(match[1]));
}

async function updateResourceSelection(env, issue, selection) {
    const body = upsertResourceSelection(issue.body || '', selection);
    await updateGitHubIssueBody(env, issue.number, body);
}

async function getGitHubIssue(env, issueNumber) {
    const response = await githubJsonFetch(env, `/issues/${issueNumber}`, { method: 'GET' });
    if (!response.ok) {
        const detail = await response.text();
        throw new Error(`GitHub issue fetch failed: ${response.status} ${detail.slice(0, 300)}`);
    }
    return response.json();
}

async function updateGitHubIssueBody(env, issueNumber, body) {
    const response = await githubJsonFetch(env, `/issues/${issueNumber}`, {
        method: 'PATCH',
        body: { body }
    });
    if (!response.ok) {
        const detail = await response.text();
        throw new Error(`GitHub issue update failed: ${response.status} ${detail.slice(0, 300)}`);
    }
    return response.json();
}

async function commentGitHubIssue(env, issueNumber, body) {
    const response = await githubJsonFetch(env, `/issues/${issueNumber}/comments`, {
        method: 'POST',
        body: { body }
    });
    if (!response.ok) {
        const detail = await response.text();
        throw new Error(`GitHub issue comment failed: ${response.status} ${detail.slice(0, 300)}`);
    }
    return response.json();
}

async function closeGitHubIssue(env, issueNumber) {
    const response = await githubJsonFetch(env, `/issues/${issueNumber}`, {
        method: 'PATCH',
        body: { state: 'closed' }
    });
    if (!response.ok) {
        const detail = await response.text();
        throw new Error(`GitHub issue close failed: ${response.status} ${detail.slice(0, 300)}`);
    }
    return response.json();
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
        return updateGitHubRef(env, RESOURCE_LINKS_PENDING_BRANCH, baseRef.object.sha, true);
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

    if (response.status === 422) {
        const retry = await findOpenResourceLinksPullRequest(env);
        if (retry) return retry;
    }

    if (!response.ok) {
        const detail = await response.text();
        throw new Error(`GitHub PR creation failed: ${response.status} ${detail.slice(0, 300)}`);
    }

    return response.json();
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
    return {
        sha: data.sha,
        content: base64ToUtf8(data.content || '')
    };
}

async function putGitHubFile(env, path, data) {
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
    const channelId = interaction.channel_id || interaction.message?.channel_id;
    const messageId = interaction.message?.id;
    if (!channelId || !messageId) return null;

    const safePayload = {
        allowed_mentions: { parse: [] },
        ...payload
    };

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
    let binary = '';
    for (const byte of bytes) {
        binary += String.fromCharCode(byte);
    }
    return btoa(binary);
}

function hexToBytes(hex) {
    const bytes = new Uint8Array(hex.length / 2);
    for (let i = 0; i < bytes.length; i += 1) {
        bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
    }
    return bytes;
}
