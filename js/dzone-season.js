(function (root, factory) {
    const api = factory();
    if (typeof module === 'object' && module.exports) module.exports = api;
    else root.DzoneSeason = api;
})(typeof window === 'undefined' ? globalThis : window, function () {
    const SEASON_68_START = Date.parse('2026-08-31T10:00:00+09:00');
    const MAX_TIMER_DELAY = 2147483647;

    function selectSeason(now = Date.now()) {
        return now < SEASON_68_START
            ? { period: 67, path: 'data/dzone_season67.json' }
            : { period: 68, path: 'data/dzone_current.json' };
    }

    function nextCheckDelay(now = Date.now()) {
        return now < SEASON_68_START ? Math.min(SEASON_68_START - now, MAX_TIMER_DELAY) : null;
    }

    async function loadCurrent(fetcher = fetch, now = Date.now) {
        // A request started before the cutoff may finish after it. Never render
        // that stale season, and never substitute the upcoming season on failure.
        for (;;) {
            const selected = selectSeason(now());
            const response = await fetcher(`${selected.path}?t=${now()}`, { cache: 'no-store' });
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const data = await response.json();
            if (data.period !== selected.period) throw new Error(`Unexpected dzone season: ${data.period}`);
            if (selectSeason(now()).period === selected.period) return data;
        }
    }

    return Object.freeze({ SEASON_68_START, selectSeason, nextCheckDelay, loadCurrent });
});
