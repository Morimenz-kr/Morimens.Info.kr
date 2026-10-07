/* UI-independent functions for projected, public game-server records. */
(function (root, factory) {
    const api = factory();
    if (typeof module === 'object' && module.exports) module.exports = api;
    else root.RecordFeatures = api;
})(typeof globalThis === 'object' ? globalThis : this, function () {
    'use strict';
    const METRICS = Object.freeze({ damage: 'AwakerDoDamage', healing: 'AwakerDoHeal', shield: 'AwakerDoBlock' });
    const MODES = ['dzone', 'pdive', 'railway', 'collection'];
    const object = value => value && typeof value === 'object' && !Array.isArray(value) ? value : {};
    const list = value => Array.isArray(value) ? value : [];
    const copy = value => JSON.parse(JSON.stringify(value));
    function integer(value, min, max, name) {
        if (!Number.isSafeInteger(value) || value < min || value > max) throw new Error(`Invalid ${name}`);
        return value;
    }
    function id(value) {
        if (!/^[1-9][0-9]{0,17}$/.test(String(value))) throw new Error('Invalid ID');
        return String(value);
    }
    function finite(value) {
        if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) throw new Error('Invalid metric');
        return value;
    }
    function code(value) {
        if (typeof value !== 'string' || !/^[a-f\d]{8}(?:-[a-f\d]{4}){3}-[a-f\d]{12}(?:#E#[a-z])?$/i.test(value)) throw new Error('Invalid replay code');
        return value.split('#')[0].toLowerCase();
    }
    function uniqueRecords(records) {
        const seen = new Set();
        return list(records).filter(row => {
            const key = code(row.battleUuid);
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
        });
    }
    function classifyRecords(records, stages, rotations) {
        const classified = [], unclassified = [];
        for (const record of uniqueRecords(records)) {
            const candidates = object(stages)[record.stageTid];
            const stage = (Array.isArray(candidates) ? candidates : [candidates]).find(candidate => candidate && list(rotations).some(row => row.mode === candidate.mode && row.season === candidate.season
                && Number.isSafeInteger(record.timestamp) && record.timestamp >= row.start && (row.end === null || record.timestamp < row.end)));
            const rotation = list(rotations).find(row => stage && row.mode === stage.mode && row.season === stage.season
                && Number.isSafeInteger(record.timestamp) && record.timestamp >= row.start && (row.end === null || record.timestamp < row.end));
            if (!stage || !rotation || !['dzone', 'pdive', 'railway'].includes(stage.mode)) {
                unclassified.push(record); continue;
            }
            classified.push({ ...record, ...stage });
        }
        return { records: classified, unclassified, coverage: 'public-recent-window' };
    }
    function challenges(records, stages, rotations) {
        const classified = classifyRecords(records, stages, rotations);
        const best = new Map();
        for (const row of classified.records) {
            const key = `${row.mode}:${row.season}:${row.slot}`;
            const current = best.get(key);
            const knownScore = Number.isFinite(row.score), currentKnownScore = Number.isFinite(current?.score);
            if (!current || knownScore && (!currentKnownScore || row.score > current.score)
                || knownScore === currentKnownScore && row.score === current.score && row.timestamp > current.timestamp) best.set(key, row);
        }
        return { records: [...best.values()].map(row => ({ ...row,
            selectionBasis: Number.isFinite(row.score) ? 'highest-known-record-score' : 'latest-public-record-without-verified-score',
            rankingEligibilityVerified: false })).sort((a, b) => b.season - a.season || a.slot - b.slot),
            unclassified: classified.unclassified, coverage: classified.coverage };
    }
    function latestClear(records, stages, rotations, mode = 'dzone') {
        if (!MODES.includes(mode) || mode === 'collection') throw new Error('Invalid challenge mode');
        const result = classifyRecords(records, stages, rotations);
        return { record: result.records.filter(row => row.mode === mode).sort((a, b) => b.timestamp - a.timestamp || code(a.battleUuid).localeCompare(code(b.battleUuid)))[0] || null,
            unclassifiedCount: result.unclassified.length, coverage: result.coverage };
    }
    function normalizedFilters(input = {}) {
        const include = [...new Set(list(input.include).map(id))], exclude = [...new Set(list(input.exclude).map(id))];
        if (include.length > 4 || exclude.length > 200 || include.some(tid => exclude.includes(tid))) throw new Error('Conflicting character filters');
        const growth = {};
        for (const [tid, range] of Object.entries(object(input.growth))) {
            growth[id(tid)] = { min: integer(range.min, 0, 15, 'growth'), max: integer(range.max, 0, 15, 'growth') };
            if (range.min > range.max) throw new Error('Invalid growth range');
        }
        const output = { include, exclude, growth };
        for (const key of ['ownedCharacters', 'ownedWheels']) if (input[key] !== undefined) {
            if (!Array.isArray(input[key]) || input[key].length > 500) throw new Error('Invalid owned inventory');
            output[key] = [...new Set(input[key].map(id))];
        }
        if (input.ownedPotency !== undefined) {
            if (!input.ownedPotency || typeof input.ownedPotency !== 'object' || Array.isArray(input.ownedPotency) || Object.keys(input.ownedPotency).length > 500) throw new Error('Invalid owned growth');
            output.ownedPotency = Object.fromEntries(Object.entries(object(input.ownedPotency)).map(([tid, value]) =>
                [id(tid), integer(value, 0, 15, 'owned growth')]));
        }
        if (input.allowBorrowed !== undefined && typeof input.allowBorrowed !== 'boolean') throw new Error('Invalid support inventory');
        output.allowBorrowed = input.allowBorrowed === true;
        for (const [key, max] of [['season', 10000], ['slot', 100], ['alert', 10], ['rankMin', 1000000], ['rankMax', 1000000]]) {
            if (input[key] !== undefined) output[key] = integer(input[key], 1, max, key);
        }
        if (output.rankMin && output.rankMax && output.rankMin > output.rankMax) throw new Error('Invalid rank range');
        for (const key of ['excludeSupport', 'extraOnly']) {
            if (input[key] !== undefined && typeof input[key] !== 'boolean') throw new Error(`Invalid ${key}`);
            output[key] = input[key] === true;
        }
        if (input.mode !== undefined) {
            if (!MODES.includes(input.mode)) throw new Error('Invalid mode');
            output.mode = input.mode;
        }
        return output;
    }
    function searchClears(records, input = {}, paging = {}) {
        const filters = normalizedFilters(input);
        const matched = uniqueRecords(records).filter(row => {
            for (const key of ['mode', 'season', 'slot', 'alert']) if (filters[key] !== undefined && row[key] !== filters[key]) return false;
            if (filters.extraOnly && row.historicalChallenge !== true) return false;
            if (filters.rankMin !== undefined && !(row.rank >= filters.rankMin)) return false;
            if (filters.rankMax !== undefined && !(row.rank <= filters.rankMax)) return false;
            const party = list(row.awakeners);
            if (filters.allowBorrowed && party.filter(aw => Number.isSafeInteger(aw.assistPlayerId) && aw.assistPlayerId > 0).length > 1) return false;
            const tids = party.map(aw => String(aw.tid));
            if (!filters.include.every(tid => tids.includes(tid)) || filters.exclude.some(tid => tids.includes(tid))) return false;
            // Unknown assist markers must not pass an explicit no-support filter.
            if (filters.excludeSupport && (!party.length || party.some(aw => aw.assistPlayerId !== 0))) return false;
            if (filters.ownedCharacters !== undefined && (!party.length || party.some(aw => {
                if (filters.allowBorrowed && Number.isSafeInteger(aw.assistPlayerId) && aw.assistPlayerId > 0) return false;
                const tid = String(aw.tid);
                return !filters.ownedCharacters.includes(tid) || filters.ownedPotency?.[tid] !== undefined
                    && (!Number.isInteger(aw.potencyLevel) || aw.potencyLevel > filters.ownedPotency[tid]);
            }))) return false;
            if (filters.ownedWheels !== undefined && party.some(aw => {
                if (filters.allowBorrowed && Number.isSafeInteger(aw.assistPlayerId) && aw.assistPlayerId > 0) return false;
                if (!Array.isArray(aw.weaponSlots) || aw.weaponSlots.length !== 2) return true;
                return aw.weaponSlots.some(slot => !filters.ownedWheels.includes(String(object(object(row.items)[slot.weaponUid]).tid)));
            })) return false;
            for (const [tid, range] of Object.entries(filters.growth)) {
                const aw = party.find(item => String(item.tid) === tid);
                if (!aw || !Number.isInteger(aw.potencyLevel) || aw.potencyLevel < range.min || aw.potencyLevel > range.max) return false;
            }
            return true;
        }).sort((a, b) => b.timestamp - a.timestamp || code(a.battleUuid).localeCompare(code(b.battleUuid)));
        const offset = integer(paging.offset ?? 0, 0, 10000000, 'offset');
        const limit = integer(paging.limit ?? 10, 1, 100, 'limit');
        const groups = new Map();
        for (const row of matched) {
            const tids = list(row.awakeners).map(aw => id(aw.tid)).sort();
            const key = tids.join(',');
            if (!groups.has(key)) groups.set(key, { tids, count: 0, waves: {}, records: [] });
            const group = groups.get(key); group.count++;
            group.waves[row.slot ?? 'unknown'] = (group.waves[row.slot ?? 'unknown'] || 0) + 1;
            if (group.records.length < 5) group.records.push(row);
        }
        return { records: matched.slice(offset, offset + limit), total: matched.length, offset, limit,
            nextOffset: offset + limit < matched.length ? offset + limit : null,
            groups: [...groups.values()].sort((a, b) => b.count - a.count || a.tids.join(',').localeCompare(b.tids.join(','))), filters };
    }
    function filtersToQuery(input) {
        const filters = normalizedFilters(input), params = new URLSearchParams();
        for (const key of ['include', 'exclude', 'ownedCharacters', 'ownedWheels']) {
            if (filters[key]?.length || ['ownedCharacters', 'ownedWheels'].includes(key) && filters[key] !== undefined) params.set(key, filters[key].join(','));
        }
        if (Object.keys(filters.growth).length) params.set('growth', JSON.stringify(filters.growth));
        if (filters.ownedPotency) params.set('ownedPotency', JSON.stringify(filters.ownedPotency));
        for (const key of ['mode', 'season', 'slot', 'alert', 'rankMin', 'rankMax', 'excludeSupport', 'extraOnly', 'allowBorrowed']) {
            if (filters[key] !== undefined && filters[key] !== false) params.set(key, String(filters[key]));
        }
        return params.toString();
    }
    function filtersFromQuery(query) {
        const params = new URLSearchParams(query), input = {};
        const allowed = new Set(['include', 'exclude', 'growth', 'mode', 'season', 'slot', 'alert', 'rankMin', 'rankMax', 'excludeSupport', 'extraOnly', 'ownedCharacters', 'ownedWheels', 'ownedPotency', 'allowBorrowed']);
        for (const [key] of params) if (!allowed.has(key) || params.getAll(key).length !== 1) throw new Error('Unknown or repeated filter');
        for (const key of ['include', 'exclude']) if (params.has(key)) input[key] = params.get(key).split(',');
        for (const key of ['ownedCharacters', 'ownedWheels']) if (params.has(key)) input[key] = params.get(key) ? params.get(key).split(',') : [];
        if (params.has('ownedPotency')) input.ownedPotency = JSON.parse(params.get('ownedPotency'));
        if (params.has('growth')) input.growth = JSON.parse(params.get('growth'));
        if (params.has('mode')) input.mode = params.get('mode');
        for (const key of ['season', 'slot', 'alert', 'rankMin', 'rankMax']) if (params.has(key)) input[key] = Number(params.get(key));
        for (const key of ['excludeSupport', 'extraOnly', 'allowBorrowed']) if (params.has(key)) {
            if (!['true', 'false'].includes(params.get(key))) throw new Error('Invalid boolean filter');
            input[key] = params.get(key) === 'true';
        }
        return normalizedFilters(input);
    }
    function distribution(rows, read, denominator = rows.length) {
        const counts = new Map();
        for (const row of rows) for (const key of new Set(read(row).map(String))) counts.set(key, (counts.get(key) || 0) + 1);
        return [...counts].map(([key, count]) => ({ key, count, rate: denominator ? count / denominator : 0 }))
            .sort((a, b) => b.count - a.count || a.key.localeCompare(b.key));
    }
    function partyGroups(records, options = {}) {
        const minimumPlayers = integer(options.minimumPlayers ?? 1, 1, 1000000, 'minimumPlayers');
        const maximum = integer(options.maximum ?? 100, 1, 1000, 'maximum');
        const cores = options.cores === true, groups = new Map();
        for (const record of uniqueRecords(records)) {
            const tids = list(record.awakeners).map(aw => id(aw.tid)).sort();
            if (tids.length !== 4 || new Set(tids).size !== 4) continue;
            const configurations = cores ? tids.map((fourth, index) => ({ tids: tids.filter((_, position) => index !== position), fourth })) : [{ tids }];
            for (const configuration of configurations) {
                const key = configuration.tids.join(',');
                if (!groups.has(key)) groups.set(key, { tids: configuration.tids, players: new Set(), records: [], fourth: new Map() });
                const group = groups.get(key); group.players.add(id(record.playerId)); group.records.push(record);
                if (cores) {
                    if (!group.fourth.has(configuration.fourth)) group.fourth.set(configuration.fourth, new Set());
                    group.fourth.get(configuration.fourth).add(id(record.playerId));
                }
            }
        }
        const eligible = [...groups.values()].filter(group => group.players.size >= minimumPlayers)
            .sort((a, b) => b.players.size - a.players.size || b.records.length - a.records.length || a.tids.join(',').localeCompare(b.tids.join(',')));
        return { groups: eligible.slice(0, maximum).map(group => ({ tids: group.tids, playerCount: group.players.size,
            recordCount: group.records.length, smallSample: group.players.size < 5,
            records: group.records.slice().sort((a, b) => b.timestamp - a.timestamp).slice(0, 5),
            fourth: [...group.fourth].map(([tid, players]) => ({ tid, playerCount: players.size, rate: players.size / group.players.size }))
                .sort((a, b) => b.playerCount - a.playerCount || a.tid.localeCompare(b.tid)) })),
            totalGroups: groups.size, eligibleGroups: eligible.length, hiddenGroups: groups.size - eligible.length,
            truncated: eligible.length > maximum, minimumPlayers, maximum, unit: 'distinct-players' };
    }
    function meta(records, filters = {}, characterTid = null) {
        // Use all filtered rows, not the five previews stored in each group.
        const all = uniqueRecords(records).filter(row => searchClears([row], filters).total === 1);
        const players = new Set(all.map(row => id(row.playerId)));
        const adoption = new Map();
        for (const row of all) for (const aw of list(row.awakeners)) {
            const tid = id(aw.tid);
            if (!adoption.has(tid)) adoption.set(tid, { tid, players: new Set(), supportPlayers: new Set(), waves: new Map() });
            const entry = adoption.get(tid); entry.players.add(id(row.playerId));
            if (Number.isSafeInteger(aw.assistPlayerId) && aw.assistPlayerId > 0) entry.supportPlayers.add(id(row.playerId));
            if (!entry.waves.has(row.slot ?? 'unknown')) entry.waves.set(row.slot ?? 'unknown', new Set());
            entry.waves.get(row.slot ?? 'unknown').add(id(row.playerId));
        }
        const result = { recordCount: all.length, playerCount: players.size, unit: 'distinct-players', smallSample: players.size < 5,
            lowDifficulty: all.length > 0 && all.some(row => row.mode === 'dzone' && Number.isInteger(row.alert) && row.alert < 4),
            partyGroups: partyGroups(all), coreGroups: partyGroups(all, { cores: true }),
            awakeners: [...adoption.values()].map(row => ({ tid: row.tid, count: row.players.size, rate: players.size ? row.players.size / players.size : 0,
                supportCount: row.supportPlayers.size, waves: Object.fromEntries([...row.waves].map(([wave, members]) => [wave, members.size])) }))
                .sort((a, b) => b.count - a.count || a.tid.localeCompare(b.tid)) };
        if (characterTid !== null) {
            const tid = id(characterTid), selected = all.filter(row => list(row.awakeners).some(aw => String(aw.tid) === tid));
            const awakeners = selected.map(row => row.awakeners.find(aw => String(aw.tid) === tid));
            const equipmentRows = selected.map((row, index) => ({ row, aw: awakeners[index] }));
            result.character = { tid, recordCount: selected.length, unit: 'matching-clears',
                equipmentCoverage: { records: selected.length, completeWheels: equipmentRows.filter(({ row, aw }) =>
                    list(aw.weaponSlots).length === 2 && aw.weaponSlots.every(slot => Number.isSafeInteger(object(object(row.items)[slot.weaponUid]).tid))).length,
                    knownCovenantSets: awakeners.filter(aw => Array.isArray(aw.covenantSets)).length },
                growth: distribution(awakeners, aw => Number.isInteger(aw.potencyLevel) ? [aw.potencyLevel] : []),
                wheels: distribution(equipmentRows, ({ row, aw }) => list(aw.weaponSlots).map(slot => object(object(row.items)[slot.weaponUid]).tid).filter(Number.isSafeInteger)),
                wheelPairs: distribution(equipmentRows, ({ row, aw }) => {
                    const items = object(row.items);
                    const pair = list(aw.weaponSlots).map(slot => object(items[slot.weaponUid]).tid);
                    return pair.length === 2 && pair.every(Number.isSafeInteger) ? [pair.sort((a, b) => a - b).join(',')] : [];
                }),
                wheelGrowth: distribution(equipmentRows, ({ row, aw }) => list(aw.weaponSlots).flatMap(slot => {
                    const item = object(object(row.items)[slot.weaponUid]);
                    return Number.isSafeInteger(item.tid) && Number.isInteger(slot.level) ? [`${item.tid}:${slot.level}`] : [];
                })),
                covenants: distribution(awakeners, aw => list(aw.covenantSets).map(set => `${set.suitId}:${set.count}`)),
                silverkeys: distribution(selected, row => Number.isSafeInteger(row.keeperSkill) ? [row.keeperSkill] : []),
                teammates: distribution(selected, row => row.awakeners.filter(aw => String(aw.tid) !== tid).map(aw => aw.tid)),
                parties: searchClears(selected, {}).groups };
        }
        return result;
    }
    function analyze(review, options = {}) {
        const metric = METRICS[options.metric ?? 'damage'];
        if (!metric) throw new Error('Invalid analysis metric');
        const battles = list(review.battles);
        const scope = options.battle === undefined || options.battle === null ? null : integer(options.battle, 0, battles.length - 1, 'battle');
        const actor = options.actor === undefined || options.actor === null ? null : String(options.actor);
        if (actor !== null && !/^[0-9]{1,18}$/.test(actor)) throw new Error('Invalid actor');
        const actorTotals = new Map(), sources = new Map(), turns = [];
        let globalTurn = 0;
        // Validate every reported metric against the full run before narrowing scope.
        const computed = Object.fromEntries(Object.values(METRICS).map(key => [key, {}]));
        for (let battleIndex = 0; battleIndex < battles.length; battleIndex++) {
            for (let turnIndex = 0; turnIndex < list(battles[battleIndex].turns).length; turnIndex++) {
                const turn = battles[battleIndex].turns[turnIndex]; globalTurn++;
                for (const [tid, values] of Object.entries(object(turn.totals))) for (const key of Object.values(METRICS)) {
                    if (values[key] !== undefined) computed[key][tid] = (computed[key][tid] || 0) + finite(values[key]);
                }
                if (scope !== null && scope !== battleIndex) continue;
                const actors = Object.entries(object(turn.totals)).map(([tid, values]) => ({ tid, value: finite(values[metric] ?? 0) }));
                const total = actors.reduce((n, row) => n + (actor === null || actor === row.tid ? row.value : 0), 0);
                for (const row of actors) if (actor === null || actor === row.tid) actorTotals.set(row.tid, (actorTotals.get(row.tid) || 0) + row.value);
                turns.push({ globalTurn, battle: battleIndex, turn: turnIndex + 1, gearType: battles[battleIndex].gearType ?? null, total, actors });
                for (const [sourceKey, values] of Object.entries(object(turn.sources))) {
                    const match = sourceKey.match(/^([0-9]{1,18}):([a-zA-Z]{1,32}):([0-9]{1,18})$/);
                    if (!match) throw new Error('Invalid source key');
                    const [, tid, kind, sourceId] = match;
                    if (actor !== null && actor !== tid) continue;
                    const value = finite(values[metric] ?? 0);
                    if (!sources.has(sourceKey)) sources.set(sourceKey, { key: sourceKey, actor: tid, kind, sourceId,
                        label: object(review.sourceLabels)[sourceKey] || null, classification: kind === 'skill' ? 'direct' : kind === 'state' ? 'proc' : 'unknown', total: 0, activeTurns: 0, peak: 0 });
                    const row = sources.get(sourceKey); row.total += value; row.peak = Math.max(row.peak, value);
                    if (value > 0) row.activeTurns++;
                }
            }
        }
        for (const [key, reported] of Object.entries(object(review.totals))) {
            if (!Object.values(METRICS).includes(key)) continue;
            for (const tid of new Set([...Object.keys(object(reported)), ...Object.keys(computed[key])])) {
                const expected = finite(object(reported)[tid] ?? 0), actual = computed[key][tid] || 0;
                if (Math.abs(expected - actual) > Math.max(1e-8, Math.abs(expected) * 1e-12)) throw new Error('Incomplete combat totals');
            }
        }
        const total = turns.reduce((n, row) => n + row.total, 0);
        const sort = options.sourceSort ?? 'total';
        if (!['total', 'activeTurns', 'peak'].includes(sort)) throw new Error('Invalid source sort');
        const selectedTurn = options.turn === undefined || options.turn === null ? null : turns.find(row => row.globalTurn === options.turn);
        if (options.turn !== undefined && options.turn !== null && !selectedTurn) throw new Error('Turn outside scope');
        return { metric: options.metric ?? 'damage', total, turns: turns.map(row => ({ ...row, share: total ? row.total / total : 0 })),
            actors: [...actorTotals].map(([tid, value]) => ({ tid, value, share: total ? value / total : 0 })).sort((a, b) => b.value - a.value || a.tid.localeCompare(b.tid)),
            sources: [...sources.values()].sort((a, b) => b[sort] - a[sort] || a.key.localeCompare(b.key)),
            selectedTurn: selectedTurn ? { ...selectedTurn, share: total ? selectedTurn.total / total : 0,
                previous: turns[turns.indexOf(selectedTurn) - 1]?.globalTurn ?? null, next: turns[turns.indexOf(selectedTurn) + 1]?.globalTurn ?? null } : null,
            attributionNote: 'Direct/Proc is a skill/state grouping, not a reconstruction of every game trigger cause.' };
    }
    function partyFromReview(review) {
        if (!list(review.awakeners).length || review.awakeners.length > 4) throw new Error('Invalid party');
        const tids = review.awakeners.map(aw => id(aw.tid));
        if (new Set(tids).size !== tids.length) throw new Error('Duplicate party member');
        // Import data, not a claim that our simulator can replay its RNG/state.
        return { schemaVersion: 1, kind: 'historical-game-build', provenance: { source: 'game-server', replayCode: code(review.battleUuid),
            recordedAt: review.timestamp ?? null, stageTid: review.stageTid ?? null }, keeperLevel: review.summary?.playerLevel ?? null,
            keeperSkill: review.keeperSkill ?? null, silverkey: copy(object(review.silverkey)), members: review.awakeners.map(aw => {
                const equipment = slot => {
                    const item = object(review.items)[slot.weaponUid];
                    return { slot: slot.slot ?? null, slotLevel: slot.level ?? null, item: item ? {
                        uid: slot.weaponUid, tid: item.tid, name: item.name ?? null, image: item.image ?? null,
                        level: item.level ?? null, breakLevel: item.breakLevel ?? null, enhanceLevel: item.enhanceLevel ?? null,
                        attrs: copy(list(item.attrs)), trainAttrs: copy(object(item.trainAttrs)) } : null };
                };
                return { tid: aw.tid, name: aw.name ?? null, image: aw.image_thumb ?? null,
                    level: aw.level ?? null, potencyLevel: aw.potencyLevel ?? null, breakLevel: aw.breakLevel ?? null,
                    talents: copy(object(aw.talents)), boundTrinkets: copy(object(aw.boundTrinkets)),
                    boundTrinketsComplete: aw.boundTrinketsComplete === true,
                    cards: list(aw.slots).map(card => ({ tid: card.tid, name: card.name ?? null,
                        level: card.level ?? null, upNum: card.upNum ?? null, slot: card.slot ?? null })),
                    wheels: list(aw.weaponSlots).map(equipment), covenants: list(aw.trinkets).map(itemUid => {
                        const item = object(review.items)[itemUid];
                        return item ? { uid: itemUid, tid: item.tid, name: item.name ?? null, image: item.image ?? null,
                            suitId: item.suitId ?? null, level: item.level ?? null, attrs: copy(list(item.attrs)) } : null;
                    }), stats: copy(object(aw.attrs)), statsScope: 'recorded-base-not-final', assistPlayerId: aw.assistPlayerId ?? null };
            }), caveats: ['시작 상태·유물·스테이지 효과·난수는 별도이며 동일 피해 재현을 보장하지 않습니다.'] };
    }
    function recentProfiles(storage, options = {}) {
        const key = options.key || 'morimens-recent-public-profiles-v1', maximum = integer(options.maximum ?? 20, 1, 100, 'maximum');
        function read() {
            try {
                return list(JSON.parse(storage.getItem(key))).filter(row => typeof row.name === 'string' && /^[1-9][0-9]{0,17}$/.test(row.uid)
                    && Number.isSafeInteger(row.viewedAt) && row.viewedAt >= 0).slice(0, maximum);
            } catch { return []; }
        }
        const write = values => { try { storage.setItem(key, JSON.stringify(values)); return true; } catch { return false; } };
        return { list: read, add(profile, viewedAt = Date.now()) {
            const uid = id(profile.uid); integer(viewedAt, 0, Number.MAX_SAFE_INTEGER, 'viewedAt');
            if (typeof profile.name !== 'string' || profile.name.length > 200) throw new Error('Invalid profile name');
            return write([{ uid, name: profile.name, viewedAt }, ...read().filter(row => row.uid !== uid)].slice(0, maximum));
        }, remove(uid) { return write(read().filter(row => row.uid !== id(uid))); }, clear() { return write([]); } };
    }
    function buildDetails(review, characterTid, attributeIndex) {
        if (attributeIndex.source !== 'client-config') throw new Error('Unverified attribute index');
        const aw = list(review.awakeners).find(row => String(row.tid) === id(characterTid));
        if (!aw) throw new Error('Unknown awakener');
        const base = copy(object(aw.attrs)), gear = {}, unknownAttributes = [], missingItems = [];
        const itemUids = [...list(aw.weaponSlots).map(slot => slot.weaponUid), ...list(aw.trinkets)];
        for (const itemUid of new Set(itemUids)) {
            const item = object(review.items)[itemUid];
            if (!item) { missingItems.push(itemUid); continue; }
            for (const attr of list(item.attrs)) {
                const definition = object(attributeIndex.attributes)[attr.attrId];
                if (!definition || typeof attr.val !== 'number' || !Number.isFinite(attr.val)) { unknownAttributes.push(copy(attr)); continue; }
                gear[definition.key] = (gear[definition.key] ?? 0) + attr.val;
            }
        }
        const stats = [...new Set([...Object.keys(base), ...Object.keys(gear)])].map(key => {
            const definition = Object.values(attributeIndex.attributes).find(row => row.key === key);
            const baseValue = typeof base[key] === 'number' && Number.isFinite(base[key]) ? base[key] : null;
            const gearValue = gear[key] ?? 0;
            return { key, name: definition?.name ?? key, percentage: definition?.percentage ?? null,
                iconSource: definition?.iconSource ?? null, sort: definition?.sort ?? null,
                base: baseValue, gear: gearValue, basePlusGear: baseValue === null ? null : Math.round((baseValue + gearValue) * 1000000) / 1000000 };
        });
        return { tid: aw.tid, stats, unknownAttributes, missingItems, scope: 'recorded-base-plus-explicit-gear-attributes',
            finalStatsVerified: false, caveats: ['명륜 고유 효과·비밀계약 세트·재능·전투 조건 효과를 모두 합친 최종 스탯이 아닙니다.'] };
    }
    function recordedTeamStats(review, attributeIndex) {
        if (attributeIndex.source !== 'client-config') throw Error('Unverified attribute index');
        const attrs = object(review.teamAttrs), definitions = Object.values(attributeIndex.attributes);
        const fields = [
            ['occupation_master_final', 'occupation_master', false],
            ['basic_damage_per', 'basic_damage_per', true],
            ['blackcoin_upgrade_per', 'blackcoin_upgrade_per', true],
            ['death_resist', 'death_resist', true]
        ];
        return { stats: fields.map(([key, metadataKey, percentage]) => {
            const definition = definitions.find(row => row.key === metadataKey);
            return { key, name: definition?.name ?? metadataKey, percentage, iconSource: definition?.iconSource ?? null,
                value: Number.isFinite(attrs[key]) ? attrs[key] : null,
                base: key === 'occupation_master_final' && Number.isFinite(attrs.occupation_master) ? attrs.occupation_master : null };
        }), source: 'game-server', scope: 'recorded-team-attributes', capturedPhase: 'not-specified-by-record',
            complete: fields.every(([key]) => Number.isFinite(attrs[key])),
            includesConditionHistory: 'not-reconstructed', notCurrentShowcase: true };
    }
    function leaderboard(snapshot, options = {}) {
        if (!MODES.includes(options.mode) || !Array.isArray(snapshot.entries) || snapshot.source !== 'game-server') throw new Error('Unverified leaderboard');
        const entries = snapshot.entries.filter(row => row.mode === options.mode && (options.season === undefined || row.season === options.season))
            .map(row => ({ uid: id(row.uid), name: String(row.name ?? ''), rank: integer(row.rank, 1, 1000000, 'rank'), score: finite(row.score),
                mode: row.mode, season: row.season ?? null, icon: row.icon ?? null,
                avatarFrame: row.avatarFrame ?? null, level: row.level ?? null })).sort((a, b) => a.rank - b.rank);
        if (new Set(entries.map(row => row.rank)).size !== entries.length || new Set(entries.map(row => row.uid)).size !== entries.length) throw new Error('Duplicate leaderboard rank/player');
        const offset = integer(options.offset ?? 0, 0, 1000000, 'offset'), limit = integer(options.limit ?? 20, 1, 100, 'limit');
        return { entries: entries.slice(offset, offset + limit), podium: entries.filter(row => row.rank <= 3), total: entries.length,
            fetchedAt: snapshot.fetchedAt ?? null, coverage: snapshot.coverage ?? 'unknown', nextOffset: offset + limit < entries.length ? offset + limit : null };
    }
    function events(snapshot, options = {}) {
        const now = integer(options.now ?? Math.floor(Date.now() / 1000), 0, Number.MAX_SAFE_INTEGER, 'now');
        if (!Array.isArray(snapshot.events) || !['game-server', 'client-config'].includes(snapshot.source)) throw new Error('Unverified events');
        const entries = snapshot.events.map(row => {
            const start = integer(row.start, 0, Number.MAX_SAFE_INTEGER, 'start'), end = integer(row.end, 1, Number.MAX_SAFE_INTEGER, 'end');
            if (start >= end || !['banner', 'task', 'trial', 'attendance', 'event'].includes(row.type)) throw new Error('Invalid event');
            return { ...row, status: now < start ? 'upcoming' : now >= end ? 'ended' : 'current', remainingSeconds: Math.max(0, end - now) };
        });
        const category = options.category ?? 'all';
        if (!['all', 'current', 'task', 'trial', 'banner', 'attendance'].includes(category)) throw new Error('Invalid event category');
        const status = options.status ?? 'all';
        if (!['all', 'current', 'upcoming', 'ended'].includes(status)) throw new Error('Invalid event status');
        const matched = entries.filter(row => (category === 'all' || category === 'current' && row.status === 'current' || row.type === category)
            && (status === 'all' || row.status === status))
            .sort((a, b) => ['current', 'upcoming', 'ended'].indexOf(a.status) - ['current', 'upcoming', 'ended'].indexOf(b.status)
                || (a.status === 'upcoming' ? a.start - b.start : b.start - a.start) || String(a.id).localeCompare(String(b.id)));
        const rewards = { free: {}, pass: {} };
        for (const row of matched) for (const reward of list(row.rewards)) {
            const bucket = reward.requiresPass === true ? rewards.pass : rewards.free;
            const item = id(reward.itemTid); bucket[item] = (bucket[item] || 0) + finite(reward.count);
        }
        return { events: matched, rewards, rewardTotalsComplete: snapshot.rewardTotalsComplete !== false
                && matched.every(row => ['explicit-references', 'not-applicable'].includes(row.rewardsCoverage)),
            coverage: snapshot.coverage ?? 'unknown', omittedCount: list(snapshot.omitted).length,
            counts: Object.fromEntries(['all', 'current', 'task', 'trial', 'banner', 'attendance'].map(key => [key,
            entries.filter(row => key === 'all' || key === 'current' && row.status === 'current' || row.type === key).length])), now, fetchedAt: snapshot.fetchedAt ?? null };
    }
    function career(profile, stageNames = {}) {
        const achievements = object(profile.achievements);
        const read = key => Object.hasOwn(achievements, key) ? finite(achievements[key]) : null;
        return { story: ['Main1', 'Main2', 'Main3'].map((key, index) => ({ difficulty: ['normal', 'hard', 'madness'][index],
            stageTid: read(key), stageName: object(stageNames)[read(key)] ?? null, sourceKey: key })),
            statistics: { awakeners: read('AwakerNum'), achievements: read('AchieveNum'), loginDays: read('LoginDay'),
                assists: read('AssistNum'), likesGiven: read('GoodOtherNum'),
                collection: profile.collectionCount === undefined ? null : finite(profile.collectionCount) },
            personalBests: { dzone: { score: read('AbyssChallengeLifeMaxScore'), sourceKey: 'AbyssChallengeLifeMaxScore' },
                pdive: { score: read('DailyChallengeLifeMaxScore'), titleTid: read('DailyChallengeRandCfgId'), sourceKey: 'DailyChallengeLifeMaxScore' } },
            pvpLevels: { prebuild: read('PhaseDuelPrebuildLv'), draft: read('PhaseDuelDraftLv') },
            schoolTower: copy(object(profile.schoolTower)), scope: 'public-profile-career-not-current-season-rank' };
    }
    function pvpMatches(snapshot, targetUid) {
        if (snapshot.source !== 'game-server' || !Array.isArray(snapshot.records)) throw new Error('Unverified matches');
        const owner = id(targetUid), seen = new Set();
        const matches = snapshot.records.map(record => {
            const uuid = code(record.battleUuid);
            if (seen.has(uuid)) throw new Error('Duplicate match');
            seen.add(uuid);
            const players = list(record.players);
            if (players.length !== 2 || new Set(players.map(player => id(player.uid))).size !== 2) throw new Error('Invalid match players');
            const self = players.find(player => id(player.uid) === owner), opponent = players.find(player => id(player.uid) !== owner);
            if (!self || id(record.selfUid) !== owner || id(record.opponentUid) !== id(opponent.uid)) throw new Error('Match ownership mismatch');
            const winner = record.winnerId === 0 ? null : id(record.winnerId);
            if (winner !== null && !players.some(player => id(player.uid) === winner)) throw new Error('Invalid winner');
            const contributions = player => {
                const units = list(player.awakeners).map(aw => ({ ...copy(aw), contribution: Object.fromEntries(['damage', 'heal', 'shield']
                    .map(key => [key, finite(object(aw.contribution)[key] ?? 0)])) }));
                const special = Object.fromEntries(['damage', 'heal', 'shield'].map(key => [key, finite(object(player.specialContribution)[key] ?? 0)]));
                const totals = Object.fromEntries(['damage', 'heal', 'shield'].map(key => [key, units.reduce((sum, aw) => sum + aw.contribution[key], special[key])]));
                return { ...copy(player), awakeners: units.map(aw => ({ ...aw, share: Object.fromEntries(['damage', 'heal', 'shield']
                    .map(key => [key, totals[key] ? aw.contribution[key] / totals[key] : 0])) })), specialContribution: special, totals };
            };
            return { ...copy(record), timestamp: finite(record.timestamp), self: contributions(self), opponent: contributions(opponent),
                outcome: winner === null ? 'unresolved' : winner === owner ? 'win' : 'loss' };
        }).sort((a, b) => b.timestamp - a.timestamp);
        const wins = matches.filter(row => row.outcome === 'win').length, losses = matches.filter(row => row.outcome === 'loss').length;
        return { matches, summary: { wins, losses, unresolved: matches.length - wins - losses,
            winRate: wins + losses ? wins / (wins + losses) : null, aiOpponents: matches.filter(row => row.opponent.isAI === true).length },
            page: snapshot.page ?? null, total: snapshot.total ?? null, totalPage: snapshot.totalPage ?? null,
            coverage: 'queried-public-page-not-lifetime', fetchedAt: snapshot.fetchedAt ?? null };
    }
    return { METRICS, classifyRecords, challenges, latestClear, normalizedFilters, searchClears, filtersToQuery, filtersFromQuery,
        meta, partyGroups, analyze, partyFromReview, recentProfiles, buildDetails, recordedTeamStats, leaderboard, events, pvpMatches, career };
});
