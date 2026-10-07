/* Shared site IDs and inventory. No name/image guessing and no automatic storage overwrite. */
(function (root, factory) {
    const api = factory();
    if (typeof module === 'object' && module.exports) module.exports = api;
    else root.RecordIntegration = api;
})(typeof globalThis === 'object' ? globalThis : this, function () {
    'use strict';
    const INVENTORY_KEY = 'morimens_inventory_checker_v2', HANDOFF_KEY = 'morimens-record-handoff-v1';
    function unique(index, key, value) {
        const matches = index.filter(row => String(row[key]) === String(value));
        return matches.length === 1 ? matches[0] : null;
    }
    function ownedFilters(storage, links, { wheels = false, growth = false, allowBorrowed = false } = {}) {
        let saved;
        try { saved = JSON.parse(storage.getItem(INVENTORY_KEY)); } catch { throw Error('보유 현황 저장값을 읽을 수 없습니다.'); }
        if (!saved || !Array.isArray(saved.characters) || !Array.isArray(saved.wheels)) throw Error('먼저 보유 현황에서 각성체와 명륜을 선택해 주세요.');
        const unresolved = [], selected = [];
        for (const siteId of saved.characters) {
            const row = unique(links.characters, 'siteId', siteId);
            if (row) selected.push(row); else unresolved.push({ kind: 'character', siteId });
        }
        const filters = { ownedCharacters: selected.map(row => String(row.clientId)), allowBorrowed };
        if (growth) {
            filters.ownedPotency = {};
            for (const row of selected) {
                const value = saved.characterBreakthroughs?.[row.siteId];
                if (!Number.isInteger(value) || value < 0 || value > 15) throw Error('선택한 각성체의 보유 계령 단계가 필요합니다.');
                filters.ownedPotency[row.clientId] = value;
            }
        }
        if (wheels) filters.ownedWheels = saved.wheels.flatMap(siteId => {
            const row = unique(links.wheels, 'siteId', siteId);
            if (!row) { unresolved.push({ kind: 'wheel', siteId }); return []; }
            return [String(row.clientId)];
        });
        return { filters, unresolved, scope: 'manually-selected-local-inventory-not-server-ownership' };
    }
    function validateParty(party, links) {
        if (!party || !Array.isArray(party.chars) || party.chars.length !== 4 || new Set(party.chars).size !== 4
            || !Array.isArray(party.wheels) || party.wheels.length !== 4
            || !Number.isInteger(party.supportIdx) || party.supportIdx < -1 || party.supportIdx > 3) throw Error('잘못된 편성 데이터입니다.');
        if (party.chars.some(id => !unique(links.characters, 'siteId', id))
            || party.wheels.some(pair => !Array.isArray(pair) || pair.length !== 2 || pair.some(id => id !== null && !unique(links.wheels, 'siteId', id)))
            || party.key !== null && !links.keys.some(row => row.siteId === party.key)) throw Error('도감에 연결되지 않은 편성 항목입니다.');
        return { chars: [...party.chars], wheels: party.wheels.map(pair => [...pair]), key: party.key, supportIdx: party.supportIdx };
    }
    function stageHandoff(storage, party, links) {
        const value = { version: 1, createdAt: Date.now(), party: validateParty(party, links) };
        storage.setItem(HANDOFF_KEY, JSON.stringify(value));
        return 'party_builder.html?import=record';
    }
    function readHandoff(storage, links, now = Date.now()) {
        let saved;
        try { saved = JSON.parse(storage.getItem(HANDOFF_KEY)); } catch { throw Error('가져오기 데이터를 읽을 수 없습니다.'); }
        if (saved?.version !== 1 || !Number.isSafeInteger(saved.createdAt) || saved.createdAt > now || now - saved.createdAt > 3600000) throw Error('가져오기 데이터가 만료되었습니다. 기록에서 다시 가져와 주세요.');
        return validateParty(saved.party, links);
    }
    function simulationUrl(base, payload) {
        const url = new URL(base);
        if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password) throw Error('잘못된 시뮬레이터 주소입니다.');
        if (payload?.kind !== 'scarecrow-record-build' || payload.schemaVersion !== 1 || payload.members?.length !== 4) throw Error('잘못된 시뮬레이터 가져오기 데이터입니다.');
        const encoded = encodeURIComponent(JSON.stringify(payload));
        if (encoded.length > 64000) throw Error('가져오기 데이터가 너무 큽니다. JSON 파일로 저장해 주세요.');
        url.hash = 'record-build=' + encoded;
        return url.href;
    }
    function shareUrl(base, section, values = {}) {
        if (!['home', 'profile', 'review', 'clears', 'meta', 'leaderboard', 'events', 'relics', 'about'].includes(section)) throw Error('Unknown section');
        const url = new URL(base); url.search = ''; url.hash = ''; url.searchParams.set('view', section);
        for (const [key, value] of Object.entries(values)) if (value !== undefined && value !== null && value !== '') url.searchParams.set(key, String(value));
        return url.href;
    }
    return { INVENTORY_KEY, HANDOFF_KEY, ownedFilters, validateParty, stageHandoff, readHandoff, simulationUrl, shareUrl };
});
