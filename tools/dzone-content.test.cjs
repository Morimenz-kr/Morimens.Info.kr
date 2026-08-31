const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const modulePromise = import('./dzone-content.mjs');

function fixture() {
    const tables = { Skill: { 1: { Name: 's|공격', Desc: 'd|<Shield:서리 방패> 획득. 방어막 보유 시 HP 소모.', CmdList: 1 } }, SkillText: {}, State: {
        10: { Name: 'a|서리 방패', Desc: 'b|일반 방어막.' },
        11: { Name: 'c|서리 방패', Desc: 'e|피격 시 둔화 부여.' }
    }, StateText: {}, MonsterConfig: {}, MonsterConfigText: {}, Cmd: { 1: { data_list: { 1: { Type: 'BEAddState', Para: '11,1' } } } }, keywords: { Shield: { stateLink: 10 } } };
    const doc = { waves: [{ monsters: [{ tid: 2, states: [] }], alerts: [{ monsters: [{ tid: 2, hp: 100, attack: 10, defense: 2, resolvedSkills: { 1: { args: [] } } }] }] }] };
    return { tables, doc };
}
test('source command chooses the actual state variant, not same-name generic effect', async () => {
    const { enrichDzoneContent } = await modulePromise;
    const { tables, doc } = fixture();
    const audit = enrichDzoneContent(doc, tables);
    assert.deepEqual(audit.diagnostics, []);
    assert.equal(Object.values(doc.keywordGlossary)[0].source.id, 11);
    assert.match(Object.values(doc.keywordGlossary)[0].description, /피격 시 둔화/);
    assert.equal(doc.waves[0].alerts[0].monsters[0].hp, 100);
});
test('unknown tags are diagnosed instead of guessed from visible Korean', async () => {
    const { enrichDzoneContent } = await modulePromise;
    const { tables, doc } = fixture();
    tables.Skill[1].Desc = 'd|<Unknown:서리 방패>';
    assert.equal(enrichDzoneContent(doc, tables).diagnostics[0].kind, 'unknown-tag');
});
test('nested tags and comma-containing formula parameters remain intact', async () => {
    const { parseGameText, splitArguments } = await modulePromise;
    assert.equal(parseGameText('<Color:<Shield:방패>>')[0].children[0].tag, 'Shield');
    assert.deepEqual(splitArguments('5,math.max(1,2),StateArg1'), ['5', 'math.max(1,2)', 'StateArg1']);
});
test('deployment gate rejects missing references and unresolved source diagnostics', async () => {
    const { validateDzoneContent } = await modulePromise;
    assert.throws(() => validateDzoneContent({ contentAudit: { diagnostics: [{ kind: 'unknown-tag' }] } }), /diagnostics/);
    assert.throws(() => validateDzoneContent({ contentAudit: { diagnostics: [] }, waves: ['<kw_0123456789abcdef:효과>'] }), /Missing D-Zone reference/);
});
test('entry-state traversal follows only unconditional self entry commands, including chained additions', async () => {
    const { entryStateReferences } = await modulePromise;
    const state = (cmd, event = 'BSTStateOnAdd', target = 'StateOwner') => ({ TriggerCmd1: cmd, TriggerCond1: { 1: event }, TriggerTarget1: target, ShowType: 'Normal', Desc: 'x|effect' });
    const add = (id, extra = {}) => ({ Type: 'BEAddState', Target: 'UpperTarget', Para: id, ...extra });
    const tables = { State: {
        1: state(1), 2: state(2), 3: { ShowType: 'Normal', Desc: 'x|effect' },
        4: state(3, 'BSTRoleAfterDeath'), 5: state(4, 'BSTStateOnAdd', 'PlayerRole'),
        6: { ...state(5), Judgement1: 'StateOwner.hp<100' }, 7: state(6)
    }, Cmd: {
        1: { data_list: { 1: add(2) } }, 2: { data_list: { 1: add(3) } },
        3: { data_list: { 1: add(3) } }, 4: { data_list: { 1: add(3) } },
        5: { data_list: { 1: add(3) } }, 6: { data_list: { 1: add(3, { Cond: 'X==1' }) } }
    } };
    assert.deepEqual(entryStateReferences({ states: [{ id: 1 }] }, tables).map(x => x.id), [2, 3]);
    for (const id of [4, 5, 6, 7]) assert.deepEqual(entryStateReferences({ states: [{ id }] }, tables), []);
});
test('wave 2 boss retains initial two stacks and its actual entry frost shield', () => {
    const data = JSON.parse(fs.readFileSync(path.join(__dirname, '../data/dzone_current.json')));
    for (const difficulty of data.waves.find(w => w.wave === 2).alerts) {
        const boss = difficulty.monsters.find(m => m.tid === 149115);
        assert.equal(boss.resolvedStates.find(s => s.id === 149268).initialLayer.value.display, 2);
        assert.deepEqual(boss.entryStates.map(s => s.id), [149773]);
        assert.equal(boss.entryStates[0].sourceStateId, 149229);
        assert.match(boss.entryStates[0].description, /둔화.*5회/);
    }
});
test('current snapshot references all resolve, with real shield and monster death-resist effects', () => {
    const data = JSON.parse(fs.readFileSync(path.join(__dirname, '../data/dzone_current.json')));
    assert.deepEqual(data.contentAudit.diagnostics, []);
    for (const match of JSON.stringify(data.waves).matchAll(/<(kw_[a-f0-9]{16}):/g)) assert.ok(data.keywordGlossary[match[1]], match[1]);
    const entries = Object.values(data.keywordGlossary);
    assert.ok(entries.some(e => e.source.id === 149773 && /5회/.test(e.description) && /둔화/.test(e.description)));
    assert.ok(entries.some(e => e.source.id === 94600 && /5%/.test(e.description)));
    assert.ok(entries.some(e => e.source.id === 81341));
    for (const item of entries) {
        assert.doesNotMatch(item.description, /\[(?:\w+:)?(?:Arg|StateArg|DescArg)\d+\]|\[object Object\]|NaN/);
        if (item.icon) assert.ok(fs.existsSync(path.join(__dirname, '..', item.icon)), item.icon);
    }
});
