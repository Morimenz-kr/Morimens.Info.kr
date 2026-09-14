(function (root, factory) {
    const api = factory();
    if (typeof module === 'object' && module.exports) module.exports = api;
    else root.DzoneSeason = api;
})(typeof window === 'undefined' ? globalThis : window, function () {
    const CURRENT_SEASON = 69;

    function selectSeason() {
        return { period: CURRENT_SEASON, path: 'data/dzone_current.json' };
    }

    function nextCheckDelay() {
        return null;
    }

    async function loadCurrent(fetcher = fetch, now = Date.now) {
        const selected = selectSeason();
        const response = await fetcher(`${selected.path}?t=${now()}`, { cache: 'no-store' });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = await response.json();
        if (data.period !== selected.period) throw new Error(`Unexpected dzone season: ${data.period}`);
        return data;
    }

    return Object.freeze({ CURRENT_SEASON, selectSeason, nextCheckDelay, loadCurrent });
});
