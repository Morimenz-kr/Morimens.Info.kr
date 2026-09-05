import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

const ENDPOINT = 'https://carriepigeon.khj613401.workers.dev';
const character = item => ({ tid: item.tid, name: item.name, image_thumb: item.image_thumb });

// Send only public aggregates. Replay identifiers and collector metadata never leave the machine.
export function buildUsageRequests(payload) {
    const data = payload?.data;
    if (!data || ![10, 20].includes(data.stages?.length)) throw new Error('Expected 10 or 20 stages');
    const difficulties = data.stages.length === 10 ? ['nightmare', 'madness'] : ['normal', 'hard', 'nightmare', 'madness'];
    const pairs = new Set(data.stages.map(stage => `${stage.wave}:${stage.difficulty}`));
    if (new Set(data.stages.map(stage => stage.stageTid)).size !== data.stages.length
        || !Array.from({ length: 5 }, (_, index) => index + 1).every(wave => difficulties.every(difficulty => pairs.has(`${wave}:${difficulty}`)))) {
        throw new Error('Incomplete or duplicate stage scope');
    }
    const overviewStages = data.stages.map(stage => {
        if (!Array.isArray(stage.constraintBuckets) || stage.constraintBuckets.reduce((sum, bucket) => sum + bucket.count, 0) !== stage.recordCount) {
            throw new Error(`Constraint count mismatch: ${stage.stageTid}`);
        }
        return {
            wave: stage.wave, difficulty: stage.difficulty, stageTid: stage.stageTid, recordCount: stage.recordCount,
            constraintBuckets: stage.constraintBuckets.map(bucket => ({
                hasOverlimit: bucket.hasOverlimit, hasFinalLaw: bucket.hasFinalLaw,
                usedEmergencySpirit: bucket.usedEmergencySpirit, count: bucket.count
            }))
        };
    });
    const requests = data.stages.map(stage => {
        if (!Array.isArray(stage.awakeners) || !Array.isArray(stage.parties)) throw new Error(`Missing usage: ${stage.stageTid}`);
        return {
            path: `/api/dzone/stage/${stage.stageTid}/usage`,
            body: {
                stageTid: stage.stageTid, since: stage.usageSince ?? data.since,
                recordCount: stage.usageRecordCount ?? stage.recordCount,
                awakeners: stage.awakeners.map(item => ({ ...character(item), count: item.count })),
                parties: stage.parties.map(item => ({ count: item.count, awakeners: item.awakeners.map(character) }))
            }
        };
    });
    // Constraint and usage snapshots can have different sample sizes; never mix their denominators.
    requests.push({ path: '/api/dzone/usage', body: { period: data.period, since: data.since, stages: overviewStages } });
    return requests;
}

export async function publishUsage(requests, token, fetchImpl = fetch) {
    if (!token) throw new Error('DZONE_INGEST_TOKEN is required');
    for (const request of requests) {
        const response = await fetchImpl(`${ENDPOINT}${request.path}`, {
            method: 'POST', redirect: 'error', signal: AbortSignal.timeout(30000),
            headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify(request.body)
        });
        if (!response.ok) throw new Error(`Upload failed (${response.status}): ${request.path}`);
        const result = await response.json();
        if (result.ok !== true) throw new Error(`Upload not acknowledged: ${request.path}`);
    }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
    try {
        const file = process.argv.slice(2).find(arg => !arg.startsWith('--')) || 'private-tools/output/dzone-usage-overview.json';
        const requests = buildUsageRequests(JSON.parse(await readFile(file, 'utf8')));
        if (!process.argv.includes('--dry-run')) await publishUsage(requests, process.env.DZONE_INGEST_TOKEN);
        console.log(JSON.stringify({ dryRun: process.argv.includes('--dry-run'), stages: requests.length - 1, constraintRecords: requests.at(-1).body.stages.reduce((sum, stage) => sum + stage.recordCount, 0) }));
    } catch (error) {
        console.error(error.message);
        process.exitCode = 1;
    }
}
