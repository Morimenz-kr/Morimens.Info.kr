import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { normalizeUsage, validateUsageCatalog, compactUsage, sampleCount } from '../js/character-usage-model.mjs';
import { normalizeClearIndex } from '../js/dzone-clear-model.mjs';

const root = path.resolve(import.meta.dirname, '..');
const read = async file => JSON.parse(await fs.readFile(file, 'utf8'));
export const digest = value => createHash('sha256').update(value).digest('hex');
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const endpoint = 'https://carriepigeon.khj613401.workers.dev';

export function verifyCollection(season, overview, audit, overviewBytes) {
    assert.equal(season.source, 'server-active-activity');
    assert.equal(overview.data.period, season.period);
    assert.equal(overview.data.since, season.usageSince);
    const stages = season.waves.flatMap(w => w.alerts.map(a => a.stageId));
    assert.equal(new Set(stages).size, 35);
    assert.deepEqual(overview.data.stages.map(s => s.stageTid).sort(), stages.sort());
    assert.equal(overview.data.recordCount, overview.data.stages.reduce((sum, s) => sum + s.recordCount, 0));
    assert.equal(audit.period, season.period);
    assert.equal(audit.snapshotSha256, digest(overviewBytes));
    assert.equal(audit.counts.records, overview.data.recordCount);
    assert.equal(audit.counts.stages, 35);
    assert.deepEqual(audit.issues, []);
}

// Validation projects allowlisted schemas again; raw review files are never uploaded.
export async function preparePublication(directory, { period, records, catalog, output }) {
    const manifest = await read(path.join(directory, 'publication.json'));
    assert.equal(manifest.schemaVersion, 1);
    assert.equal(manifest.period, period);
    assert.equal(manifest.records, records);
    assert.ok(records > 0 && manifest.collectedAt <= Date.now() / 1000 + 300);
    assert.ok(Array.isArray(manifest.characters) && manifest.characters.length > 0);
    assert.equal(new Set(manifest.characters).size, manifest.characters.length);
    await fs.mkdir(output, { recursive: true });
    const files = [], expected = [], counts = new Map();
    let batch = [], bytes = 0;
    const flush = async () => {
        if (!batch.length) return;
        const filename = path.join(output, `data-${files.length + 1}.json`);
        await fs.writeFile(filename, JSON.stringify(batch)); files.push(filename); batch = []; bytes = 0;
    };
    const append = async (key, value, url, characterId) => {
        const encoded = JSON.stringify(value);
        assert.ok(Buffer.byteLength(encoded) < 24_000_000, 'Snapshot exceeds receiver size limit');
        const row = { key, value: encoded }, length = Buffer.byteLength(JSON.stringify(row));
        if (bytes + length > 40_000_000) await flush();
        batch.push(row); bytes += length;
        expected.push({ url, key, characterId, hash: digest(encoded), collectedAt: manifest.collectedAt });
    };
    for (const id of manifest.characters) {
        assert.match(id, /^[A-Za-z0-9_-]{1,80}$/);
        const data = validateUsageCatalog(normalizeUsage((await read(path.join(directory, 'characters', id + '.json'))).data), catalog);
        assert.equal(data.characterId, id); assert.equal(data.period, period); assert.equal(data.collectedAt, manifest.collectedAt);
        const count = sampleCount(data.rows); assert.ok(count > 0); counts.set(id, count);
        await append(`dzone:character-usage:v1:${id}:${period}`, compactUsage(data), `/api/dzone/character/${id}/usage`, id);
    }
    const teams = normalizeClearIndex((await read(path.join(directory, 'teams.json'))).data, new Set(catalog.manifest.map(c => c.id)));
    assert.equal(teams.period, period); assert.equal(teams.collectedAt, manifest.collectedAt);
    const teamCounts = new Map(); let total = 0;
    for (const team of teams.teams) for (const bucket of team.buckets) {
        total += bucket.count;
        for (const id of team.members) teamCounts.set(id, (teamCounts.get(id) || 0) + bucket.count);
    }
    assert.equal(total, records); assert.deepEqual([...counts].sort(), [...teamCounts].sort(), 'Missing or mismatched character snapshot');
    await append(`dzone:clear-index:v1:${period}`, { data: teams }, `/api/dzone/clears?period=${period}`);
    await flush();
    return { period, records, expected, files, output };
}

export async function publishPublication(plan, { request = fetch, upload, wait = sleep, attempts = 19 } = {}) {
    const indexes = []; let unchanged = true;
    for (const item of plan.expected) {
        const url = endpoint + item.url + (item.characterId ? `?period=${plan.period}` : '');
        const r = await request(url, { signal: AbortSignal.timeout(60000) });
        assert.ok(r.status === 200 || r.status === 404, `Preflight HTTP ${r.status}`);
        const previous = await r.json();
        assert.ok(!previous.data || previous.data.collectedAt <= item.collectedAt, 'Newer snapshot already published');
        unchanged &&= r.status === 200 && digest(JSON.stringify(item.characterId ? previous.data : previous)) === item.hash;
        if (item.characterId) {
            const periods = [...new Set([...(previous.periods || []), plan.period])].sort((a, b) => b - a);
            indexes.push({ key: `dzone:character-usage:v1:${item.characterId}:index`, value: JSON.stringify({ periods }) });
        }
    }
    if (!unchanged) for (const file of plan.files) await upload(file);
    // Do not point default reads at a new season until every data batch has succeeded.
    const indexFile = path.join(plan.output, 'indexes.json');
    await fs.writeFile(indexFile, JSON.stringify(indexes));
    await upload(indexFile);
    for (const item of plan.expected) {
        let verified = false;
        for (let attempt = 0; attempt < attempts; attempt++) {
            try {
                const r = await request(endpoint + item.url, { signal: AbortSignal.timeout(60000) });
                assert.equal(r.status, 200); const result = await r.json();
                // A later published season must remain the default; explicitly verify this archive then.
                const latest = item.characterId ? Math.max(...(result.periods || [])) : plan.period;
                if (latest > plan.period) {
                    const archive = await request(endpoint + item.url + `?period=${plan.period}`);
                    assert.equal(archive.status, 200); const p = await archive.json();
                    assert.equal(digest(JSON.stringify(p.data)), item.hash);
                } else {
                    assert.equal(digest(JSON.stringify(item.characterId ? result.data : result)), item.hash);
                }
                verified = true; break;
            } catch (error) { if (attempt + 1 === attempts) throw error; await wait(10000); }
        }
        assert.ok(verified);
    }
    const report = { period: plan.period, records: plan.records, characters: indexes.length, verifiedAt: new Date().toISOString(), unchanged };
    await fs.writeFile(path.join(plan.output, 'verified.json'), JSON.stringify(report, null, 2));
    return report;
}

function run(command, args, cwd = root) {
    const result = spawnSync(command, args, { cwd, stdio: 'inherit', windowsHide: true });
    if (result.error) throw result.error;
    assert.equal(result.status, 0, 'Recommendation pipeline command failed');
}

async function main() {
    const args = process.argv.slice(2), option = name => args[args.indexOf(name) + 1];
    for (const flag of ['--archive', '--catalog', '--season', '--overview', '--audit']) assert.ok(args.includes(flag) && option(flag), `Missing ${flag}`);
    const season = await read(option('--season')), overviewBytes = await fs.readFile(option('--overview'));
    const overview = JSON.parse(overviewBytes), audit = await read(option('--audit'));
    verifyCollection(season, overview, audit, overviewBytes);
    if (overview.data.recordCount === 0) { console.log('No new-season records; retaining previous recommendations'); return; }
    run(process.execPath, ['tools/build-dzone-clear-snapshots.mjs', path.resolve(option('--archive')), path.resolve(option('--catalog')),
        String(season.period), '0', path.resolve(option('--season'))]);
    const [manifest, wheels, covenants] = await Promise.all(['character_manifest', 'wheel_list', 'covenant_list'].map(n => read(path.join(root, 'data', n + '.json'))));
    const output = path.join(root, '.generated', 'recommendations-publish', String(season.period));
    const plan = await preparePublication(path.join(root, '.generated/dzone-recommendations', String(season.period)), {
        period: season.period, records: overview.data.recordCount, catalog: { manifest, wheels, covenants }, output });
    if (args.includes('--dry-run')) { console.log(`Validated ${plan.expected.length - 1} character snapshots; no upload`); return; }
    const upload = async file => {
        // Only internally generated, shell-safe relative paths enter npx.cmd on Windows.
        const relative = path.relative(root, file).replaceAll('\\', '/'); assert.match(relative, /^\.generated\/[A-Za-z0-9_./-]+$/);
        const argv = ['--yes', 'wrangler@4.129.0', 'kv', 'bulk', 'put', relative, '--binding', 'RESOURCE_LINK_STATE', '--remote'];
        const result = spawnSync(process.platform === 'win32' ? 'npx.cmd' : 'npx', argv,
            { cwd: root, shell: process.platform === 'win32', windowsHide: true, stdio: 'inherit' });
        if (result.error) throw result.error; assert.equal(result.status, 0, 'Recommendation upload failed');
    };
    console.log(JSON.stringify(await publishPublication(plan, { upload })));
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await main();
