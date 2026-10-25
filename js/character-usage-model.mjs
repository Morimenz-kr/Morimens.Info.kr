import { usageExtraWheels } from './character-usage-equipment.mjs';
// Public, anonymous joint-loadout contract shared by the receiver and browser.
const fail = message => { throw new Error(message); };
const integer = (n, min, max, field) => Number.isSafeInteger(n) && n >= min && n <= max ? n : fail(`Invalid ${field}`);
const identifier = (s, field) => typeof s === 'string' && /^[A-Za-z0-9_-]{1,80}$/.test(s) ? s : fail(`Invalid ${field}`);
const text = (s, field) => typeof s === 'string' && s.trim() && s.length <= 100 ? s.trim() : fail(`Invalid ${field}`);
const difficulties = ['normal', 'hard', 'nightmare', 'madness', '1', '2', '3', '4', '5', '6', '7'];
export const difficultyLabel = value => ({ normal: '일반', hard: '어려움', nightmare: '악몽', madness: '광기', '1': 'C', '2': 'B', '3': 'A', '4': 'S', '5': 'SS', '6': 'SSS', '7': '특수 등급' }[value] || '미확인');
export const enlightenmentLabel = level => level === null ? '잠재력 미수집' : level === 0 ? '명함' : level <= 3 ? `${level}돌` : `잠재력 ${level}단계`;
function stat(s) {
    if (!s || typeof s.value !== 'number' || !Number.isFinite(s.value) || s.value < 0 || s.value > 1e9) fail('Invalid stat.value');
    if (!['%', 'pt', ''].includes(s.unit)) fail('Invalid stat.unit');
    return { id: identifier(s.id, 'stat.id'), label: text(s.label, 'stat.label'), value: s.value, unit: s.unit };
}
function covenant(c) {
    if (c == null) return null;
    if (c.completion !== null && (typeof c.completion !== 'number' || !Number.isFinite(c.completion) || c.completion < 0 || c.completion > 100)) fail('Invalid completion');
    if (!Array.isArray(c.parts) || c.parts.length !== 6) fail('Covenant requires six parts');
    const seen = new Set();
    const parts = c.parts.map(p => {
        const slot = integer(p.slot, 1, 6, 'slot');
        if (seen.has(slot)) fail('Duplicate covenant slot');
        seen.add(slot);
        if (!Array.isArray(p.subs) || p.subs.length > 8) fail('Invalid substats');
        // Rolled substat lines may repeat an attribute. Preserve their order.
        const subs = p.subs.map(stat);
        return { slot, setId: identifier(p.setId, 'setId'), main: stat(p.main), subs };
    }).sort((a, b) => a.slot - b.slot);
    return { completion: c.completion, parts };
}
export function normalizeMember(m) {
    const characterId = identifier(m.characterId, 'member.characterId');
    const enlightenment = m.enlightenment === null ? null : integer(m.enlightenment, 0, 30, 'enlightenment');
    if (m.borrowed !== null && typeof m.borrowed !== 'boolean') fail('Invalid borrowed');
    if (m.wheels !== null && (!Array.isArray(m.wheels) || m.wheels.length > 2)) fail('At most two equipped wheels, or null for unknown');
    const wheels = m.wheels === null ? null : m.wheels.map(w => ({ id: identifier(w.id, 'wheel.id'), level: w.level === null ? null : integer(w.level, 0, 30, 'wheel.level') })).sort((a, b) => a.id.localeCompare(b.id));
    return { characterId, enlightenment, borrowed: m.borrowed, wheels, covenant: covenant(m.covenant) };
}
export function normalizeUsage(input) {
    if (input?.schemaVersion === 2) return decodeCompactUsage(input);
    if (input?.schemaVersion !== 1) fail('Unsupported schemaVersion');
    const characterId = identifier(input.characterId, 'characterId');
    const period = integer(input.period, 1, 9999, 'period');
    const collectedAt = integer(input.collectedAt, 1, 9999999999, 'collectedAt');
    if (!Array.isArray(input.rows) || input.rows.length > 100000) fail('At most 100000 joint loadouts per snapshot');
    if (!['sample', 'complete'].includes(input.coverage)) fail('Invalid coverage');
    const source = text(input.source, 'source');
    const rows = input.rows.map(row => {
        const wave = integer(row.wave, 1, 5, 'wave');
        if (!difficulties.includes(row.difficulty)) fail('Invalid difficulty');
        const count = integer(row.count, 1, 1e7, 'count');
        if (!Array.isArray(row.members) || !row.members.length || row.members.length > 4) fail('Invalid team size');
        const members = row.members.map(normalizeMember).sort((a, b) => a.characterId.localeCompare(b.characterId));
        if (new Set(members.map(m => m.characterId)).size !== members.length || !members.some(m => m.characterId === characterId)) fail('Duplicate or missing target member');
        return { wave, difficulty: row.difficulty, count, members };
    });
    // Deliberate allowlist: no player ID, replay ID, session or raw payload survives.
    return { schemaVersion: 1, characterId, period, collectedAt, coverage: input.coverage, source, rows };
}
export function validateUsageCatalog(data, { manifest, wheels, covenants }) {
    const chars = new Set(manifest.map(c => c.id));
    const wheelIds = new Set([...wheels, ...usageExtraWheels].map(w => w.english_name));
    const covenantIds = new Set(covenants.map(c => c.english_name));
    const checked = new Set();
    if (!chars.has(data.characterId)) fail(`Unknown character ID: ${data.characterId}`);
    for (const row of data.rows) for (const member of row.members) {
        if (checked.has(member)) continue;
        checked.add(member);
        if (!chars.has(member.characterId)) fail(`Unknown character ID: ${member.characterId}`);
        for (const wheel of member.wheels || []) if (!wheelIds.has(wheel.id)) fail(`Unknown wheel ID: ${wheel.id}`);
        for (const part of member.covenant?.parts || []) if (!covenantIds.has(part.setId)) fail(`Unknown covenant ID: ${part.setId}`);
    }
    return data;
}
export const teamKey = row => row.members.map(m => m.characterId).sort().join('|');
export const wheelKey = member => member.wheels === null ? '' : member.wheels.length ? member.wheels.map(w => w.id).sort().join('|') : '__unequipped__';
export function covenantKey(member) {
    if (!member.covenant) return '';
    const counts = {};
    member.covenant.parts.forEach(p => { counts[p.setId] = (counts[p.setId] || 0) + 1; });
    return Object.entries(counts).sort(([a], [b]) => a.localeCompare(b)).map(([id, n]) => `${id}:${n}`).join('|');
}
export const targetMember = (row, id) => row.members.find(m => m.characterId === id);
export const sampleCount = rows => rows.reduce((n, r) => n + r.count, 0);
export function selectRows(data, filters = {}) {
    return data.rows.filter(row => {
        const m = targetMember(row, data.characterId);
        return (!filters.wave || String(row.wave) === String(filters.wave)) &&
            (!filters.difficulty || row.difficulty === filters.difficulty) &&
            (!filters.enlightenment || String(m.enlightenment) === filters.enlightenment) &&
            (!filters.noBorrowed || row.members.every(x => x.borrowed === false)) &&
            (!filters.team || teamKey(row) === filters.team) &&
            (!filters.wheels || wheelKey(m) === filters.wheels) &&
            (!filters.covenant || covenantKey(m) === filters.covenant);
    });
}
export function distribution(rows, keyFn) {
    const groups = new Map();
    const total = sampleCount(rows);
    for (const row of rows) {
        const key = keyFn(row);
        if (!key) continue;
        const g = groups.get(key) || { key, count: 0, rows: [] };
        g.count += row.count; g.rows.push(row); groups.set(key, g);
    }
    return [...groups.values()].map(g => ({ ...g, rate: total ? g.count / total : 0 })).sort((a, b) => b.count - a.count || a.key.localeCompare(b.key));
}
export function optionStats(rows, id) {
    const eligible = rows.filter(r => targetMember(r, id).covenant?.completion >= 90);
    const total = sampleCount(eligible);
    const slots = Array.from({ length: 6 }, (_, i) => ({ slot: i + 1, main: new Map(), subs: new Map() }));
    for (const row of eligible) {
        for (const p of targetMember(row, id).covenant.parts) {
            const subTotals = new Map();
            for (const s of p.subs) {
                const key = `${s.id}:${s.unit}`;
                const total = subTotals.get(key) || { ...s, value: 0 };
                total.value += s.value; subTotals.set(key, total);
            }
            for (const [key, values] of [['main', [p.main]], ['subs', [...subTotals.values()]]]) {
                for (const s of values) {
                    const map = slots[p.slot - 1][key];
                    const k = `${s.id}:${s.unit}`;
                    const v = map.get(k) || { ...s, count: 0, min: Infinity, max: -Infinity, sum: 0 };
                    v.count += row.count; v.sum += s.value * row.count;
                    v.min = Math.min(v.min, s.value); v.max = Math.max(v.max, s.value); map.set(k, v);
                }
            }
        }
    }
    return { total, slots: slots.map(s => ({ slot: s.slot, ...Object.fromEntries(['main', 'subs'].map(key => [key, [...s[key].values()].map(v => ({ ...v, mean: v.sum / v.count, rate: total ? v.count / total : 0 })).sort((a, b) => b.count - a.count)])) })) };
}

// Dictionary encoding retains exact joint builds while sharing repeated loadouts.
export function decodeCompactUsage(input) {
    const bounded = (a, max, field) => Array.isArray(a) && a.length <= max ? a : fail(`Invalid ${field}`);
    const strings = (a, field) => bounded(a, 1000, field).map(x => identifier(x, field));
    const chars = strings(input.characters, 'characters'), wheels = strings(input.wheels, 'wheels'), sets = strings(input.sets, 'sets');
    const attrs = bounded(input.attributes, 100, 'attributes').map(a => {
        if (!Array.isArray(a) || a.length !== 3 || !['%', 'pt', ''].includes(a[2])) fail('Invalid attribute');
        return { id: identifier(a[0], 'attribute.id'), label: text(a[1], 'attribute.label'), unit: a[2] };
    });
    const ref = (a, i) => a[integer(i, 0, a.length - 1, 'dictionary reference')];
    const statRef = a => { if (!Array.isArray(a) || a.length !== 2) fail('Invalid stat reference'); return { ...ref(attrs, a[0]), value: a[1] }; };
    const members = bounded(input.members, 100000, 'members').map(m => {
        if (!Array.isArray(m) || m.length !== 5) fail('Invalid compact member');
        return normalizeMember({ characterId: ref(chars, m[0]), enlightenment: m[1], borrowed: m[2],
            wheels: m[3] === null ? null : bounded(m[3], 2, 'wheels').map(w => ({ id: ref(wheels, w[0]), level: w[1] })),
            covenant: m[4] === null ? null : { completion: m[4][0], parts: bounded(m[4][1], 6, 'parts').map((p, i) => ({ slot: i + 1, setId: ref(sets, p[0]), main: statRef(p[1]), subs: bounded(p[2], 8, 'subs').map(statRef) })) }
        });
    });
    const meta = normalizeUsage({ ...input, schemaVersion: 1, rows: [] });
    const rows = bounded(input.rows, 100000, 'rows').map(r => {
        if (!Array.isArray(r) || r.length !== 4 || !difficulties.includes(r[1])) fail('Invalid compact row');
        const team = bounded(r[3], 4, 'team').map(i => ref(members, i)).sort((a, b) => a.characterId.localeCompare(b.characterId));
        if (!team.length || new Set(team.map(m => m.characterId)).size !== team.length || !team.some(m => m.characterId === meta.characterId)) fail('Duplicate or missing target member');
        return { wave: integer(r[0], 1, 5, 'wave'), difficulty: r[1], count: integer(r[2], 1, 1e7, 'count'), members: team };
    });
    return { ...meta, rows };
}
export function compactUsage(data) {
    const characters = [], wheels = [], sets = [], attributes = [], members = [];
    const maps = new Map();
    const intern = (list, value) => { let map = maps.get(list); if (!map) maps.set(list, map = new Map()); const key = JSON.stringify(value); if (!map.has(key)) { map.set(key, list.length); list.push(value); } return map.get(key); };
    const statRef = s => [intern(attributes, [s.id, s.label, s.unit]), s.value];
    const rows = data.rows.map(r => [r.wave, r.difficulty, r.count, r.members.map(m => intern(members, [intern(characters, m.characterId), m.enlightenment, m.borrowed,
        m.wheels === null ? null : m.wheels.map(w => [intern(wheels, w.id), w.level]),
        m.covenant === null ? null : [m.covenant.completion, m.covenant.parts.map(p => [intern(sets, p.setId), statRef(p.main), p.subs.map(statRef)])]
    ]))]);
    return { schemaVersion: 2, characterId: data.characterId, period: data.period, collectedAt: data.collectedAt, coverage: data.coverage, source: data.source, characters, wheels, sets, attributes, members, rows };
}
