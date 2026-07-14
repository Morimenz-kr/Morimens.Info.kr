import { HttpError, jsonResponse, sha256Hex } from './http.js';

const DEFAULT_ALLOWED_ORIGIN = 'https://morimenz-kr.github.io';

const PUBLIC_RATE_LIMITS = {
    feedback: { retryAfter: 60 },
    resourceLinks: { retryAfter: 60 }
};

async function enforcePublicSubmissionPolicy(request, env, url, corsHeaders, kind) {
    const origin = request.headers.get('Origin') || '';
    const hasApiKey = await hasValidSubmissionApiKey(request, env);
    const originAllowed = origin
        ? isAllowedBrowserOrigin(origin, env, url.origin)
        : hasApiKey || String(env.ALLOW_ORIGINLESS_SUBMISSIONS || '').toLowerCase() === 'true';

    if (!originAllowed && !hasApiKey) {
        return jsonResponse({ error: 'Origin is not allowed', code: 'origin_not_allowed' }, 403, corsHeaders);
    }

    if (
        kind === 'resourceLinks'
        && !hasApiKey
        && String(env.ALLOW_PUBLIC_RESOURCE_LINKS || '').toLowerCase() !== 'true'
    ) {
        return jsonResponse({
            error: 'Public resource-link submissions are disabled',
            code: 'resource_links_public_disabled'
        }, 403, corsHeaders);
    }

    // A browser Origin is a CORS policy signal, never authentication. Trusted callers
    // use the API key; anonymous browser traffic must pass the platform rate limiter.
    if (hasApiKey) return null;

    const rateLimit = await consumePublicRateLimit(request, env, kind);
    if (!rateLimit.allowed) {
        return jsonResponse({ error: 'Too many submissions', code: 'rate_limited' }, 429, {
            ...corsHeaders,
            'Retry-After': String(rateLimit.retryAfter)
        });
    }
    return null;
}

async function hasValidSubmissionApiKey(request, env) {
    const expected = String(env.SUBMISSION_API_KEY || '');
    const provided = String(request.headers.get('X-Submission-Key') || '');
    if (!expected || !provided) return false;
    const [expectedHash, providedHash] = await Promise.all([
        sha256Hex(expected),
        sha256Hex(provided)
    ]);
    return expectedHash === providedHash;
}

async function consumePublicRateLimit(request, env, kind) {
    const defaults = PUBLIC_RATE_LIMITS[kind] || PUBLIC_RATE_LIMITS.feedback;
    if (!env.PUBLIC_SUBMISSION_RATE_LIMITER?.limit) {
        throw new HttpError('Anonymous submission protection is unavailable', 503, {
            expose: true,
            code: 'submission_security_unavailable'
        });
    }

    const identity = getClientIdentity(request);
    const identityHash = await sha256Hex(identity);
    const limiterKey = `${kind}:${identityHash}`;

    try {
        const result = await env.PUBLIC_SUBMISSION_RATE_LIMITER.limit({ key: limiterKey });
        if (result?.success === false) return { allowed: false, retryAfter: defaults.retryAfter };
        if (result?.success !== true) throw new Error('Rate limiter returned an invalid result');
    } catch (error) {
        console.error('Cloudflare rate limiter binding failed', error);
        throw new HttpError('Anonymous submission protection is unavailable', 503, {
            expose: true,
            code: 'submission_security_unavailable'
        });
    }

    return { allowed: true, retryAfter: 0 };
}

function getClientIdentity(request) {
    const connectingIp = String(request.headers.get('CF-Connecting-IP') || '').trim();
    if (connectingIp) return `ip:${connectingIp}`;
    return `fallback-origin:${request.headers.get('Origin') || 'originless'}`;
}

function getAllowedOrigins(env) {
    return String(env.ALLOWED_ORIGINS || DEFAULT_ALLOWED_ORIGIN)
        .split(',')
        .map(value => value.trim())
        .filter(Boolean)
        .map(value => {
            try {
                const normalized = value.endsWith('/') ? value.slice(0, -1) : value;
                const parsed = new URL(normalized);
                if (normalized !== parsed.origin || !isPermittedBrowserOrigin(parsed, env)) return null;
                return parsed.origin;
            } catch {
                return null;
            }
        })
        .filter(Boolean);
}

function isAllowedBrowserOrigin(origin, env, workerOrigin) {
    if (!origin || origin === 'null') return false;
    let parsed;
    try {
        parsed = new URL(origin);
    } catch {
        return false;
    }
    if (origin !== parsed.origin || !isPermittedBrowserOrigin(parsed, env)) return false;
    return origin === workerOrigin || getAllowedOrigins(env).includes(origin);
}

function isPermittedBrowserOrigin(parsed, env) {
    if (parsed.username || parsed.password) return false;
    if (parsed.protocol === 'https:') return true;
    if (
        parsed.protocol === 'http:'
        && String(env.ALLOW_LOCALHOST_ORIGINS || '').toLowerCase() === 'true'
    ) {
        const hostname = parsed.hostname.toLowerCase();
        return hostname === 'localhost'
            || hostname.endsWith('.localhost')
            || hostname === '127.0.0.1'
            || hostname === '[::1]';
    }
    return false;
}

function getCorsHeaders(origin, env, workerOrigin = '') {
    const allowOrigin = isAllowedBrowserOrigin(origin, env, workerOrigin) ? origin : '';

    return {
        ...(allowOrigin ? { 'Access-Control-Allow-Origin': allowOrigin } : {}),
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Idempotency-Key, X-Submission-Key',
        'Access-Control-Max-Age': '86400',
        'Vary': 'Origin',
        'Cache-Control': 'no-store',
        'X-Content-Type-Options': 'nosniff'
    };
}

export { enforcePublicSubmissionPolicy, getClientIdentity, getCorsHeaders, isAllowedBrowserOrigin };
