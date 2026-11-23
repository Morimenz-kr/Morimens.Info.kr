const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');

async function fixture(t, period = 75) {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'recommendations-'));
    t.after(() => fs.rm(dir, { recursive: true, force: true }));
    const ids = ['xu', 'lotan', 'lily', 'tulu'];
    const meta = { schemaVersion: 1, period, collectedAt: 1700000000, coverage: 'sample', source: 'test' };
    const members = ids.map(characterId => ({ characterId, enlightenment: 0, borrowed: false, wheels: null, covenant: null }));
    await fs.mkdir(path.join(dir, 'characters'));
    for (const characterId of ids) await fs.writeFile(path.join(dir, 'characters', characterId + '.json'), JSON.stringify({ data: {
        ...meta, characterId, uid: 'secret', rows: [{ wave: 1, difficulty: '4', count: 3, members }] } }));
    await fs.writeFile(path.join(dir, 'teams.json'), JSON.stringify({ data: { ...meta, uid: 'secret', teams: [
        { members: ids, buckets: [{ wave: 1, difficulty: '4', count: 3, gearCount: 0 }] }
    ] } }));
    await fs.writeFile(path.join(dir, 'publication.json'), JSON.stringify({ ...meta, records: 3, characters: ids }));
    const { preparePublication } = await import('./publish-dzone-recommendations.mjs');
    const options = { period, records: 3, catalog: { manifest: ids.map(id => ({ id })), wheels: [], covenants: [] }, output: path.join(dir, 'out') };
    return { dir, ids, options, plan: await preparePublication(dir, options), preparePublication };
}

function receiver({ failUpload = false, newer = false, staleReads = 0 } = {}) {
    const values = new Map(), uploaded = []; let reads = 0;
    return { uploaded, values,
        upload: async file => {
            uploaded.push(path.basename(file)); if (failUpload) throw new Error('Upload failed');
            for (const item of JSON.parse(await fs.readFile(file))) values.set(item.key, item.value);
        },
        request: async url => {
            const u = new URL(url), id = u.pathname.match(/character\/([^/]+)/)?.[1];
            const period = u.searchParams.get('period');
            if (newer) return Response.json({ data: { collectedAt: 1800000000 }, periods: [75] });
            const periods = id ? JSON.parse(values.get(`dzone:character-usage:v1:${id}:index`) || '{"periods":[73]}').periods : [];
            const key = id ? `dzone:character-usage:v1:${id}:${period || periods[0]}` : `dzone:clear-index:v1:${period}`;
            const data = values.get(key);
            if (!data || (!period && reads++ < staleReads)) return Response.json({ periods }, { status: 404 });
            return Response.json(id ? { data: JSON.parse(data), periods } : JSON.parse(data));
        }
    };
}

test('future season publication validates all characters, strips private fields, activates last and verifies defaults', async t => {
    const { plan } = await fixture(t);
    const { publishPublication } = await import('./publish-dzone-recommendations.mjs');
    const remote = receiver({ staleReads: 1 }); let waits = 0;
    const report = await publishPublication(plan, { ...remote, wait: async () => waits++ });
    assert.equal(report.period, 75); assert.equal(report.characters, 4); assert.equal(waits, 1);
    assert.equal(remote.uploaded.at(-1), 'indexes.json');
    assert.ok([...remote.values.values()].every(value => !value.includes('secret')));
    assert.deepEqual(JSON.parse(remote.values.get('dzone:character-usage:v1:xu:index')).periods, [75, 73]);
    remote.uploaded.length = 0;
    assert.equal((await publishPublication(plan, remote)).unchanged, true);
    assert.deepEqual(remote.uploaded, ['indexes.json']);
});

test('missing character or inconsistent counts stop before publication', async t => {
    const f = await fixture(t);
    await fs.unlink(path.join(f.dir, 'characters/xu.json'));
    await assert.rejects(f.preparePublication(f.dir, f.options), /ENOENT/);
    const g = await fixture(t); g.options.records = 4;
    await assert.rejects(g.preparePublication(g.dir, g.options));
});

test('failed batch never activates the new season and newer data is never overwritten', async t => {
    const { plan } = await fixture(t);
    const { publishPublication } = await import('./publish-dzone-recommendations.mjs');
    const failed = receiver({ failUpload: true });
    await assert.rejects(publishPublication(plan, failed), /Upload failed/);
    assert.ok(!failed.uploaded.includes('indexes.json'));
    const newer = receiver({ newer: true });
    await assert.rejects(publishPublication(plan, newer), /Newer snapshot/);
    assert.deepEqual(newer.uploaded, []);
});

test('failed production readback is a failure, not a published success', async t => {
    const { plan } = await fixture(t);
    const { publishPublication } = await import('./publish-dzone-recommendations.mjs');
    const remote = receiver({ staleReads: 100 });
    await assert.rejects(publishPublication(plan, { ...remote, attempts: 2, wait: async () => {} }));
    await assert.rejects(fs.stat(path.join(plan.output, 'verified.json')), /ENOENT/);
});

test('publishing an archive preserves a later available default season', async t => {
    const { plan } = await fixture(t);
    const { publishPublication } = await import('./publish-dzone-recommendations.mjs');
    const remote = receiver();
    for (const id of ['xu', 'lotan', 'lily', 'tulu']) {
        remote.values.set(`dzone:character-usage:v1:${id}:index`, JSON.stringify({ periods: [76, 73] }));
        remote.values.set(`dzone:character-usage:v1:${id}:76`, JSON.stringify({ period: 76 }));
    }
    await publishPublication(plan, remote);
    assert.deepEqual(JSON.parse(remote.values.get('dzone:character-usage:v1:xu:index')).periods, [76, 75, 73]);
    assert.equal(JSON.parse(remote.values.get('dzone:character-usage:v1:xu:76')).period, 76);
});

test('collection gate binds stage coverage, period, counts and audit digest', async () => {
    const { verifyCollection, digest } = await import('./publish-dzone-recommendations.mjs');
    const season = { source: 'server-active-activity', period: 76, usageSince: 1700000000,
        waves: Array.from({ length: 5 }, (_, w) => ({ alerts: Array.from({ length: 7 }, (_, a) => ({ stageId: w * 7 + a + 1 })) })) };
    const overview = { data: { period: 76, since: season.usageSince, recordCount: 35,
        stages: Array.from({ length: 35 }, (_, i) => ({ stageTid: i + 1, recordCount: 1 })) } };
    const bytes = JSON.stringify(overview), audit = { period: 76, snapshotSha256: digest(bytes), counts: { records: 35, stages: 35 }, issues: [] };
    verifyCollection(season, overview, audit, bytes);
    assert.throws(() => verifyCollection({ ...season, period: 75 }, overview, audit, bytes));
    assert.throws(() => verifyCollection(season, overview, { ...audit, snapshotSha256: 'wrong' }, bytes));
    overview.data.stages[0].stageTid = 2;
    assert.throws(() => verifyCollection(season, overview, audit, bytes));
});

test('empty future season retains existing recommendations without reading archives or publishing', async t => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'empty-recommendations-'));
    t.after(() => fs.rm(dir, { recursive: true, force: true }));
    const { digest } = await import('./publish-dzone-recommendations.mjs');
    const season = { source: 'server-active-activity', period: 77, usageSince: 1700000000,
        waves: Array.from({ length: 5 }, (_, w) => ({ alerts: Array.from({ length: 7 }, (_, a) => ({ stageId: w * 7 + a + 1 })) })) };
    const overview = { data: { period: 77, since: season.usageSince, recordCount: 0,
        stages: Array.from({ length: 35 }, (_, i) => ({ stageTid: i + 1, recordCount: 0 })) } };
    const bytes = JSON.stringify(overview);
    for (const [name, data] of Object.entries({ season, overview, audit: {
        period: 77, snapshotSha256: digest(bytes), counts: { records: 0, stages: 35 }, issues: []
    } })) await fs.writeFile(path.join(dir, name + '.json'), JSON.stringify(data));
    const { spawnSync } = require('node:child_process');
    const result = spawnSync(process.execPath, [path.join(__dirname, 'publish-dzone-recommendations.mjs'),
        '--archive', path.join(dir, 'does-not-exist'), '--catalog', path.join(dir, 'does-not-exist'),
        '--season', path.join(dir, 'season.json'), '--overview', path.join(dir, 'overview.json'),
        '--audit', path.join(dir, 'audit.json')], { encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /retaining previous recommendations/);
});
