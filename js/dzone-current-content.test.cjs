const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const data = JSON.parse(fs.readFileSync(path.join(__dirname, '../data/dzone_current.json'), 'utf8'));

test('현재 시즌의 모든 단계 의도와 소환체는 단계 컨텍스트로 해석된다', () => {
    let checked = 0;
    for (const wave of data.waves) {
        for (const monster of [...wave.monsters, ...(wave.summonDefinitions || [])]) {
            if (!(monster.states || []).some(state => state.id === 22074)) continue;
            checked++;
            const action = monster.conditionalActions.find(item => item.contextResolved && item.skillId === 4681);
            assert.ok(action, `${wave.wave}파 Monster:${monster.tid}`);
            assert.equal(action.firstTurn, 6);
            assert.equal(action.conditionText, '6턴부터 매 턴');
            assert.equal(action.persistent, true);
            assert.equal(action.sourceStageGroupId, wave.stageGroupId);
            assert.ok(action.contextEvidence.length);
            assert.ok(!monster.conditionalActions.some(item => item.contextResolved && item.skillId === 4747));
            for (const alert of wave.alerts) {
                for (const stats of [...alert.monsters, ...(alert.summonedMonsters || [])].filter(item => item.tid === monster.tid)) {
                    assert.match(stats.resolvedSkills['4681'].description, /증상 카드 1장/);
                }
            }
        }
    }
    assert.ok(checked > 0);
});

test('현재 시즌의 실제 참조 설명과 조건부 행동에는 미해석 데이터가 없다', () => {
    assert.deepEqual(data.contentAudit.diagnostics, []);
    assert.ok(data.contentAudit.patternEdgesChecked > 0);
    for (const match of JSON.stringify(data.waves).matchAll(/<(kw_[a-f0-9]{16}):/g)) {
        assert.ok(data.keywordGlossary[match[1]]?.description);
    }
    for (const item of Object.values(data.keywordGlossary)) {
        assert.doesNotMatch(item.description, /\[(?:\w+:)?(?:Arg|StateArg|DescArg)\d+\]|NaN|undefined/);
        if (item.icon) assert.ok(fs.existsSync(path.join(__dirname, '..', item.icon)), item.icon);
    }
});
