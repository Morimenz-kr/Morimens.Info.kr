(function(root, factory) {
    const api = factory();
    if (typeof module === 'object' && module.exports) module.exports = api;
    else root.RosterModel = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function() {
    'use strict';
    const KEY = 'morimens_roster_preview_v1';
    const LEGACY = 'morimens_inventory_checker_v2';
    const empty = () => ({version: 1, characters: {}, wheels: {}, presets: []});
    const clone = value => JSON.parse(JSON.stringify(value));
    const number = (value, min, max) => Number.isInteger(value) && value >= min && value <= max;
    function migrate(saved) {
        const out = empty();
        for (const id of saved?.characters || []) out.characters[id] = {owned: true, potency: saved.characterBreakthroughs?.[id] ?? 0, talents: {}, skills: {}};
        for (const id of saved?.wheels || []) out.wheels[id] = {owned: true, potency: saved.wheelBreakthroughs?.[id] ?? 0};
        return out;
    }
    function fields(growth) {
        if (!growth) return [];
        return [{key: 'level', label: '캐릭터 레벨', min: 1, max: growth.maxLevel},
            ...(growth.talentUpgrades || []).map(t => ({key: `talent:${t.type}`, label: t.name, min: 0, max: t.maxLevel})),
            ...(growth.skillUpgrades || []).map(s => ({key: `skill:${s.slot}`, label: s.name, min: 1, max: s.maxLevel}))];
    }
    function get(entry, key) {
        const [group, id] = key.split(':');
        return group === 'talent' ? entry?.talents?.[id] : group === 'skill' ? entry?.skills?.[id] : entry?.[key];
    }
    function set(entry, key, value) {
        const [group, id] = key.split(':');
        if (group === 'talent') (entry.talents ||= {})[id] = value;
        else if (group === 'skill') (entry.skills ||= {})[id] = value;
        else entry[key] = value;
    }
    function complete(entry, growth) { const fs = fields(growth); return fs.length > 0 && fs.every(f => get(entry, f.key) != null); }
    function apply(account, ids, patch, growths, blanksOnly = false, limitedIds = []) {
        const out = normalizeLimited(account, limitedIds), skipped = []; let changes = 0;
        const limited = new Set(limitedIds);
        for (const id of ids) {
            const entry = out.characters[id] ||= {owned: false, potency: 0, talents: {}, skills: {}};
            const allowed = [{key: 'potency', min: 0, max: 15}, ...fields(growths[id])];
            if (limited.has(id) && !allowed.some(f => f.key === 'talent:3')) allowed.push({key:'talent:3',min:5,max:5});
            for (const [key, raw] of Object.entries(patch)) {
                if (raw === '' || raw === undefined) continue;
                if (key === 'owned') { if (typeof raw !== 'boolean') throw Error('잘못된 보유 설정입니다.'); if (entry.owned !== raw) changes++; entry.owned = raw; continue; }
                const field = allowed.find(f => f.key === key);
                if (!field) { skipped.push({id, key}); continue; }
                if (blanksOnly && get(entry, key) != null) continue;
                const value = key === 'talent:3' && limited.has(id) ? 5 : raw === 'max' ? field.max : raw;
                if (value !== null && !number(value, field.min, field.max)) { skipped.push({id, key}); continue; }
                if (get(entry, key) !== value) { set(entry, key, value); changes++; }
            }
        }
        return {account: normalizeLimited(out, limitedIds), skipped, changes};
    }
    function validate(input, characters, wheels, growths) {
        if (!input || input.version !== 1 || typeof input.characters !== 'object' || !input.characters || Array.isArray(input.characters)
            || typeof input.wheels !== 'object' || !input.wheels || Array.isArray(input.wheels) || !Array.isArray(input.presets)) throw Error('지원하는 보유 현황 백업 파일이 아닙니다.');
        const out = empty(); const unknown = [];
        for (const [id, row] of Object.entries(input.characters)) {
            if (!characters.includes(id)) { unknown.push(id); continue; }
            if (!row || typeof row.owned !== 'boolean' || (row.potency != null && !number(row.potency, 0, 15))) throw Error('각성체 보유·돌파 값을 확인해 주세요.');
            const entry = {owned: row.owned, potency: row.potency ?? 0, talents: {}, skills: {}};
            for (const f of fields(growths[id])) {
                const value = get(row, f.key);
                if (value != null && !number(value, f.min, f.max)) throw Error(`${id}: ${f.label} 입력 범위를 벗어났습니다.`);
                if (value != null) set(entry, f.key, value);
            }
            out.characters[id] = entry;
        }
        for (const [id, row] of Object.entries(input.wheels)) {
            if (!wheels.includes(id)) { unknown.push(id); continue; }
            if (!row || typeof row.owned !== 'boolean' || !number(row.potency, 0, 3)) throw Error('명륜 돌파 값을 확인해 주세요.');
            out.wheels[id] = {owned: row.owned, potency: row.potency};
        }
        const allowed = new Set(['owned', 'potency', 'level']);
        Object.values(growths).forEach(g => fields(g).forEach(f => allowed.add(f.key)));
        for (const preset of input.presets) {
            if (!preset || typeof preset.name !== 'string' || !preset.name.trim() || preset.name.length > 80 || !preset.patch || typeof preset.patch !== 'object' || Array.isArray(preset.patch)) throw Error('프리셋 형식이 올바르지 않습니다.');
            const patch = {};
            for (const [key, value] of Object.entries(preset.patch)) {
                if (!allowed.has(key) || !(value === 'max' || value === null || key === 'owned' && typeof value === 'boolean' || number(value, 0, 100))) throw Error('프리셋 입력값이 올바르지 않습니다.');
                patch[key] = value;
            }
            out.presets.push({name: preset.name, patch});
        }
        return {account: out, unknown};
    }
    function merge(base, incoming) {
        const out = clone(base);
        for (const [id, entry] of Object.entries(incoming.characters)) {
            if (!out.characters[id]) { out.characters[id] = entry; continue; }
            const old = out.characters[id]; old.owned ||= entry.owned;
            if (old.potency == null) old.potency = entry.potency;
            if (old.level == null && entry.level != null) old.level = entry.level;
            for (const group of ['talents','skills']) { old[group] ||= {}; for (const [key,value] of Object.entries(entry[group] || {})) if (old[group][key] == null) old[group][key] = value; }
        }
        for (const [id, entry] of Object.entries(incoming.wheels)) { if (!out.wheels[id]) out.wheels[id] = entry; else out.wheels[id].owned ||= entry.owned; }
        for (const p of incoming.presets) if (!out.presets.some(x => x.name === p.name)) out.presets.push(p);
        return out;
    }
    function availability(team, account) {
        const missing = team.members.filter(id => !account.characters[id]?.owned);
        return {missing, owned: team.members.length - missing.length};
    }
    // ScareCrow growth-presentation.js: three passive diamonds, then 1–12 enhancement.
    function potencyDisplay(value) {
        if (!number(value, 0, 15)) return {diamonds: 0, extra: null, max: false};
        return {diamonds: Math.min(value, 3), extra: Math.max(0, value - 3), max: value === 15};
    }
    function normalizeLimited(account, limitedIds) {
        const out = clone(account);
        for (const id of limitedIds) {
            const row = out.characters[id];
            if (row) (row.talents ||= {})[3] = 5;
        }
        return out;
    }
    return {normalizeLimited, potencyDisplay, KEY, LEGACY, empty, clone, migrate, fields, get, set, complete, apply, validate, merge, availability};
});
