(function (root, factory) {
    const api = factory();
    if (typeof module === 'object' && module.exports) module.exports = api;
    else root.DzoneSeason = api;
})(typeof window === 'undefined' ? globalThis : window, function () {
    const CURRENT_SEASON = 69;
    const SEASONS = Object.freeze([
        Object.freeze({ period: 68, path: 'data/dzone_season68.json', mapPath: 'data/dzone_maps_season68.json', current: false }),
        Object.freeze({ period: CURRENT_SEASON, path: 'data/dzone_current.json', mapPath: 'data/dzone_maps.json', current: true })
    ]);

    function availableSeasons() {
        return SEASONS.map(season => ({ ...season }));
    }

    function selectSeason(period = CURRENT_SEASON) {
        const selected = SEASONS.find(season => season.period === Number(period))
            || SEASONS.find(season => season.current);
        return { period: selected.period, path: selected.path, mapPath: selected.mapPath };
    }

    function nextCheckDelay() {
        return null;
    }

    async function load(period = CURRENT_SEASON, fetcher = fetch, now = Date.now) {
        const selected = selectSeason(period);
        const response = await fetcher(`${selected.path}?t=${now()}`, { cache: 'no-store' });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = await response.json();
        if (data.period !== selected.period) throw new Error(`Unexpected dzone season: ${data.period}`);
        return data;
    }

    function loadCurrent(fetcher = fetch, now = Date.now) {
        return load(CURRENT_SEASON, fetcher, now);
    }

    return Object.freeze({ CURRENT_SEASON, availableSeasons, selectSeason, nextCheckDelay, load, loadCurrent });
});
