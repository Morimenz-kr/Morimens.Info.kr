import { distribution, targetMember, wheelKey, covenantKey, teamKey, optionStats, sampleCount } from './character-usage-model.mjs';
function countSubstatLine(counts, stat, weight) {
    const key = `${stat.id}:${stat.unit}`;
    const entry = counts.get(key) || { id: stat.id, label: stat.label, unit: stat.unit, count: 0 };
    entry.count += weight;
    counts.set(key, entry);
}

function substatShares(counts) {
    const entries = [...counts.values()].sort((a, b) => b.count - a.count || a.id.localeCompare(b.id) || a.unit.localeCompare(b.unit));
    const total = entries.reduce((sum, entry) => sum + entry.count, 0);
    if (!total) return [];
    const shares = entries.map(entry => {
        const scaledCount = entry.count * 1000;
        return { ...entry, rate: entry.count / total, percentTenths: Math.floor(scaledCount / total), remainder: scaledCount % total };
    });
    // Assign remaining tenths to the largest remainders so the displayed list sums to 100%.
    const remaining = 1000 - shares.reduce((sum, entry) => sum + entry.percentTenths, 0);
    const byRemainder = [...shares].sort((a, b) => b.remainder - a.remainder);
    for (const entry of byRemainder.slice(0, remaining)) entry.percentTenths++;
    return shares.map(({ remainder, ...entry }) => entry);
}

// Contract statistics describe a population, never a synthesized individual loadout.
export function covenantStatistics(rows, characterId) {
    const known = rows.filter(row => targetMember(row, characterId)?.covenant);
    const knownCount = sampleCount(known);
    return distribution(known, row => covenantKey(targetMember(row, characterId))).map(group => {
        const pairs = distribution(group.rows, row => wheelKey(targetMember(row, characterId)));
        const qualified = group.rows.filter(row => targetMember(row, characterId).covenant.completion >= 90);
        const options = optionStats(qualified, characterId);
        const subs = new Map();
        const slotSubs = Array.from({ length: 6 }, () => new Map());
        for (const row of qualified) {
            for (const part of targetMember(row, characterId).covenant.parts) {
                for (const stat of part.subs) {
                    countSubstatLine(subs, stat, row.count);
                    countSubstatLine(slotSubs[part.slot - 1], stat, row.count);
                }
            }
        }
        const counts = values => values.map(({id,label,unit,count,rate}) => ({id,label,unit,count,rate}));
        const wheelPairs = pairs.map(pair => ({ key:pair.key, ids:pair.key === '__unequipped__' ? [] : pair.key.split('|'), count:pair.count, rate:pair.rate }));
        return { key:group.key, count:group.count, rate:group.rate, knownCount, rows:group.rows,
            sets:group.key.split('|').map(part => {const [id,count]=part.split(':'); return {id,count:Number(count)};}),
            wheels:wheelPairs[0]?.ids || [], wheelPairs,
            options:{ total:options.total, slots:options.slots.map(slot=>({slot:slot.slot,main:counts(slot.main),subs:substatShares(slotSubs[slot.slot-1])})),
                subs:substatShares(subs) }
        };
    });
}

function wheelPairGroups(pairRows, characterId) {
    return distribution(pairRows, row => wheelKey(targetMember(row, characterId)))
        .map(group => ({ key:group.key, ids:group.key.split('|'), count:group.count, rate:group.rate }));
}

export function wheelStatistics(rows, characterId) {
    return wheelPairGroups(rows.filter(row => targetMember(row, characterId)?.wheels?.length === 2), characterId);
}

// Exact equipment matches are useful for inspecting joint records.
export function equipmentStatistics(rows, characterId, { wheelKey: selectedWheelKey = '', covenantKey: selectedCovenantKey = '' } = {}) {
    const pairRows = rows.filter(row => targetMember(row, characterId)?.wheels?.length === 2);
    const wheelGroups = wheelPairGroups(pairRows, characterId);
    const contractGroups = covenantStatistics(rows, characterId);
    const joints = distribution(pairRows.filter(row => targetMember(row, characterId).covenant), row => {
        const member = targetMember(row, characterId);
        return JSON.stringify([wheelKey(member), covenantKey(member)]);
    });
    if (!selectedWheelKey && !selectedCovenantKey) {
        [selectedWheelKey, selectedCovenantKey] = joints.length ? JSON.parse(joints[0].key) : ['', ''];
    } else if (!selectedWheelKey || !selectedCovenantKey) {
        const observed = joints.find(group => {
            const [pair, contract] = JSON.parse(group.key);
            return (!selectedWheelKey || selectedWheelKey === pair) && (!selectedCovenantKey || selectedCovenantKey === contract);
        });
        if (observed) [selectedWheelKey, selectedCovenantKey] = JSON.parse(observed.key);
    }
    const jointRows = selectedWheelKey && selectedCovenantKey ? pairRows.filter(row => {
        const member = targetMember(row, characterId);
        return wheelKey(member) === selectedWheelKey && covenantKey(member) === selectedCovenantKey;
    }) : [];
    const optionGroup = covenantStatistics(jointRows, characterId).find(group => group.key === selectedCovenantKey) || null;
    return { wheelGroups, contractGroups, selectedWheelKey, selectedCovenantKey, optionGroup, jointRows };
}

// Count unique observed four-member teams inside each core containing the featured Awakener.
export function recommendParties(rows, characterId, { limit = 3 } = {}) {
    const teams = distribution(rows.filter(row => row.members.length === 4 && targetMember(row, characterId)), teamKey);
    const cores = new Map();
    for (const team of teams) {
        const teammates = team.key.split('|').filter(id => id !== characterId);
        if (teammates.length !== 3 || new Set(teammates).size !== 3) continue;
        for (const fourth of teammates) {
            const members = [characterId, ...teammates.filter(id => id !== fourth)];
            const key = members.join('|');
            const core = cores.get(key) || { key, members, count: 0, candidates: [] };
            core.count += team.count;
            core.candidates.push({ key: team.key, id: fourth, count: team.count });
            cores.set(key, core);
        }
    }
    const ranked = [...cores.values()].sort((a, b) => b.count - a.count || a.key.localeCompare(b.key));
    const flexible = ranked.filter(core => core.candidates.length > 1);
    const covered = new Set(flexible.flatMap(core => core.candidates.map(candidate => candidate.key)));
    const standalone = ranked.filter(core => {
        const [candidate] = core.candidates;
        if (core.candidates.length !== 1 || covered.has(candidate.key)) return false;
        covered.add(candidate.key);
        return true;
    });
    return [...flexible, ...standalone].slice(0, limit).map(core => ({
        ...core,
        candidates: core.candidates.map(candidate => ({ ...candidate, rate: candidate.count / core.count }))
    }));
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
