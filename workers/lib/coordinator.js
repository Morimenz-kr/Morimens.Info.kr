import { HttpError, coordinatorResponse } from './http.js';

const WORKFLOW_LOCK_TTL_SECONDS = 5 * 60;

const WORKFLOW_RECORD_TTL_SECONDS = 24 * 60 * 60;

export class WorkflowCoordinator {
    constructor(ctx) {
        this.ctx = ctx;
    }

    async fetch(request) {
        if (request.method !== 'POST') {
            return coordinatorResponse({ error: 'method not allowed' }, 405);
        }

        let payload;
        try {
            payload = await request.json();
        } catch {
            return coordinatorResponse({ error: 'invalid JSON' }, 400);
        }

        const owner = String(payload?.owner || '');
        if (!/^[A-Za-z0-9-]{8,128}$/.test(owner)) {
            return coordinatorResponse({ error: 'invalid owner' }, 400);
        }

        const path = new URL(request.url).pathname;
        if (path === '/acquire') return this.acquire(owner);
        if (path === '/record') return this.record(owner, payload.record);
        if (path === '/release') return this.release(owner);
        return coordinatorResponse({ error: 'not found' }, 404);
    }

    async acquire(owner) {
        const now = Date.now();
        let result;
        let nextState;
        await this.ctx.storage.transaction(async transaction => {
            const state = { ...(await transaction.get('workflow') || {}) };
            if (state.recordExpiresAt <= now) {
                delete state.record;
                delete state.recordExpiresAt;
            }
            if (state.lock?.expiresAt > now && state.lock.owner !== owner) {
                result = { acquired: false };
                nextState = state;
                return;
            }

            nextState = {
                ...state,
                lock: {
                    owner,
                    acquiredAt: new Date(now).toISOString(),
                    expiresAt: now + WORKFLOW_LOCK_TTL_SECONDS * 1000
                }
            };
            await transaction.put('workflow', nextState);
            result = { acquired: true, record: nextState.record || null };
        });
        await this.scheduleAlarm(nextState);
        return coordinatorResponse(result, 200);
    }

    async record(owner, record) {
        if (!record || typeof record !== 'object' || Array.isArray(record)) {
            return coordinatorResponse({ error: 'invalid record' }, 400);
        }

        const now = Date.now();
        let updated = false;
        let nextState;
        await this.ctx.storage.transaction(async transaction => {
            const state = await transaction.get('workflow');
            if (!state?.lock || state.lock.owner !== owner || state.lock.expiresAt <= now) return;
            nextState = {
                ...state,
                lock: {
                    ...state.lock,
                    expiresAt: now + WORKFLOW_LOCK_TTL_SECONDS * 1000
                },
                record: { ...record, updatedAt: new Date(now).toISOString() },
                recordExpiresAt: now + WORKFLOW_RECORD_TTL_SECONDS * 1000
            };
            await transaction.put('workflow', nextState);
            updated = true;
        });
        if (!updated) return coordinatorResponse({ error: 'lock ownership lost' }, 409);
        await this.scheduleAlarm(nextState);
        return coordinatorResponse({ ok: true }, 200);
    }

    async release(owner) {
        const now = Date.now();
        let released = false;
        let nextState;
        await this.ctx.storage.transaction(async transaction => {
            const state = await transaction.get('workflow');
            if (!state?.lock || state.lock.owner !== owner) return;
            nextState = { ...state };
            delete nextState.lock;
            if (nextState.record) {
                nextState.recordExpiresAt = now + WORKFLOW_RECORD_TTL_SECONDS * 1000;
                await transaction.put('workflow', nextState);
            } else {
                await transaction.delete('workflow');
                nextState = null;
            }
            released = true;
        });
        if (!released) return coordinatorResponse({ error: 'lock ownership lost' }, 409);
        await this.scheduleAlarm(nextState);
        return coordinatorResponse({ ok: true }, 200);
    }

    async alarm() {
        const now = Date.now();
        let nextState;
        await this.ctx.storage.transaction(async transaction => {
            const state = { ...(await transaction.get('workflow') || {}) };
            if (state.lock?.expiresAt <= now) delete state.lock;
            if (state.recordExpiresAt <= now) {
                delete state.record;
                delete state.recordExpiresAt;
            }

            if (!state.lock && !state.record) {
                await transaction.delete('workflow');
                nextState = null;
                return;
            }
            await transaction.put('workflow', state);
            nextState = state;
        });
        await this.scheduleAlarm(nextState);
    }

    async scheduleAlarm(state) {
        if (!state) return;
        const deadlines = [state.lock?.expiresAt, state.recordExpiresAt]
            .filter(value => Number.isFinite(value));
        if (deadlines.length > 0) {
            await this.ctx.storage.setAlarm(Math.min(...deadlines));
        }
    }
}

async function withSubmissionCoordinator(env, key, task) {
    const owner = crypto.randomUUID();
    const lock = await acquireWorkflowLock(env, key, owner);
    if (!lock.acquired) {
        throw new HttpError('An identical submission is already being processed', 409, {
            expose: true,
            code: 'submission_in_progress',
            headers: { 'Retry-After': '60' }
        });
    }

    let shouldRelease = false;
    try {
        const putRecord = record => putWorkflowRecord(env, key, owner, record);
        const result = await task(lock.record, putRecord);
        shouldRelease = true;
        return result;
    } catch (error) {
        shouldRelease = Boolean(error?.releaseWorkflowLock);
        throw error;
    } finally {
        if (shouldRelease) {
            try {
                await releaseWorkflowLock(env, key, owner);
            } catch (error) {
                // A failed release intentionally leaves the coordinator locked and fails closed.
                console.error('Workflow lock release failed; coordinator remains fail-closed', error);
            }
        }
    }
}

async function acquireWorkflowLock(env, key, owner) {
    return callWorkflowCoordinator(env, key, '/acquire', { owner });
}

async function putWorkflowRecord(env, key, owner, record) {
    await callWorkflowCoordinator(env, key, '/record', { owner, record });
}

async function releaseWorkflowLock(env, key, owner) {
    await callWorkflowCoordinator(env, key, '/release', { owner });
}

async function callWorkflowCoordinator(env, key, path, payload) {
    const namespace = env.WORKFLOW_COORDINATOR;
    if (!namespace?.idFromName || !namespace?.get) {
        throw new HttpError('Submission coordination is unavailable', 503, {
            expose: true,
            code: 'workflow_coordinator_unavailable'
        });
    }

    try {
        const id = namespace.idFromName(key);
        const stub = namespace.get(id);
        const response = await stub.fetch(`https://workflow-coordinator.internal${path}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const body = await response.json().catch(() => null);
        if (!response.ok) {
            throw new HttpError('Submission coordination is unavailable', 503, {
                expose: true,
                code: 'workflow_coordinator_unavailable'
            });
        }
        return body;
    } catch (error) {
        if (error instanceof HttpError) throw error;
        console.error('Workflow coordinator request failed', error);
        throw new HttpError('Submission coordination is unavailable', 503, {
            expose: true,
            code: 'workflow_coordinator_unavailable'
        });
    }
}

export { acquireWorkflowLock, releaseWorkflowLock, withSubmissionCoordinator };
