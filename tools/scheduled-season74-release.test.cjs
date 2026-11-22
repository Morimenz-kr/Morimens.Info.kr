const test = require('node:test');
const assert = require('node:assert/strict');
test('74기는 정확한 한국 시간 시작 경계와 일회성 실행 기간을 적용한다', async () => {
  const { releaseEnabled, RELEASE_AT, RELEASE_DEADLINE } = await import('./scheduled-season74-release.mjs');
  assert.equal(RELEASE_AT, Date.parse('2026-11-23T10:00:00+09:00'));
  assert.throws(() => releaseEnabled({ now: RELEASE_AT - 1 }));
  assert.equal(releaseEnabled({ now: RELEASE_AT - 1, scheduled: true }), false);
  assert.equal(releaseEnabled({ now: RELEASE_AT }), true);
  assert.equal(releaseEnabled({ now: RELEASE_DEADLINE - 1 }), true);
  assert.equal(releaseEnabled({ now: RELEASE_DEADLINE, scheduled: true }), false);
  assert.equal(releaseEnabled({ now: Date.parse('2027-11-23T01:00:00Z'), scheduled: true }), false);
  assert.throws(() => releaseEnabled({ now: NaN }));
  assert.equal(releaseEnabled({ now: RELEASE_AT - 1, dryRun: true }), true);
});
