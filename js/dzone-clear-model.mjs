const grades = new Set(['1', '2', '3', '4', '5', '6', '7', 'normal', 'hard', 'nightmare', 'madness']);
const idPattern = /^[A-Za-z0-9_-]{1,80}$/;

const validInt = (value, min, max) => Number.isSafeInteger(value) && value >= min && value <= max;

export function normalizeClearIndex(input, characterIds) {
    if (input?.schemaVersion !== 1 || !validInt(input.period, 1, 9999)
        || !validInt(input.collectedAt, 1, 9999999999) || !['sample', 'complete'].includes(input.coverage)
        || typeof input.source !== 'string' || !input.source.trim() || input.source.length > 100
        || !Array.isArray(input.teams) || input.teams.length > 100000) throw new Error('Invalid clear index');
    const seenTeams = new Set();
    const teams = input.teams.map(team => {
        if (!Array.isArray(team.members) || team.members.length !== 4 || new Set(team.members).size !== 4
            || team.members.some(id => typeof id !== 'string' || !idPattern.test(id) || (characterIds && !characterIds.has(id)))
            || !Array.isArray(team.buckets) || !team.buckets.length || team.buckets.length > 55) throw new Error('Invalid clear team');
        const members = [...team.members].sort(), key = members.join('|');
        if (seenTeams.has(key)) throw new Error('Duplicate clear team');
        seenTeams.add(key);
        const seenBuckets = new Set();
        const buckets = team.buckets.map(({ wave, difficulty, count, gearCount }) => {
            const key = wave + ':' + difficulty;
            if (!validInt(wave, 1, 5) || !grades.has(difficulty) || !validInt(count, 1, 1e7)
                || !validInt(gearCount, 0, count) || seenBuckets.has(key)) throw new Error('Invalid clear bucket');
            seenBuckets.add(key);
            return { wave, difficulty, count, gearCount };
        });
        return { members, buckets };
    });
    return { schemaVersion: 1, period: input.period, collectedAt: input.collectedAt, coverage: input.coverage, source: input.source.trim(), teams };
}

export function findClearTeams(data, { include = [], exclude = [], wave = '', difficulty = '', owned = null } = {}) {
    const results = [];
    let total = 0;
    for (const team of data.teams) {
        if (!include.every(id => team.members.includes(id)) || exclude.some(id => team.members.includes(id))) continue;
        if (owned !== null && !team.members.every(id => owned.has(id))) continue;
        const buckets = team.buckets.filter(bucket => (!wave || String(bucket.wave) === String(wave))
            && (!difficulty || bucket.difficulty === difficulty));
        if (!buckets.length) continue;
        const count = buckets.reduce((sum, bucket) => sum + bucket.count, 0);
        const gearCount = buckets.reduce((sum, bucket) => sum + bucket.gearCount, 0);
        total += count;
        results.push({ key: team.members.join('|'), members: team.members, count, gearCount, buckets });
    }
    results.sort((a, b) => b.count - a.count || a.key.localeCompare(b.key));
    return { total, teams: results };
}

export function findClearAlternatives(data, base, filters = {}) {
    const stages = new Set(base.buckets.map(b => `${b.wave}:${b.difficulty}`));
    return findClearTeams(data, filters).teams.flatMap(team => {
        const added = team.members.filter(id => !base.members.includes(id));
        const removed = base.members.filter(id => !team.members.includes(id));
        if (added.length !== 1 || removed.length !== 1) return [];
        const buckets = team.buckets.filter(b => stages.has(`${b.wave}:${b.difficulty}`));
        if (!buckets.length) return [];
        return [{ ...team, added: added[0], removed: removed[0], buckets,
            count: buckets.reduce((sum, b) => sum + b.count, 0),
            gearCount: buckets.reduce((sum, b) => sum + b.gearCount, 0) }];
    }).sort((a, b) => b.count - a.count || a.key.localeCompare(b.key));
}

// Input is one validated Awakener snapshot, never several overlapping perspectives.
export function indexUsageTeams(rows) {
    const teams = new Map();
    for (const row of rows) {
        if (row.members.length !== 4) continue;
        const members = row.members.map(m => m.characterId).sort(), key = members.join('|');
        let team = teams.get(key);
        if (!team) { team = { members, buckets: new Map() }; teams.set(key, team); }
        const stage = `${row.wave}:${row.difficulty}`, bucket = team.buckets.get(stage) || { wave: row.wave, difficulty: row.difficulty, count: 0, gearCount: 0 };
        bucket.count += row.count;
        if (row.members.every(m => m.wheels !== null && m.covenant !== null)) bucket.gearCount += row.count;
        team.buckets.set(stage, bucket);
    }
    return { teams: [...teams.values()].map(team => ({ members: team.members, buckets: [...team.buckets.values()] })) };
}

export function clearSettingsHref(team, period, { wave = '', difficulty = '' } = {}) {
    const query = new URLSearchParams({ category: 'character', id: team.members[0], period, team: team.key, usageView: 'records', recordScope: 'all' });
    if (wave) query.set('wave', wave);
    if (difficulty) query.set('difficulty', difficulty);
    return 'links.html?' + query + '#usage';
}
