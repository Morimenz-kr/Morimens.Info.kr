const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

test('연구 깊이 계산기가 루비 브로치 수치를 실제 식으로 계산한다', async () => {
    const levels = JSON.parse(fs.readFileSync(path.join(__dirname, '../data/research_depth_levels.json'), 'utf8'));
    const storage = new Map();
    const context = {
        window: {},
        localStorage: { getItem: key => storage.get(key) || null, setItem: (key, value) => storage.set(key, value) },
        fetch: async () => ({ ok: true, json: async () => levels }),
        Intl,
        Math,
        Number
    };
    vm.runInNewContext(fs.readFileSync(path.join(__dirname, 'research-depth.js'), 'utf8'), context);
    await context.window.ResearchDepth.load();
    const depth = context.window.ResearchDepth.depthAt(81);
    assert.equal(context.window.ResearchDepth.evaluate('math.ceil(PlayerGrowth*0.03)', depth), 33);
    assert.equal(context.window.ResearchDepth.evaluate('math.ceil(InsightResearchDepth*0.06)', depth), 236);
    assert.equal(context.window.ResearchDepth.evaluate('math.ceil(20*(1+0.01*PlayerRole.GetStateLayer(71005)))', depth, {
        'PlayerRole.GetStateLayer(71005)': 0
    }), 20);
    assert.equal(context.window.ResearchDepth.evaluate('math.ceil(50*SpiritResearchDepthMultiplier)', depth), 183);
});
