import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

function argument(name) {
  const index = process.argv.indexOf(name);
  if (index === -1 || !process.argv[index + 1]) {
    throw new Error(`${name} 값이 필요합니다.`);
  }
  return path.resolve(process.argv[index + 1]);
}

async function readJson(filePath) {
  return JSON.parse(await fs.readFile(filePath, 'utf8'));
}

function orderedValues(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return [];
  return Object.keys(value)
    .sort((left, right) => Number(left) - Number(right))
    .map(key => value[key]);
}

function splitTopLevel(value) {
  if (value === undefined || value === null || value === '') return [];
  if (typeof value === 'number') return [String(value)];
  const parts = [];
  let start = 0;
  let depth = 0;
  const source = String(value);
  for (let index = 0; index < source.length; index += 1) {
    if (source[index] === '(') depth += 1;
    if (source[index] === ')') depth -= 1;
    if (source[index] === ',' && depth === 0) {
      parts.push(source.slice(start, index).trim());
      start = index + 1;
    }
  }
  parts.push(source.slice(start).trim());
  return parts.filter(Boolean);
}

function stripGameMarkup(value) {
  return String(value || '')
    .replace(/<[^:>]+:([^>]+)>/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();
}

function localized(raw, catalog) {
  if (!raw) return '';
  if (typeof raw === 'object') {
    const first = orderedValues(raw)[0];
    return localized(first, catalog);
  }
  const [key, ...fallback] = String(raw).split('|');
  return catalog[key] || fallback.join('|') || key;
}

function textCatalog(document) {
  return Object.fromEntries(
    Object.entries(document.data || {}).map(([key, row]) => [key, row.Text || ''])
  );
}

const TYPE_LABELS = Object.freeze({
  Intent_Attack: '공격',
  Intent_HeavyAttack: '강공격',
  Intent_AttackBuff: '공격·강화',
  Intent_AttackDebuff: '공격·약화',
  Intent_AttackDefence: '공격·방어',
  Intent_Defence: '방어',
  Intent_DefenceBuff: '방어·강화',
  Intent_DefenceDebuff: '방어·약화',
  Intent_Buff: '강화',
  Intent_StrongBuff: '강력 강화',
  Intent_Debuff: '약화',
  Intent_StrongDebuff: '강력 약화',
  Intent_Burst: '특수 행동',
  Intent_Burst2: '특수 행동',
  Intent_Unknown: '특수 행동'
});

const TARGET_LABELS = Object.freeze({
  FrontEnemy: '전방 각성체',
  PlayerRole: '아군',
  RandomAwaker: '무작위 각성체',
  CmdCaster: '자신',
  AllAlly: '모든 적',
  FrontAlly: '전방 적'
});

function evaluateExpression(expression, stats, context = {}) {
  const original = String(expression || '');
  const dynamic = /GetStateLayer|\.tentacle_count|HandDeck\.CardCount/.test(original);
  let source = original
    .replaceAll('BattleAtkForce', String(stats.attack))
    .replaceAll('BattleDefForce', String(stats.defense))
    .replaceAll('CmdCaster.max_hp', String(stats.hp))
    .replaceAll('CmdCaster.hp', String(stats.hp))
    .replaceAll('CmdCaster.atk', String(stats.attack))
    .replaceAll('CmdCaster.def', String(stats.defense))
    .replaceAll('StateOwner.max_hp', String(stats.hp))
    .replaceAll('StateOwner.hp', String(stats.hp))
    .replaceAll('StateOwner.atk', String(stats.attack))
    .replaceAll('StateOwner.def', String(stats.defense))
    .replace(/GetMonsterByID\(\d+\)\.atk/g, String(stats.attack))
    .replace(/GetMonsterByID\(\d+\)\.max_hp/g, String(stats.hp))
    .replace(/CmdCaster\.GetStateLayer\((\d+)\)/g, (_, id) => String(context.stateLayers?.[id] ?? 0))
    .replace(/FrontEnemy\.GetStateLayer\(\d+\)/g, '0')
    .replace(/PlayerRole\.GetStateLayer\(\d+\)/g, '0')
    .replace(/StateArg(\d+)/g, (token, number) => {
      const value = context.stateArgs?.[Number(number) - 1]?.value?.raw;
      return value === undefined ? token : String(value);
    })
    .replaceAll('CmdCaster.tentacle_count', String(context.tentacleCount ?? 0))
    .replaceAll('HandDeck.CardCount', '0')
    .replaceAll('math.ceil', 'Math.ceil')
    .replaceAll('math.min', 'Math.min')
    .replaceAll('math.max', 'Math.max');
  if (!/^(?:[0-9+\-*/(),.\s]|Math\.(?:ceil|min|max))+$/.test(source)) return null;
  try {
    const value = Function(`"use strict"; return (${source});`)();
    if (!Number.isFinite(value)) return null;
    return { raw: value, display: Math.ceil(value), ...(dynamic ? { dynamic: true } : {}) };
  } catch {
    return null;
  }
}

function resolvedDisplay(value) {
  return value?.display === undefined
    ? null
    : new Intl.NumberFormat('ko-KR').format(value.display);
}

function resolveStateDescription(template, resolved) {
  let description = template;
  const replaceArgument = (kind, values) => {
    values.forEach((item, index) => {
      const display = resolvedDisplay(item.value);
      if (display === null) return;
      const number = index + 1;
      description = description
        .replace(new RegExp(`\\[[A-Za-z]+:${kind}${number}\\]`, 'g'), display)
        .replaceAll(`[${kind}${number}]`, display);
    });
  };
  replaceArgument('StateArg', resolved.stateArgs);
  replaceArgument('DescArg', resolved.descArgs);
  const layer = resolvedDisplay(resolved.initialLayer?.value);
  if (layer !== null) description = description.replaceAll('[Layer]', layer);
  return description
    .replace(/적의 손패에 ([\d,]+)장의 둔화 명령 카드가/g, '적의 손패에 둔화 명령 카드가 $1장')
    .replace(/자신이 ([\d,]+) 스택의 피의 맹세를/g, '피의 맹세 $1스택을')
    .replace(/명령 카드 ([\d,]+)장에 무작위로 ([\d,]+) 스택의 둔화를/g, '명령 카드 $1장에 둔화 $2스택을 무작위로');
}

function resolveDescription(template, args) {
  return template.replace(/\[(?:[A-Za-z]+:)?Arg(\d+)\]/g, (match, number) => {
    const resolved = args[Number(number) - 1]?.value;
    if (!resolved && !args[Number(number) - 1]?.expression && match.startsWith('[AttackTimes:')) return '1';
    if (!resolved) return match;
    const display = new Intl.NumberFormat('ko-KR').format(resolved.display);
    if (!resolved.dynamic) return display;
    const expression = args[Number(number) - 1]?.expression || '';
    if (/FrontEnemy\.GetStateLayer\(2840\)\/3/.test(expression)) {
      return `기본 ${display}(대상의 출혈 3스택당 +1)`;
    }
    return `기본 ${display}`;
  });
}

// Recalculate archived public snapshots without requiring game config files.
// Dynamic baselines exclude runtime stacks and hand cards; their conditions
// remain in the description instead of implying a fixed in-battle total.
export function resolveStoredSkillValues(snapshot) {
  for (const wave of snapshot.waves || []) {
    for (const alert of wave.alerts || []) {
      for (const monster of [...(alert.monsters || []), ...(alert.summonedMonsters || [])]) {
        for (const [id, skill] of Object.entries(monster.resolvedSkills || {})) {
          if (!/\[(?:[A-Za-z]+:)?Arg\d+\]/.test(skill.description)) continue;
          const args = skill.args.map(arg => ({
            ...arg,
            value: arg.value ?? evaluateExpression(arg.expression, monster)
          }));
          let description = resolveDescription(skill.description, args);
          if (/\[(?:[A-Za-z]+:)?Arg\d+\]/.test(description)) continue;
          if (id === '126447') {
            // This archived skill uses 0.35 ATK for damage but 0.30 ATK
            // for poison. Keep both source formulas, not the conflicting
            // template claim that poison equals 10% of the displayed damage.
            description = `기본 ${resolvedDisplay(args[0].value)}pt의 피해를 ${resolvedDisplay(args[1].value)}회 입히고, 중독 기본 ${resolvedDisplay(args[3].value)}스택을 부여한다. 손패 ${resolvedDisplay(args[4].value)}장에 연소를 부여한다.`;
          }
          if (args.some(arg => arg.expression.includes('GetStateLayer(126464)'))) {
            description += ' 청록색 불씨가 없는 상태의 기본 수치이며, 불씨 1스택당 1회 피해에 공격력의 2%가 추가된다.';
          }
          skill.args = args;
          skill.description = description;
        }
      }
    }
  }
  return snapshot;
}

function patternEntries(config) {
  return Object.entries(config)
    .filter(([key, value]) => (
      (key === 'InitSkillList' || /^CycleSkillList\d+$/.test(key))
      && value && typeof value === 'object'
    ))
    .map(([key, value]) => ({
      id: key === 'InitSkillList' ? 'opening' : key.replace('CycleSkillList', 'cycle-'),
      label: key === 'InitSkillList'
        ? '최초 행동'
        : `반복 행동 ${key.replace('CycleSkillList', '')}`,
      skillIds: orderedValues(value).filter(Number.isInteger)
    }))
    .sort((left, right) => {
      if (left.id === 'opening') return -1;
      if (right.id === 'opening') return 1;
      return left.id.localeCompare(right.id, 'ko');
    });
}

function triggerSlots(state) {
  return Object.entries(state)
    .filter(([key, value]) => /^TriggerCmd\d+$/.test(key) && Number.isInteger(value))
    .map(([key, commandId]) => {
      const suffix = key.replace('TriggerCmd', '');
      return {
        commandId,
        judgement: state[`Judgement${suffix}`] || '',
        triggerEvents: orderedValues(state[`TriggerCond${suffix}`]).map(String)
      };
    });
}

function humanizeCommandCondition(expression, states, skills, stateText, skillText) {
  if (!expression) return '';
  const fragments = String(expression).split(/\s+and\s+/i).flatMap(fragment => {
    const source = fragment.trim();
    if (/^LastConditionRet==[01]$/.test(source)) return [];

    const intention = source.match(/^TriggerValue2==([0-9]+)$/);
    if (intention) {
      const skill = skills[intention[1]] || {};
      const name = stripGameMarkup(localized(skill.Name, skillText));
      return name ? [`「${name}」 의도로 전환`] : [];
    }

    const stateLayer = source.match(/^(?:UpperTarget|CmdCaster|StateOwner)\.GetStateLayer\(([0-9]+)\)>=(\d+)$/);
    if (stateLayer) {
      const state = states[stateLayer[1]] || {};
      const name = stripGameMarkup(localized(state.Name, stateText));
      return name ? [`${name} ${stateLayer[2]}스택 이상`] : [];
    }
    return [];
  });
  return [...new Set(fragments)].join(' · ');
}

function conditionalActionEntries(stateIds, states, commands, skills, stateText, skillText) {
  const actions = [];
  const seen = new Set();
  for (const stateId of stateIds) {
    const state = states[String(stateId)] || {};
    for (const trigger of triggerSlots(state)) {
      const command = commands[String(trigger.commandId)] || {};
      for (const entry of orderedValues(command.data_list)) {
        if (entry?.Type !== 'BEMonsterChangeSkill') continue;
        const skillId = Number(splitTopLevel(entry.Para)[0]);
        if (!Number.isInteger(skillId) || !skills[String(skillId)]) continue;
        const key = `${stateId}:${trigger.commandId}:${skillId}:${entry.Cond || ''}`;
        if (seen.has(key)) continue;
        seen.add(key);
        actions.push({
          stateId,
          commandId: trigger.commandId,
          skillId,
          judgement: trigger.judgement,
          triggerEvents: trigger.triggerEvents,
          commandCondition: entry.Cond || '',
          conditionText: humanizeCommandCondition(entry.Cond, states, skills, stateText, skillText)
        });
      }
    }
  }
  return actions;
}

function researchParameter(expression, index) {
  const source = String(expression ?? '');
  const numeric = Number(source);
  if (source !== '' && Number.isFinite(numeric)) {
    return { index, expression: source, displayFormula: source, kind: 'fixed', label: '고정 수치', coefficient: null, fixedValue: numeric };
  }
  const definitions = [
    ['InsightResearchDepth', 'spirit', '영식 연구 깊이'],
    ['PlayerGrowth', 'material', '물상 연구 깊이(기록 각인 포함)'],
    ['GetAccountStageGrow()', 'material-base', '물상 연구 깊이 기본값'],
    ['PlayerRole.max_hp', 'max-hp', '최대 HP']
  ];
  const matched = definitions.find(([token]) => source.includes(token));
  const coefficientMatch = matched && source.match(new RegExp(`${matched[0].replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*\\*\\s*(0?\\.\\d+|\\d+(?:\\.\\d+)?)`));
  const displayFormula = source
    .replace(/^math\.ceil\((.*)\)$/i, '올림($1)')
    .replaceAll('InsightResearchDepth', '영식 연구 깊이')
    .replaceAll('PlayerGrowth', '물상 연구 깊이(기록 각인 포함)')
    .replaceAll('PlayerRole.GetStateLayer(71006)', '반격 보정 스택')
    .replaceAll('PlayerRole.max_hp', '최대 HP')
    .replaceAll('GetAccountStageGrow()', '물상 연구 깊이 기본값')
    .replace(/\b0\.\d+\b/g, value => `${Number(value) * 100}%`)
    .replaceAll('*', ' × ')
    .replaceAll('+', ' + ');
  return {
    index,
    expression: source,
    displayFormula,
    kind: matched?.[1] || 'formula',
    label: matched?.[2] || '전투 중 계산식',
    coefficient: coefficientMatch ? Number(coefficientMatch[1]) : null,
    fixedValue: null
  };
}

function relicImagePath(icon) {
  const basename = path.posix.basename(String(icon || ''))
    .replace(/\.png$/i, '.webp')
    .toLowerCase();
  return basename ? `images/dzone/relic/${basename}` : '';
}

function monsterImagePath(icon) {
  const basename = path.posix.basename(String(icon || ''))
    .replace(/\.png$/i, '.webp');
  return basename ? `images/dzone/monster/${basename}` : '';
}

function stateIconPath(icon) {
  const basename = path.posix.basename(String(icon || ''))
    .replace(/^IconS_/i, 'icons_')
    .toLowerCase();
  return basename ? `images/keyword-icons/original/${basename}` : '';
}

function normalizeMonsterHp(definition, stats, standardRows) {
  if (!definition?.config || !/StandardTurn/.test(String(stats.hpFormula || ''))) return;
  const standard = (standardRows || []).find(row => row.BattleTag === definition.battleTag);
  if (!standard) return;
  const proportion = Number(definition.config.MonsterProportion);
  const hpPercent = Number(definition.config.MonsterHpPercent);
  const defensePercent = Number(definition.config.MonsterDefPercent);
  if (![standard.StandardHp, standard.StandardDef, proportion, hpPercent, defensePercent].every(Number.isFinite)) return;

  const hp = Math.ceil(
    standard.StandardHp * proportion * hpPercent
    - standard.StandardDef * defensePercent * 0.2
  );
  stats.hp = hp;
  stats.hpFormula = 'ceil(StandardHp*MonsterProportion*MonsterHpPercent - StandardDef*MonsterDefPercent*0.2)';
  if (Array.isArray(stats.phases) && stats.phases.length) {
    stats.phases = stats.phases.map(phase => ({
      ...phase,
      hp: Math.ceil(hp * (Number(phase.maxHpMultiplier) || 1))
    }));
    stats.effectiveHp = stats.phases.reduce((sum, phase) => sum + phase.hp, 0);
  } else {
    stats.effectiveHp = hp;
  }
}

export async function buildDzoneSiteData({ basePath, staticDirectory, outputPath }) {
  const base = await readJson(basePath);
  const [monsterDocument, monsterTextDocument, skillDocument, skillTextDocument, stateDocument, stateTextDocument, commandDocument, relicDocument, relicTextDocument] = await Promise.all([
    readJson(path.join(staticDirectory, 'Config.MonsterConfig.json')),
    readJson(path.join(staticDirectory, 'Text_KR.Text_MonsterConfig.json')),
    readJson(path.join(staticDirectory, 'Config.Skill.json')),
    readJson(path.join(staticDirectory, 'Text_KR.Text_Skill.json')),
    readJson(path.join(staticDirectory, 'Config.State.json')),
    readJson(path.join(staticDirectory, 'Text_KR.Text_State.json')),
    readJson(path.join(staticDirectory, 'Config.Cmd.json')),
    readJson(path.join(staticDirectory, 'Config.RelicConfig.json')),
    readJson(path.join(staticDirectory, 'Text_KR.Text_RelicConfig.json'))
  ]);
  const monsters = monsterDocument.data || {};
  const skills = skillDocument.data || {};
  const states = stateDocument.data || {};
  const commands = commandDocument.data || {};
  const relics = relicDocument.data || {};
  const monsterText = textCatalog(monsterTextDocument);
  const skillText = textCatalog(skillTextDocument);
  const stateText = textCatalog(stateTextDocument);
  const relicText = textCatalog(relicTextDocument);

  const enrichMonsterDefinition = monster => {
    const config = monsters[String(monster.tid)] || {};
    monster.nameKo ||= stripGameMarkup(localized(config.MonsterName, monsterText));
    monster.description = stripGameMarkup(localized(config.Desc, monsterText));
    monster.monsterClass ||= config.MonsterClass || 'Common';
    monster.monsterTags = orderedValues(config.MonsterTag)
      .map(Number)
      .filter(Number.isFinite);
    monster.image ||= config.MiniIcon || '';
    monster.webImage = monsterImagePath(monster.image);
    monster.patterns = patternEntries(config);
    const stateIds = orderedValues(config.ExistState);
    const stateLayers = splitTopLevel(config.StateLayers);
    const stateParams = splitTopLevel(config.StateParams);
    monster.states = stateIds.map((stateId, index) => {
      const row = states[String(stateId)] || {};
      return {
        id: stateId,
        name: stripGameMarkup(localized(row.Name, stateText)),
        descriptionTemplate: stripGameMarkup(localized(row.Desc, stateText)),
        initialLayerExpression: stateLayers[index] || null,
        stateParamExpressions: stateParams,
        descParamExpressions: orderedValues(row.DescPara).map(String),
        icon: stateIconPath(row.Icon),
        visible: row.ShowType !== 'Hide'
      };
    });
    monster.conditionalActions = conditionalActionEntries(
      stateIds,
      states,
      commands,
      skills,
      stateText,
      skillText
    );
    const skillIds = [...new Set([
      ...monster.patterns.flatMap(pattern => pattern.skillIds),
      ...monster.conditionalActions.map(action => action.skillId)
    ])];
    monster.skills = skillIds.map(skillId => {
      const row = skills[String(skillId)] || {};
      const types = orderedValues(row.Type);
      const name = localized(row.Name, skillText);
      const fallbackName = types.map(type => TYPE_LABELS[type]).find(Boolean) || '행동';
      return {
        id: skillId,
        name: stripGameMarkup(name || fallbackName),
        hasOfficialName: Boolean(name),
        type: types[0] || '',
        typeLabel: types.map(type => TYPE_LABELS[type]).find(Boolean) || '행동',
        target: row.CmdTarget || '',
        targetLabel: TARGET_LABELS[row.CmdTarget] || row.CmdTarget || '조건에 따름',
        descriptionTemplate: stripGameMarkup(localized(row.BattleDesc || row.Desc, skillText)),
        para: row.Para ?? null,
        expressions: splitTopLevel(row.Para)
      };
    });
    return monster;
  };

  const resolveMonster = (definition, stats) => {
    const stateLayers = Object.fromEntries((definition?.states || []).map(state => {
      const value = state.initialLayerExpression
        ? evaluateExpression(state.initialLayerExpression, stats)
        : null;
      return [String(state.id), value?.raw ?? 0];
    }));
    const expressionContext = {
      stateLayers,
      tentacleCount: (definition?.states || []).some(state => state.id === 118118) ? 1 : 0
    };
    stats.resolvedSkills = Object.fromEntries((definition?.skills || []).map(skill => {
      const args = skill.expressions.map(expression => ({
        expression,
        value: evaluateExpression(expression, stats, expressionContext)
      }));
      return [String(skill.id), { args, description: resolveDescription(skill.descriptionTemplate, args) }];
    }));
    stats.resolvedStates = (definition?.states || []).map(state => {
      const stateArgs = state.stateParamExpressions.map(expression => ({
        expression,
        value: evaluateExpression(expression, stats, expressionContext)
      }));
      const resolved = {
        initialLayer: state.initialLayerExpression
          ? { expression: state.initialLayerExpression, value: evaluateExpression(state.initialLayerExpression, stats, expressionContext) }
          : null,
        stateArgs,
        descArgs: state.descParamExpressions.map(expression => ({
          expression,
          value: evaluateExpression(expression, stats, { ...expressionContext, stateArgs })
        }))
      };
      return {
        id: state.id,
        name: state.name,
        icon: state.icon,
        visible: state.visible,
        description: resolveStateDescription(state.descriptionTemplate, resolved),
        ...resolved
      };
    });
  };

  for (const wave of base.waves || []) {
    for (const monster of wave.monsters || []) enrichMonsterDefinition(monster);

    const summonedTidSet = new Set((wave.alerts || []).flatMap(alert =>
      (alert.summonedMonsters || []).map(monster => monster.tid)
    ));
    wave.summonDefinitions = [...summonedTidSet].map(tid => enrichMonsterDefinition({ tid }));

    wave.initialRelics = (wave.initialRelics || []).map(relic => {
      const row = relics[String(relic.id)] || {};
      const parameters = orderedValues(row.StatePara).map((expression, index) => researchParameter(expression, index + 1));
      return {
        ...relic,
        nameKo: stripGameMarkup(localized(row.Name, relicText) || relic.nameKo),
        description: stripGameMarkup(localized(row.Desc, relicText) || relic.descKo),
        battleDescription: stripGameMarkup(localized(row.BattleDesc || row.Desc, relicText) || relic.descKo),
        storyDescription: stripGameMarkup(localized(row.StoryDesc, relicText)),
        quality: row.Quality || '',
        iconSource: row.Icon || relic.icon || '',
        image: relicImagePath(row.Icon || relic.icon),
        parameters
      };
    });

    const staticByTid = new Map((wave.monsters || []).map(monster => [monster.tid, monster]));
    const summonByTid = new Map((wave.summonDefinitions || []).map(monster => [monster.tid, monster]));
    for (const alert of wave.alerts || []) {
      for (const monster of alert.monsters || []) {
        const definition = staticByTid.get(monster.tid);
        normalizeMonsterHp(definition, monster, alert.standardRows);
        resolveMonster(definition, monster);
      }
      for (const summon of alert.summonedMonsters || []) {
        const parent = (alert.monsters || []).find(monster => monster.tid === summon.parentTid);
        if (summon.attack == null && parent && summon.rule?.attackExpression) {
          summon.attack = evaluateExpression(summon.rule.attackExpression, parent)?.display ?? null;
        }
        if (summon.defense == null && parent && summon.rule?.defenseExpression) {
          summon.defense = evaluateExpression(summon.rule.defenseExpression, parent)?.display ?? null;
        }
        resolveMonster(summonByTid.get(summon.tid), summon);
      }
    }
  }

  base.schemaVersion = 3;
  if (base.formulaNotes?.normalHp) {
    base.formulaNotes.normalHp = 'ceil(StandardHp*MonsterProportion*MonsterHpPercent - StandardDef*MonsterDefPercent*0.2)';
  }
  base.source = {
    kind: base.source?.kind || 'local-config-ab-static-json',
    usesSkeyDbAsInput: false
  };
  base.summary = {
    waveCount: base.waves?.length || 0,
    encounterCount: base.waves?.reduce((sum, wave) => sum + (wave.encounters?.length || 0), 0) || 0,
    uniqueMonsterCount: new Set(base.waves?.flatMap(wave => [
      ...(wave.monsters?.map(monster => monster.tid) || []),
      ...(wave.summonDefinitions?.map(monster => monster.tid) || [])
    ])).size,
    summonedMonsterCount: new Set(base.waves?.flatMap(wave => wave.summonDefinitions?.map(monster => monster.tid) || [])).size,
    relicCount: new Set(base.waves?.flatMap(wave => wave.initialRelics?.map(relic => relic.id) || [])).size
  };

  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, `${JSON.stringify(base, null, 2)}\n`, 'utf8');
  return base.summary;
}

const isMain = process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url;
if (isMain) {
  buildDzoneSiteData({
    basePath: argument('--base'),
    staticDirectory: argument('--static'),
    outputPath: argument('--out')
  }).then(summary => console.log(JSON.stringify(summary, null, 2))).catch(error => {
    console.error(error.stack || error.message || error);
    process.exitCode = 1;
  });
}
