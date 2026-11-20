(function (root, factory) {
    const api = factory();
    if (typeof module === 'object' && module.exports) module.exports = api;
    else if (!root.MorimensAccountStore) root.MorimensAccountStore = { ...api, store: api.createStore(root.localStorage) };
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
    'use strict';
    const KEYS = { roster: 'morimens_roster_preview_v1', legacy: 'morimens_inventory_checker_v2', parties: 'morimens_v2_pages', oldParties: 'morimens_v2' };
    const kinds = ['roster', 'parties'];
    const emptyRoster = () => ({ version: 1, characters: {}, wheels: {}, presets: [] });
    const clone = value => value === undefined ? undefined : JSON.parse(JSON.stringify(value));
    const plain = x => !!x && typeof x === 'object' && !Array.isArray(x);
    function clean(value, depth = 0) {
        if (depth > 24) throw Error('기록의 중첩이 너무 깊습니다.');
        if (value === null || typeof value === 'boolean') return value;
        if (typeof value === 'string') { if (value.length > 65536) throw Error('기록이 너무 큽니다.'); return value; }
        if (typeof value === 'number' && Number.isFinite(value)) return value;
        if (Array.isArray(value)) return value.map(x => clean(x, depth + 1));
        if (!plain(value)) throw Error('지원하지 않는 기록 형식입니다.');
        const out = {};
        for (const key of Object.keys(value).sort()) {
            if (['__proto__', 'constructor', 'prototype'].includes(key)) throw Error('잘못된 기록 키입니다.');
            out[key] = clean(value[key], depth + 1);
        }
        return out;
    }
    const canonical = value => JSON.stringify(clean(value));
    const equal = (a, b) => a === undefined || b === undefined ? a === b : canonical(a) === canonical(b);
    function encode(value) {
        const text = canonical(value).replace(/[^\x20-\x7e]/g, c => '\\u' + c.charCodeAt(0).toString(16).padStart(4, '0'));
        if (text.length > 65536) throw Error('계정 기록 한 항목은 64KiB까지 저장할 수 있습니다. JSON 백업을 보관해주세요.');
        return text;
    }
    const integer = (n, min, max) => Number.isInteger(n) && n >= min && n <= max;
    const id = (s, max = 120) => typeof s === 'string' && s.length > 0 && s.length <= max;
    function validateRoster(value) {
        if (!plain(value) || value.version !== 1 || !plain(value.characters) || !plain(value.wheels) || !Array.isArray(value.presets)) throw Error('보유 현황 형식을 확인해주세요.');
        const out = clean(value);
        if (Object.keys(out.characters).length > 256 || Object.keys(out.wheels).length > 512 || out.presets.length > 100) throw Error('보유 기록 개수가 너무 많습니다.');
        for (const [key, row] of Object.entries(out.characters)) {
            if (!id(key) || !plain(row) || typeof row.owned !== 'boolean' || !integer(row.potency ?? 0, 0, 15) || (row.level != null && !integer(row.level, 1, 1000))) throw Error('각성체 기록이 올바르지 않습니다.');
            for (const group of ['talents', 'skills']) {
                if (row[group] != null && (!plain(row[group]) || Object.values(row[group]).some(n => n != null && !integer(n, 0, 1000)))) throw Error('육성 기록이 올바르지 않습니다.');
            }
        }
        for (const [key, row] of Object.entries(out.wheels)) if (!id(key) || !plain(row) || typeof row.owned !== 'boolean' || !integer(row.potency, 0, 15)) throw Error('명륜 기록이 올바르지 않습니다.');
        for (const p of out.presets) if (!plain(p) || !id(p.name, 80) || !plain(p.patch)) throw Error('프리셋 형식을 확인해주세요.');
        return out;
    }
    function validateParties(value) {
        if (!Array.isArray(value) || value.length > 5) throw Error('파티 페이지는 최대 5개입니다.');
        const out = clean(value), ids = new Set();
        out.forEach((page, p) => {
            if (!plain(page) || !id(page.pageName, 15) || !Array.isArray(page.teams) || page.teams.length > 10) throw Error('파티 페이지 형식이 올바르지 않습니다.');
            page.id ||= `legacy-page-${p}`;
            if (!id(page.id) || ids.has(page.id)) throw Error('파티 페이지 ID가 중복됐습니다.');
            ids.add(page.id);
            const teams = new Set();
            page.teams.forEach((team, t) => {
                team.id ||= `${page.id}-team-${t}`;
                if (!id(team.id) || teams.has(team.id) || !id(team.name, 15) || !Array.isArray(team.chars) || team.chars.length !== 4 || team.chars.some(x => x !== null && !id(x)) || !Array.isArray(team.wheels) || team.wheels.length !== 4 || team.wheels.some(pair => !Array.isArray(pair) || pair.length !== 2 || pair.some(x => x !== null && !id(x))) || (team.key !== null && !id(team.key)) || !integer(team.supportIdx, -1, 3)) throw Error('파티 편성 형식이 올바르지 않습니다.');
                teams.add(team.id);
            });
        });
        return out;
    }
    const validate = (kind, value) => kind === 'roster' ? validateRoster(value) : kind === 'parties' ? validateParties(value) : (() => { throw Error('알 수 없는 기록입니다.'); })();
    function migrateInventory(saved) {
        const out = emptyRoster();
        if (!saved) return out;
        if (!Array.isArray(saved.characters) || !Array.isArray(saved.wheels)) throw Error('이전 보유 기록을 읽을 수 없습니다.');
        for (const key of saved.characters) out.characters[key] = { owned: true, potency: saved.characterBreakthroughs?.[key] ?? 0, talents: {}, skills: {} };
        for (const key of saved.wheels) out.wheels[key] = { owned: true, potency: saved.wheelBreakthroughs?.[key] ?? 0 };
        return validateRoster(out);
    }
    // Arrays of pages/teams merge by stable IDs. Slots and preset arrays are atomic.
    function threeWay(base, local, remote, preference) {
        const conflicts = [];
        function walk(b, l, r, path) {
            if (equal(l, b)) return clone(r);
            if (equal(r, b) || equal(l, r)) return clone(l);
            if (plain(l) && plain(r) && (plain(b) || b == null)) {
                const out = {};
                for (const key of new Set([...Object.keys(b || {}), ...Object.keys(l), ...Object.keys(r)])) {
                    const next = walk(b?.[key], l[key], r[key], `${path}/${key}`);
                    if (next !== undefined) out[key] = next;
                }
                return out;
            }
            const keyed = a => Array.isArray(a) && a.every(x => plain(x) && id(x.id)) && new Set(a.map(x => x.id)).size === a.length;
            if (keyed(l) && keyed(r) && keyed(b || [])) {
                const index = a => new Map(a.map(x => [x.id, x]));
                const bm = index(b || []), lm = index(l), rm = index(r), out = [];
                for (const key of new Set([...r.map(x => x.id), ...l.map(x => x.id)])) {
                    const next = walk(bm.get(key), lm.get(key), rm.get(key), `${path}/@${key}`);
                    if (next !== undefined) out.push(next);
                }
                return out;
            }
            conflicts.push(path || '/');
            return clone(preference === 'remote' ? r : l);
        }
        return { value: walk(base, local, remote, ''), conflicts };
    }
    function createStore(storage) {
        let uid = null, blocked = false, record, lastDisk, listeners = new Set();
        const cacheKey = u => `morimens_account_v1:${u}`;
        const fresh = () => ({ version: 1, data: { roster: null, parties: null }, base: { roster: null, parties: null }, dirty: { roster: false, parties: false } });
        const emit = (kind, reason = 'local') => { for (const fn of listeners) fn({ uid, kind, reason }); };
        const persist = () => {
            const raw = storage.getItem(cacheKey(uid)), saved = raw ? JSON.parse(raw) : null;
            if (saved && !equal(saved, lastDisk)) {
                const next = clone(record);
                for (const kind of kinds) {
                    const merged = threeWay(lastDisk.data[kind], record.data[kind], saved.data[kind]);
                    if (merged.conflicts.length) throw Error('다른 탭의 수정과 겹칩니다. 다시 불러온 뒤 저장해주세요.');
                    next.data[kind] = merged.value;
                    next.base[kind] = equal(record.base[kind], lastDisk.base[kind]) ? saved.base[kind] : record.base[kind];
                    next.dirty[kind] = !equal(next.data[kind], next.base[kind]);
                }
                record = next;
            }
            storage.setItem(cacheKey(uid), JSON.stringify(record)); lastDisk = clone(record);
        };
        function guest(kind) {
            if (kind === 'roster') {
                const current = storage.getItem(KEYS.roster);
                if (current) return validateRoster(JSON.parse(current));
                return migrateInventory(JSON.parse(storage.getItem(KEYS.legacy) || 'null'));
            }
            const current = storage.getItem(KEYS.parties);
            if (current) return validateParties(JSON.parse(current));
            const old = storage.getItem(KEYS.oldParties);
            return old ? validateParties([{ pageName: 'PAGE 1', teams: JSON.parse(old) }]) : [];
        }
        return {
            get uid() { return uid; }, get blocked() { return blocked; },
            subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); },
            setBlocked(value) { blocked = value; emit(null, 'status'); },
            activate(next) {
                if (next !== null && !/^[A-Za-z0-9_-]{1,128}$/.test(next)) throw Error('계정 ID가 올바르지 않습니다.');
                let nextRecord;
                if (next) {
                    const raw = storage.getItem(cacheKey(next)); nextRecord = raw ? JSON.parse(raw) : fresh();
                    if (nextRecord.version !== 1 || !plain(nextRecord.data) || !plain(nextRecord.base) || !plain(nextRecord.dirty)) throw Error('계정의 로컬 기록을 확인해주세요.');
                    for (const k of kinds) for (const part of ['data', 'base']) if (nextRecord[part][k] !== null) nextRecord[part][k] = validate(k, nextRecord[part][k]);
                }
                uid = next; record = nextRecord; lastDisk = clone(nextRecord); blocked = false; emit(null, 'account');
            },
            read(kind) { return uid ? clone(record.data[kind]) : guest(kind); },
            write(kind, value) {
                if (blocked) throw Error('계정 기록을 확인하는 중입니다. 잠시 후 다시 저장해주세요.');
                const data = validate(kind, value);
                if (!uid) { storage.setItem(KEYS[kind], JSON.stringify(data)); emit(kind); return clone(data); }
                const previous = clone(record); record.data[kind] = data; record.dirty[kind] = !equal(data, record.base[kind]);
                try { persist(); } catch (e) { record = previous; throw e; }
                emit(kind); return clone(record.data[kind]);
            },
            writeMany(values) {
                if (!uid || blocked) throw Error('계정 기록을 먼저 확인해주세요.');
                const previous = clone(record), checked = {};
                for (const [kind, value] of Object.entries(values)) checked[kind] = validate(kind, value);
                for (const [kind, value] of Object.entries(checked)) { record.data[kind] = value; record.dirty[kind] = !equal(value, record.base[kind]); }
                try { persist(); } catch (e) { record = previous; throw e; }
                for (const kind of Object.keys(checked)) { emit(kind); emit(kind, 'import'); }
            },
            snapshot(kind) { if (!uid) throw Error('먼저 로그인해주세요.'); return { uid, local: clone(record.data[kind]), base: clone(record.base[kind]), dirty: record.dirty[kind] }; },
            reconcile(kind, remote, local) {
                if (!uid) return;
                const previous = clone(record);
                record.base[kind] = remote === null ? null : validate(kind, remote);
                record.data[kind] = local === null ? null : validate(kind, local);
                record.dirty[kind] = !equal(record.data[kind], record.base[kind]);
                try { persist(); } catch(e) { record = previous; throw e; }
                emit(kind, 'remote');
            },
            accept(kind, remote, sentLocal) {
                if (!uid) return;
                const data = remote === null ? null : validate(kind, remote), previous = clone(record);
                let rebase;
                if (sentLocal === undefined || equal(record.data[kind], sentLocal)) record.data[kind] = clone(data);
                else {
                    const local = clone(record.data[kind]);
                    rebase = { ...threeWay(sentLocal, local, data), base: clone(sentLocal), local, remote: clone(data) };
                    record.data[kind] = rebase.value;
                }
                record.base[kind] = clone(data); record.dirty[kind] = !equal(record.data[kind], record.base[kind]);
                try { persist(); } catch (e) { record = previous; throw e; }
                emit(kind, 'remote'); return rebase;
            },
            guest, hasGuest() { return Object.values(KEYS).some(k => storage.getItem(k) !== null); },
            clearAccount(target) { storage.removeItem(cacheKey(target)); if (uid === target) this.activate(null); },
            importRoster(current, incoming) {
                const out = clone(current || emptyRoster());
                for (const group of ['characters', 'wheels']) for (const [key, row] of Object.entries(incoming[group])) if (!Object.hasOwn(out[group], key)) out[group][key] = clone(row);
                for (const p of incoming.presets) if (!out.presets.some(x => equal(x, p))) out.presets.push(clone(p));
                return validateRoster(out);
            }
        };
    }
    return { KEYS, kinds, emptyRoster, clone, plain, equal, canonical, encode, validate, validateRoster, validateParties, migrateInventory, threeWay, createStore };
});
