/* Static configuration queries work without exposing any game account service. */
(function (root, factory) {
    if (typeof module === 'object' && module.exports) module.exports = factory(require('./record-features.js'), require('./relic-features.js'));
    else root.RecordCatalogClient = factory(root.RecordFeatures, root.RelicFeatures);
})(typeof globalThis === 'object' ? globalThis : this, function (records, relics) {
    'use strict';
    function create({ baseUrl = '', fetch: fetcher = globalThis.fetch } = {}) {
        if (typeof fetcher !== 'function' || baseUrl && !/^https?:\/\/[^?#]+$/.test(baseUrl)) throw Error('Invalid catalog source');
        const base = baseUrl.replace(/\/$/, '');
        async function read(name, options = {}) {
            const response = await fetcher(`${base}/data/${name}.json`, { method: 'GET', credentials: 'omit', signal: options.signal, headers: { Accept: 'application/json' } });
            if (!response.ok) throw Error('정적 자료를 불러오지 못했습니다.');
            const value = await response.json();
            if (!value || value.source !== 'client-config' || value.schemaVersion !== 1) throw Error('검증되지 않은 자료입니다.');
            return value;
        }
        const page = (entries, offset = 0, limit = 20) => {
            if (!Number.isSafeInteger(offset) || offset < 0 || !Number.isSafeInteger(limit) || limit < 1 || limit > 100) throw Error('Invalid page');
            return { entries: entries.slice(offset, offset + limit), total: entries.length, nextOffset: offset + limit < entries.length ? offset + limit : null };
        };
        const result = data => ({ ok: true, source: 'client-config', data });
        return {
            async relics(filters = {}, options) { return result(relics.search(await read('relic_library', options), filters)); },
            async relic(tid, { level = 65, ...context } = {}, options) {
                if (!Number.isSafeInteger(tid) || tid < 1 || !Number.isSafeInteger(level) || level < 1 || level > 100) throw Error('Invalid relic');
                const catalog = await read('relic_library', options);
                const response = await fetcher(`${base}/data/research_depth_levels.json`, { method: 'GET', credentials: 'omit', signal: options?.signal });
                if (!response.ok) throw Error('심도 자료를 불러오지 못했습니다.');
                const levels = await response.json(), depth = levels.levels?.find(row => row.level === level);
                const data = relics.detail(catalog, tid, depth, context);
                if (!data) throw Error('존재하지 않는 유물입니다.');
                return result(data);
            },
            async events(filters = {}, options) { return result(records.events(await read('event_library', options), filters)); },
            async event(id, options) {
                const catalog = await read('event_library', options);
                const data = records.events(catalog).events.find(row => String(row.id) === String(id))
                    ?? catalog.timeRules.find(row => String(row.id) === String(id));
                if (!data) throw Error('존재하지 않는 이벤트입니다.');
                return result(data);
            },
            async eventTimeRules({ type, offset = 0, limit = 20 } = {}, options) {
                const catalog = await read('event_library', options);
                if (type && !['Permanent', 'Duration', 'DurationHourAfterTrigger', 'TaskDrivenEnd', 'FixedTime'].includes(type)) throw Error('Invalid time rule');
                return result({ ...page(catalog.timeRules.filter(row => !type || row.timeType === type), offset, limit), scope: 'time-rules-not-personal-server-schedule' });
            },
            async profileCosmetics({ kind = 'avatars', q = '', offset = 0, limit = 20 } = {}, options) {
                if (!['avatars', 'frames'].includes(kind) || typeof q !== 'string' || q.length > 200) throw Error('Invalid cosmetics');
                const catalog = await read('profile_cosmetic_library', options);
                return result({ kind, ...page(Object.values(catalog[kind]).filter(row => !q || String(row.id) === q || row.name.includes(q)), offset, limit),
                    scope: 'client-config-not-owned-or-currently-obtainable' });
            },
            async seasons(mode, options) {
                if (mode && !['dzone', 'pdive', 'railway'].includes(mode)) throw Error('Invalid mode');
                const catalog = await read('record_seasons', options);
                return result({ seasons: catalog.seasons.filter(row => !mode || row.mode === mode) });
            }
        };
    }
    return { create };
});
