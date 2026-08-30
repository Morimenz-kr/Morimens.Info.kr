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
    300: { Name: 'State_300_Name|누적', Desc: 'State_300_Desc|10스택이면 특수 공격으로 전환한다.', ShowType: 'Normal', TriggerCmd1: 400, TriggerCond1: { 1: 'BSTStateOnAdd' } }
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
  assert.equal(output.waves[0].alerts[0].monsters[0].resolvedSkills['201'].description, '강한 피해');
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
