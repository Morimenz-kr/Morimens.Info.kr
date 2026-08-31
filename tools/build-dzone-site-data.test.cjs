const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const buildModule = import('./build-dzone-site-data.mjs');

async function writeDocument(directory, name, data) {
  await fs.writeFile(path.join(directory, name), JSON.stringify({ data }), 'utf8');
}

test('상태 명령으로 교체되는 몬스터 의도를 조건부 행동에 포함한다', async () => {
  const { buildDzoneSiteData } = await buildModule;
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'morimens-dzone-'));
  const staticDirectory = path.join(root, 'static');
  const basePath = path.join(root, 'base.json');
  const outputPath = path.join(root, 'out.json');
  await fs.mkdir(staticDirectory);
  await fs.writeFile(basePath, JSON.stringify({
    waves: [{
      wave: 1,
      encounters: [],
      monsters: [{ tid: 100, nameKo: '테스트 몬스터' }],
      alerts: [{ alert: 5, monsters: [{ tid: 100, hp: 1000, attack: 200, defense: 50 }] }]
    }]
  }), 'utf8');

  await writeDocument(staticDirectory, 'Config.MonsterConfig.json', {
    100: { InitSkillList: { 1: 200 }, CycleSkillList1: { 1: 200 }, ExistState: { 1: 300 }, MonsterTag: { 1: 90640, 2: 90645 } }
  });
  await writeDocument(staticDirectory, 'Text_KR.Text_MonsterConfig.json', {});
  await writeDocument(staticDirectory, 'Config.Skill.json', {
    200: { Name: 'Skill_200_Name|일반 공격', Desc: 'Skill_200_Desc|일반 피해', Type: { 1: 'Intent_Attack' }, Para: 'BattleAtkForce*1' },
    201: { Name: 'Skill_201_Name|특수 공격', Desc: 'Skill_201_Desc|강한 피해', Type: { 1: 'Intent_HeavyAttack' }, Para: 'BattleAtkForce*2' }
  });
  await writeDocument(staticDirectory, 'Text_KR.Text_Skill.json', {
    Skill_200_Name: { Text: '일반 공격' }, Skill_200_Desc: { Text: '일반 피해' },
    Skill_201_Name: { Text: '특수 공격' }, Skill_201_Desc: { Text: '강한 피해' }
  });
  await writeDocument(staticDirectory, 'Config.State.json', {
    300: { Name: 'State_300_Name|누적', Desc: 'State_300_Desc|10스택이면 특수 공격으로 전환한다.', Icon: 'IconS_Buff_061.png', ShowType: 'Normal', TriggerCmd1: 400, TriggerCond1: { 1: 'BSTStateOnAdd' } }
  });
  await writeDocument(staticDirectory, 'Text_KR.Text_State.json', {
    State_300_Name: { Text: '누적' }, State_300_Desc: { Text: '10스택이면 특수 공격으로 전환한다.' }
  });
  await writeDocument(staticDirectory, 'Config.Cmd.json', {
    400: { data_list: { 1: { Type: 'BEMonsterChangeSkill', Para: '201,1' } } }
  });
  await writeDocument(staticDirectory, 'Config.RelicConfig.json', {});
  await writeDocument(staticDirectory, 'Text_KR.Text_RelicConfig.json', {});

  await buildDzoneSiteData({ basePath, staticDirectory, outputPath });
  const output = JSON.parse(await fs.readFile(outputPath, 'utf8'));
  const monster = output.waves[0].monsters[0];
  assert.deepEqual(monster.monsterTags, [90640, 90645]);
  assert.deepEqual(monster.patterns[0].skillIds, [200]);
  assert.deepEqual(monster.conditionalActions, [{
    stateId: 300,
    commandId: 400,
    skillId: 201,
    judgement: '',
    triggerEvents: ['BSTStateOnAdd'],
    commandCondition: '',
    conditionText: ''
  }]);
  assert.deepEqual(monster.skills.map(skill => skill.id), [200, 201]);
  assert.equal(monster.states[0].icon, 'images/keyword-icons/original/icons_buff_061.png');
  assert.equal(output.waves[0].alerts[0].monsters[0].resolvedStates[0].icon, 'images/keyword-icons/original/icons_buff_061.png');
  assert.equal(output.waves[0].alerts[0].monsters[0].resolvedSkills['201'].description, '강한 피해');
});

test('일반 몬스터 HP는 방어 보정치를 HP 비율 바깥에서 차감한다', async () => {
  const { buildDzoneSiteData } = await buildModule;
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'morimens-dzone-hp-'));
  const staticDirectory = path.join(root, 'static');
  const basePath = path.join(root, 'base.json');
  const outputPath = path.join(root, 'out.json');
  await fs.mkdir(staticDirectory);
  await fs.writeFile(basePath, JSON.stringify({
    formulaNotes: { normalHp: 'old' },
    waves: [{
      wave: 1,
      encounters: [],
      monsters: [{ tid: 100, battleTag: 'MonsterGrade1', config: { MonsterProportion: 0.25, MonsterHpPercent: 1.05, MonsterDefPercent: 0.36 } }],
      alerts: [{
        alert: 4,
        standardRows: [{ BattleTag: 'MonsterGrade1', StandardHp: 1687703.18, StandardDef: 97627.33, StandardTurn: 4 }],
        monsters: [{ tid: 100, hp: 416019, attack: 534, defense: 9762, hpFormula: 'ceil(StandardHp*(MonsterProportion*MonsterHpPercent - MonsterDefPercent*StandardTurn/(20*StandardTurn+10)))', phases: [{ bar: 1, hp: 416019, maxHpMultiplier: 1 }] }]
      }]
    }]
  }), 'utf8');
  await writeDocument(staticDirectory, 'Config.MonsterConfig.json', { 100: {} });
  await writeDocument(staticDirectory, 'Text_KR.Text_MonsterConfig.json', {});
  await writeDocument(staticDirectory, 'Config.Skill.json', {});
  await writeDocument(staticDirectory, 'Text_KR.Text_Skill.json', {});
  await writeDocument(staticDirectory, 'Config.State.json', {});
  await writeDocument(staticDirectory, 'Text_KR.Text_State.json', {});
  await writeDocument(staticDirectory, 'Config.Cmd.json', {});
  await writeDocument(staticDirectory, 'Config.RelicConfig.json', {});
  await writeDocument(staticDirectory, 'Text_KR.Text_RelicConfig.json', {});

  await buildDzoneSiteData({ basePath, staticDirectory, outputPath });
  const output = JSON.parse(await fs.readFile(outputPath, 'utf8'));
  const stats = output.waves[0].alerts[0].monsters[0];
  assert.equal(stats.hp, 435993);
  assert.equal(stats.phases[0].hp, 435993);
  assert.equal(stats.effectiveHp, 435993);
  assert.match(stats.hpFormula, /StandardDef\*MonsterDefPercent\*StandardTurn\/20/);
});

test('인간형 각성체 보스는 각성체 전용 방어 보정치를 사용한다', async () => {
  const { buildDzoneSiteData } = await buildModule;
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'morimens-dzone-awakener-hp-'));
  const staticDirectory = path.join(root, 'static');
  const basePath = path.join(root, 'base.json');
  const outputPath = path.join(root, 'out.json');
  await fs.mkdir(staticDirectory);
  await fs.writeFile(basePath, JSON.stringify({
    waves: [{ wave: 3, encounters: [], monsters: [{ tid: 74035, battleTag: 'Boss', monsterClass: 'Boss', config: { MonsterProportion: 1, MonsterHpPercent: 1, MonsterDefPercent: 2.67 } }], alerts: [{ alert: 4, standardRows: [{ BattleTag: 'Boss', StandardHp: 7709681.13, StandardDef: 224772.04, StandardTurn: 12 }], monsters: [{ tid: 74035, hp: 1, attack: 2251, defense: 22477, hpFormula: 'old', phases: [{ bar: 1, hp: 1, maxHpMultiplier: 1 }] }] }] }]
  }), 'utf8');
  await writeDocument(staticDirectory, 'Config.MonsterConfig.json', { 74035: { MonsterClass: 'Boss', MonsterTag: { 1: 84277, 2: 90645 } } });
  await writeDocument(staticDirectory, 'Text_KR.Text_MonsterConfig.json', {});
  await writeDocument(staticDirectory, 'Config.Skill.json', {});
  await writeDocument(staticDirectory, 'Text_KR.Text_Skill.json', {});
  await writeDocument(staticDirectory, 'Config.State.json', {});
  await writeDocument(staticDirectory, 'Text_KR.Text_State.json', {});
  await writeDocument(staticDirectory, 'Config.Cmd.json', {});
  await writeDocument(staticDirectory, 'Config.RelicConfig.json', {});
  await writeDocument(staticDirectory, 'Text_KR.Text_RelicConfig.json', {});

  await buildDzoneSiteData({ basePath, staticDirectory, outputPath });
  const output = JSON.parse(await fs.readFile(outputPath, 'utf8'));
  const stats = output.waves[0].alerts[0].monsters[0];
  assert.equal(stats.hp, 7349597);
  assert.match(stats.hpFormula, /MonsterDefPercent\*StandardTurn\/20/);
});

test('엘리트 몬스터는 기준 8턴에 따른 0.4 방어 보정치를 사용한다', async () => {
  const { buildDzoneSiteData } = await buildModule;
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'morimens-dzone-elite-hp-'));
  const staticDirectory = path.join(root, 'static');
  const basePath = path.join(root, 'base.json');
  const outputPath = path.join(root, 'out.json');
  await fs.mkdir(staticDirectory);
  await fs.writeFile(basePath, JSON.stringify({
    waves: [{ wave: 4, encounters: [], monsters: [{ tid: 13967, battleTag: 'Elite', config: { MonsterProportion: 1, MonsterHpPercent: 1, MonsterDefPercent: 1.72 } }], alerts: [{ alert: 4, standardRows: [{ BattleTag: 'Elite', StandardHp: 3866124.54, StandardDef: 140090.53, StandardTurn: 8 }], monsters: [{ tid: 13967, hp: 1, attack: 1, defense: 1, hpFormula: 'old', phases: [{ bar: 1, hp: 1, maxHpMultiplier: 1 }] }] }] }]
  }), 'utf8');
  await writeDocument(staticDirectory, 'Config.MonsterConfig.json', { 13967: {} });
  await writeDocument(staticDirectory, 'Text_KR.Text_MonsterConfig.json', {});
  await writeDocument(staticDirectory, 'Config.Skill.json', {});
  await writeDocument(staticDirectory, 'Text_KR.Text_Skill.json', {});
  await writeDocument(staticDirectory, 'Config.State.json', {});
  await writeDocument(staticDirectory, 'Text_KR.Text_State.json', {});
  await writeDocument(staticDirectory, 'Config.Cmd.json', {});
  await writeDocument(staticDirectory, 'Config.RelicConfig.json', {});
  await writeDocument(staticDirectory, 'Text_KR.Text_RelicConfig.json', {});

  await buildDzoneSiteData({ basePath, staticDirectory, outputPath });
  const output = JSON.parse(await fs.readFile(outputPath, 'utf8'));
  assert.equal(output.waves[0].alerts[0].monsters[0].hp, 3769743);
});

test('사망 직전 각성은 2배 HP, 2단계 행동, 생성 카드를 함께 보존한다', async () => {
  const { buildDzoneSiteData } = await buildModule;
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'morimens-dzone-phase-'));
  const staticDirectory = path.join(root, 'static');
  const basePath = path.join(root, 'base.json');
  const outputPath = path.join(root, 'out.json');
  await fs.mkdir(staticDirectory);
  await fs.writeFile(basePath, JSON.stringify({
    waves: [{
      wave: 1,
      encounters: [],
      monsters: [{ tid: 100, battleTag: 'Boss', config: { MonsterProportion: 1, MonsterHpPercent: 1, MonsterDefPercent: 0 } }],
      alerts: [{
        alert: 4,
        standardRows: [{ BattleTag: 'Boss', StandardHp: 1000, StandardDef: 100, StandardTurn: 12 }],
        monsters: [{ tid: 100, hp: 1, attack: 200, defense: 10, phases: [{ bar: 1, hp: 1, maxHpMultiplier: 1 }, { bar: 2, hp: 1, maxHpMultiplier: 1 }] }]
      }]
    }]
  }), 'utf8');
  await writeDocument(staticDirectory, 'Config.MonsterConfig.json', {
    100: { ExistState: { 1: 300 }, CycleSkillList1: { 1: 200 }, CycleSkillList2: { 1: 201 } }
  });
  await writeDocument(staticDirectory, 'Text_KR.Text_MonsterConfig.json', {});
  await writeDocument(staticDirectory, 'Config.Skill.json', {
    200: { Name: 'Skill_200_Name|1단계 공격', Desc: 'Skill_200_Desc|공격', Type: { 1: 'Intent_Attack' }, Para: '1' },
    201: { Name: 'Skill_201_Name|2단계 공격', Desc: 'Skill_201_Desc|강한 공격', Type: { 1: 'Intent_HeavyAttack' }, Para: 'CmdCaster.max_hp*0.15' },
    202: { Name: 'Skill_202_Name|각성', Desc: 'Skill_202_Desc|각성한다.', Type: { 1: 'Intent_StrongBuff' }, CmdList: 501 },
    203: { Name: 'Skill_203_Name|살려줘', Desc: 'Skill_203_Desc|기절시키고 카드를 3장 뽑으며 산출력 3pt를 획득한다.', Type: { 1: 'Card_State' }, Cost: 0, CmdList: 502 },
    204: { Name: 'Skill_204_Name|기절', Desc: 'Skill_204_Desc|행동할 수 없음', Type: { 1: 'Intent_Dizzy' } }
  });
  await writeDocument(staticDirectory, 'Text_KR.Text_Skill.json', {
    Skill_200_Name: { Text: '1단계 공격' }, Skill_200_Desc: { Text: '공격' },
    Skill_201_Name: { Text: '2단계 공격' }, Skill_201_Desc: { Text: '강한 공격' },
    Skill_202_Name: { Text: '각성' }, Skill_202_Desc: { Text: '각성한다.' },
    Skill_203_Name: { Text: '살려줘' }, Skill_203_Desc: { Text: '기절시키고 카드를 3장 뽑으며 산출력 3pt를 획득한다.' },
    Skill_204_Name: { Text: '기절' }, Skill_204_Desc: { Text: '행동할 수 없음' }
  });
  await writeDocument(staticDirectory, 'Config.State.json', {
    300: { Name: 'State_300_Name|미각성', Desc: 'State_300_Desc|쓰러질 때 각성한다.', ShowType: 'Normal', TriggerCmd1: 400, TriggerCond1: { 1: 'BSTRoleBeforeDeath' } },
    301: { Name: 'State_301_Name|피해 면역', Desc: 'State_301_Desc|관통 피해가 아닌 피해에 면역', ShowType: 'Normal' }
  });
  await writeDocument(staticDirectory, 'Text_KR.Text_State.json', {
    State_300_Name: { Text: '미각성' }, State_300_Desc: { Text: '쓰러질 때 각성한다.' },
    State_301_Name: { Text: '피해 면역' }, State_301_Desc: { Text: '관통 피해가 아닌 피해에 면역' }
  });
  await writeDocument(staticDirectory, 'Config.Cmd.json', {
    400: { data_list: {
      1: { Type: 'BEPVERebirth', Para: 1 },
      2: { Type: 'BEChangeMaxHp', Para: 'CmdCaster.max_hp' },
      3: { Type: 'BEHeal', Para: 'CmdCaster.max_hp' },
      4: { Type: 'BEAddState', Para: '301,1' },
      5: { Type: 'BEMonsterChangeSkillList', Para: 2 },
      6: { Type: 'BEMonsterChangeSkill', Para: '202,1' }
    } },
    501: { data_list: { 1: { Type: 'BECreateCard', Target: 'GetCardByID(203,1)', Para: 'HandDeck,TOP,1' } } },
    502: { data_list: {
      1: { Type: 'BEMonsterChangeSkill', Para: '204,1' },
      2: { Type: 'BEDrawCard', Para: 3 },
      3: { Type: 'BEChangeEnergy', Para: 3 }
    } }
  });
  await writeDocument(staticDirectory, 'Config.RelicConfig.json', {});
  await writeDocument(staticDirectory, 'Text_KR.Text_RelicConfig.json', {});

  await buildDzoneSiteData({ basePath, staticDirectory, outputPath });
  const output = JSON.parse(await fs.readFile(outputPath, 'utf8'));
  const monster = output.waves[0].monsters[0];
  const stats = output.waves[0].alerts[0].monsters[0];
  assert.equal(monster.phaseTransitions[0].maxHpMultiplier, 2);
  assert.equal(monster.phaseTransitions[0].phaseIndex, 2);
  assert.deepEqual(monster.phaseTransitions[0].createdCards[0].effects, ['전방 적의 행동을 「기절」으로 변경', '카드 3장 뽑기', '산출력 3pt 획득']);
  assert.equal(stats.phases[0].hp, 1000);
  assert.equal(stats.phases[1].hp, 2000);
  assert.equal(stats.effectiveHp, 3000);
  assert.equal(stats.resolvedSkills['201'].args[0].value.display, 150);
  assert.equal(stats.phaseResolvedSkills['2']['201'].args[0].value.display, 300);
});

test('조건부 사망 저항은 HP 단계를 만들지 않고 다른 개체의 의도는 소환체에 연결한다', async () => {
  const { buildDzoneSiteData } = await buildModule;
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'morimens-dzone-target-'));
  const staticDirectory = path.join(root, 'static');
  await fs.mkdir(staticDirectory);
  const basePath = path.join(root, 'base.json'), outputPath = path.join(root, 'out.json');
  await fs.writeFile(basePath, JSON.stringify({ waves: [{ wave: 4, encounters: [],
    monsters: [{ tid: 100, nameKo: '소환자' }],
    alerts: [{ alert: 4, monsters: [{ tid: 100, hp: 1000, attack: 200, defense: 50,
      phases: [{ bar: 1, hp: 1000 }, { bar: 2, hp: 1250 }] }],
    summonedMonsters: [
      { tid: 101, parentTid: 100, hp: 999, attack: 999, defense: 999,
        phases: [{ bar: 1, hp: 999 }], effectiveHp: 999,
        rule: { hpExpression: 'CmdCaster.max_hp*0.02', attackExpression: 'CmdCaster.AtkForce*0.04', defenseExpression: 'CmdCaster.DefForce' } },
      { tid: 102, parentTid: 100, hp: 999, attack: 999,
        rule: { hpExpression: 'CmdCaster.max_hp*(0.015+0.0015*BattleStats.BoutCount)', attackExpression: 'CmdCaster.AtkForce*0.04' } }
    ] }]
  }] }));
  const tables = {
    MonsterConfig: { 100: { ExistState: { 1: 300, 2: 301 } }, 101: {}, 102: {} },
    Skill: { 201: { Para: 'BattleAtkForce*0.5', Desc: 'Skill_201_Desc|[Arg1] 피해' } },
    State: {
      300: { ShowType: 'Hide', TriggerCmd1: 400, TriggerCond1: { 1: 'BSTRoleBeforeDeath' } },
      301: { ShowType: 'Hide', TriggerCmd1: 401, TriggerCond1: { 1: 'BSTStateOnAdd' } }
    },
    Cmd: {
      400: { data_list: { 1: { Type: 'BEPVERebirth', Para: 1 },
        2: { Type: 'BEChangeMaxHp', Para: 'CmdCaster.max_hp*0.25', Cond: 'UpperTarget.GetStateLayer(999)==1' },
        3: { Type: 'BEHeal', Para: 'CmdCaster.max_hp*0.05' } } },
      401: { data_list: {
        1: { Type: 'BEMonsterChangeSkill', Para: '201,1', Target: 'GetMonsterByID(101)' },
        2: { Type: 'BEMonsterChangeSkill', Para: '201,1', Target: 'GetMonsterByID(102)' }
      } }
    }, RelicConfig: {}
  };
  for (const [name, data] of Object.entries(tables)) {
    await writeDocument(staticDirectory, `Config.${name}.json`, data);
    if (name !== 'Cmd') await writeDocument(staticDirectory, `Text_KR.Text_${name}.json`, {});
  }
  await buildDzoneSiteData({ basePath, staticDirectory, outputPath });
  const wave = JSON.parse(await fs.readFile(outputPath, 'utf8')).waves[0];
  assert.equal(wave.monsters[0].phaseTransitions.length, 0);
  assert.equal(wave.alerts[0].monsters[0].phases.length, 1);
  assert.equal(wave.monsters[0].conditionalActions.length, 0);
  for (const definition of wave.summonDefinitions) {
    assert.equal(definition.conditionalActions[0].skillId, 201);
    assert.equal(definition.conditionalActions[0].sourceMonsterTid, 100);
  }
  const [fixed, dynamic] = wave.alerts[0].summonedMonsters;
  assert.equal(fixed.hp, 20);
  assert.equal(fixed.phases[0].hp, 20);
  assert.equal(fixed.effectiveHp, 20);
  assert.equal(fixed.attack, 8);
  assert.equal(fixed.defense, 50);
  assert.equal(fixed.resolvedSkills['201'].args[0].value.display, 4);
  assert.equal(dynamic.hp, null);
  assert.equal(dynamic.phases[0].hp, null);
  assert.equal(dynamic.effectiveHp, null);
  assert.equal(dynamic.hpDisplay, '소환자의 최대 HP × (1.5% + 소환 턴 × 0.15%)');
});

test('소환 개체의 패턴과 조물의 연구 깊이 수식을 함께 생성한다', async () => {
  const { buildDzoneSiteData } = await buildModule;
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'morimens-dzone-'));
  const staticDirectory = path.join(root, 'static');
  const basePath = path.join(root, 'base.json');
  const outputPath = path.join(root, 'out.json');
  await fs.mkdir(staticDirectory);
  await fs.writeFile(basePath, JSON.stringify({
    waves: [{
      wave: 1,
      encounters: [],
      initialRelics: [{ id: 500 }],
      monsters: [{ tid: 100, nameKo: '소환자' }],
      alerts: [{
        alert: 5,
        monsters: [{ tid: 100, hp: 1000, attack: 200, defense: 50 }],
        summonedMonsters: [{
          parentTid: 100,
          tid: 101,
          nameKo: '소환물',
          hp: 300,
          attack: null,
          defense: 20,
          rule: { attackExpression: 'CmdCaster.atk*0.15' }
        }]
      }]
    }]
  }), 'utf8');
  await writeDocument(staticDirectory, 'Config.MonsterConfig.json', {
    100: {},
    101: {
      MonsterName: 'MonsterConfig_101_MonsterName|소환물',
      MiniIcon: 'Portraits/Minihead/Portrait_Small_Monster_Test.png',
      InitSkillList: { 1: 201 },
      CycleSkillList1: { 1: 201 }
    }
  });
  await writeDocument(staticDirectory, 'Text_KR.Text_MonsterConfig.json', {
    MonsterConfig_101_MonsterName: { Text: '소환물' }
  });
  await writeDocument(staticDirectory, 'Config.Skill.json', {
    201: { Name: 'Skill_201_Name|소환 공격', BattleDesc: 'Skill_201_Desc|[Arg1] 피해', Type: { 1: 'Intent_Attack' }, Para: 'BattleAtkForce*2' }
  });
  await writeDocument(staticDirectory, 'Text_KR.Text_Skill.json', {
    Skill_201_Name: { Text: '소환 공격' }, Skill_201_Desc: { Text: '[Arg1] 피해' }
  });
  await writeDocument(staticDirectory, 'Config.State.json', {});
  await writeDocument(staticDirectory, 'Text_KR.Text_State.json', {});
  await writeDocument(staticDirectory, 'Config.Cmd.json', {});
  await writeDocument(staticDirectory, 'Config.RelicConfig.json', {
    500: {
      Name: 'RelicConfig_500_Name|연구 조물',
      Desc: 'RelicConfig_500_Desc|[Arg1] 힘과 [Arg2] 중독',
      StoryDesc: 'RelicConfig_500_StoryDesc|이야기',
      StatePara: { 1: 'math.ceil(PlayerGrowth*0.1)', 2: 'math.ceil(InsightResearchDepth*0.06)' },
      Icon: 'Icon/Relic/Icon_Creation_001.png',
      Quality: 'Forged'
    }
  });
  await writeDocument(staticDirectory, 'Text_KR.Text_RelicConfig.json', {
    RelicConfig_500_Name: { Text: '연구 조물' },
    RelicConfig_500_Desc: { Text: '[Arg1] 힘과 [Arg2] 중독' },
    RelicConfig_500_StoryDesc: { Text: '이야기' }
  });

  await buildDzoneSiteData({ basePath, staticDirectory, outputPath });
  const output = JSON.parse(await fs.readFile(outputPath, 'utf8'));
  const wave = output.waves[0];
  assert.deepEqual(wave.summonDefinitions[0].patterns[0].skillIds, [201]);
  assert.equal(wave.summonDefinitions[0].webImage, 'images/dzone/monster/Portrait_Small_Monster_Test.webp');
  assert.equal(wave.alerts[0].summonedMonsters[0].attack, 30);
  assert.equal(wave.alerts[0].summonedMonsters[0].resolvedSkills['201'].description, '60 피해');
  assert.deepEqual(wave.initialRelics[0].parameters.map(parameter => [parameter.kind, parameter.coefficient]), [
    ['material', 0.1], ['spirit', 0.06]
  ]);
  assert.equal(wave.initialRelics[0].image, 'images/dzone/relic/icon_creation_001.webp');
});

test('상태 의존 수식은 기본값을 남기고 DescArg는 StateArg로 해결한다', async () => {
  const { buildDzoneSiteData } = await buildModule;
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'morimens-dzone-dynamic-'));
  const staticDirectory = path.join(root, 'static');
  const basePath = path.join(root, 'base.json');
  const outputPath = path.join(root, 'out.json');
  await fs.mkdir(staticDirectory);
  await fs.writeFile(basePath, JSON.stringify({
    waves: [{
      wave: 1,
      encounters: [],
      monsters: [{ tid: 100, nameKo: '적심 성도' }],
      alerts: [{ alert: 5, monsters: [{ tid: 100, hp: 1000, attack: 1216, defense: 50 }] }]
    }]
  }), 'utf8');
  await writeDocument(staticDirectory, 'Config.MonsterConfig.json', {
    100: { InitSkillList: { 1: 201, 2: 202, 3: 203 }, ExistState: { 1: 301 }, StateParams: '1,1,1,1' }
  });
  await writeDocument(staticDirectory, 'Text_KR.Text_MonsterConfig.json', {});
  await writeDocument(staticDirectory, 'Config.Skill.json', {
    201: {
      Name: 'Skill_201_Name|새로운 생명을 포옹하다',
      Desc: 'Skill_201_Desc|[Damage:Arg1] 피해를 [AttackTimes:Arg2]회 입히고, 피의 맹세 1 스택마다 [Arg3] 증가.',
      Type: { 1: 'Intent_Attack' },
      Para: 'BattleAtkForce*0.3+BattleAtkForce*0.035*CmdCaster.GetStateLayer(999),3,BattleAtkForce*0.035'
    },
    202: {
      Name: 'Skill_202_Name|미지원 계산식',
      Desc: 'Skill_202_Desc|[AttackTimes:Arg1]회',
      Type: { 1: 'Intent_Attack' },
      Para: 'UnknownCounter()'
    },
    203: {
      Name: 'Skill_203_Name|손패 연동',
      Desc: 'Skill_203_Desc|[AttackTimes:Arg1]회',
      Type: { 1: 'Intent_Attack' },
      Para: 'math.min(10,4+math.max(HandDeck.CardCount,PlayerRole.GetStateLayer(20692)))'
    }
  });
  await writeDocument(staticDirectory, 'Text_KR.Text_Skill.json', {});
  await writeDocument(staticDirectory, 'Config.State.json', {
    301: {
      Name: 'State_301_Name|피의 서약',
      Desc: 'State_301_Desc|적의 손패에 [DescArg1]장의 둔화 명령 카드가 있을 때마다 자신이 [DescArg2] 스택의 피의 맹세를 획득한다.',
      DescPara: { 1: 'StateArg1', 2: 'StateArg2' }, ShowType: 'Normal'
    }
  });
  await writeDocument(staticDirectory, 'Text_KR.Text_State.json', {});
  await writeDocument(staticDirectory, 'Config.Cmd.json', {});
  await writeDocument(staticDirectory, 'Config.RelicConfig.json', {});
  await writeDocument(staticDirectory, 'Text_KR.Text_RelicConfig.json', {});

  await buildDzoneSiteData({ basePath, staticDirectory, outputPath });
  const output = JSON.parse(await fs.readFile(outputPath, 'utf8'));
  const monster = output.waves[0].alerts[0].monsters[0];
  assert.equal(monster.resolvedSkills['201'].description, '기본 365 피해를 3회 입히고, 피의 맹세 1 스택마다 43 증가.');
  assert.equal(monster.resolvedSkills['202'].description, '[AttackTimes:Arg1]회');
  assert.equal(monster.resolvedSkills['203'].description, '기본 4회');
  assert.equal(monster.resolvedStates[0].description, '적의 손패에 둔화 명령 카드가 1장 있을 때마다 피의 맹세 1스택을 획득한다.');
});
