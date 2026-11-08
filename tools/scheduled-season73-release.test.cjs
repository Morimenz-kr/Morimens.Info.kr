const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const api = import('./scheduled-season73-release.mjs');
test('한국 시간 오전 10시 이전에는 운영 배포를 허용하지 않고 드라이런만 허용한다', async () => {
  const { releaseEnabled, RELEASE_AT } = await api;
  assert.throws(() => releaseEnabled({ now: RELEASE_AT - 1 }), /10:00 KST/);
  assert.equal(releaseEnabled({ now: RELEASE_AT - 1, scheduled: true }), false);
  assert.equal(releaseEnabled({ now: RELEASE_AT - 1, dryRun: true }), true);
  assert.equal(releaseEnabled({ now: RELEASE_AT }), true);
});
test('예약은 지정한 하루만 유효하고 다음 해에 재배포하지 않는다', async () => {
  const { releaseEnabled, RELEASE_DEADLINE } = await api;
  assert.equal(releaseEnabled({ now: RELEASE_DEADLINE - 1 }), true);
  assert.equal(releaseEnabled({ now: RELEASE_DEADLINE, scheduled: true }), false);
  assert.equal(releaseEnabled({ now: Date.parse('2027-11-09T01:00:00Z'), scheduled: true }), false);
});
test('드라이런은 push·배포를 실행하지 않고 정상 배포는 Pages를 명시적으로 시작한다', () => {
  const yaml = fs.readFileSync('.github/workflows/season73-release.yml', 'utf8');
  assert.match(yaml, /cron: '0 1 9 11 \*'/);
  assert.equal((yaml.match(/if: steps\.gate\.outputs\.enabled == 'true' && env\.DRY_RUN != 'true'/g) || []).length, 3);
  assert.match(yaml, /git push origin HEAD:main/);
  assert.doesNotMatch(yaml, /--force/);
  assert.match(yaml, /gh workflow run pages\.yml --ref main/);
  assert.match(yaml, /gh run watch/);
});
