import test from 'node:test';
import assert from 'node:assert/strict';
import worker, { WorkflowCoordinator } from '../workers/feedback-worker.js';
import { WorkflowCoordinator as CoordinatorModuleClass } from '../workers/lib/coordinator.js';
import { interactionResponse } from '../workers/lib/discord-adapter.js';
import {
    commitGitHubFilesAtomically,
    createGitHubIssueWithOptionalLabels
} from '../workers/lib/github-adapter.js';
import { ValidationError, normalizeHttpUrl } from '../workers/lib/http.js';
import { buildResourceMessageContent } from '../workers/lib/resource-discord-view.js';
import { extractResourceSelection, upsertResourceSelection } from '../workers/lib/resource-issue.js';
import { normalizeResourceProposal as facadeNormalizeResourceProposal } from '../workers/lib/resource-links.js';
import {
    buildResourceLinksUpdate,
    updateResourceLinks
} from '../workers/lib/resource-repository.js';
import {
    buildResourceLinkShardUpdates,
    serializeDeterministicJson
} from '../shared/runtime-data-shards.js';
import { normalizeResourceProposal } from '../workers/lib/resource-schema.js';
import { getCorsHeaders } from '../workers/lib/security.js';

const workerUrl = 'https://worker.example.test';
const allowedOrigin = 'https://site.example.test';
const env = { ALLOWED_ORIGINS: allowedOrigin };
const submissionKey = 'test-submission-key-that-is-long-enough';

function allowRateLimit() {
    return { limit: async () => ({ success: true }) };
}

function createWorkflowCoordinatorBinding(initialRecord = null) {
    const states = new Map();
    const binding = {
        lastId: null,
        idFromName(name) {
            this.lastId = name;
            return name;
        },
        get(id) {
            return {
                async fetch(input, init) {
                    const request = new Request(input, init);
                    const { owner, record } = await request.json();
                    const path = new URL(request.url).pathname;
                    const state = states.get(id) || (initialRecord
                        ? { record: structuredClone(initialRecord) }
                        : {});

                    if (path === '/acquire') {
                        if (state.owner && state.owner !== owner) {
                            return Response.json({ acquired: false });
                        }
                        states.set(id, { ...state, owner });
                        return Response.json({ acquired: true, record: state.record || null });
                    }
                    if (!state.owner || state.owner !== owner) {
                        return Response.json({ error: 'lock ownership lost' }, { status: 409 });
                    }
                    if (path === '/record') {
                        states.set(id, { ...state, record });
                        return Response.json({ ok: true });
                    }
                    if (path === '/release') {
                        states.set(id, { ...state, owner: null });
                        return Response.json({ ok: true });
                    }
                    return Response.json({ error: 'not found' }, { status: 404 });
                }
            };
        }
    };
    return binding;
}

class TransactionalMemoryStorage {
    constructor() {
        this.values = new Map();
        this.queue = Promise.resolve();
    }

    transaction(callback) {
        const transaction = {
            get: key => Promise.resolve(this.values.get(key)),
            put: (key, value) => {
                this.values.set(key, structuredClone(value));
                return Promise.resolve();
            },
            delete: key => {
                this.values.delete(key);
                return Promise.resolve();
            }
        };
        const result = this.queue.then(() => callback(transaction));
        this.queue = result.catch(() => undefined);
        return result;
    }

    async setAlarm(value) {
        this.alarm = value;
    }

    async deleteAll() {
        this.values.clear();
    }
}

test('split Worker modules expose the entrypoint contracts without changing behavior', async () => {
    assert.equal(WorkflowCoordinator, CoordinatorModuleClass);
    assert.equal(typeof createGitHubIssueWithOptionalLabels, 'function');
    assert.equal(facadeNormalizeResourceProposal, normalizeResourceProposal);
    assert.equal(
        normalizeHttpUrl('https://example.test/path', 'url'),
        'https://example.test/path'
    );
    assert.throws(
        () => normalizeHttpUrl('http://example.test/path', 'url'),
        ValidationError
    );

    const proposal = normalizeResourceProposal({
        url: 'https://example.test/resource',
        title: 'resource',
        targets: ['category:newbie']
    });
    assert.equal(proposal.link.url, 'https://example.test/resource');
    assert.deepEqual(proposal.targets, [{ type: 'category', id: 'newbie' }]);

    const storedSelection = upsertResourceSelection('', {
        targets: ['category:newbie'],
        activeRelems: 'chaos'
    });
    assert.deepEqual(extractResourceSelection(storedSelection).targets, [
        { type: 'category', id: 'newbie' }
    ]);

    const resourceUpdate = buildResourceLinksUpdate(JSON.stringify({
        categories: { newbie: { links: [] } },
        characters: {}
    }, null, 2), proposal.link, proposal.targets);
    assert.deepEqual(resourceUpdate.added, [{ type: 'category', id: 'newbie' }]);
    assert.equal(JSON.parse(resourceUpdate.content).categories.newbie.links[0].url, proposal.link.url);
    assert.match(buildResourceMessageContent(), /resource_links/);

    const interaction = interactionResponse(4, { content: '@everyone' });
    assert.deepEqual((await interaction.json()).data.allowed_mentions, { parse: [] });
    assert.equal(
        getCorsHeaders(allowedOrigin, { ALLOWED_ORIGINS: allowedOrigin }, workerUrl)['Access-Control-Allow-Origin'],
        allowedOrigin
    );
});

test('resource approval advances canonical data and every target shard in one atomic commit', async () => {
    const link = {
        url: 'https://example.test/approved-guide',
        title: 'Approved guide',
        desc: 'A reviewed resource'
    };
    const targets = [
        { type: 'category', id: 'newbie' },
        { type: 'character', id: 'nymphaea' }
    ];
    const initialDatabase = {
        categories: { newbie: { title: 'Newbie', links: [] } },
        characters: { nymphaea: [] }
    };
    const files = new Map([
        ['data/resource_links.json', `${JSON.stringify(initialDatabase, null, 2)}\n`],
        ['data/resource-links/categories/newbie.json', serializeDeterministicJson(initialDatabase.categories.newbie)],
        ['data/resource-links/characters/nymphaea.json', serializeDeterministicJson(initialDatabase.characters.nymphaea)]
    ]);
    const events = [];
    let failAtomicCommitOnce = true;
    let pullRequestCount = 0;
    let commitSequence = 1;
    let headSha = 'a'.repeat(40);
    const actions = {
        async ensurePendingBranch() {
            events.push('ensure-branch');
        },
        async getPendingRef() {
            events.push('get-head');
            return { object: { sha: headSha } };
        },
        async getFile(path) {
            events.push(`get:${path}`);
            const content = files.get(path);
            assert.notEqual(content, undefined, `unexpected file read: ${path}`);
            return { sha: `blob-${path}`, content };
        },
        async commitFiles(branch, expectedHeadSha, data) {
            events.push(`atomic:${data.files.map(file => file.path).join('|')}`);
            assert.equal(branch, 'resource-links/pending');
            assert.equal(expectedHeadSha, headSha);
            if (failAtomicCommitOnce) {
                failAtomicCommitOnce = false;
                throw new Error('simulated atomic tree failure');
            }
            for (const file of data.files) files.set(file.path, file.content);
            headSha = String(commitSequence++).padStart(40, 'b');
            return { sha: headSha, html_url: `https://github.example/${headSha}` };
        },
        async findOpenPullRequest() {
            events.push('find-pr');
            return null;
        },
        async getBranchComparison() {
            events.push('compare');
            return { ahead_by: 1 };
        },
        async ensurePullRequest() {
            events.push('open-pr');
            pullRequestCount += 1;
            return { html_url: 'https://github.example/pr/1' };
        }
    };

    await assert.rejects(
        updateResourceLinks({}, link, targets, null, actions),
        /simulated atomic tree failure/
    );
    assert.equal(pullRequestCount, 0, 'a failed atomic tree must not get a PR');
    assert.ok(!events.includes('find-pr'), 'PR discovery must happen only after the atomic branch update');
    assert.deepEqual(
        JSON.parse(files.get('data/resource_links.json')).categories.newbie.links,
        [],
        'a failed atomic operation must leave the canonical source unchanged'
    );
    assert.deepEqual(
        JSON.parse(files.get('data/resource-links/categories/newbie.json')).links,
        [],
        'a failed atomic operation must leave every category shard unchanged'
    );
    assert.deepEqual(
        JSON.parse(files.get('data/resource-links/characters/nymphaea.json')),
        [],
        'a failed atomic operation must leave every character shard unchanged'
    );

    events.length = 0;
    const recovered = await updateResourceLinks({}, link, targets, null, actions);
    assert.deepEqual(recovered.added, targets);
    assert.deepEqual(recovered.skipped, []);
    assert.equal(recovered.shardUpdates, 2);
    assert.equal(recovered.shardUnchanged, 0);
    assert.equal(pullRequestCount, 1);
    assert.equal(
        JSON.parse(files.get('data/resource_links.json')).categories.newbie.links[0].url,
        link.url
    );
    assert.equal(
        JSON.parse(files.get('data/resource-links/categories/newbie.json')).links[0].url,
        link.url
    );
    assert.equal(
        JSON.parse(files.get('data/resource-links/characters/nymphaea.json'))[0].url,
        link.url
    );
    const atomicEvent = events.find(event => event.startsWith('atomic:'));
    assert.equal(
        atomicEvent,
        'atomic:data/resource_links.json|data/resource-links/categories/newbie.json|data/resource-links/characters/nymphaea.json'
    );
    assert.ok(
        events.indexOf(atomicEvent) < events.indexOf('open-pr'),
        'the one complete tree commit must precede PR creation'
    );
});

test('an already-canonical approval atomically recreates a missing requested shard before PR creation', async () => {
    const link = {
        url: 'https://example.test/already-approved',
        title: 'Already approved',
        desc: ''
    };
    const canonical = `${JSON.stringify({
        categories: {
            newbie: { title: 'Newbie', links: [link] }
        },
        characters: {}
    }, null, 2)}\n`;
    const events = [];
    let committedFiles = null;
    const actions = {
        async ensurePendingBranch() {},
        async getPendingRef() {
            return { object: { sha: 'a'.repeat(40) } };
        },
        async getFile(path) {
            if (path === 'data/resource_links.json') return { sha: 'canonical', content: canonical };
            if (path === 'data/resource-links/categories/newbie.json') {
                throw Object.assign(new Error('missing shard'), { status: 404 });
            }
            throw new Error(`unexpected path: ${path}`);
        },
        async commitFiles(branch, headSha, data) {
            events.push('atomic');
            committedFiles = data.files;
            return { sha: 'b'.repeat(40), html_url: 'https://github.example/repair' };
        },
        async findOpenPullRequest() {
            events.push('find-pr');
            return null;
        },
        async getBranchComparison() {
            throw new Error('comparison is unnecessary after a repair commit');
        },
        async ensurePullRequest() {
            events.push('open-pr');
            return { html_url: 'https://github.example/pr/repair' };
        }
    };

    const result = await updateResourceLinks(
        {},
        link,
        [{ type: 'category', id: 'newbie' }],
        null,
        actions
    );
    assert.deepEqual(result.added, []);
    assert.deepEqual(result.skipped, [{ type: 'category', id: 'newbie' }]);
    assert.equal(result.shardUpdates, 1);
    assert.deepEqual(committedFiles.map(file => file.path), [
        'data/resource-links/categories/newbie.json'
    ]);
    assert.equal(JSON.parse(committedFiles[0].content).links[0].url, link.url);
    assert.deepEqual(events, ['atomic', 'find-pr', 'open-pr']);
});

test('Git database adapter creates one tree and advances the pending ref only after the commit exists', async () => {
    const originalFetch = globalThis.fetch;
    const headSha = 'a'.repeat(40);
    const commitSha = 'c'.repeat(40);
    const requests = [];
    globalThis.fetch = async (input, init = {}) => {
        const url = new URL(input);
        const request = {
            path: url.pathname.replace('/repos/example/project', ''),
            method: init.method,
            headers: init.headers,
            body: init.body ? JSON.parse(init.body) : null
        };
        requests.push(request);

        if (request.method === 'GET' && request.path === `/git/commits/${headSha}`) {
            return Response.json({ sha: headSha, tree: { sha: 'tree-base' } });
        }
        if (request.method === 'POST' && request.path === '/git/trees') {
            return Response.json({ sha: 'tree-new' }, { status: 201 });
        }
        if (request.method === 'POST' && request.path === '/git/commits') {
            return Response.json({ sha: commitSha, html_url: 'https://github.example/commit' }, { status: 201 });
        }
        if (request.method === 'PATCH' && request.path === '/git/refs/heads/resource-links/pending') {
            return Response.json({ object: { sha: commitSha } });
        }
        return Response.json({ message: 'unexpected request' }, { status: 500 });
    };

    try {
        const result = await commitGitHubFilesAtomically({
            GITHUB_OWNER: 'example',
            GITHUB_REPO: 'project',
            GITHUB_TOKEN: 'token'
        }, 'resource-links/pending', headSha, {
            message: 'Update @reviewers',
            files: [
                { path: 'data/resource_links.json', content: '{}\n' },
                { path: 'data/resource-links/categories/newbie.json', content: '{"links":[]}\n' }
            ]
        });

        assert.equal(result.sha, commitSha);
        assert.deepEqual(requests.map(request => `${request.method} ${request.path}`), [
            `GET /git/commits/${headSha}`,
            'POST /git/trees',
            'POST /git/commits',
            'PATCH /git/refs/heads/resource-links/pending'
        ]);
        assert.equal(requests[1].body.base_tree, 'tree-base');
        assert.deepEqual(requests[1].body.tree.map(entry => entry.path), [
            'data/resource_links.json',
            'data/resource-links/categories/newbie.json'
        ]);
        assert.equal(requests[2].body.parents[0], headSha);
        assert.equal(requests[2].body.message, 'Update @\u200breviewers');
        assert.deepEqual(requests[3].body, { sha: commitSha, force: false });
        assert.equal(requests[0].headers['X-GitHub-Api-Version'], '2026-03-10');
    } finally {
        globalThis.fetch = originalFetch;
    }
});

test('resource shard payloads use safe routes and deterministic shared serialization', () => {
    const updates = buildResourceLinkShardUpdates({
        categories: {
            newbie: {
                title: 'Newbie',
                links: [{ url: 'https://example.test', title: 'Guide', desc: '' }]
            }
        },
        characters: { nymphaea: [] }
    }, [
        { type: 'character', id: 'nymphaea' },
        { type: 'category', id: 'newbie' },
        { type: 'category', id: 'newbie' }
    ]);

    assert.deepEqual(updates.map(update => update.path), [
        'data/resource-links/characters/nymphaea.json',
        'data/resource-links/categories/newbie.json'
    ]);
    assert.equal(updates[0].content, '[]\n');
    assert.equal(
        updates[1].content,
        '{\n  "links": [\n    {\n      "desc": "",\n      "title": "Guide",\n      "url": "https://example.test"\n    }\n  ],\n  "title": "Newbie"\n}\n'
    );
    assert.throws(
        () => buildResourceLinkShardUpdates({ categories: {}, characters: {} }, [
            { type: 'character', id: '../escape' }
        ]),
        /unsafe/
    );
    assert.throws(
        () => buildResourceLinkShardUpdates({
            categories: { newbie: { links: [] } },
            characters: {}
        }, [{ type: 'category', id: 'newbie' }]),
        /Invalid resource link category/
    );
});

test('worker health response exposes no CORS access to an unknown origin', async () => {
    const response = await worker.fetch(new Request(`${workerUrl}/`, {
        headers: { Origin: 'https://attacker.example' }
    }), env, {});
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.deepEqual(body, { ok: true, service: 'morimens-feedback-worker' });
    assert.equal(response.headers.get('Access-Control-Allow-Origin'), null);
    assert.equal(response.headers.get('Cache-Control'), 'no-store');
    assert.equal(response.headers.get('X-Content-Type-Options'), 'nosniff');

    const explicitHealth = await worker.fetch(new Request(`${workerUrl}/health`), env, {});
    assert.equal(explicitHealth.status, 200);
    assert.deepEqual(await explicitHealth.json(), body);

    const unknown = await worker.fetch(new Request(`${workerUrl}/definitely-not-a-route`), env, {});
    assert.equal(unknown.status, 404);
    assert.equal((await unknown.json()).error, 'Not found');
});

test('worker returns narrow CORS headers to an allowed browser origin', async () => {
    const response = await worker.fetch(new Request(`${workerUrl}/resource-links/categories`, {
        headers: { Origin: allowedOrigin }
    }), env, {});
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.equal(response.headers.get('Access-Control-Allow-Origin'), allowedOrigin);
    assert.equal(response.headers.get('Vary'), 'Origin');
    assert.ok(Array.isArray(body.categories) && body.categories.length > 0);

    const preflight = await worker.fetch(new Request(`${workerUrl}/feedback`, {
        method: 'OPTIONS',
        headers: { Origin: allowedOrigin }
    }), env, {});
    assert.equal(preflight.status, 204);
    assert.equal(preflight.headers.get('Access-Control-Allow-Origin'), allowedOrigin);
});

test('worker rejects preflight and submissions from disallowed origins', async () => {
    const preflight = await worker.fetch(new Request(`${workerUrl}/feedback`, {
        method: 'OPTIONS',
        headers: { Origin: 'https://attacker.example' }
    }), env, {});
    assert.equal(preflight.status, 403);
    assert.equal(preflight.headers.get('Access-Control-Allow-Origin'), null);

    const submission = await worker.fetch(new Request(`${workerUrl}/feedback`, {
        method: 'POST',
        headers: {
            Origin: 'https://attacker.example',
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ category: '기타', content: 'blocked' })
    }), env, {});
    const body = await submission.json();
    assert.equal(submission.status, 403);
    assert.equal(body.code, 'origin_not_allowed');

    const originless = await worker.fetch(new Request(`${workerUrl}/feedback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ category: '기타', content: 'blocked' })
    }), env, {});
    assert.equal(originless.status, 403);
    assert.equal((await originless.json()).code, 'origin_not_allowed');
});

test('worker rejects unsupported methods with an explicit Allow header', async () => {
    const response = await worker.fetch(new Request(`${workerUrl}/`, {
        method: 'DELETE',
        headers: { Origin: allowedOrigin }
    }), env, {});

    assert.equal(response.status, 405);
    assert.equal(response.headers.get('Allow'), 'GET, POST, OPTIONS');
});

test('browser origins require HTTPS except for an explicit localhost development opt-in', async () => {
    const insecureRemote = await worker.fetch(new Request(`${workerUrl}/resource-links/categories`, {
        headers: { Origin: 'http://example.test' }
    }), { ALLOWED_ORIGINS: 'http://example.test' }, {});
    assert.equal(insecureRemote.headers.get('Access-Control-Allow-Origin'), null);

    const localOrigin = 'http://localhost:8787';
    const localWithoutOptIn = await worker.fetch(new Request(`${workerUrl}/resource-links/categories`, {
        headers: { Origin: localOrigin }
    }), { ALLOWED_ORIGINS: localOrigin }, {});
    assert.equal(localWithoutOptIn.headers.get('Access-Control-Allow-Origin'), null);

    const localWithOptIn = await worker.fetch(new Request(`${workerUrl}/resource-links/categories`, {
        headers: { Origin: localOrigin }
    }), {
        ALLOWED_ORIGINS: localOrigin,
        ALLOW_LOCALHOST_ORIGINS: 'true'
    }, {});
    assert.equal(localWithOptIn.headers.get('Access-Control-Allow-Origin'), localOrigin);
});

test('public resource-link submissions are disabled until the bot-control gate is enabled', async () => {
    const response = await worker.fetch(new Request(`${workerUrl}/resource-links`, {
        method: 'POST',
        headers: {
            Origin: allowedOrigin,
            'Content-Type': 'application/json'
        },
        body: 'not-json'
    }), {
        ...env,
        PUBLIC_SUBMISSION_RATE_LIMITER: allowRateLimit()
    }, {});

    assert.equal(response.status, 403);
    assert.equal((await response.json()).code, 'resource_links_public_disabled');
});

test('resource-link destination URLs require HTTPS before any GitHub lookup', async () => {
    const response = await worker.fetch(new Request(`${workerUrl}/resource-links`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-Submission-Key': submissionKey
        },
        body: JSON.stringify({
            url: 'http://example.test/insecure',
            title: 'insecure resource'
        })
    }), {
        SUBMISSION_API_KEY: submissionKey,
        GITHUB_TOKEN: 'not-used',
        GITHUB_OWNER: 'not-used',
        GITHUB_REPO: 'not-used',
        DISCORD_BOT_TOKEN: 'not-used',
        DISCORD_CHANNEL_ID: 'not-used'
    }, {});

    assert.equal(response.status, 400);
    assert.equal((await response.json()).code, 'validation_error');
});

test('allowed browser submissions fail closed without a platform rate limiter', async () => {
    const response = await worker.fetch(new Request(`${workerUrl}/feedback`, {
        method: 'POST',
        headers: {
            Origin: allowedOrigin,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ message: 'rate limiter must exist' })
    }), env, {});

    assert.equal(response.status, 503);
    assert.equal((await response.json()).code, 'submission_security_unavailable');
});

test('platform rate limiter rejection returns 429 and does not parse the submission', async () => {
    const response = await worker.fetch(new Request(`${workerUrl}/feedback`, {
        method: 'POST',
        headers: {
            Origin: allowedOrigin,
            'Content-Type': 'application/json'
        },
        body: 'not-json'
    }), {
        ...env,
        PUBLIC_SUBMISSION_RATE_LIMITER: { limit: async () => ({ success: false }) }
    }, {});

    assert.equal(response.status, 429);
    assert.equal(response.headers.get('Retry-After'), '60');
    assert.equal((await response.json()).code, 'rate_limited');
});

test('platform rate limiter failures return 503 instead of falling back locally', async () => {
    const originalError = console.error;
    console.error = () => {};
    try {
        const response = await worker.fetch(new Request(`${workerUrl}/feedback`, {
            method: 'POST',
            headers: {
                Origin: allowedOrigin,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ message: 'binding failure must fail closed' })
        }), {
            ...env,
            PUBLIC_SUBMISSION_RATE_LIMITER: {
                limit: async () => {
                    throw new Error('simulated binding outage');
                }
            }
        }, {});

        assert.equal(response.status, 503);
        assert.equal((await response.json()).code, 'submission_security_unavailable');
    } finally {
        console.error = originalError;
    }
});

test('trusted API-key submissions bypass the anonymous limiter but still validate JSON', async () => {
    const response = await worker.fetch(new Request(`${workerUrl}/feedback`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-Submission-Key': submissionKey
        },
        body: 'not-json'
    }), { SUBMISSION_API_KEY: submissionKey }, {});

    assert.equal(response.status, 400);
    assert.equal((await response.json()).code, 'validation_error');
});

test('valid submissions fail closed when the Durable Object coordinator is missing', async () => {
    const response = await worker.fetch(new Request(`${workerUrl}/feedback`, {
        method: 'POST',
        headers: {
            Origin: allowedOrigin,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ message: 'coordinator must exist' })
    }), {
        ...env,
        PUBLIC_SUBMISSION_RATE_LIMITER: allowRateLimit()
    }, {});

    assert.equal(response.status, 503);
    assert.equal((await response.json()).code, 'workflow_coordinator_unavailable');
});

test('public and Discord routes reject declared or streamed bodies over 24 KiB', async () => {
    const declared = await worker.fetch(new Request(`${workerUrl}/feedback`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Content-Length': String(24 * 1024 + 1),
            'X-Submission-Key': submissionKey
        },
        body: '{}'
    }), { SUBMISSION_API_KEY: submissionKey }, {});
    assert.equal(declared.status, 413);
    assert.equal((await declared.json()).code, 'payload_too_large');

    const streamed = await worker.fetch(new Request(`${workerUrl}/feedback`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-Submission-Key': submissionKey
        },
        body: `{"message":"${'x'.repeat(24 * 1024)}"}`
    }), { SUBMISSION_API_KEY: submissionKey }, {});
    assert.equal(streamed.status, 413);
    assert.equal((await streamed.json()).code, 'payload_too_large');

    const discord = await worker.fetch(new Request(`${workerUrl}/discord/interactions`, {
        method: 'POST',
        headers: { 'Content-Length': String(24 * 1024 + 1) },
        body: '{}'
    }), {}, {});
    assert.equal(discord.status, 413);
    assert.equal((await discord.json()).code, 'payload_too_large');

    const streamedDiscord = await worker.fetch(new Request(`${workerUrl}/discord/interactions`, {
        method: 'POST',
        body: 'x'.repeat(24 * 1024 + 1)
    }), {}, {});
    assert.equal(streamedDiscord.status, 413);
    assert.equal((await streamedDiscord.json()).code, 'payload_too_large');
});

test('workflow coordinator grants only one atomic owner', async () => {
    const storage = new TransactionalMemoryStorage();
    const coordinator = new WorkflowCoordinator({ storage });
    const acquire = owner => coordinator.fetch(new Request('https://coordinator.test/acquire', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ owner })
    })).then(response => response.json());

    const [first, second] = await Promise.all([
        acquire('owner-11111111'),
        acquire('owner-22222222')
    ]);

    assert.deepEqual([first.acquired, second.acquired].sort(), [false, true]);
});

test('an interrupted issue creation is recovered by its GitHub submission marker', async t => {
    const originalFetch = globalThis.fetch;
    const coordinator = createWorkflowCoordinatorBinding({
        status: 'creating',
        startedAt: new Date(Date.now() - 11 * 60 * 1000).toISOString()
    });
    const githubMethods = [];
    t.after(() => {
        globalThis.fetch = originalFetch;
    });
    globalThis.fetch = async (input, init = {}) => {
        if (!String(input).includes('api.github.com')) {
            throw new Error(`Unexpected outbound request: ${input}`);
        }
        githubMethods.push(init.method);
        return Response.json([{
            number: 654,
            html_url: 'https://github.com/example/repo/issues/654',
            body: `recovered\n<!-- submission-id:${coordinator.lastId} -->`
        }]);
    };

    const response = await worker.fetch(new Request(`${workerUrl}/feedback`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-Submission-Key': submissionKey
        },
        body: JSON.stringify({ message: '중단된 이슈 생성 복구를 검증합니다.' })
    }), {
        SUBMISSION_API_KEY: submissionKey,
        WORKFLOW_COORDINATOR: coordinator,
        GITHUB_TOKEN: 'github-token',
        GITHUB_OWNER: 'example',
        GITHUB_REPO: 'repo'
    }, {});
    const result = await response.json();

    assert.equal(response.status, 200);
    assert.equal(result.issueUrl, 'https://github.com/example/repo/issues/654');
    assert.equal(result.deduplicated, true);
    assert.deepEqual(githubMethods, ['GET']);
});

test('contact details stay out of the public issue and are sent only to private Discord', async t => {
    const originalFetch = globalThis.fetch;
    const calls = [];
    t.after(() => {
        globalThis.fetch = originalFetch;
    });
    globalThis.fetch = async (input, init = {}) => {
        calls.push({ url: String(input), init });
        if (String(input).includes('api.github.com')) {
            return Response.json({
                number: 321,
                html_url: 'https://github.com/example/repo/issues/321'
            }, { status: 201 });
        }
        if (String(input).startsWith('https://discord.com/api/webhooks/')) {
            return new Response(null, { status: 204 });
        }
        throw new Error(`Unexpected outbound request: ${input}`);
    };

    const privateContact = 'private-contact@example.test';
    const secureEnv = {
        SUBMISSION_API_KEY: submissionKey,
        WORKFLOW_COORDINATOR: createWorkflowCoordinatorBinding(),
        GITHUB_TOKEN: 'github-token',
        GITHUB_OWNER: 'example',
        GITHUB_REPO: 'repo',
        DISCORD_WEBHOOK_URL: 'https://discord.com/api/webhooks/123/token'
    };
    const requestBody = {
        reporter: privateContact,
        message: '공개 이슈와 비공개 알림의 개인정보 경계를 @octocat 계정으로 검증합니다.',
        sourceUrl: 'https://site.example.test/page',
        pageTitle: '테스트 페이지',
        userAgent: 'private-user-agent-value'
    };

    const first = await worker.fetch(new Request(`${workerUrl}/feedback`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-Submission-Key': submissionKey
        },
        body: JSON.stringify(requestBody)
    }), secureEnv, {});
    assert.equal(first.status, 200);

    const retry = await worker.fetch(new Request(`${workerUrl}/feedback`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-Submission-Key': submissionKey
        },
        body: JSON.stringify(requestBody)
    }), secureEnv, {});
    assert.equal(retry.status, 200);
    assert.equal((await retry.json()).deduplicated, true);

    const githubCalls = calls.filter(call => call.url.includes('api.github.com'));
    const discordCalls = calls.filter(call => call.url.startsWith('https://discord.com/api/webhooks/'));
    assert.equal(githubCalls.length, 1);
    assert.equal(discordCalls.length, 1);
    assert.doesNotMatch(githubCalls[0].init.body, new RegExp(privateContact));
    assert.doesNotMatch(githubCalls[0].init.body, /private-user-agent-value/);
    assert.doesNotMatch(githubCalls[0].init.body, /@octocat/);
    assert.match(githubCalls[0].init.body, /@​octocat/);
    assert.match(discordCalls[0].init.body, new RegExp(privateContact));
    assert.deepEqual(JSON.parse(discordCalls[0].init.body).allowed_mentions, { parse: [] });
});

test('worker approval page is protected against embedding and ambient browser capabilities', async () => {
    const response = await worker.fetch(new Request(`${workerUrl}/resource-links/submit`, {
        headers: { Origin: allowedOrigin }
    }), env, {});

    assert.equal(response.status, 200);
    assert.match(response.headers.get('Content-Security-Policy') || '', /frame-ancestors 'none'/);
    assert.equal(response.headers.get('X-Frame-Options'), 'DENY');
    assert.equal(response.headers.get('Referrer-Policy'), 'no-referrer');
    assert.match(response.headers.get('Permissions-Policy') || '', /camera=\(\)/);
    assert.equal(response.headers.get('Cache-Control'), 'no-store');
});
