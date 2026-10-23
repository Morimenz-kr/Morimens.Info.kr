const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const source = fs.readFileSync(path.join(__dirname, 'links.js'), 'utf8');
const context = vm.createContext({});
vm.runInContext(source.slice(0, source.indexOf('// --- 뒤로가기 ---')), context);
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
