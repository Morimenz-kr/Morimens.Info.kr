import { distribution, targetMember, wheelKey, covenantKey, teamKey } from './character-usage-model.mjs';

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
