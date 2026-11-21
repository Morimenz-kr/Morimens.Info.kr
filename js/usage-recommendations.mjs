import { distribution, targetMember, wheelKey, covenantKey, teamKey } from './character-usage-model.mjs';
import { gearKnown } from './usage-plan.mjs';

const stage = row => `${row.wave}:${row.difficulty}`;
const grade = value => ({ normal: 1, hard: 2, nightmare: 3, madness: 4 }[value] || Number(value));

// Rank complete, observed lineups first. Equipment is selected only inside that lineup.
export function recommendParties(rows, characterId, { limit = 3, minCount = 3 } = {}) {
    const groups = distribution(rows.filter(row => row.members.length === 4 && targetMember(row, characterId)), teamKey);
    const candidates = groups.map(group => {
        const builds = distribution(group.rows, row => {
            const member = targetMember(row, characterId), wheels = wheelKey(member), covenant = covenantKey(member);
            return wheels && covenant ? JSON.stringify([wheels, covenant]) : '';
        });
        if (!builds.length) return null;
        const build = builds[0];
        const example = [...build.rows].sort((a, b) => Number(gearKnown(b)) - Number(gearKnown(a))
            || grade(b.difficulty) - grade(a.difficulty)
            || (targetMember(b, characterId).covenant.completion ?? -1) - (targetMember(a, characterId).covenant.completion ?? -1)
            || b.count - a.count || a.wave - b.wave)[0];
        return { ...group, build, equipmentCount: builds.reduce((sum, item) => sum + item.count, 0), example, member: targetMember(example, characterId), sparse: group.count < minCount };
    }).filter(Boolean);
    const supported = candidates.filter(group => !group.sparse);
    const pool = supported.length ? supported : candidates;
    const parties = [];
    for (const group of pool) {
        const similar = parties.some(other => {
            const overlap = group.key.split('|').filter(id => other.key.split('|').includes(id)).length;
            const stages = new Set(other.rows.map(stage));
            return overlap === 3 && group.rows.some(row => stages.has(stage(row)));
        });
        if (similar) continue;
        parties.push(group);
        if (parties.length >= limit) break;
    }
    return { parties, totalTeams: groups.length, totalCount: groups.reduce((sum, group) => sum + group.count, 0), sparse: !!parties.length && !supported.length };
}

export function recommendBuilds(rows, characterId, owned) {
    return distribution(rows, row => {
        const member = targetMember(row, characterId), wheels = wheelKey(member), covenant = covenantKey(member);
        return wheels && covenant ? JSON.stringify([wheels, covenant]) : '';
    }).map(group => {
        const ownedRows = group.rows.filter(row => row.members.length === 4 && row.members.every(member => owned.has(member.characterId)));
        const examples = ownedRows.length ? ownedRows : group.rows;
        const example = [...examples].sort((a, b) => b.count - a.count || a.wave - b.wave || a.difficulty.localeCompare(b.difficulty))[0];
        return { ...group, ownedRows, ownedTeams: distribution(ownedRows, teamKey), example, member: targetMember(example, characterId) };
    }).sort((a, b) => Number(b.ownedRows.length > 0) - Number(a.ownedRows.length > 0) || b.count - a.count || a.key.localeCompare(b.key)).slice(0, 3);
}
