const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const season = require('./dzone-season.js');
const response = period => ({ ok: true, json: async () => ({ period, waves: [] }) });

test('현재 융재금구는 69기 데이터를 선택한다', () => {
    assert.equal(season.CURRENT_SEASON, 69);
    assert.deepEqual(season.selectSeason(), {
        period: 69,
        path: 'data/dzone_current.json',
        mapPath: 'data/dzone_maps.json'
    });
    assert.equal(season.nextCheckDelay(), null);
});

test('현재 및 바로 이전 융재금구 데이터를 선택한다', () => {
    assert.deepEqual(season.availableSeasons(), [
        { period: 68, path: 'data/dzone_season68.json', mapPath: 'data/dzone_maps_season68.json', current: false },
        { period: 69, path: 'data/dzone_current.json', mapPath: 'data/dzone_maps.json', current: true }
    ]);
    assert.deepEqual(season.selectSeason(68), {
        period: 68,
        path: 'data/dzone_season68.json',
        mapPath: 'data/dzone_maps_season68.json'
    });
    assert.deepEqual(season.selectSeason(999), {
        period: 69,
        path: 'data/dzone_current.json',
        mapPath: 'data/dzone_maps.json'
    });
});

test('69기 파일을 캐시 없이 요청한다', async () => {
    const requests = [];
    const data = await season.loadCurrent(async (url, options) => {
        requests.push({ url, options });
        return response(69);
    }, () => 12345);
    assert.equal(data.period, 69);
    assert.equal(requests.length, 1);
    assert.equal(requests[0].url, 'data/dzone_current.json?t=12345');
    assert.equal(requests[0].options.cache, 'no-store');
});

test('68기 보관 파일을 캐시 없이 요청한다', async () => {
    const requests = [];
    const data = await season.load(68, async (url, options) => {
        requests.push({ url, options });
        return response(68);
    }, () => 12345);
    assert.equal(data.period, 68);
    assert.deepEqual(requests, [{ url: 'data/dzone_season68.json?t=12345', options: { cache: 'no-store' } }]);
});

test('로드 실패나 시즌 불일치 때 다른 시즌으로 대체하지 않는다', async () => {
    await assert.rejects(season.loadCurrent(async () => ({ ok: false, status: 404 })), /404/);
    await assert.rejects(season.loadCurrent(async () => response(68)), /Unexpected/);
});

test('69기 데이터와 이미지는 배포 가능한 공개 경로에 존재한다', () => {
    const selected = season.selectSeason();
    const data = JSON.parse(fs.readFileSync(path.join(__dirname, '..', selected.path), 'utf8'));
    assert.equal(data.period, 69);
    assert.equal(data.waves.length, 5);
    const visit = value => {
        if (typeof value === 'string' && value.startsWith('images/')) {
            assert.ok(fs.existsSync(path.join(__dirname, '..', value)), value);
        } else if (value && typeof value === 'object') Object.values(value).forEach(visit);
    };
    visit(data);
});

test('각 시즌 데이터와 지도는 같은 기수의 공개 파일을 사용한다', () => {
    for (const selected of season.availableSeasons()) {
        const seasonData = JSON.parse(fs.readFileSync(path.join(__dirname, '..', selected.path), 'utf8'));
        const mapData = JSON.parse(fs.readFileSync(path.join(__dirname, '..', selected.mapPath), 'utf8'));
        assert.equal(seasonData.period, selected.period);
        assert.equal(mapData.period, selected.period);
        assert.equal(mapData.waves.length, seasonData.waves.length);
    }
});

test('페이지는 시즌 모듈을 먼저 불러오고 절전 복귀 시 재검사를 연결한다', () => {
    const html = fs.readFileSync(path.join(__dirname, '..', 'dzone_info.html'), 'utf8');
    const source = fs.readFileSync(path.join(__dirname, 'dzone-info.js'), 'utf8');
    assert.ok(html.indexOf("loadJS('js/dzone-season.js')") < html.indexOf("loadJS('js/dzone-info.js')"));
    assert.match(source, /addEventListener\('focus', refreshSeason\)/);
    assert.match(source, /addEventListener\('visibilitychange'/);
});
