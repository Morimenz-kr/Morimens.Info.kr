const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const seasons = require('./dzone-season.js');

test('현재 및 차기 시즌은 통계 수집 시작 시각과 전체 난이도 범위를 제공한다', () => {
    for (const season of seasons.availableSeasons().filter(row => row.period >= seasons.CURRENT_SEASON)) {
        const data = JSON.parse(fs.readFileSync(path.join(__dirname, '..', season.path), 'utf8'));
        assert.ok(Number.isSafeInteger(data.usageSince) && data.usageSince > 0,
            `${data.period}기: usageSince 누락으로 수집기가 중단된다`);
        const stages = data.waves.flatMap(wave => wave.alerts.map(alert => alert.stageId));
        assert.equal(stages.length, data.difficultyCount * 5);
        assert.equal(new Set(stages).size, stages.length);
        const verifiedStarts = { 73: 1794186000, 74: 1795395600 };
        if (verifiedStarts[data.period]) assert.equal(data.usageSince, verifiedStarts[data.period]);
    }
});
