const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const source = fs.readFileSync(path.join(__dirname, 'links.js'), 'utf8');
const context = vm.createContext({});
vm.runInContext(source.slice(0, source.indexOf('// --- 뒤로가기 ---')), context);

test('모든 비밀계약 추천 주옵은 해당 부위에서 실제로 등장한다', () => {
    // Native Constant.TrinketMainAttrTypeWeight_1..6, res15 (2026-11-02).
    const pools = [
        ['크리티컬 확률', '크리티컬 피해', '광기 회복', '은열쇠 충전'],
        ['크리티컬 확률', '크리티컬 피해', '영역 숙련', '검은 인장 획득'],
        ['크리티컬 확률', '크리티컬 피해', '피해 증폭', '죽음 저항'],
        ['영역 숙련', '광기 회복', '은열쇠 충전', '검은 인장 획득'],
        ['광기 회복', '피해 증폭', '은열쇠 충전', '죽음 저항'],
        ['영역 숙련', '검은 인장 획득', '피해 증폭', '죽음 저항']
    ];
    const simulator = fs.readFileSync(path.join(__dirname, 'covenant_simulator.js'), 'utf8');
    const ids = {critRate:'크리티컬 확률',critDamage:'크리티컬 피해',madnessRegen:'광기 회복',silverCharge:'은열쇠 충전',domainMastery:'영역 숙련',blackSealDrop:'검은 인장 획득',damageAmp:'피해 증폭',deathResist:'죽음 저항'};
    const simulatorPools = vm.runInNewContext(simulator.match(/const MAIN_OPTIONS = (\[[\s\S]*?\n    \]);/)[1]);
    simulatorPools.forEach((pool, i) => assert.deepEqual(Array.from(pool, id => ids[id]).sort(), [...pools[i]].sort()));
    for (const [id, settings] of Object.entries(require('../data/character_settings.json'))) {
        for (const setting of settings) {
            const covenant = setting.covenant || {};
            const variants = [covenant.main_stats, ...Object.values(covenant.substitute_main_stats || {})].filter(Array.isArray);
            for (const stats of variants) {
                assert.equal(stats.length, 6, id);
                stats.forEach((stat, i) => {
                    for (const option of stat.split(/\s*\/\s*/)) {
                        assert(option === '자유' || pools[i].includes(option), `${id}/${setting.settingName}/${i + 1}: ${option}`);
                    }
                });
            }
        }
    }
});
test('all published recommendation names get exactly one setting suffix without changing source data', () => {
    const data = require('../data/character_settings.json');
    const original = JSON.stringify(data);
    const records = Object.values(data).flat();
    assert.ok(records.length > 0);
    for (const setting of records) {
        const actual = context.formatRecommendationSettingName(setting.settingName);
        assert.ok(actual.endsWith(' 세팅'), setting.settingName);
        assert.doesNotMatch(actual, /세팅\s*세팅/);
        assert.equal(context.formatRecommendationSettingName(actual), actual);
    }
    assert.equal(JSON.stringify(data), original);
    assert.equal(context.formatRecommendationSettingName(' 광기 폭발 세팅 '), '광기 폭발 세팅');
    assert.equal(context.formatRecommendationSettingName('딜러'), '딜러 세팅');
    assert.equal(context.formatRecommendationSettingName(null), '추천 세팅');
});
