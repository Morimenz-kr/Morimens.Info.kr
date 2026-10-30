const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const context = vm.createContext({ document: { getElementById: () => ({}) } });
const source = fs.readFileSync(path.join(__dirname, 'rerun_schedule.js'), 'utf8');
vm.runInContext(source.replace('    initialize();',
    '    globalThis.collectLastAppearances = collectLastAppearances; globalThis.mergeScheduleHistory = mergeScheduleHistory;'), context);
const collect = context.collectLastAppearances;
const schedule = JSON.parse(fs.readFileSync(path.join(__dirname, '../data/rerun_schedule.json'), 'utf8'));
const schedules = [...schedule.current_pickups, ...schedule.next_pickups];
const now = new Date('2026-10-29T03:00:00Z');

test('원본 월별 표의 34명·100건과 출시 및 복각 차수가 모두 일치한다', () => {
    const reference = require('./fixtures/rerun-history-20261030.json');
    const history = context.mergeScheduleHistory(schedule.history, schedules, schedule.verified_periods,
        new Date('2026-10-30T03:00:00Z'));
    const actual = JSON.parse(JSON.stringify(history.flatMap(group => group.characters.map(entry =>
        [group.month, entry.id, entry.appearance]))));
    actual.sort((a, b) => a[0].localeCompare(b[0]) || a[1].localeCompare(b[1]));
    assert.deepEqual(actual, reference.records);
    assert.equal(new Set(actual.map(record => record[1])).size, 34);
    assert.equal(actual.length, 100);
    const catalog = require('../data/character_manifest.json');
    const gacha = require('../data/gachatype.json');
    const ids = new Set(actual.map(record => record[1]));
    for (const id of new Set([...gacha.forgotten, ...gacha.celestial])) {
        if (!gacha.standard.includes(id)) assert.ok(ids.has(id), `한정 각성체 기록 누락: ${id}`);
    }
    for (const id of ids) assert.ok(catalog.some(character => character.id === id), `미등록 ID: ${id}`);
});

test('시작한 일정은 월별 기록에도 합치고 미래 일정은 표시하지 않는다', () => {
    const original = JSON.stringify(schedule.history);
    const history = context.mergeScheduleHistory(schedule.history, schedules, schedule.verified_periods, now);
    const september = history.find(group => group.month === '2026-09').characters;
    const october = history.find(group => group.month === '2026-10').characters;
    assert.deepEqual(Array.from(september, entry => entry.id).sort(),
        ['GOgier', 'Murphy_Fauxborn', 'dafoodil', 'kathigu-ra'].sort());
    assert.deepEqual(Array.from(october, entry => entry.id).sort(), ['castor', 'miryam', 'vivian', 'xu'].sort());
    assert.equal(september.find(entry => entry.id === 'GOgier').appearance, 1);
    assert.equal(september.find(entry => entry.id === 'Murphy_Fauxborn').appearance, 2);
    assert.equal(october.find(entry => entry.id === 'vivian').appearance, 1);
    assert.equal(history.some(group => group.month > '2026-10'), false);
    for (const group of history) assert.equal(new Set(group.characters.map(entry => entry.id)).size, group.characters.length);
    assert.equal(JSON.stringify(schedule.history), original);
    const repeated = context.mergeScheduleHistory(history, schedules, schedule.verified_periods, now);
    assert.equal(JSON.stringify(repeated), JSON.stringify(history));
});

test('기록은 한국 시간 픽업 시작 시점에 추가한다', () => {
    const items = [{ id: 'new', kind: 'release', start_date: '2026-10-19', start_time: '10:00', end_date: '2026-11-16' }];
    assert.equal(context.mergeScheduleHistory([], items, {}, new Date('2026-10-19T00:59:00Z')).length, 0);
    assert.equal(context.mergeScheduleHistory([], items, {}, new Date('2026-10-19T01:00:00Z'))[0].characters[0].appearance, 1);
});

test('지난 복각과 신규 출시 일정이 월별 이력에 없어도 공백 목록에 포함된다', () => {
    const entries = collect(schedule.history, schedule.verified_periods, schedules, now);
    for (const id of ['Murphy_Fauxborn', 'kathigu-ra', 'dafoodil']) {
        assert.equal(entries.get(id).period.end_date, '2026-10-05');
        assert.equal(entries.get(id).rerun, '2026-09');
    }
    for (const [id, end] of [['caraboo', '2026-09-21'], ['GOgier', '2026-10-19']]) {
        assert.equal(entries.get(id).period.end_date, end);
        assert.equal(entries.get(id).rerun, null);
        assert.ok(entries.get(id).release);
    }
    assert.equal(entries.has('vivian'), false, '진행 중인 출시는 종료 전 공백 목록에 넣지 않는다');
    assert.equal(entries.get('tulu').period.end_date, '2026-05-04', '미래 복각으로 지난 기록을 덮어쓰지 않는다');
});

test('기존 검증 기간을 보존하고 더 오래된 일정으로 되돌리지 않는다', () => {
    const history = [{ month: '2026-06', characters: [{ id: 'a', appearance: 2 }] }];
    const periods = { a: { start_date: '2026-06-15', end_date: '2026-07-13' } };
    const old = [{ id: 'a', kind: 'release', start_date: '2025-01-01', end_date: '2025-01-29' }];
    const entry = collect(history, periods, old, now).get('a');
    assert.equal(entry.period.end_date, '2026-07-13');
    assert.equal(entry.rerun, '2026-06');
});

test('한국 시간 픽업 종료 시점부터 기록을 반영한다', () => {
    const items = [{ id: 'new', kind: 'release', start_date: '2026-10-19', end_date: '2026-11-16', end_time: '10:00' }];
    assert.equal(collect([], {}, items, new Date('2026-11-16T00:59:00Z')).has('new'), false);
    const entry = collect([], {}, items, new Date('2026-11-16T01:00:00Z')).get('new');
    assert.equal(entry.release, '2026-10');
    assert.equal(entry.rerun, null);
});
