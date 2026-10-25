import { normalizeUsage, validateUsageCatalog, compactUsage } from '../js/character-usage-model.mjs';
import manifest from '../data/character_manifest.json' with { type: 'json' };
import wheels from '../data/wheel_list.json' with { type: 'json' };
import covenants from '../data/covenant_list.json' with { type: 'json' };

export async function handleCharacterUsage(request, env, characterId) {
    const headers = { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', 'Access-Control-Allow-Headers': 'Authorization, Content-Type', 'Cache-Control': 'no-store' };
    const reply = (body, status = 200) => new Response(JSON.stringify(body), { status, headers });
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
    const token = request.headers.get('Authorization')?.replace(/^Bearer\s+/i, '');
    if (!env.DZONE_INGEST_TOKEN || token !== env.DZONE_INGEST_TOKEN) return reply({ error: 'Unauthorized' }, 401);
    if (!store) return reply({ error: 'Usage storage unavailable' }, 503);
    // Read a bounded stream, including requests without Content-Length.
    const reader = request.body?.getReader();
    if (!reader) return reply({ error: 'Missing body' }, 400);
    const chunks = []; let length = 0;
    while (true) {
        const { done, value } = await reader.read(); if (done) break;
        length += value.byteLength;
        if (length > 24_000_000) { await reader.cancel(); return reply({ error: 'Payload too large' }, 413); }
        chunks.push(value);
    }
    try {
        const data = normalizeUsage(JSON.parse(await new Blob(chunks).text()));
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
    } catch (e) { return reply({ error: e.message }, 400); }
}
