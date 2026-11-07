/* Read-only public query, with an authenticated outbound-only current-PC host. */
import { hostRequest, relayStub, RecordPullRelay } from './record-pull-relay.mjs';
export { RecordPullRelay };
const publicPath = pathname => pathname === '/api/health' || pathname === '/api/seasons' || pathname === '/api/clears' || pathname === '/api/meta'
    || pathname === '/api/leaderboard' || /^\/api\/profile\/[1-9][0-9]{0,17}(?:\/(?:history|challenges|latest-dzone|matches)|\/awakener\/[1-9][0-9]{0,8})?$/.test(pathname)
    || /^\/api\/dzone\/stage\/[1-9][0-9]{0,8}\/clears$/.test(pathname)
    || /^\/api\/replay\/[a-f\d]{8}(?:-[a-f\d]{4}){3}-[a-f\d]{12}(?:%23E%23[a-z])?(?:\/(?:analysis|party|party-code|build|original-build|simulation))?$/i.test(pathname)
    || /^\/api\/events(?:\/time-rules|\/(?:summon-)?[1-9][0-9]{0,8})?$/.test(pathname)
    || /^\/api\/library\/(?:profile-cosmetics|stages|relics|relic-variants|relics-full|relics\/[1-9][0-9]{0,8}|sources\/(?:Skill|State)\/[1-9][0-9]{0,8})$/.test(pathname);
const json = (value, status = 200, origin = null) => new Response(JSON.stringify(value), { status, headers: {
    'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff',
    ...(origin ? { 'Access-Control-Allow-Origin': origin, Vary: 'Origin' } : {}) } });

export class RecordRateLimit {
    constructor(state) { this.storage = state.storage; }
    async fetch() {
        const now = Date.now(), minute = Math.floor(now / 60000), hour = Math.floor(now / 3600000);
        const allowed = await this.storage.transaction(async storage => {
            const previous = await storage.get('window') ?? {};
            const m = previous.minute === minute ? previous.m : 0, h = previous.hour === hour ? previous.h : 0;
            if (m >= 10 || h >= 60) return false;
            await storage.put('window', { minute, hour, m: m + 1, h: h + 1 }); return true;
        });
        return json({ allowed }, allowed ? 200 : 429);
    }
}

export function createRecordWorker(fetcher = fetch) {
    return { async fetch(request, env) {
        const url = new URL(request.url), origin = request.headers.get('Origin');
        if(url.pathname.startsWith('/__relay/'))return hostRequest(request,env);
        const allowedOrigins = String(env.RECORD_ALLOWED_ORIGINS ?? '').split(',').map(value => value.trim()).filter(Boolean);
        if (origin && !allowedOrigins.includes(origin)) return json({ error: 'origin-not-allowed', data: null }, 403);
        if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: origin ? {
            'Access-Control-Allow-Origin': origin, 'Access-Control-Allow-Methods': 'GET, OPTIONS',
            'Access-Control-Allow-Headers': 'Accept', Vary: 'Origin' } : {} });
        if (request.method !== 'GET') return json({ error: 'read-only', data: null }, 405, origin);
        if (url.href.length > 4096 || !publicPath(url.pathname)) return json({ error: 'not-found', data: null }, 404, origin);
        let target;const pull=env.RECORD_QUERY_MODE==='pull';
        try {
            if(!pull)target = new URL(env.RECORD_QUERY_ORIGIN);
            if ((!pull&&(target.protocol !== 'https:' || target.username || target.password || target.pathname !== '/' || target.search || target.hash)) || pull&&!env.RECORD_PULL_RELAY
                || typeof env.RECORD_QUERY_TOKEN !== 'string' || env.RECORD_QUERY_TOKEN.length < 32 || env.RECORD_QUERY_TOKEN.length > 256 || !env.RECORD_RATE_LIMIT) throw Error();
        } catch { return json({ error: 'query-service-not-configured', data: null }, 503, origin); }
        if (url.pathname === '/api/health') return json({ ok: true, mode: pull?'outbound-pc-relay':'private-query-relay', ...(pull?await(await relayStub(env).fetch('https://relay/health')).json():{}), configurationPresent: true,
            gameQueryVerified: false, steamCredentialsInWorker: false }, 200, origin);
        const ip = request.headers.get('CF-Connecting-IP');
        if (!ip || ip.length > 64) return json({ error: 'client-address-unavailable', data: null }, 503, origin);
        const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(ip));
        const identity = [...new Uint8Array(bytes)].map(value => value.toString(16).padStart(2, '0')).join('');
        try {
            const limiter = env.RECORD_RATE_LIMIT.get(env.RECORD_RATE_LIMIT.idFromName(identity));
            const limit = await limiter.fetch('https://internal/limit');
            if (limit.status === 429) return json({ error: 'rate-limited', data: null }, 429, origin);
            if (!limit.ok) throw Error('limiter-unavailable');
        } catch { return json({ error: 'query-service-unavailable', data: null }, 503, origin); }
        if(pull){try{const r=await relayStub(env).fetch('https://relay/request',{method:'POST',body:JSON.stringify({path:url.pathname+url.search})});return json(await r.json(),r.status,origin);}catch{return json({error:'query-service-unavailable',data:null},503,origin);}}
        target.pathname = url.pathname; target.search = url.search;
        try {
            const response = await fetcher(target, { method: 'GET', redirect: 'error', signal: AbortSignal.timeout(25000),
                headers: { Accept: 'application/json', 'X-Morimens-Relay': env.RECORD_QUERY_TOKEN } });
            const declared = Number(response.headers.get('Content-Length'));
            if (declared > 12 * 1024 * 1024) throw Error('response-size');
            const reader = response.body.getReader(), chunks = []; let size = 0;
            while (true) {
                const { done, value } = await reader.read(); if (done) break;
                size += value.byteLength;
                if (size > 12 * 1024 * 1024) { await reader.cancel(); throw Error('response-size'); }
                chunks.push(value);
            }
            const bytes = new Uint8Array(size); let offset = 0;
            for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
            const body = JSON.parse(new TextDecoder().decode(bytes));
            if (!response.ok || body.error || body.ok === false) {
                const allowed = new Set(['not-found', 'invalid-input', 'busy', 'rate-limited', 'data-not-collected', 'game_running',
                    'version', 'private', 'record_unavailable', 'steam_unavailable', 'unknown-record-chapter']);
                const error = allowed.has(body.error) ? body.error : 'query-failed';
                return json({ error, data: null }, response.status === 400 ? 400 : response.status === 404 ? 404 : 503, origin);
            }
            if (!['game-server', 'client-config', 'client-export'].includes(body.source) || !body.data || typeof body.data !== 'object') throw Error('invalid-response');
            return json(Object.fromEntries(['ok', 'source', 'data', 'fetchedAt', 'cached', 'globalCoverage'].filter(key => Object.hasOwn(body, key)).map(key => [key, body[key]])), 200, origin);
        } catch { return json({ error: 'query-service-unavailable', data: null }, 503, origin); }
    } };
}
export default createRecordWorker();
