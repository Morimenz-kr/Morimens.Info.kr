import { WorkflowCoordinator } from './lib/coordinator.js';
import { handleFeedback } from './lib/feedback.js';
import { HttpError, htmlResponse, jsonResponse } from './lib/http.js';
import { enforcePublicSubmissionPolicy, getCorsHeaders, isAllowedBrowserOrigin } from './lib/security.js';
import {
    getResourceCategories,
    getResourceLinkSubmitHtml,
    handleArcaMonitor,
    handleDiscordInteraction,
    handleResourceLinkProposal
} from './lib/resource-links.js';

export { WorkflowCoordinator };

export default {
    async fetch(request, env, ctx) {
        const url = new URL(request.url);
        const origin = request.headers.get('Origin') || '';
        const corsHeaders = getCorsHeaders(origin, env, url.origin);

        try {
            if (request.method === 'OPTIONS') {
                if (!isAllowedBrowserOrigin(origin, env, url.origin)) {
                    return jsonResponse({ error: 'Origin is not allowed' }, 403, corsHeaders);
                }
                return new Response(null, { status: 204, headers: corsHeaders });
            }

            if (url.pathname === '/discord/interactions') {
                if (request.method !== 'POST') {
                    return new Response('method not allowed', { status: 405, headers: { Allow: 'POST' } });
                }
                return await handleDiscordInteraction(request, env, ctx);
            }

            if (request.method === 'GET') return handleGet(url, corsHeaders);
            if (request.method !== 'POST') {
                return jsonResponse({ error: 'Method not allowed' }, 405, {
                    ...corsHeaders,
                    Allow: 'GET, POST, OPTIONS'
                });
            }

            if (url.pathname === '/resource-links') {
                const rejection = await enforcePublicSubmissionPolicy(request, env, url, corsHeaders, 'resourceLinks');
                if (rejection) return rejection;
                return await handleResourceLinkProposal(request, env, corsHeaders);
            }

            if (url.pathname === '/' || url.pathname === '/feedback') {
                const rejection = await enforcePublicSubmissionPolicy(request, env, url, corsHeaders, 'feedback');
                if (rejection) return rejection;
                return await handleFeedback(request, env, corsHeaders);
            }

            return jsonResponse({ error: 'Not found' }, 404, corsHeaders);
        } catch (error) {
            if (!(error instanceof HttpError)) console.error(error);
            const status = error instanceof HttpError ? error.status : 500;
            const message = error instanceof HttpError && error.expose ? error.message : 'Worker request failed';
            return jsonResponse({ error: message, code: error.code || undefined }, status, {
                ...corsHeaders,
                ...(error.headers || {})
            });
        }
    },

    async scheduled(event, env, ctx) {
        ctx.waitUntil(handleArcaMonitor(env).catch(error => {
            console.error('Arca monitor failed', error);
        }));
    }
};

function handleGet(url, corsHeaders) {
    if (url.pathname === '/resource-links/submit') {
        return htmlResponse(getResourceLinkSubmitHtml(), 200, corsHeaders);
    }
    if (url.pathname === '/resource-links/categories') {
        return jsonResponse({ categories: getResourceCategories() }, 200, corsHeaders);
    }
    if (url.pathname === '/' || url.pathname === '/health') {
        return jsonResponse({ ok: true, service: 'morimens-feedback-worker' }, 200, corsHeaders);
    }
    return jsonResponse({ error: 'Not found' }, 404, corsHeaders);
}
