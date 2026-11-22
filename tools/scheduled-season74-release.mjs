import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';

export const RELEASE_AT = Date.parse('2026-11-23T01:00:00Z');
export const RELEASE_DEADLINE = Date.parse('2026-11-24T01:00:00Z');
export function releaseEnabled({ now = Date.now(), dryRun = false, scheduled = false } = {}) {
  if (dryRun) return true;
  if (Number.isFinite(now) && now >= RELEASE_AT && now < RELEASE_DEADLINE) return true;
  if (scheduled) return false;
  throw new Error('74기 운영 반영은 2026-11-23 10:00 KST부터 24시간 동안만 허용합니다.');
}
export function verifyReleaseData(current, maps, archive73, archive74, season, catalog) {
  assert.equal(current.period, 74);
  assert.equal(maps.period, 74);
  assert.equal(archive73.period, 73);
  assert.deepEqual(current, archive74);
  assert.equal(season.CURRENT_SEASON, 74);
  assert.equal(season.selectSeason().period, 74);
  assert.equal(season.selectSeason(73).path, 'data/dzone_season73.json');
  assert.equal(season.availableSeasons().filter(row => row.current).length, 1);
  assert.equal(current.source.resourceVersion, 23);
  assert.equal(current.waves.length, 5);
  assert.equal(maps.waves.length, 5);
  assert.deepEqual(current.contentAudit.diagnostics, []);
  assert.deepEqual(current.contentAudit.presentationAudit.issues, []);
  assert.equal(current.contentAudit.glossaryCount, 290);
  assert.equal(current.contentAudit.presentationAudit.counts.tooltipReferences, 269);
  const schedule = catalog.seasons.find(row => row.period === 74);
  assert.equal(schedule.usageSince * 1000, RELEASE_AT);
  for (const wave of current.waves) {
    assert.deepEqual(wave.alerts.map(row => row.alert), [1,2,3,4,5,6,7]);
    assert.deepEqual(wave.alerts.map(row => row.stageId), schedule.waves.find(row => row.wave === wave.wave).alerts.map(row => row.stageId));
  }
}
async function verifyLive() {
  const base = 'https://morimenz-kr.github.io/Morimens.Info.kr/';
  for (let attempt = 0; attempt < 24; attempt++) {
    try {
      const files = ['data/dzone_current.json', 'data/dzone_maps.json', 'data/dzone_season73.json', 'data/dzone_season74.json', 'js/dzone-season.js'];
      const [current, maps, archive73, archive74, source] = await Promise.all(files.map(async file => {
        const response = await fetch(`${base}${file}?release74=${Date.now()}`, { signal: AbortSignal.timeout(20000) });
        assert.equal(response.status, 200, file);
        return file.endsWith('.json') ? response.json() : response.text();
      }));
      assert.equal(current.period, 74); assert.equal(maps.period, 74); assert.equal(archive73.period, 73);
      assert.deepEqual(current, archive74);
      assert.equal(current.contentAudit.presentationAudit.counts.tooltipReferences, 269);
      assert.match(source, /BUILT_SEASON\s*=\s*74\s*;/);
      console.log(`${base}dzone_info.html`);
      return;
    } catch (error) {
      if (attempt === 23) throw error;
      await new Promise(resolve => setTimeout(resolve, 10000));
    }
  }
}
async function main() {
  const mode = process.argv[2];
  if (mode === 'gate') {
    const dryRun = process.env.DRY_RUN === 'true';
    let enabled = releaseEnabled({ dryRun, scheduled: process.env.GITHUB_EVENT_NAME === 'schedule' });
    if (enabled && !dryRun) {
      const current = JSON.parse(await fs.readFile('data/dzone_current.json', 'utf8'));
      if (current.period === 74) try {
        const base = 'https://morimenz-kr.github.io/Morimens.Info.kr/data/';
        const [live, maps] = await Promise.all(['dzone_current.json', 'dzone_maps.json'].map(async file => {
          const response = await fetch(`${base}${file}?release74=${Date.now()}`, { signal: AbortSignal.timeout(15000) });
          assert.equal(response.status, 200);
          return response.json();
        }));
        assert.deepEqual(live, current);
        assert.equal(maps.period, 74);
        enabled = false;
      } catch { /* An incomplete deployment may be retried within the release window. */ }
    }
    console.log(`enabled=${enabled}`);
  }
  else if (mode === 'assert-window') { releaseEnabled(); console.log('Season 74 release window is open'); }
  else if (mode === 'verify') {
    const read = async name => JSON.parse(await fs.readFile(`data/${name}.json`, 'utf8'));
    verifyReleaseData(await read('dzone_current'), await read('dzone_maps'), await read('dzone_season73'), await read('dzone_season74'), createRequire(import.meta.url)('../js/dzone-season.js'), await read('dzone_season_catalog'));
    console.log('Verified season 74 production candidate');
  } else if (mode === 'live') await verifyLive();
  else if (mode === 'dom') {
    const dom = await fs.readFile(process.argv[3], 'utf8');
    assert.match(dom, /id="dzone-content"[^>]*data-season="74"/);
    assert.match(dom, /74기 \(현재\)/);
    assert.doesNotMatch(dom, /74기 \(미리보기\)/);
    console.log('Production browser renders season 74 as current');
  } else throw new Error('Expected gate, assert-window, verify, live or dom');
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await main();
