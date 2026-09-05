const test = require('node:test');
const assert = require('node:assert/strict');

function snapshot() {
    return { data: { period: 68, since: 100, stages: Array.from({ length: 5 }, (_, i) => ['nightmare', 'madness'].map((difficulty, j) => ({
        wave: i + 1, difficulty, stageTid: 100 + i * 2 + j,
        recordCount: 1, usageRecordCount: 2, usageSince: 101,
        constraintBuckets: [{ hasOverlimit: false, hasFinalLaw: false, usedEmergencySpirit: false, count: 1 }],
        awakeners: [{ tid: 1, name: '각성체', count: 2, uid: 'private' }],
        parties: [{ count: 2, battleUuid: 'private', awakeners: [{ tid: 1, name: '각성체' }] }]
    }))).flat() } };
}

test('공개 필드만 보내고 편성·제한 표본 수를 독립적으로 보존한다', async () => {
    const { buildUsageRequests } = await import('./publish-dzone-usage.mjs');
    const requests = buildUsageRequests(snapshot());
    assert.equal(requests.length, 11);
    assert.equal(requests[0].body.recordCount, 2);
    assert.equal(requests[0].body.since, 101);
    assert.equal(requests.at(-1).body.stages[0].recordCount, 1);
    assert.equal(requests.at(-1).path, '/api/dzone/usage');
    assert.doesNotMatch(JSON.stringify(requests), /private|uid|battleUuid/);
    const invalid = snapshot();
    invalid.data.stages[0].constraintBuckets[0].count = 2;
    assert.throws(() => buildUsageRequests(invalid), /mismatch/);
});

test('스테이지 전송 실패 시 전체 집계를 게시하지 않는다', async () => {
    const { buildUsageRequests, publishUsage } = await import('./publish-dzone-usage.mjs');
    const calls = [];
    const fakeFetch = async (url, options) => {
        calls.push(url);
        assert.equal(options.redirect, 'error');
        return { ok: false, status: 401 };
    };
    await assert.rejects(publishUsage(buildUsageRequests(snapshot()), 'test-token', fakeFetch), /401/);
    assert.equal(calls.length, 1);
    await assert.rejects(publishUsage([], '', fakeFetch), /required/);
});
