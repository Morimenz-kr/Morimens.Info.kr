import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';

export const RELEASE_AT = Date.parse('2026-11-09T01:00:00Z');
export const RELEASE_DEADLINE = Date.parse('2026-11-10T01:00:00Z');
export function releaseEnabled({ now = Date.now(), dryRun = false, scheduled = false } = {}) {
  if (dryRun) return true;
  if (now >= RELEASE_AT && now < RELEASE_DEADLINE) return true;
  if (scheduled) return false;
  throw new Error('Season 73 production release is allowed only after 2026-11-09 10:00 KST within its one-day release window');
}

export function verifyReleaseData(current, maps, archive, season) {
  assert.equal(current.period, 73);
  assert.equal(maps.period, 73);
  assert.equal(archive.period, 72);
  assert.equal(season.CURRENT_SEASON, 73);
  assert.equal(season.selectSeason().period, 73);
  assert.equal(season.availableSeasons().filter(s => s.current).length, 1);
  assert.equal(current.waves.length, 5);
  assert.equal(maps.waves.length, 5);
  for (const wave of current.waves) assert.deepEqual(wave.alerts.map(a => a.alert), [1, 2, 3, 4, 5, 6, 7]);
  const boss = current.waves.flatMap(w => w.monsters).find(m => m.tid === 44480);
  assert.ok(boss);
  assert.deepEqual(boss.intentionCycles.map(c => [...new Set(c.transitions.map(t => t.skillId))]), [[44766, 44765, 44767], [44788, 44787, 44786]]);
  assert.deepEqual(current.contentAudit.diagnostics, []);
  assert.deepEqual(current.contentAudit.presentationAudit.issues, []);
}

async function verifyLive() {
  const root = 'https://morimenz-kr.github.io/Morimens.Info.kr/';
  for (let attempt = 0; attempt < 30; attempt++) {
    try {
      const stamp = Date.now();
      const [data, maps, js] = await Promise.all(['data/dzone_current.json', 'data/dzone_maps.json', 'js/dzone-season.js'].map(async file => {
        const response = await fetch(`${root}${file}?release73=${stamp}`, { signal: AbortSignal.timeout(30000) });
        assert.equal(response.status, 200, file);
        return file.endsWith('.json') ? response.json() : response.text();
      }));
      assert.match(js, /CURRENT_SEASON\s*=\s*73\s*;/);
      assert.equal(data.period, 73); assert.equal(maps.period, 73);
      assert.equal(data.waves.length, 5);
      const boss = data.waves.flatMap(w => w.monsters).find(m => m.tid === 44480);
      assert.equal(boss.intentionCycles.length, 2);
      console.log(`${root}dzone_info.html#season-73-wave-3-alert-1`);
      return;
    } catch (error) {
      if (attempt === 29) throw error;
      await new Promise(resolve => setTimeout(resolve, 10000));
    }
  }
}

async function main() {
  const mode = process.argv[2];
  if (mode === 'gate') {
    console.log(`enabled=${releaseEnabled({ dryRun: process.env.DRY_RUN === 'true', scheduled: process.env.GITHUB_EVENT_NAME === 'schedule' })}`);
  } else if (mode === 'verify') {
    const read = async name => JSON.parse(await fs.readFile(`data/${name}.json`, 'utf8'));
    verifyReleaseData(await read('dzone_current'), await read('dzone_maps'), await read('dzone_season72'), createRequire(import.meta.url)('../js/dzone-season.js'));
    console.log('Season 73 production candidate verified');
  } else if (mode === 'live') await verifyLive();
  else if (mode === 'dom') {
    const dom = await fs.readFile(process.argv[3], 'utf8');
    assert.match(dom, /id="dzone-content"[^>]*data-season="73"/);
    assert.match(dom, /73기 \(현재\)/);
    assert.doesNotMatch(dom, /73기 \(미리보기\)/);
    console.log('Production browser renders season 73 as current');
  } else throw new Error('Expected gate, verify, live or dom');
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await main();
