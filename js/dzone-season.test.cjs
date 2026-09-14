const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const season = require('./dzone-season.js');
const response = period => ({ ok: true, json: async () => ({ period, waves: [] }) });

test('현재 융재금구는 69기 데이터를 선택한다', () => {
    assert.equal(season.CURRENT_SEASON, 69);
    assert.deepEqual(season.selectSeason(), { period: 69, path: 'data/dzone_current.json' });
    assert.equal(season.nextCheckDelay(), null);
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

test('페이지는 시즌 모듈을 먼저 불러오고 절전 복귀 시 재검사를 연결한다', () => {
    const html = fs.readFileSync(path.join(__dirname, '..', 'dzone_info.html'), 'utf8');
    const source = fs.readFileSync(path.join(__dirname, 'dzone-info.js'), 'utf8');
    assert.ok(html.indexOf("loadJS('js/dzone-season.js')") < html.indexOf("loadJS('js/dzone-info.js')"));
    assert.match(source, /addEventListener\('focus', refreshSeason\)/);
    assert.match(source, /addEventListener\('visibilitychange'/);
});
