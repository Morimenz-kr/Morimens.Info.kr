const assert = require('node:assert/strict');
const test = require('node:test');
const F = require('./record-features.js');
test('recorded team stats use server fields, icons and unknowns without inventing totals', () => {
    const index = { source: 'client-config', attributes: { 1: { key: 'occupation_master', name: '영역 숙련', iconSource: 'game-icon' } } };
    const result = F.recordedTeamStats({ teamAttrs: { occupation_master: 21, occupation_master_final: 42,
        basic_damage_per: 157, blackcoin_upgrade_per: 3, death_resist: 254 } }, index);
    assert.equal(result.complete, true); assert.equal(result.stats[0].value, 42);
    assert.equal(result.stats[0].base, 21); assert.equal(result.stats[0].iconSource, 'game-icon');
    assert.equal(F.recordedTeamStats({}, index).stats[0].value, null);
});
const uuid = n => `00000000-0000-0000-0000-${String(n).padStart(12, '0')}`;
const clear = (n, overrides = {}) => ({ battleUuid: uuid(n), playerId: 100 + n, stageTid: 50, timestamp: 1000 + n,
    mode: 'dzone', season: 70, slot: 3, alert: 4, score: 85, awakeners: [
        { tid: 1, potencyLevel: 7, breakLevel: 5, assistPlayerId: 0, weaponSlots: [] },
        { tid: 2, potencyLevel: 3, breakLevel: 5, assistPlayerId: 0, weaponSlots: [] }], ...overrides });
const review = () => ({ battleUuid: uuid(1), timestamp: 1001, stageTid: 50, summary: { playerLevel: 80 }, keeperSkill: 9,
    awakeners: [{ tid: 1, level: 60, potencyLevel: 7, breakLevel: 5, slots: [{ tid: 10, level: 6, slot: 1 }, { tid: 11, level: 3, slot: 2 }],
        weaponSlots: [{ weaponUid: 20, level: 3, slot: 0 }, { weaponUid: 21, level: 15, slot: 0 }], trinkets: [22], attrs: { crit: 5 }, talents: { 50: { lv: 10 } } }],
    items: { 20: { tid: 200, attrs: [], trainAttrs: {} }, 21: { tid: 201, attrs: [], trainAttrs: {} }, 22: { tid: 202, suitId: 30, level: 12, attrs: [] } },
    totals: { AwakerDoDamage: { 1: 30 }, AwakerDoHeal: { 1: 3 } },
    battles: [{ gearType: 3, turns: [
        { totals: { 1: { AwakerDoDamage: 10, AwakerDoHeal: 1 } }, sources: { '1:skill:10': { AwakerDoDamage: 10 } } },
        { totals: { 1: { AwakerDoDamage: 20, AwakerDoHeal: 2 } }, sources: { '1:state:11': { AwakerDoDamage: 20 } } }
    ] }] });

test('latest selects newest clear, not highest score, and retains unclassified rows', () => {
    const stages = { 50: { mode: 'dzone', season: 70, slot: 3, score: 85 } }, rotations = [{ mode: 'dzone', season: 70, start: 1000, end: 2000 }];
    const rows = [clear(1), clear(2), clear(3, { stageTid: 99 })];
    assert.equal(F.latestClear(rows, stages, rotations).record.battleUuid, uuid(2));
    assert.equal(F.latestClear(rows, stages, rotations).unclassifiedCount, 1);
    assert.equal(F.challenges(rows, stages, rotations).records.length, 1);
    assert.equal(F.challenges([clear(1), clear(2)], { 50: { mode: 'dzone', season: 70, slot: 3 } }, rotations).records[0].battleUuid, uuid(2));
});
test('build stats retain unknown bases and exclude unverified conditional effects', () => {
    const input = review(); input.items[20].attrs = [{ attrId: 18159, val: 2.8 }, { attrId: 999, val: 10 }];
    input.items[21].attrs = [{ attrId: 18105, val: 25.2 }];
    const index = { source: 'client-config', attributes: { 18159: { key: 'crit', name: '크리티컬 확률', percentage: true },
        18105: { key: 'crit_damage', name: '크리티컬 피해', percentage: true } } };
    const result = F.buildDetails(input, 1, index);
    assert.equal(result.stats.find(row => row.key === 'crit').basePlusGear, 7.8);
    assert.equal(result.stats.find(row => row.key === 'crit_damage').basePlusGear, null);
    assert.equal(result.unknownAttributes.length, 1); assert.equal(result.finalStatsVerified, false);
    assert.throws(() => F.buildDetails(input, 1, { ...index, source: 'unknown' }));
});
test('include/exclude, per-character enlightenment, rank and unknown support are filtered', () => {
    const rows = [clear(1, { rank: 10 }), clear(2, { rank: 501, awakeners: [{ tid: 1, potencyLevel: 15, assistPlayerId: 55 }] }), clear(3, { awakeners: [{ tid: 1, potencyLevel: 7 }] })];
    assert.equal(F.searchClears(rows, { include: ['1'], growth: { 1: { min: 7, max: 7 } }, excludeSupport: true }).total, 1);
    assert.equal(F.searchClears(rows, { rankMin: 1, rankMax: 100 }).total, 1);
    assert.equal(F.searchClears(rows, { exclude: ['2'] }).total, 2);
    assert.throws(() => F.searchClears(rows, { include: ['1'], exclude: ['1'] }));
    assert.throws(() => F.searchClears(rows, { excludeSupport: 'false' }));
});
test('URL filter roundtrip is strict and preserves booleans and growth', () => {
    const filters = F.normalizedFilters({ include: [1], growth: { 1: { min: 3, max: 15 } }, excludeSupport: true, season: 70 });
    assert.deepEqual(F.filtersFromQuery(F.filtersToQuery(filters)), filters);
    assert.throws(() => F.filtersFromQuery('include=1&include=2'));
    assert.throws(() => F.filtersFromQuery('excludeSupport=0'));
});
test('meta uses distinct people and all clears, not five preview rows', () => {
    const rows = Array.from({ length: 12 }, (_, index) => clear(index + 1, { playerId: index < 2 ? 101 : 100 + index }));
    const result = F.meta(rows, {}, 1);
    assert.equal(result.recordCount, 12); assert.equal(result.playerCount, 11);
    assert.equal(result.awakeners[0].rate, 1); assert.equal(result.character.recordCount, 12);
    assert.equal(result.character.teammates[0].count, 12); assert.equal(result.character.growth[0].key, '7');
});
test('analysis supplies actor/source contribution, turn navigation and scoped totals', () => {
    const result = F.analyze(review(), { turn: 1 });
    assert.equal(result.total, 30); assert.equal(result.actors[0].share, 1);
    assert.equal(result.sources[0].classification, 'proc'); assert.equal(result.selectedTurn.next, 2);
    assert.equal(F.analyze(review(), { metric: 'healing' }).total, 3);
    assert.throws(() => F.analyze(review(), { battle: 1 }));
    const broken = review(); broken.totals.AwakerDoDamage[1] = 99;
    assert.throws(() => F.analyze(broken), /Incomplete/);
});
test('historical party export retains individual card levels, both wheel levels and covenant options', () => {
    const input = review();
    input.awakeners[0].boundTrinkets = { 1: input.awakeners[0].trinkets[0] };
    input.awakeners[0].boundTrinketsComplete = true;
    const output = F.partyFromReview(input);
    assert.deepEqual(output.members[0].cards.map(card => card.level), [6, 3]);
    assert.deepEqual(output.members[0].wheels.map(slot => slot.slotLevel), [3, 15]);
    assert.equal(output.members[0].covenants[0].level, 12);
    assert.equal(output.members[0].covenants[0].uid, input.awakeners[0].trinkets[0]);
    assert.deepEqual(output.members[0].boundTrinkets, input.awakeners[0].boundTrinkets);
    assert.equal(output.members[0].boundTrinketsComplete, true);
    output.members[0].boundTrinkets[1] = 999;
    assert.notEqual(input.awakeners[0].boundTrinkets[1], 999);
    output.members[0].stats.crit = 99; assert.equal(input.awakeners[0].attrs.crit, 5);
});
test('local recent profiles tolerate corrupt/disabled storage and support removal', () => {
    let saved = 'broken'; const storage = { getItem: () => saved, setItem: (_, value) => { saved = value; } };
    const recent = F.recentProfiles(storage); assert.deepEqual(recent.list(), []);
    recent.add({ uid: 1, name: 'A' }, 10); recent.add({ uid: 1, name: 'B' }, 11);
    assert.equal(recent.list().length, 1); recent.remove(1); assert.deepEqual(recent.list(), []);
    assert.equal(F.recentProfiles({ getItem() { throw Error(); }, setItem() { throw Error(); } }).add({ uid: 1, name: 'A' }), false);
});
test('leaderboards validate provenance, uniqueness, pagination and podium', () => {
    const snapshot = { source: 'game-server', entries: [{ uid: 1, mode: 'dzone', season: 70, rank: 1, score: 85 }] };
    assert.equal(F.leaderboard(snapshot, { mode: 'dzone', season: 70 }).podium.length, 1);
    assert.throws(() => F.leaderboard({ ...snapshot, source: 'eremora' }, { mode: 'dzone' }));
    assert.throws(() => F.leaderboard({ ...snapshot, entries: [...snapshot.entries, ...snapshot.entries] }, { mode: 'dzone' }));
});
test('events use half-open time windows and separate paid-pass rewards', () => {
    const snapshot = { source: 'client-config', events: [{ id: 1, type: 'task', start: 100, end: 200,
        rewards: [{ itemTid: 1, count: 5 }, { itemTid: 1, count: 7, requiresPass: true }] }] };
    const result = F.events(snapshot, { now: 100, category: 'current' });
    assert.equal(result.events.length, 1); assert.equal(result.rewards.free[1], 5); assert.equal(result.rewards.pass[1], 7);
    assert.equal(F.events(snapshot, { now: 200, category: 'current' }).events.length, 0);
});
test('partial event reference coverage cannot be reported as complete', () => {
    assert.equal(F.events({ source: 'client-config', events: [{ id: 1, type: 'event', start: 1, end: 10,
        rewardsCoverage: 'partial-explicit-references' }] }, { now: 5 }).rewardTotalsComplete, false);
});
test('reused stage IDs are classified by their matching season window', () => {
    const result = F.classifyRecords([clear(1, { stageTid: 10, timestamp: 150 })], { 10: [
        { mode: 'dzone', season: 1, slot: 1 }, { mode: 'dzone', season: 2, slot: 2 }] }, [
        { mode: 'dzone', season: 1, start: 1, end: 100 }, { mode: 'dzone', season: 2, start: 100, end: 200 }]);
    assert.equal(result.records[0].season, 2); assert.equal(result.records[0].slot, 2);
});
test('PvP comparison keeps both sides, contributions, AI and page-only win rate', () => {
    const row = { battleUuid: clear(1).battleUuid, timestamp: 10.5, selfUid: 1, opponentUid: 2, winnerId: 1,
        players: [{ uid: 1, awakeners: [{ tid: 3, contribution: { damage: 30, heal: 4, shield: 2 } }], specialContribution: { damage: 10 } },
            { uid: 2, isAI: true, awakeners: [{ tid: 4, contribution: { damage: 20 } }] }] };
    const snapshot = { source: 'game-server', records: [row], page: 1, total: 25 };
    const result = F.pvpMatches(snapshot, 1);
    assert.equal(result.summary.winRate, 1); assert.equal(result.summary.aiOpponents, 1);
    assert.equal(result.matches[0].self.totals.damage, 40); assert.equal(result.matches[0].self.awakeners[0].share.damage, 0.75);
    assert.equal(result.total, 25); assert.equal(result.coverage, 'queried-public-page-not-lifetime');
    assert.throws(() => F.pvpMatches(snapshot, 2));
    assert.throws(() => F.pvpMatches({ ...snapshot, records: [row, row] }, 1));
    assert.throws(() => F.pvpMatches({ ...snapshot, source: 'eremora' }, 1));
});
test('three-member cores retain distinct-player counts and fourth-place alternatives', () => {
    const party = tids => tids.map(tid => ({ tid }));
    const rows = [clear(1, { playerId: 1, awakeners: party([1, 2, 3, 4]) }),
        clear(2, { playerId: 1, awakeners: party([1, 2, 3, 4]) }), clear(3, { playerId: 2, awakeners: party([1, 2, 3, 5]) })];
    const result = F.partyGroups(rows, { cores: true, minimumPlayers: 2 });
    assert.equal(result.groups.length, 1); assert.deepEqual(result.groups[0].tids, ['1', '2', '3']);
    assert.equal(result.groups[0].playerCount, 2); assert.equal(result.groups[0].recordCount, 3);
    assert.deepEqual(result.groups[0].fourth.map(row => row.tid), ['4', '5']);
    assert.equal(result.hiddenGroups, 6);
    assert.equal(F.partyGroups(rows, { maximum: 1 }).truncated, true);
});
test('career separates lifetime mode records from current ranking and retains unknowns', () => {
    const result = F.career({ achievements: { Main1: 8, AwakerNum: 59, LoginDay: 467,
        DailyChallengeLifeMaxScore: 6390, AbyssChallengeLifeMaxScore: 525 } }, { 8: '스테이지' });
    assert.equal(result.personalBests.dzone.score, 525); assert.equal(result.personalBests.pdive.score, 6390);
    assert.equal(result.story[0].stageName, '스테이지'); assert.equal(result.statistics.loginDays, 467);
    assert.equal(result.statistics.likesGiven, null); assert.equal(result.story[1].stageTid, null);
});
