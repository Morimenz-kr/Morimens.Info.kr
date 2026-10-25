import { normalizeUsage, teamKey } from './character-usage-model.mjs';

const KEY = 'morimens_dzone_plan_v1';
export const gearKnown = row => row.members.length === 4 && row.members.every(m => m.wheels !== null && m.covenant !== null);
export function readPlan(storage = localStorage) {
    try {
        const raw = JSON.parse(storage.getItem(KEY));
        if (!raw || raw.version !== 1 || !Number.isInteger(raw.period)) return null;
        const zones = {};
        for (const [wave, value] of Object.entries(raw.zones || {})) {
            const snapshot = normalizeUsage({ schemaVersion: 1, characterId: value.row.members[0].characterId, period: raw.period,
                collectedAt: value.collectedAt, coverage: 'sample', source: '선택한 클리어 세팅', rows: [value.row] });
            const row = snapshot.rows[0];
            if (String(row.wave) !== wave || !gearKnown(row)) throw new Error('Invalid plan');
            zones[wave] = { row, collectedAt: snapshot.collectedAt };
        }
        return { version: 1, period: raw.period, zones };
    } catch { return null; }
}
export function conflicts(row, plan, period) {
    if (!plan || plan.period !== period) return [];
    const result = [];
    for (const [wave, saved] of Object.entries(plan.zones)) {
        if (Number(wave) === row.wave) continue;
        for (const member of row.members) {
            if (saved.row.members.some(m => m.characterId === member.characterId)) result.push({ kind: 'character', id: member.characterId, wave: Number(wave) });
            for (const wheel of member.wheels || []) if (saved.row.members.some(m => m.wheels?.some(w => w.id === wheel.id))) result.push({ kind: 'wheel', id: wheel.id, wave: Number(wave) });
        }
    }
    return result;
}
export function putPlan(row, period, collectedAt, storage = localStorage) {
    if (!gearKnown(row)) throw new Error('네 명의 장비가 공개된 기록을 선택해주세요.');
    if (new Set(row.members.flatMap(m => m.wheels.map(w => w.id))).size !== row.members.reduce((n, m) => n + m.wheels.length, 0)) throw new Error('이 기록은 파티 내 명륜이 중복됩니다.');
    const old = readPlan(storage);
    if (old && old.period !== period && Object.keys(old.zones).length) throw new Error('다른 기수의 편성이 있습니다. 기존 편성을 비운 뒤 다시 담아주세요.');
    const plan = old || { version: 1, period, zones: {} };
    if (conflicts(row, plan, period).length) throw new Error('다른 구역에 배정한 각성체·명륜과 겹칩니다.');
    plan.zones[row.wave] = { row, collectedAt };
    storage.setItem(KEY, JSON.stringify(plan));
    return plan;
}
export function removePlan(wave, storage = localStorage) {
    const plan = readPlan(storage);
    if (!plan) return;
    delete plan.zones[wave];
    if (!Object.keys(plan.zones).length) storage.removeItem(KEY);
    else storage.setItem(KEY, JSON.stringify(plan));
}
export function recordKey(row) {
    // Stable navigation key only; never used to merge or deduplicate records.
    let hash = 2166136261;
    for (const c of JSON.stringify([row.wave, row.difficulty, row.members])) hash = Math.imul(hash ^ c.charCodeAt(0), 16777619);
    return (hash >>> 0).toString(36);
}
export function settingsHref(row, period) {
    const query = new URLSearchParams({ category: 'character', id: row.members[0].characterId, period, wave: row.wave, difficulty: row.difficulty, team: teamKey(row), usageView: 'records', record: recordKey(row) });
    return `links.html?${query}#usage`;
}
export function builderTeam(saved) {
    const row = saved.row;
    return { name: `${row.wave}구역`, chars: row.members.map(m => m.characterId), wheels: row.members.map(m => m.wheels.map(w => w.id)), key: null,
        supportIdx: row.members.findIndex(m => m.borrowed), usageSource: saved };
}
