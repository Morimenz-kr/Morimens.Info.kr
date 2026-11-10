const assert = require('node:assert/strict');
const test = require('node:test');
const seasonModule = require('./dzone-season.js');

function metadata(period, start) {
    return { period, activityTid: period * 10, usageSince: start, usageUntil: start + 998,
        waves: Array.from({ length: 5 }, (_, wave) => ({ wave: wave + 1,
            alerts: Array.from({ length: 7 }, (_, grade) => ({ alert: grade + 1, stageId: period * 100 + wave * 7 + grade })) })) };
}
const catalog = { seasons: [metadata(73, 1000), metadata(74, 2000), metadata(75, 3000), metadata(99, 99000)] };
function overview(row, fetchedAt) {
    return { fetchedAt, data: { period: row.period, since: row.usageSince,
        stages: row.waves.flatMap(wave => wave.alerts.map(alert => ({ wave: wave.wave, difficulty: String(alert.alert), stageTid: alert.stageId }))) } };
}
function fetcher(usage, native = null) {
    return async url => {
        if (url.includes('season_catalog')) return { ok: true, json: async () => catalog };
        if (url.includes('/api/dzone/usage')) return { ok: true, json: async () => usage };
        return native ? { ok: true, json: async () => native } : { ok: false, status: 404 };
    };
}

test('미래 99기를 고르지 않고 시작 시각에 73→74→75기로 자동 전환한다', async () => {
    const api = seasonModule.create();
    const stale = overview(catalog.seasons[0], 1500);
    assert.equal(await api.discover(fetcher(stale), () => 1500_000), 73);
    assert.equal(await api.discover(fetcher(stale), () => 2000_000), 74);
    assert.equal(await api.discover(fetcher(stale), () => 3000_000), 75);
    assert.equal(api.CURRENT_SEASON, 75);
    assert.ok(!api.availableSeasons().some(row => row.period === 99));
});

test('신규 패턴 파일이 없어도 35개 구간의 최신 통계를 제공하고 73기로 되돌리지 않는다', async () => {
    const api = seasonModule.create();
    const f = fetcher(overview(catalog.seasons[1], 2005), { period: 73, waves: [] });
    await api.discover(f, () => 2010_000);
    const data = await api.loadCurrent(f, () => 2010_000);
    assert.equal(data.period, 74);
    assert.equal(data.statsOnly, true);
    assert.equal(data.waves.flatMap(wave => wave.alerts).length, 35);
    assert.equal(data.waves[0].alerts[0].stageId, catalog.seasons[1].waves[0].alerts[0].stageId);
});

test('같은 기수의 오래된 스테이지 파일도 새 통계와 섞지 않는다', async () => {
    const api = seasonModule.create();
    const f = fetcher(overview(catalog.seasons[1], 2005), { ...catalog.seasons[1], waves: catalog.seasons[0].waves });
    await api.discover(f, () => 2010_000);
    assert.equal((await api.loadCurrent(f, () => 2010_000)).statsOnly, true);
});

test('검증된 현재 시즌 파일이 있으면 기존 몬스터 정보를 유지한다', async () => {
    const api = seasonModule.create();
    const native = { ...catalog.seasons[1], marker: 'verified-combat-content' };
    const f = fetcher(overview(catalog.seasons[1], 2005), native);
    await api.discover(f, () => 2010_000);
    assert.equal((await api.loadCurrent(f, () => 2010_000)).marker, native.marker);
});
