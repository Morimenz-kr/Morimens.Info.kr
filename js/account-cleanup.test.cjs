const { test } = require('node:test');
const assert = require('node:assert/strict');
test('cleanup defaults to dry-run and never interprets Auth errors as deleted users', async () => {
    const { cleanupAccounts } = await import('../tools/account-cleanup.mjs');
    const record = { id: 'user', ref: {} }, query = { where() { return this; }, limit() { return this; }, async get() { return { size: 1, docs: [record] }; } };
    let transactions = 0; const db = { collection: () => query, runTransaction: async () => transactions++ }, cutoff = new Date(Date.now() - 48 * 3600000);
    const gone = { getUser: async () => { throw { code: 'auth/user-not-found' }; } };
    assert.deepEqual(await cleanupAccounts({ db, auth: gone, cutoff }), { checked: 1, eligible: 1, deleted: 0, retainedAuthUsers: 0, apply: false });
    assert.equal(transactions, 0);
    assert.equal((await cleanupAccounts({ db, auth: { getUser: async () => ({ uid: 'user' }) }, cutoff, apply: true })).retainedAuthUsers, 1);
    assert.equal(transactions, 0);
    await assert.rejects(cleanupAccounts({ db, auth: { getUser: async () => { throw { code: 'auth/insufficient-permission' }; } }, cutoff, apply: true }), /중단/);
    await assert.rejects(cleanupAccounts({ db, auth: gone, cutoff: new Date(), apply: true }), /24시간/);
});
