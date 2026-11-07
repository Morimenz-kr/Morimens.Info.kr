const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const F = require('./relic-features.js');
const catalog = JSON.parse(fs.readFileSync(path.join(__dirname, '../data/relic_catalog.json'), 'utf8'));
const levels = JSON.parse(fs.readFileSync(path.join(__dirname, '../data/research_depth_levels.json'), 'utf8')).levels;
const depth = levels.find(row => row.level === 65);
test('expression grammar resolves nested game formulas without dynamic JS execution', () => {
    assert.equal(F.expressionValue('math.ceil(math.ceil(PlayerGrowth*0.01)*1.5)', { PlayerGrowth: 858 }), 14);
    assert.equal(F.expressionValue('math.max(1,2)+3*4'), 14);
    assert.equal(F.expressionValue('-2^2'), -4);
    assert.equal(F.expressionValue('2^-2'), 0.25);
    assert.equal(F.expressionValue('2^3^2'), 512);
    assert.equal(F.expressionValue('globalThis.process.exit()'), null);
    assert.equal(F.expressionValue('1/0'), null); assert.equal(F.expressionValue(''), null);
    assert.equal(F.expressionValue('PlayerRole.hp'), null);
});
test('same level/context matches Eremora observed Pathwalker Remains 536 at archive mark zero', () => {
    const result = F.detail(catalog, 78666, depth, { stateLayers: { 71006: 0 } });
    assert.equal(result.variant.values[1], 536);
    assert.deepEqual(Object.values(result.variant.values), [536, 3, 25, 500, 3]);
    assert.equal(result.variant.resolved, true);
    assert.equal(F.detail(catalog, 78666, depth).variant.resolved, false);
});
test('relic heal markup is substituted and runtime variables remain explicitly unknown', () => {
    const result = F.detail(catalog, 70727, depth);
    assert.match(result.variant.description, /86/); assert.doesNotMatch(result.variant.description, /Arg1/);
    assert.equal(F.expressionValue('math.ceil(25+((PlayerRole.max_hp-PlayerRole.hp)/PlayerRole.max_hp)*25)',
        F.variablesAt(depth, { maxHp: 100, hp: 50 })), 38);
    assert.throws(() => F.variablesAt(depth, { maxHp: 100, hp: 101 }));
});
test('library combines variant-origin/tier/mechanic/full-text filters and counts correctly', () => {
    const all = F.search(catalog); assert.equal(all.canonicalCount, 182); assert.equal(all.variantCount, 481);
    const result = F.search(catalog, { query: '여정의 유골', chapter: 'stars', tier: 'cursed', mechanic: 'debuff' });
    assert.equal(result.canonicalCount, 1); assert.equal(result.variantCount, 1);
    assert.throws(() => F.search(catalog, { mechanic: 'unknown' }));
});
test('inventory comparison treats shared icons as candidates, not exact semantic identity', () => {
    const result = F.compareInventory(catalog, [{ name: 'Pathwalker Remains', icon: 'Icon_Creation_126.webp', variantCount: 4 },
        { name: 'Test Relic', icon: 'unknown.webp', variantCount: 1 }]);
    assert.deepEqual(result.candidates[0].localCanonicalIds, [51455]);
    assert.equal(result.candidates[1].localCanonicalIds.length, 0);
    assert.equal(result.candidates[0].match, 'icon-candidate-only');
});
