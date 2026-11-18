import { normalizeClearIndex } from '../js/dzone-clear-model.mjs';
import { normalizeUsage, validateUsageCatalog, compactUsage } from '../js/character-usage-model.mjs';
import manifest from '../data/character_manifest.json' with { type: 'json' };
import wheels from '../data/wheel_list.json' with { type: 'json' };
import covenants from '../data/covenant_list.json' with { type: 'json' };

const headers = { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', 'Access-Control-Allow-Headers': 'Authorization, Content-Type', 'Cache-Control': 'no-store' };
const reply = (body, status = 200) => new Response(JSON.stringify(body), { status, headers });

export async function handleCharacterUsage(request, env, characterId) {
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers });
    if (!['GET', 'POST'].includes(request.method)) return reply({ error: 'Method not allowed' }, 405);
    const store = env.RESOURCE_LINK_STATE;
    const root = `dzone:character-usage:v1:${characterId}`;
    if (request.method === 'GET') {
        if (!store) return reply({ error: 'Usage storage unavailable' }, 503);
        const period = new URL(request.url).searchParams.get('period');
        if (period !== null && !/^[1-9]\d{0,3}$/.test(period)) return reply({ error: 'Invalid period' }, 400);
        const index = await store.get(`${root}:index`, 'json');
        const selected = period || index?.periods?.[0];
        // Keep large, already-validated snapshots encoded in the read path.
        // Parsing every nested loadout here doubles CPU and memory without changing it.
        const encoded = selected ? await store.get(`${root}:${selected}`, 'stream') : null;
        if (!encoded) return reply({ error: 'Usage data not collected', periods: index?.periods || [] }, 404);
        const reader = encoded.getReader(), encoder = new TextEncoder();
        let started = false;
        const body = new ReadableStream({
            async pull(controller) {
                if (!started) { started = true; controller.enqueue(encoder.encode('{"data":')); return; }
                const chunk = await reader.read();
                if (!chunk.done) controller.enqueue(chunk.value);
                else {
                    controller.enqueue(encoder.encode(`,"periods":${JSON.stringify(index?.periods || [Number(selected)])}}`));
                    controller.close();
                }
            },
            cancel(reason) { return reader.cancel(reason); }
        });
        return new Response(body, { status: 200, headers });
    }
    if (!isAuthorized(request, env)) return reply({ error: 'Unauthorized' }, 401);
    if (!store) return reply({ error: 'Usage storage unavailable' }, 503);
    try {
        const data = normalizeUsage(await readJson(request));
        validateUsageCatalog(data, { manifest, wheels, covenants });
        if (data.characterId !== characterId) throw new Error('Character does not match path');
        if (data.collectedAt > Date.now() / 1000 + 300) throw new Error('Collection date is in the future');
        const key = `${root}:${data.period}`;
        const previous = await store.get(key, 'json');
        if (previous && previous.collectedAt > data.collectedAt) return reply({ error: 'Older snapshot rejected' }, 409);
        await store.put(key, JSON.stringify(compactUsage(data)));
        const index = await store.get(`${root}:index`, 'json');
        const periods = [...new Set([...(index?.periods || []), data.period])].sort((a, b) => b - a);
        await store.put(`${root}:index`, JSON.stringify({ periods }));
        return reply({ ok: true, period: data.period, rows: data.rows.length });
    } catch (e) { return reply({ error: e.message }, e.status || 400); }
}


function isAuthorized(request, env) {
    const token = request.headers.get('Authorization')?.replace(/^Bearer\s+/i, '');
    return Boolean(token) && token === env.DZONE_INGEST_TOKEN;
}

async function readJson(request) {
    const reader = request.body?.getReader();
    if (!reader) throw new Error('Missing body');
    const chunks = [];
    let size = 0;
    try {
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            size += value.byteLength;
            if (size > 24_000_000) {
                await reader.cancel();
                throw Object.assign(new Error('Payload too large'), { status: 413 });
            }
            chunks.push(value);
        }
        return JSON.parse(await new Blob(chunks).text());
    } finally {
        reader.releaseLock();
    }
}

export async function handleClearIndex(request, env) {
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers });
    if (!['GET', 'POST'].includes(request.method)) return reply({ error: 'Method not allowed' }, 405);
    if (request.method === 'POST' && !isAuthorized(request, env)) return reply({ error: 'Unauthorized' }, 401);
    const store = env.RESOURCE_LINK_STATE;
    if (!store) return reply({ error: 'Clear storage unavailable' }, 503);
    const period = new URL(request.url).searchParams.get('period');
    if (!/^[1-9]\d{0,3}$/.test(period ?? '')) return reply({ error: 'A valid period is required' }, 400);
    const key = `dzone:clear-index:v1:${period}`;
    if (request.method === 'GET') {
        const data = await store.get(key, 'stream');
        return data ? new Response(data, { status: 200, headers }) : reply({ error: 'Clear data not collected' }, 404);
    }
    try {
        const data = normalizeClearIndex(await readJson(request), new Set(manifest.map(row => row.id)));
        if (data.period !== Number(period)) throw new Error('Period does not match request');
        if (data.collectedAt > Date.now() / 1000 + 300) throw new Error('Collection date is in the future');
        const previous = await store.get(key, 'json');
        if (previous?.data?.collectedAt > data.collectedAt) return reply({ error: 'Older snapshot rejected' }, 409);
        await store.put(key, JSON.stringify({ data }));
        return reply({ ok: true, period: data.period, teams: data.teams.length });
    } catch (error) {
        return reply({ error: error.message }, error.status || 400);
    }
}
