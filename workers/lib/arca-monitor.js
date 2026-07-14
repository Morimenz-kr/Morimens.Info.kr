import {
    SAFE_HTTPS_PROTOCOLS,
    createSubmissionKey,
    escapeRegExp,
    getPositiveIntegerEnv,
    requireEnv
} from './http.js';
import {
    normalizeResourceProposal,
    resourceProposalFingerprint
} from './resource-schema.js';
import { getResourceCharacterRegistry } from './resource-repository.js';
import { submitResourceProposal } from './resource-submission.js';

const DEFAULT_ARCA_LIST_SCAN_LIMIT = 20;

const DEFAULT_ARCA_MAX_PROPOSALS_PER_RUN = 5;

const ARCA_SEEN_KEY_PREFIX = 'arca:seen:';

const ARCA_FETCH_USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';

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
    const registry = await getResourceCharacterRegistry(env);
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
                }, registry);
                const submissionKey = await createSubmissionKey('resource-link', resourceProposalFingerprint(proposal));
                const submission = await submitResourceProposal(env, proposal, registry, submissionKey);
                await env.RESOURCE_LINK_STATE.put(seenKey, JSON.stringify({
                    id: post.id,
                    url: proposal.link.url,
                    title: proposal.link.title,
                    sourceListUrl: listUrl,
                    issueUrl: submission.issue.html_url,
                    discordMessageId: submission.discordMessage.id,
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
                const parsed = new URL(url);
                if (parsed.protocol !== 'https:' || parsed.hostname !== 'arca.live') return null;
                parsed.username = '';
                parsed.password = '';
                parsed.hash = '';
                return parsed.toString();
            } catch {
                return null;
            }
        })
        .filter(Boolean);
}

async function fetchText(url) {
    const response = await fetch(url, {
        headers: {
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7',
            'User-Agent': ARCA_FETCH_USER_AGENT
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
        } catch {
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
    } catch {
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
        const parsed = new URL(image, baseUrl);
        if (!SAFE_HTTPS_PROTOCOLS.has(parsed.protocol) || parsed.username || parsed.password) return '';
        parsed.hash = '';
        return parsed.toString();
    } catch {
        return '';
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

export { handleArcaMonitor };
