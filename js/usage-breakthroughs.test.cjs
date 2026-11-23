const test = require('node:test');
const assert = require('node:assert/strict');
test('guide conditions retain original ranges, role names and differing sources without inferring investment', async () => {
    const { guideBreakthroughs, renderGuideBreakthroughs } = await import('./usage-breakthroughs.mjs');
    const input = [
        { settingName: '지원', recommendStep: '명함 ~ 1돌', settings_source: 'chaos' },
        { settingName: '은열쇠 수급', recommendStep: '명함 ~ 1돌', settings_source: 'chaos' },
        { settingName: '딜러', recommendStep: '3돌 ~ 초한', settings_source: 'chaos' },
        { settingName: '조건부', recommendStep: '2돌 미만', settings_source: 'aequor' }
    ];
    const rows = guideBreakthroughs(input);
    assert.equal(rows.length, 3); assert.deepEqual(rows[0].settings, ['지원', '은열쇠 수급']);
    assert.equal(rows[1].step, '3돌 ~ 초한'); assert.equal(rows[2].step, '2돌 미만');
    assert.match(renderGuideBreakthroughs(input), /기존 공략 세팅 기준/);
    assert.equal(renderGuideBreakthroughs([{ settingName: '미제공' }]), '');
    assert.equal(renderGuideBreakthroughs(null), '');
    assert.doesNotMatch(renderGuideBreakthroughs({ recommendStep: '<script>' }), /<script>/);
});
