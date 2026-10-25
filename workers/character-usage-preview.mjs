// Read-only QA endpoint. Shares the production reader, with isolated KV keys.
import { handleCharacterUsage } from './character-usage.mjs';
export default {
    async fetch(request, env) {
        const match = new URL(request.url).pathname.match(/^\/api\/dzone\/character\/([A-Za-z0-9_-]{1,80})\/usage$/);
        if (!match) return new Response('Not found', { status: 404 });
        if (!['GET', 'OPTIONS'].includes(request.method)) return new Response('Read only', { status: 405 });
        return handleCharacterUsage(request, { RESOURCE_LINK_STATE: {
            get: (key, type) => env.RESOURCE_LINK_STATE.get(`character-usage-qa:${key}`, type)
        } }, match[1]);
    }
};
