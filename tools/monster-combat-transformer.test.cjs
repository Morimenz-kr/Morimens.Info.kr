const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const test = require('node:test');

const fixture = JSON.parse(fs.readFileSync(
  path.join(__dirname, 'fixtures', 'monster-combat-148007.json'),
  'utf8'
));

let transformer;
test.before(async () => {
  transformer = await import(pathToFileURL(path.join(__dirname, 'monster-combat-transformer.mjs')));
});

function template() {
  return transformer.buildMonsterTemplate({ monsterId: 148007, tables: fixture.tables });
}

const encounters = [
  { id: 'wave-5-alert-1', standard: { StandardHp: 391477.68, StandardAtk: 680.83, StandardDef: 31318.21, StandardTurn: 12 }, expected: [234887, 613, 3131] },
  { id: 'wave-5-alert-2', standard: { StandardHp: 3864277.08, StandardAtk: 1962.82, StandardDef: 309142.17, StandardTurn: 12 }, expected: [2318567, 1767, 30914] },
  { id: 'wave-5-alert-3', standard: { StandardHp: 9496745.66, StandardAtk: 2502.03, StandardDef: 458640.86, StandardTurn: 12 }, expected: [5698048, 2252, 45864] },
  { id: 'wave-5-alert-4', standard: { StandardHp: 30308911.67, StandardAtk: 3338.40, StandardDef: 631172.67, StandardTurn: 12 }, expected: [18185348, 3005, 63117] }
];

test('TID 148007의 원본 패턴과 인게임 문구를 편집 없이 보존한다', () => {
  const result = template();
  assert.equal(result.name, '「혼을 거두는 자」');
  assert.deepEqual(result.patterns.map(row => row.skillIds), [
    [148362, 148361, 148362, 148365],
    [148362, 148361, 148362, 148365],
    [148362, 148360, 148362, 148365]
  ]);
  assert.equal(result.skills[148364].name, '피에 굶주린 철구');
  assert.equal(
    result.skills[148364].descriptionTemplate,
    '<Damage:[Damage:Arg1]> 피해를 [AttackTimes:Arg2]회 입히고, 적의 <BleedingIconKeywords:출혈> 3 스택마다 피해 1 증가, 손실된 HP의 30% 회복.'
  );
  assert.equal(result.states[148395].name, '영혼을 거두리-피에 굶주린 철구');
  assert.equal(
    result.states[148395].descriptionTemplate,
    '모든 피해(관통 피해 포함)에 면역되며 HP를 잃을 수 없습니다. 적의 턴 종료 후 제거됩니다.'
  );
});

test('사망 전환과 조건부 의도 교체를 명령 그래프에서 추출한다', () => {
  const result = template();
  assert.deepEqual(result.transitions, [{
    stateId: 148387,
    commandId: 148376,
    triggerEvents: ['BSTRoleBeforeDeath'],
    judgement: '',
    rebirth: true,
    maxHpAddedMultiplier: 0.5,
    maxHpMultiplier: 1.5,
    healsToMax: true,
    targetSkillList: 2,
    forcedSkillIds: [148393],
    addedStateIds: [148020],
    source: { table: 'Cmd', id: 148376 }
  }]);
  assert.deepEqual(result.conditionalActions, [{
    stateId: 148384,
    commandId: 148377,
    commandStep: 3,
    skillId: 148364,
    sourceSkillId: 148362,
    triggerEvents: ['BSTAfterIntentionChanged'],
    judgement: 'StateOwner.ID==148007',
    condition: 'Arg1==148362 and UpperTarget.GetStateLayer(148383)==4',
    source: { table: 'Cmd', id: 148377, step: 3 }
  }]);
  assert.ok(result.conditionalStates.some(item =>
    item.ownerStateId === 148384
    && item.commandId === 148377
    && item.commandStep === 15
    && item.appliedStateId === 148395
    && item.condition === 'Arg1==148364 and UpperTarget.GetStateLayer(148394)>0'
  ));
  assert.ok(result.patternInterventions.some(item =>
    item.stateId === 148392
    && item.name === '임시 열광'
    && item.actionTypes.includes('BEAttachPostAction')
  ));
});

test('인자를 전달하는 공용 명령을 거쳐 패턴 개입의 원본 상태를 추적한다', () => {
  const tables = structuredClone(fixture.tables);
  tables.states[148388] = {
    ID: 148388,
    ShowType: 'Hide',
    TriggerCmd1: 148374,
    TriggerCond1: { 1: 'BSTAfterUseCard' }
  };
  tables.states[148389] = {
    ID: 148389,
    ShowType: 'Hide',
    TriggerCmd1: 126570,
    TriggerPara1: '148392,2',
    TriggerCond1: { 1: 'BSTStateOnAdd' }
  };
  tables.commands[148374] = {
    ID: 148374,
    data_list: { 1: { Type: 'BEAddState', Target: 'UpperTarget', Para: 148389 } }
  };

  const result = transformer.buildMonsterTemplate({ monsterId: 148007, tables });
  const intervention = result.patternInterventions.find(item => item.stateId === 148392);
  assert.deepEqual(intervention.sourceStateIds, [148385]);
});

test('하나의 몬스터 템플릿에 경계도별 실제 수치만 결합한다', () => {
  const sharedTemplate = template();
  for (const encounter of encounters) {
    const result = transformer.resolveMonsterEncounter(sharedTemplate, {
      encounterId: encounter.id,
      standard: encounter.standard
    });
    assert.deepEqual(
      [result.stats.hp, result.stats.attack, result.stats.defense],
      encounter.expected,
      encounter.id
    );
    assert.equal(result.monsterId, 148007);
    assert.equal(result.templateSource.id, 148007);
  }
});

test('일반형 몬스터와 각성체형 몬스터의 HP 공식을 구분한다', () => {
  const sharedTemplate = template();
  const standard = { StandardHp: 100000, StandardAtk: 1000, StandardDef: 5000, StandardTurn: 12 };
  const regular = transformer.calculateEncounterStats({
    ...sharedTemplate,
    classification: { ...sharedTemplate.classification, category: 'Monster' },
    statCoefficients: { proportion: 1, hpPercent: 0.8, attackPercent: 0.9, defensePercent: 0.2 }
  }, standard);
  const awaker = transformer.calculateEncounterStats({
    ...sharedTemplate,
    classification: { ...sharedTemplate.classification, category: 'AwakerMonster' },
    statCoefficients: { proportion: 1, hpPercent: 0.8, attackPercent: 0.9, defensePercent: 0.2 }
  }, standard);
  assert.equal(regular.hp, 79040);
  assert.equal(awaker.hp, 79400);
  assert.match(regular.source.hpFormula, /20\*StandardTurn\+10/);
  assert.match(awaker.source.hpFormula, /StandardDef/);
});

test('2페이즈 HP와 동적 스킬 수치를 정확성과 의존성으로 함께 표현한다', () => {
  const result = transformer.resolveMonsterEncounter(template(), {
    encounterId: encounters[3].id,
    standard: encounters[3].standard
  });
  assert.deepEqual(result.hpPhases, [
    { phaseIndex: 1, maxHp: 18185348 },
    { phaseIndex: 2, maxHp: 27278022 }
  ]);
  assert.equal(result.effectiveHp, 45463370);
  assert.equal(
    result.skills[148364].resolvedDescription,
    '3,757 피해를 1회 입히고, 적의 출혈 3 스택마다 피해 1 증가, 손실된 HP의 30% 회복.'
  );
  assert.deepEqual(result.skills[148364].args[0].dependencies, ['FrontEnemy.GetStateLayer(2840)']);
  assert.deepEqual(result.skills[148364].args[2].dependencies, ['CmdCaster.hp']);
  assert.equal(result.phaseSkills[1].skills[148365].args[3].display, 13639011);
  assert.match(result.phaseSkills[1].skills[148365].resolvedDescription, /13,639,011\(50%\)/);
  assert.deepEqual(result.diagnostics, []);
});

test('변환 결과에 임의 안내문이나 미치환 Arg를 만들지 않는다', () => {
  const result = transformer.resolveMonsterEncounter(template(), {
    encounterId: encounters[3].id,
    standard: encounters[3].standard
  });
  for (const phase of result.phaseSkills) {
    for (const skill of Object.values(phase.skills)) {
      assert.doesNotMatch(skill.resolvedDescription, /\bArg\d+\b/);
      assert.doesNotMatch(skill.resolvedDescription, /(권장|하세요|주의하세요|적용 상태)/);
    }
  }
});

test('단계의 숨은 상태를 먼저 합성해 장기전 의도 분기를 범용적으로 확정한다', () => {
  const tables = {
    stageGroups: {
      900: { ID: 900, StageChapterState: { 1: 100 } }
    },
    monsters: {
      1: {
        ID: 1,
        MonsterName: 'Monster_1|표본',
        InitSkillList: { 1: 10 },
        ExistState: { 1: 200 },
        StateLayers: '1',
        MonsterProportion: 1,
        MonsterHpPercent: 1,
        MonsterAtkPercent: 1,
        MonsterDefPercent: 0
      }
    },
    skills: {
      10: { ID: 10, Name: 'Skill_10|기본 행동' },
      20: { ID: 20, Name: 'Skill_20|응시' },
      21: { ID: 21, Name: 'Skill_21|모독' }
    },
    states: {
      100: { ID: 100, ShowType: 'Hide', TriggerCond1: { 1: 'StageState' }, TriggerCmd1: 1000 },
      101: { ID: 101, ShowType: 'Hide' },
      200: { ID: 200, ShowType: 'Hide', TriggerCond1: { 1: 'BSTAfterBoutBegin' }, TriggerCmd1: 2000 },
      201: {
        ID: 201,
        ShowType: 'Hide',
        TriggerCond1: { 1: 'BSTBeforeBoutEnd' },
        TriggerCmd1: 2001,
        Judgement1: '(StateOwner.GetStateLayer(201)==7 and PlayerRole.GetStateLayer(101)==0) or (StateOwner.GetStateLayer(201)>=5 and PlayerRole.GetStateLayer(101)>0)',
        TriggerCond2: { 1: 'BSTBeforeBoutEnd' },
        TriggerCmd2: 2002,
        Judgement2: 'StateOwner.GetStateLayer(201)>=8 and PlayerRole.GetStateLayer(101)==0'
      }
    },
    commands: {
      1000: { ID: 1000, data_list: { 1: { Type: 'BEAddState', Target: 'PlayerRole', Para: 101 } } },
      2000: { ID: 2000, data_list: { 1: { Type: 'BEAddState', Target: 'UpperTarget', Para: '201,1' } } },
      2001: { ID: 2001, data_list: { 1: { Type: 'BEMonsterChangeSkill', Target: 'CmdCaster', Para: 20 } } },
      2002: { ID: 2002, data_list: { 1: { Type: 'BEMonsterChangeSkill', Target: 'CmdCaster', Para: 21 } } }
    }
  };
  const stageContext = transformer.buildStageContext({ stageGroupId: 900, tables });
  const monster = transformer.buildMonsterTemplate({ monsterId: 1, tables });
  const resolved = transformer.resolveContextualActions(monster, { stageContext, tables });

  assert.equal(stageContext.stateLayers['PlayerRole.GetStateLayer(101)'], 1);
  assert.deepEqual(resolved.diagnostics, []);
  assert.equal(resolved.actions.length, 1);
  assert.equal(resolved.actions[0].skillId, 20);
  assert.equal(resolved.actions[0].judgement, 'StateOwner.GetStateLayer(201)>=5');
  assert.equal(resolved.actions[0].conditionText, '6턴부터 매 턴');
  assert.equal(resolved.actions[0].persistent, true);
});
