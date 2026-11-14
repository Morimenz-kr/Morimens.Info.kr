(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.DzoneSeason = api;
})(
  typeof window === "undefined" ? globalThis : window,
  function createSeasonApi() {
    const BUILT_SEASON = 73;
    const archives = [68, 69, 70, 71, 72, 73];
    let current = BUILT_SEASON,
      metadata = new Map();
    function validate(row) {
      if (
        !Number.isSafeInteger(row?.period) ||
        row.period < 70 ||
        !Number.isSafeInteger(row.usageSince) ||
        row.usageSince <= 0 ||
        row.waves?.length !== 5
      )
        return false;
      const pairs = new Set(),
        ids = new Set();
      for (const wave of row.waves) {
        if (wave.alerts?.length !== 7) return false;
        for (const alert of wave.alerts) {
          if (
            !Number.isInteger(wave.wave) ||
            wave.wave < 1 ||
            wave.wave > 5 ||
            !Number.isInteger(alert.alert) ||
            alert.alert < 1 ||
            alert.alert > 7 ||
            !Number.isSafeInteger(alert.stageId) ||
            alert.stageId <= 0
          )
            return false;
          pairs.add(`${wave.wave}:${alert.alert}`);
          ids.add(alert.stageId);
        }
      }
      return pairs.size === 35 && ids.size === 35;
    }
    function selectSeason(period = current) {
      period = Number(period);
      if (!archives.includes(period) && !metadata.has(period)) period = current;
      return {
        period,
        path:
          period === BUILT_SEASON
            ? "data/dzone_current.json"
            : `data/dzone_season${period}.json`,
        mapPath:
          period === BUILT_SEASON
            ? "data/dzone_maps.json"
            : `data/dzone_maps_season${period}.json`,
      };
    }
    function availableSeasons() {
      return [
        ...new Set([
          ...archives,
          ...[...metadata.keys()].filter((period) => period <= current),
          current,
        ]),
      ]
        .sort((a, b) => a - b)
        .map((period) => ({
          ...selectSeason(period),
          current: period === current,
        }));
    }
    function fromUsage(payload) {
      const d = payload?.data;
      if (
        !Number.isSafeInteger(payload?.fetchedAt) ||
        !Number.isSafeInteger(d?.period) ||
        !Number.isSafeInteger(d?.since) ||
        d.stages?.length !== 35
      )
        return null;
      const waves = Array.from({ length: 5 }, (_, i) => ({
        wave: i + 1,
        alerts: d.stages
          .filter((s) => s.wave === i + 1)
          .map((s) => ({ alert: Number(s.difficulty), stageId: s.stageTid })),
      }));
      const row = {
        period: d.period,
        usageSince: d.since,
        difficultyCount: 7,
        waves,
      };
      return validate(row) ? row : null;
    }
    async function discover(fetcher = fetch, now = Date.now) {
      const timestamp = now(),
        seconds = Math.floor(timestamp / 1000);
      const endpoint =
        typeof CONFIG !== "undefined" && CONFIG.DZONE_USAGE_ENDPOINT_URL
          ? CONFIG.DZONE_USAGE_ENDPOINT_URL
          : "https://carriepigeon.khj613401.workers.dev";
      const get = async (url) => {
        const response = await fetcher(url, {
          cache: "no-store",
          ...(typeof AbortSignal !== "undefined"
            ? { signal: AbortSignal.timeout(8000) }
            : {}),
        });
        if (!response.ok) throw new Error("metadata unavailable");
        return response.json();
      };
      const results = await Promise.allSettled([
        get(`data/dzone_season_catalog.json?t=${timestamp}`),
        get(`${endpoint}/api/dzone/usage`),
      ]);
      if (results[0].status === "fulfilled") {
        const rows = results[0].value.seasons;
        if (
          Array.isArray(rows) &&
          rows.length &&
          rows.length <= 200 &&
          rows.every(validate) &&
          new Set(rows.map((r) => r.period)).size === rows.length
        )
          metadata = new Map(rows.map((r) => [r.period, r]));
      }
      const eligible = [...metadata.values()]
        .filter(
          (r) =>
            r.usageSince <= seconds &&
            Number.isSafeInteger(r.usageUntil) &&
            seconds <= r.usageUntil + 2,
        )
        .sort((a, b) => b.usageSince - a.usageSince);
      let next = eligible.length ? eligible[0].period : current;
      if (results[1].status === "fulfilled") {
        const payload = results[1].value,
          row = fromUsage(payload);
        if (
          row &&
          row.usageSince <= seconds &&
          payload.fetchedAt <= seconds + 5 &&
          payload.fetchedAt >= row.usageSince &&
          (!eligible.length || payload.fetchedAt >= eligible[0].usageSince)
        ) {
          metadata.set(row.period, { ...metadata.get(row.period), ...row });
          next = row.period;
        }
      }
      current = Math.max(current, next);
      return current;
    }
    function usageOnly(row) {
      return {
        schemaVersion: 3,
        period: row.period,
        usageSince: row.usageSince,
        difficultyCount: 7,
        statsOnly: true,
        source: { kind: "public-usage-metadata" },
        keywordGlossary: {},
        summary: {
          waveCount: 5,
          encounterCount: 0,
          uniqueMonsterCount: 0,
          relicCount: 0,
        },
        waves: row.waves.map((w) => ({
          ...w,
          monsters: [],
          encounters: [],
          initialRelics: [],
          alerts: w.alerts.map((a) => ({
            ...a,
            monsters: [],
          })),
        })),
      };
    }
    function compatible(data, row) {
      if (!row) return true;
      const ids = new Set(
        row.waves.flatMap((w) => w.alerts.map((a) => a.stageId)),
      );
      const actual =
        data.waves?.flatMap((w) => w.alerts?.map((a) => a.stageId) || []) || [];
      return (
        actual.length === 35 &&
        actual.every((id) => ids.has(id)) &&
        (!data.usageSince || data.usageSince === row.usageSince)
      );
    }
    async function load(period = current, fetcher = fetch, now = Date.now) {
      const selected = selectSeason(period),
        row = metadata.get(selected.period);
      let failure;
      const paths = [selected.path];
      if (selected.period === BUILT_SEASON)
        paths.push(`data/dzone_season${selected.period}.json`);
      for (const file of paths) {
        try {
          const response = await fetcher(`${file}?t=${now()}`, {
            cache: "no-store",
          });
          if (!response.ok) throw new Error(`HTTP ${response.status}`);
          const data = await response.json();
          if (data.period !== selected.period)
            throw new Error(`Unexpected dzone season: ${data.period}`);
          if (!compatible(data, row))
            throw new Error("Stage metadata mismatch");
          return data;
        } catch (error) {
          failure = error;
        }
      }
      if (row) return usageOnly(row);
      throw failure;
    }
    return Object.freeze({
      get CURRENT_SEASON() {
        return current;
      },
      availableSeasons,
      selectSeason,
      discover,
      nextCheckDelay: () => 60000,
      load,
      loadCurrent: (fetcher, now) => load(current, fetcher, now),
      create: createSeasonApi,
    });
  },
);
