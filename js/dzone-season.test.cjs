const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const season = require('./dzone-season.js');
const cutoff = Date.parse('2026-08-31T10:00:00+09:00');
const response = period => ({ ok: true, json: async () => ({ period, waves: [] }) });

test('KST 8월 31일 10시 직전까지 67기, 정각부터 68기를 선택한다', () => {
    assert.equal(season.selectSeason(cutoff - 1).period, 67);
    assert.equal(season.selectSeason(cutoff).period, 68);
    assert.equal(season.selectSeason(cutoff + 1).period, 68);
    assert.equal(season.selectSeason(Date.parse('2026-08-31T00:59:59.999Z')).period, 67);
    assert.equal(season.selectSeason(Date.parse('2026-08-30T18:00:00-07:00')).period, 68);
});

test('열어 둔 페이지의 전환 타이머는 정각까지의 시간을 사용한다', () => {
    assert.equal(season.nextCheckDelay(cutoff - 1), 1);
    assert.equal(season.nextCheckDelay(cutoff - 60000), 60000);
    assert.equal(season.nextCheckDelay(cutoff), null);
    assert.equal(season.nextCheckDelay(0), 2147483647);
});

test('전환 이전에는 67기 파일만 요청하고 캐시를 재사용하지 않는다', async () => {
    const requests = [];
    const data = await season.loadCurrent(async (url, options) => {
        requests.push({ url, options });
        return response(67);
    }, () => cutoff - 1);
    assert.equal(data.period, 67);
    assert.equal(requests.length, 1);
    assert.match(requests[0].url, /^data\/dzone_season67\.json\?t=/);
    assert.equal(requests[0].options.cache, 'no-store');
});

test('전환 정각에는 최신 68기 파일을 요청한다', async () => {
    const data = await season.loadCurrent(async url => {
        assert.match(url, /^data\/dzone_current\.json\?t=/);
        return response(68);
    }, () => cutoff);
    assert.equal(data.period, 68);
});

test('67기 다운로드 중 정각이 지나면 68기를 다시 로드한다', async () => {
    let now = cutoff - 1;
    const requests = [];
    const data = await season.loadCurrent(async url => {
        requests.push(url);
        if (requests.length === 1) {
            now = cutoff;
            return response(67);
        }
        return response(68);
    }, () => now);
    assert.equal(data.period, 68);
    assert.equal(requests.length, 2);
});

test('로드 실패나 시즌 불일치 때 다른 시즌으로 대체하지 않는다', async () => {
    let count = 0;
    await assert.rejects(season.loadCurrent(async () => {
        count++;
        return { ok: false, status: 404 };
    }, () => cutoff - 1), /404/);
    assert.equal(count, 1);
    await assert.rejects(season.loadCurrent(async () => response(68), () => cutoff - 1), /Unexpected/);
});

test('두 시즌 데이터와 이미지는 배포 가능한 공개 경로에 존재한다', () => {
    for (const instant of [cutoff - 1, cutoff]) {
        const selected = season.selectSeason(instant);
        const data = JSON.parse(fs.readFileSync(path.join(__dirname, '..', selected.path), 'utf8'));
        assert.equal(data.period, selected.period);
        assert.equal(data.waves.length, 5);
        const visit = value => {
            if (typeof value === 'string' && value.startsWith('images/')) {
                assert.ok(fs.existsSync(path.join(__dirname, '..', value)), value);
            } else if (value && typeof value === 'object') Object.values(value).forEach(visit);
        };
        visit(data);
    }
});

test('페이지는 정각 타이머와 절전 복귀 시 재검사를 연결한다', () => {
    const html = fs.readFileSync(path.join(__dirname, '..', 'dzone_info.html'), 'utf8');
    const source = fs.readFileSync(path.join(__dirname, 'dzone-info.js'), 'utf8');
    assert.ok(html.indexOf("loadJS('js/dzone-season.js')") < html.indexOf("loadJS('js/dzone-info.js')"));
    assert.match(source, /setTimeout\(refreshSeason, delay\)/);
    assert.match(source, /addEventListener\('focus', refreshSeason\)/);
    assert.match(source, /addEventListener\('visibilitychange'/);
});
