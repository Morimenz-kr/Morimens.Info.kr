const DEFAULT_ROUNDING = 'ceil';

function orderedValues(value) {
  if (!value || typeof value !== 'object') return [];
  return Object.keys(value)
    .sort((left, right) => Number(left) - Number(right))
    .map(key => value[key]);
}

function splitTopLevel(value) {
  if (value == null || value === '') return [];
  const source = String(value);
  const parts = [];
  let start = 0;
  let depth = 0;
  for (let index = 0; index < source.length; index += 1) {
    if (source[index] === '(') depth += 1;
    else if (source[index] === ')') depth -= 1;
    else if (source[index] === ',' && depth === 0) {
      parts.push(source.slice(start, index).trim());
      start = index + 1;
    }
  }
  parts.push(source.slice(start).trim());
  return parts.filter(Boolean);
}

function textKey(raw) {
  return String(raw || '').split('|', 1)[0];
}

function localizedExact(raw, catalog = {}) {
  if (!raw) return '';
  const [key, fallback = key] = String(raw).split('|', 2);
  const row = catalog[key];
  return typeof row === 'string' ? row : row?.Text ?? fallback;
}

function plainGameText(value) {
  return String(value || '').replace(/<[^:>]+:([^>]+)>/g, '$1');
}

function firstInteger(value) {
  const match = String(value ?? '').match(/-?\d+/);
  return match ? Number(match[0]) : null;
}

class ArithmeticParser {
  constructor(source) {
    this.source = source;
    this.index = 0;
  }

  skip() {
    while (/\s/.test(this.source[this.index] || '')) this.index += 1;
  }

  parse() {
    const value = this.expression();
    this.skip();
    if (this.index !== this.source.length) throw new Error(`지원하지 않는 수식: ${this.source.slice(this.index)}`);
    return value;
  }

  expression() {
    let value = this.term();
    while (true) {
      this.skip();
      const operator = this.source[this.index];
      if (operator !== '+' && operator !== '-') return value;
      this.index += 1;
      const right = this.term();
      value = operator === '+' ? value + right : value - right;
    }
  }

  term() {
    let value = this.factor();
    while (true) {
      this.skip();
      const operator = this.source[this.index];
      if (operator !== '*' && operator !== '/') return value;
      this.index += 1;
      const right = this.factor();
      value = operator === '*' ? value * right : value / right;
    }
  }

  factor() {
    this.skip();
    if (this.source[this.index] === '+') {
      this.index += 1;
      return this.factor();
    }
    if (this.source[this.index] === '-') {
      this.index += 1;
      return -this.factor();
    }
    if (this.source[this.index] === '(') {
      this.index += 1;
      const value = this.expression();
      this.skip();
      if (this.source[this.index] !== ')') throw new Error('닫는 괄호가 없습니다.');
      this.index += 1;
      return value;
    }
    const match = this.source.slice(this.index).match(/^(?:\d+(?:\.\d*)?|\.\d+)/);
    if (!match) throw new Error(`숫자를 읽을 수 없습니다: ${this.source.slice(this.index)}`);
    this.index += match[0].length;
    return Number(match[0]);
  }
}

function substituteRuntimeExpression(expression, context) {
  const dependencies = [];
  let source = String(expression ?? '');
  const replace = (pattern, value, dependency) => {
    if (pattern.test(source)) {
      pattern.lastIndex = 0;
      if (dependency) dependencies.push(dependency);
      source = source.replace(pattern, String(value));
    }
  };

  replace(/\bBattleAtkForce\b/g, context.attack, null);
  replace(/\bBattleDefForce\b/g, context.defense, null);
  replace(/\bCmdCaster\.max_hp\b/g, context.maxHp, null);
  replace(/\bCmdCaster\.hp\b/g, context.currentHp ?? context.maxHp, context.currentHp == null ? 'CmdCaster.hp' : null);
  replace(/\bPlayerRole\.max_hp\b/g, context.playerMaxHp ?? 0, context.playerMaxHp == null ? 'PlayerRole.max_hp' : null);
  replace(/\bPlayerRole\.hp\b/g, context.playerHp ?? context.playerMaxHp ?? 0, context.playerHp == null ? 'PlayerRole.hp' : null);
  replace(/\bPlayerGrowth\b/g, context.playerGrowth ?? 0, context.playerGrowth == null ? 'PlayerGrowth' : null);

  source = source.replace(/([A-Za-z][\w.]*)\.GetStateLayer\((\d+)\)/g, (_match, owner, stateId) => {
    const key = `${owner}.GetStateLayer(${stateId})`;
    dependencies.push(key);
    return String(context.stateLayers?.[key] ?? 0);
  });
  source = source.replace(/math\.ceil\(([^()]*)\)/g, (_match, inner) => String(Math.ceil(new ArithmeticParser(inner).parse())));
  source = source.replace(/math\.floor\(([^()]*)\)/g, (_match, inner) => String(Math.floor(new ArithmeticParser(inner).parse())));

  return { source, dependencies: [...new Set(dependencies)] };
}

export function evaluateCombatExpression(expression, context, { rounding = DEFAULT_ROUNDING } = {}) {
  if (expression == null || expression === '') return { expression: String(expression ?? ''), resolved: false };
  const substituted = substituteRuntimeExpression(expression, context);
  try {
    const raw = new ArithmeticParser(substituted.source).parse();
    const display = rounding === 'floor' ? Math.floor(raw) : rounding === 'none' ? raw : Math.ceil(raw);
    return {
      expression: String(expression),
      raw,
      display,
      dynamic: substituted.dependencies.length > 0,
      dependencies: substituted.dependencies,
      resolved: true
    };
  } catch (error) {
    return {
      expression: String(expression),
      resolved: false,
      dynamic: substituted.dependencies.length > 0,
      dependencies: substituted.dependencies,
      error: error.message
    };
  }
}

function resolveTemplateText(template, args) {
  const formatValue = value => typeof value === 'number'
    ? new Intl.NumberFormat('ko-KR', { maximumFractionDigits: 6 }).format(value)
    : String(value);
  const richText = String(template || '').replace(/\[(?:[A-Za-z]+:)?Arg(\d+)\]/g, (match, index) => {
    const value = args[Number(index) - 1];
    return value?.resolved ? formatValue(value.display) : match;
  });
  return { richText, text: plainGameText(richText) };
}

function tableData(value) {
  return value?.data || value || {};
}

function normalizeTables(input) {
  return {
    monsters: tableData(input.monsters || input.MonsterConfig),
    skills: tableData(input.skills || input.Skill),
    commands: tableData(input.commands || input.Cmd),
    states: tableData(input.states || input.State),
    stageGroups: tableData(input.stageGroups || input.StageGroup),
    textMonster: tableData(input.textMonster || input.TextMonsterConfig || input.text?.monster),
    textSkill: tableData(input.textSkill || input.TextSkill || input.text?.skill),
    textState: tableData(input.textState || input.TextState || input.text?.state)
  };
}

function stripOuterParentheses(value) {
  let source = String(value || '').trim();
  while (source.startsWith('(') && source.endsWith(')')) {
    let depth = 0;
    let wrapsWholeExpression = true;
    for (let index = 0; index < source.length; index += 1) {
      if (source[index] === '(') depth += 1;
      if (source[index] === ')') depth -= 1;
      if (depth === 0 && index < source.length - 1) {
        wrapsWholeExpression = false;
        break;
      }
    }
    if (!wrapsWholeExpression) break;
    source = source.slice(1, -1).trim();
  }
  return source;
}

function splitBooleanExpression(value, operator) {
  const source = String(value || '');
  const delimiter = ` ${operator} `;
  const parts = [];
  let depth = 0;
  let start = 0;
  for (let index = 0; index <= source.length - delimiter.length; index += 1) {
    if (source[index] === '(') depth += 1;
    if (source[index] === ')') depth -= 1;
    if (depth === 0 && source.slice(index, index + delimiter.length) === delimiter) {
      parts.push(source.slice(start, index).trim());
      start = index + delimiter.length;
      index = start - 1;
    }
  }
  if (!parts.length) return null;
  parts.push(source.slice(start).trim());
  return parts;
}

function parseBooleanExpression(value) {
  const source = stripOuterParentheses(value);
  const orParts = splitBooleanExpression(source, 'or');
  if (orParts) return { type: 'or', children: orParts.map(parseBooleanExpression) };
  const andParts = splitBooleanExpression(source, 'and');
  if (andParts) return { type: 'and', children: andParts.map(parseBooleanExpression) };
  return { type: 'atom', value: source };
}

function evaluateKnownComparison(value, stateLayers) {
  const source = String(value || '').replace(
    /([A-Za-z][\w.]*)\.GetStateLayer\((\d+)\)/g,
    (match, owner, stateId) => Object.hasOwn(stateLayers, `${owner}.GetStateLayer(${stateId})`)
      ? String(stateLayers[`${owner}.GetStateLayer(${stateId})`])
      : match
  );
  const match = source.match(/^\s*(-?\d+(?:\.\d+)?)\s*(==|~=|!=|>=|<=|>|<)\s*(-?\d+(?:\.\d+)?)\s*$/);
  if (!match) return { known: false, source };
  const left = Number(match[1]);
  const right = Number(match[3]);
  const result = {
    '==': left === right,
    '~=': left !== right,
    '!=': left !== right,
    '>=': left >= right,
    '<=': left <= right,
    '>': left > right,
    '<': left < right
  }[match[2]];
  return { known: true, value: result, source };
}

function simplifyBooleanNode(node, stateLayers) {
  if (node.type === 'atom') {
    const evaluated = evaluateKnownComparison(node.value, stateLayers);
    return evaluated.known ? { type: 'boolean', value: evaluated.value } : { ...node, value: evaluated.source };
  }
  const children = node.children.map(child => simplifyBooleanNode(child, stateLayers));
  if (node.type === 'and') {
    if (children.some(child => child.type === 'boolean' && !child.value)) return { type: 'boolean', value: false };
    const remaining = children.filter(child => child.type !== 'boolean');
    if (!remaining.length) return { type: 'boolean', value: true };
    if (remaining.length === 1) return remaining[0];
    return { ...node, children: remaining };
  }
  if (children.some(child => child.type === 'boolean' && child.value)) return { type: 'boolean', value: true };
  const remaining = children.filter(child => child.type !== 'boolean');
  if (!remaining.length) return { type: 'boolean', value: false };
  if (remaining.length === 1) return remaining[0];
  return { ...node, children: remaining };
}

function renderBooleanNode(node, parentType = '') {
  if (node.type === 'boolean') return node.value ? 'true' : 'false';
  if (node.type === 'atom') return node.value;
  const rendered = node.children.map(child => renderBooleanNode(child, node.type)).join(` ${node.type} `);
  return parentType && parentType !== node.type ? `(${rendered})` : rendered;
}

function simplifyCondition(value, stateLayers) {
  if (!value) return { active: true, expression: '', dependsOnContext: false };
  const contextKeys = Object.keys(stateLayers);
  const dependsOnContext = contextKeys.some(key => String(value).includes(key));
  const simplified = simplifyBooleanNode(parseBooleanExpression(value), stateLayers);
  return {
    active: simplified.type !== 'boolean' || simplified.value,
    expression: simplified.type === 'boolean' && simplified.value ? '' : renderBooleanNode(simplified),
    dependsOnContext
  };
}

function commandIds(value) {
  if (typeof value === 'number') return [value];
  return orderedValues(value).filter(Number.isInteger);
}

function patternRows(monster) {
  const rows = [];
  if (monster.InitSkillList) {
    rows.push({ kind: 'opening', sourceField: 'InitSkillList', skillIds: orderedValues(monster.InitSkillList) });
  }
  Object.keys(monster)
    .filter(key => /^CycleSkillList\d+$/.test(key))
    .sort((left, right) => Number(left.match(/\d+$/)[0]) - Number(right.match(/\d+$/)[0]))
    .forEach(key => rows.push({
      kind: 'cycle',
      cycleIndex: Number(key.match(/\d+$/)[0]),
      sourceField: key,
      skillIds: orderedValues(monster[key])
    }));
  return rows;
}

function actionReferences(effect) {
  const result = [];
  const paraId = firstInteger(effect.Para);
  if (effect.Type === 'BEExecuteCmd' && paraId != null) result.push({ table: 'commands', id: paraId, relation: 'execute-command' });
  if (['BEAddState', 'BERemoveState', 'BESubStateLayer'].includes(effect.Type) && paraId != null) {
    result.push({ table: 'states', id: paraId, relation: effect.Type });
  }
  if (['BEMonsterChangeSkill', 'BEAttachPostAction'].includes(effect.Type) && paraId != null) {
    result.push({ table: 'skills', id: paraId, relation: effect.Type });
  }
  for (const match of String(effect.Target || '').matchAll(/GetCardByID\((\d+)/g)) {
    result.push({ table: 'skills', id: Number(match[1]), relation: 'created-card' });
  }
  return result;
}

function walkReferences(tables, seeds) {
  const selected = { skills: new Set(seeds.skills), commands: new Set(), states: new Set(seeds.states) };
  const evidence = [];
  const queue = [
    ...[...selected.skills].map(id => ({ table: 'skills', id })),
    ...[...selected.states].map(id => ({ table: 'states', id }))
  ];
  const visited = new Set();

  while (queue.length) {
    const current = queue.shift();
    const visitKey = `${current.table}.${current.id}`;
    if (visited.has(visitKey)) continue;
    visited.add(visitKey);
    const row = tables[current.table][String(current.id)];
    if (!row) continue;
    const references = [];
    if (current.table === 'skills') {
      commandIds(row.CmdList).forEach(id => references.push({ table: 'commands', id, relation: 'CmdList' }));
    } else if (current.table === 'states') {
      Object.entries(row).forEach(([field, value]) => {
        if (/^TriggerCmd\d+$/.test(field) && Number.isInteger(value)) references.push({ table: 'commands', id: value, relation: field });
      });
    } else if (current.table === 'commands') {
      Object.entries(row.data_list || {}).forEach(([step, effect]) => {
        actionReferences(effect).forEach(reference => references.push({ ...reference, step }));
      });
    }
    for (const reference of references) {
      if (!tables[reference.table][String(reference.id)]) continue;
      selected[reference.table].add(reference.id);
      evidence.push({ from: visitKey, step: reference.step || null, relation: reference.relation, to: `${reference.table}.${reference.id}` });
      queue.push({ table: reference.table, id: reference.id });
    }
  }
  return { selected, evidence };
}

function stateTemplate(id, row, tables, initialLayerExpression = null) {
  return {
    id,
    name: localizedExact(row.Name, tables.textState),
    nameSource: textKey(row.Name),
    descriptionTemplate: localizedExact(row.Desc, tables.textState),
    descriptionSource: textKey(row.Desc),
    visible: row.ShowType !== 'Hide' && Boolean(row.Name || row.Desc),
    showType: row.ShowType || '',
    iconSource: row.Icon || '',
    initialLayerExpression,
    triggerEvents: Object.entries(row)
      .filter(([key]) => /^TriggerCond\d+$/.test(key))
      .flatMap(([, value]) => orderedValues(value)),
    triggerCommands: Object.entries(row)
      .filter(([key]) => /^TriggerCmd\d+$/.test(key))
      .map(([field, commandId]) => ({ field, commandId })),
    judgements: Object.entries(row)
      .filter(([key]) => /^Judgement\d+$/.test(key))
      .map(([field, expression]) => ({ field, expression })),
    source: { table: 'State', id }
  };
}

function skillTemplate(id, row, tables) {
  const para = row.Para ?? '';
  return {
    id,
    name: localizedExact(row.Name, tables.textSkill),
    nameSource: textKey(row.Name),
    descriptionTemplate: localizedExact(row.Desc || row.BattleDesc, tables.textSkill),
    descriptionSource: textKey(row.Desc || row.BattleDesc),
    type: orderedValues(row.Type)[0] || row.Type || '',
    target: row.CmdTarget || '',
    para,
    expressions: splitTopLevel(para),
    commandIds: commandIds(row.CmdList),
    source: { table: 'Skill', id }
  };
}

function transitionRows(graph, tables) {
  const transitions = [];
  for (const stateId of graph.selected.states) {
    const state = tables.states[String(stateId)];
    if (!state) continue;
    for (const trigger of Object.entries(state).filter(([key]) => /^TriggerCmd\d+$/.test(key))) {
      const suffix = trigger[0].replace('TriggerCmd', '');
      const commandId = trigger[1];
      const command = tables.commands[String(commandId)];
      const actions = orderedValues(command?.data_list);
      if (!actions.some(action => action.Type === 'BEPVERebirth')) continue;
      const maxHpAction = actions.find(action => action.Type === 'BEChangeMaxHp');
      const maxHpMatch = String(maxHpAction?.Para || '').match(/^CmdCaster\.max_hp\*([0-9.]+)$/);
      transitions.push({
        stateId,
        commandId,
        triggerEvents: orderedValues(state[`TriggerCond${suffix}`]),
        judgement: state[`Judgement${suffix}`] || '',
        rebirth: true,
        maxHpAddedMultiplier: maxHpMatch ? Number(maxHpMatch[1]) : null,
        maxHpMultiplier: maxHpMatch ? 1 + Number(maxHpMatch[1]) : null,
        healsToMax: actions.some(action => action.Type === 'BEHeal' && action.Para === 'CmdCaster.max_hp'),
        targetSkillList: firstInteger(actions.find(action => action.Type === 'BEMonsterChangeSkillList')?.Para),
        forcedSkillIds: actions.filter(action => action.Type === 'BEMonsterChangeSkill').map(action => firstInteger(action.Para)).filter(Number.isInteger),
        addedStateIds: actions.filter(action => action.Type === 'BEAddState').map(action => firstInteger(action.Para)).filter(Number.isInteger),
        source: { table: 'Cmd', id: commandId }
      });
    }
  }
  return transitions;
}

function conditionalActionRows(graph, transitions, tables) {
  const transitionCommands = new Set(transitions.map(item => item.commandId));
  const result = [];
  for (const stateId of graph.selected.states) {
    const state = tables.states[String(stateId)];
    if (!state) continue;
    for (const [field, commandId] of Object.entries(state).filter(([key]) => /^TriggerCmd\d+$/.test(key))) {
      if (transitionCommands.has(commandId)) continue;
      const suffix = field.replace('TriggerCmd', '');
      const command = tables.commands[String(commandId)];
      Object.entries(command?.data_list || {}).forEach(([step, action]) => {
        if (action.Type !== 'BEMonsterChangeSkill') return;
        const skillId = firstInteger(action.Para);
        if (!Number.isInteger(skillId)) return;
        const triggerEvents = orderedValues(state[`TriggerCond${suffix}`]);
        const sourceSkillMatch = triggerEvents.includes('BSTAfterIntentionChanged')
          ? String(action.Cond || '').match(/(?:^|\W)Arg1\s*==\s*(\d+)/)
          : null;
        const sourceSkillId = sourceSkillMatch ? Number(sourceSkillMatch[1]) : null;
        result.push({
          stateId,
          commandId,
          commandStep: Number(step),
          skillId,
          ...(Number.isInteger(sourceSkillId) ? { sourceSkillId } : {}),
          triggerEvents,
          judgement: state[`Judgement${suffix}`] || '',
          condition: action.Cond || '',
          source: { table: 'Cmd', id: commandId, step: Number(step) }
        });
      });
    }
  }
  return result;
}

function conditionalStateRows(graph, tables) {
  const result = [];
  for (const ownerStateId of graph.selected.states) {
    const ownerState = tables.states[String(ownerStateId)];
    if (!ownerState) continue;
    for (const [field, commandId] of Object.entries(ownerState).filter(([key]) => /^TriggerCmd\d+$/.test(key))) {
      const suffix = field.replace('TriggerCmd', '');
      const command = tables.commands[String(commandId)];
      Object.entries(command?.data_list || {}).forEach(([step, action]) => {
        if (action.Type !== 'BEAddState' || !action.Cond) return;
        const appliedStateId = firstInteger(action.Para);
        if (!Number.isInteger(appliedStateId) || !tables.states[String(appliedStateId)]) return;
        result.push({
          ownerStateId,
          commandId,
          commandStep: Number(step),
          appliedStateId,
          target: action.Target || '',
          triggerEvents: orderedValues(ownerState[`TriggerCond${suffix}`]),
          judgement: ownerState[`Judgement${suffix}`] || '',
          condition: action.Cond,
          source: { table: 'Cmd', id: commandId, step: Number(step) }
        });
      });
    }
  }
  return result;
}

const PATTERN_INTERVENTION_ACTIONS = new Set([
  'BEAttachPostAction',
  'BEForceExecSkill',
  'BEMonsterChangeSkill',
  'BEMonsterChangeSkillList'
]);

function traceStateBehavior(rootStateId, tables) {
  const reachedStateIds = new Set();
  const actionTypes = new Set();
  const queue = [{ table: 'states', id: rootStateId }];
  const visited = new Set();
  while (queue.length) {
    const current = queue.shift();
    const key = `${current.table}.${current.id}:${(current.args || []).join(',')}`;
    if (visited.has(key)) continue;
    visited.add(key);
    const row = tables[current.table][String(current.id)];
    if (!row) continue;
    if (current.table === 'states') {
      reachedStateIds.add(current.id);
      Object.entries(row).forEach(([field, commandId]) => {
        if (!/^TriggerCmd\d+$/.test(field) || !Number.isInteger(commandId)) return;
        const suffix = field.replace('TriggerCmd', '');
        queue.push({
          table: 'commands',
          id: commandId,
          args: splitTopLevel(row[`TriggerPara${suffix}`])
        });
      });
      continue;
    }
    for (const action of orderedValues(row.data_list)) {
      actionTypes.add(action.Type);
      const resolvedPara = String(action.Para ?? '').replace(/\bArg(\d+)\b/g, (match, index) =>
        current.args?.[Number(index) - 1] ?? match);
      const para = splitTopLevel(resolvedPara);
      const paraId = firstInteger(para[0]);
      if (action.Type === 'BEExecuteCmd' && Number.isInteger(paraId)) {
        queue.push({ table: 'commands', id: paraId, args: para.slice(1) });
      }
      if (action.Type === 'BEAddState' && Number.isInteger(paraId)) queue.push({ table: 'states', id: paraId });
    }
  }
  return { reachedStateIds, actionTypes };
}

function patternInterventionRows(graph, initialStateIds, tables) {
  const traces = new Map([...graph.selected.states].map(stateId => [stateId, traceStateBehavior(stateId, tables)]));
  const visibleInitialStateIds = initialStateIds.filter(stateId => {
    const state = tables.states[String(stateId)];
    return state?.ShowType !== 'Hide' && Boolean(state.Name || state.Desc);
  });
  return [...graph.selected.states]
    .filter(stateId => !initialStateIds.includes(stateId))
    .map(stateId => ({ stateId, state: tables.states[String(stateId)], trace: traces.get(stateId) }))
    .filter(item => item.state?.ShowType !== 'Hide' && item.state.Desc
      && [...item.trace.actionTypes].some(type => PATTERN_INTERVENTION_ACTIONS.has(type)))
    .map(item => ({
      stateId: item.stateId,
      name: localizedExact(item.state.Name, tables.textState),
      descriptionTemplate: localizedExact(item.state.Desc, tables.textState),
      iconSource: item.state.Icon || '',
      triggerEvents: Object.entries(item.state)
        .filter(([field]) => /^TriggerCond\d+$/.test(field))
        .flatMap(([, value]) => orderedValues(value)),
      actionTypes: [...item.trace.actionTypes].filter(type => PATTERN_INTERVENTION_ACTIONS.has(type)),
      sourceStateIds: visibleInitialStateIds.filter(sourceStateId =>
        traces.get(sourceStateId)?.reachedStateIds.has(item.stateId)),
      source: { table: 'State', id: item.stateId }
    }));
}

const IMMEDIATE_STAGE_EVENTS = new Set([
  'StageState',
  'BSTStateOnAdd',
  'BSTBeforeBattleBegin',
  'BSTAfterBattleBegin'
]);

function stateTriggerRows(state) {
  return Object.entries(state || {})
    .filter(([field]) => /^TriggerCmd\d+$/.test(field))
    .map(([field, commandId]) => {
      const suffix = field.replace('TriggerCmd', '');
      return {
        commandId,
        events: orderedValues(state[`TriggerCond${suffix}`]),
        judgement: state[`Judgement${suffix}`] || ''
      };
    });
}

export function buildStageContext({ stageGroupId, tables: inputTables }) {
  const tables = normalizeTables(inputTables);
  const stageGroup = tables.stageGroups[String(stageGroupId)];
  if (!stageGroup) throw new Error(`StageGroup ${stageGroupId}을 찾을 수 없습니다.`);

  const stateLayers = {};
  const activeStateIds = new Set();
  const evidence = [];
  const queue = orderedValues(stageGroup.StageChapterState)
    .filter(Number.isInteger)
    .map(stateId => ({ stateId, owner: 'StageState', source: { table: 'StageGroup', id: stageGroupId } }));
  const visited = new Set();

  while (queue.length) {
    const current = queue.shift();
    const visitKey = `${current.owner}.${current.stateId}`;
    if (visited.has(visitKey)) continue;
    visited.add(visitKey);
    activeStateIds.add(current.stateId);
    stateLayers[`${current.owner}.GetStateLayer(${current.stateId})`] = 1;
    const state = tables.states[String(current.stateId)];
    if (!state) continue;

    for (const trigger of stateTriggerRows(state)) {
      if (!trigger.events.some(event => IMMEDIATE_STAGE_EVENTS.has(event))) continue;
      const judgement = simplifyCondition(trigger.judgement, stateLayers);
      if (!judgement.active || judgement.expression) continue;
      const command = tables.commands[String(trigger.commandId)];
      for (const [step, action] of Object.entries(command?.data_list || {})) {
        if (action.Type !== 'BEAddState') continue;
        const target = action.Target || '';
        const addedStateId = firstInteger(action.Para);
        if (!target || !Number.isInteger(addedStateId) || !tables.states[String(addedStateId)]) continue;
        const actionCondition = simplifyCondition(action.Cond || '', stateLayers);
        if (!actionCondition.active || actionCondition.expression) continue;
        const layerParts = splitTopLevel(action.Para);
        const layer = Number(layerParts[1] || 1);
        const stateKey = `${target}.GetStateLayer(${addedStateId})`;
        stateLayers[stateKey] = (stateLayers[stateKey] || 0) + (Number.isFinite(layer) ? layer : 1);
        evidence.push({
          from: `states.${current.stateId}`,
          commandId: trigger.commandId,
          commandStep: Number(step),
          event: trigger.events,
          target,
          addedStateId,
          to: stateKey
        });
        queue.push({ stateId: addedStateId, owner: target, source: { table: 'Cmd', id: trigger.commandId, step: Number(step) } });
      }
    }
  }

  return {
    stageGroupId,
    stageStateIds: orderedValues(stageGroup.StageChapterState).filter(Number.isInteger),
    activeStateIds: [...activeStateIds].sort((left, right) => left - right),
    stateLayers,
    evidence,
    source: { table: 'StageGroup', id: stageGroupId }
  };
}

function counterAdvanceRows(template, tables) {
  const result = [];
  for (const stateId of template.initialStateIds) {
    const state = tables.states[String(stateId)];
    for (const trigger of stateTriggerRows(state)) {
      const command = tables.commands[String(trigger.commandId)];
      for (const [step, action] of Object.entries(command?.data_list || {})) {
        if (action.Type !== 'BEAddState') continue;
        const counterStateId = firstInteger(action.Para);
        if (!Number.isInteger(counterStateId)) continue;
        result.push({
          ownerStateId: stateId,
          counterStateId,
          commandId: trigger.commandId,
          commandStep: Number(step),
          triggerEvents: trigger.events,
          target: action.Target || '',
          amount: Number(splitTopLevel(action.Para)[1] || 1)
        });
      }
    }
  }
  return result;
}

function timingCondition(expression, action, advances) {
  const match = String(expression || '').match(/^StateOwner\.GetStateLayer\((\d+)\)\s*(==|>=|>)\s*(\d+)$/);
  if (!match) return null;
  const counterStateId = Number(match[1]);
  const operator = match[2];
  const threshold = Number(match[3]);
  const advance = advances.find(item => item.counterStateId === counterStateId && item.amount > 0);
  if (!advance) return null;

  const changesNextTurn = action.triggerEvents.includes('BSTBeforeBoutEnd')
    && advance.triggerEvents.includes('BSTAfterBoutBegin');
  const firstCounterLayer = operator === '>' ? threshold + 1 : threshold;
  const firstTurn = firstCounterLayer + (changesNextTurn ? 1 : 0);
  return {
    counterStateId,
    operator,
    threshold,
    firstTurn,
    persistent: operator === '>=' || operator === '>',
    conditionText: operator === '>=' || operator === '>' ? `${firstTurn}턴부터 매 턴` : `${firstTurn}턴`,
    evidence: advance
  };
}

export function resolveContextualActions(template, { stageContext, tables: inputTables }) {
  const tables = normalizeTables(inputTables);
  const advances = counterAdvanceRows(template, tables);
  const diagnostics = [];
  const actions = [];

  for (const action of template.conditionalActions) {
    const judgement = simplifyCondition(action.judgement, stageContext?.stateLayers || {});
    const condition = simplifyCondition(action.condition, stageContext?.stateLayers || {});
    const dependsOnStageContext = judgement.dependsOnContext || condition.dependsOnContext;
    if (!dependsOnStageContext) continue;
    if (!judgement.active || !condition.active) continue;
    const remainingExpression = [judgement.expression, condition.expression].filter(Boolean).join(' and ');
    const timing = timingCondition(remainingExpression, action, advances);
    if (!timing) {
      diagnostics.push({
        kind: 'unresolved-contextual-action-timing',
        monsterId: template.monsterId,
        skillId: action.skillId,
        expression: remainingExpression,
        source: action.source
      });
      continue;
    }
    actions.push({
      ...action,
      judgement: judgement.expression,
      condition: condition.expression,
      conditionText: timing.conditionText,
      firstTurn: timing.firstTurn,
      persistent: timing.persistent,
      contextResolved: true,
      stageGroupId: stageContext.stageGroupId,
      contextEvidence: stageContext.evidence.filter(item =>
        String(action.judgement).includes(`GetStateLayer(${item.addedStateId})`)
        || String(action.condition).includes(`GetStateLayer(${item.addedStateId})`)
      ),
      timingEvidence: timing.evidence
    });
  }
  return { actions, diagnostics };
}

export function buildMonsterTemplate({ monsterId, tables: inputTables }) {
  const tables = normalizeTables(inputTables);
  const monster = tables.monsters[String(monsterId)];
  if (!monster) throw new Error(`MonsterConfig ${monsterId}을 찾을 수 없습니다.`);
  const patterns = patternRows(monster);
  const initialStateIds = orderedValues(monster.ExistState).filter(Number.isInteger);
  const initialLayers = splitTopLevel(monster.StateLayers);
  const graph = walkReferences(tables, {
    skills: patterns.flatMap(pattern => pattern.skillIds),
    states: initialStateIds
  });
  const skills = Object.fromEntries([...graph.selected.skills]
    .filter(id => tables.skills[String(id)])
    .sort((left, right) => left - right)
    .map(id => [id, skillTemplate(id, tables.skills[String(id)], tables)]));
  const states = Object.fromEntries([...graph.selected.states]
    .filter(id => tables.states[String(id)])
    .sort((left, right) => left - right)
    .map(id => {
      const initialIndex = initialStateIds.indexOf(id);
      return [id, stateTemplate(id, tables.states[String(id)], tables, initialIndex >= 0 ? initialLayers[initialIndex] || null : null)];
    }));
  const transitions = transitionRows(graph, tables);
  const conditionalActions = conditionalActionRows(graph, transitions, tables);
  const conditionalStates = conditionalStateRows(graph, tables);
  const patternInterventions = patternInterventionRows(graph, initialStateIds, tables);

  return {
    schemaVersion: 1,
    monsterId,
    name: localizedExact(monster.MonsterName, tables.textMonster),
    nameSource: textKey(monster.MonsterName),
    description: localizedExact(monster.Desc, tables.textMonster),
    descriptionSource: textKey(monster.Desc),
    classification: {
      battleTag: monster.BattleTag || '',
      monsterClass: monster.MonsterClass || '',
      category: monster.Category || ''
    },
    configuredHpBars: Number(monster.MonsterHpNum || 1),
    statCoefficients: {
      proportion: Number(monster.MonsterProportion ?? 1),
      hpPercent: Number(monster.MonsterHpPercent ?? 1),
      attackPercent: Number(monster.MonsterAtkPercent ?? 1),
      defensePercent: Number(monster.MonsterDefPercent ?? 0)
    },
    imageSource: monster.MiniIcon || '',
    patterns,
    initialStateIds,
    skills,
    states,
    transitions,
    conditionalActions,
    conditionalStates,
    patternInterventions,
    evidence: graph.evidence,
    source: { table: 'MonsterConfig', id: monsterId }
  };
}

export function calculateEncounterStats(template, standard) {
  const coefficients = template.statCoefficients;
  const awakerMonster = template.classification.category === 'AwakerMonster';
  const hp = awakerMonster
    ? Math.ceil(standard.StandardHp * coefficients.proportion * coefficients.hpPercent
      - standard.StandardDef * coefficients.defensePercent * 0.6)
    : Math.ceil(standard.StandardHp * (
      coefficients.proportion * coefficients.hpPercent
      - coefficients.defensePercent * standard.StandardTurn / (20 * standard.StandardTurn + 10)
    ));
  return {
    hp,
    attack: Math.ceil(standard.StandardAtk * coefficients.proportion * coefficients.attackPercent),
    defense: Math.floor(standard.StandardDef / 10),
    source: {
      standard,
      hpFormula: awakerMonster
        ? 'ceil(StandardHp*MonsterProportion*MonsterHpPercent - StandardDef*MonsterDefPercent*0.6)'
        : 'ceil(StandardHp*(MonsterProportion*MonsterHpPercent - MonsterDefPercent*StandardTurn/(20*StandardTurn+10)))',
      attackFormula: 'ceil(StandardAtk*MonsterProportion*MonsterAtkPercent)',
      defenseFormula: 'floor(StandardDef/10)'
    }
  };
}

function resolveSkill(skill, context) {
  const args = skill.expressions.map(expression => evaluateCombatExpression(expression, context));
  const text = resolveTemplateText(skill.descriptionTemplate, args);
  return { ...skill, args, resolvedDescription: text.text, resolvedRichDescription: text.richText };
}

export function resolveMonsterEncounter(template, { standard, runtime = {}, encounterId = '' }) {
  const stats = calculateEncounterStats(template, standard);
  const phaseMaxHp = [stats.hp];
  template.transitions.forEach(transition => {
    if (transition.maxHpMultiplier != null) phaseMaxHp.push(Math.ceil(stats.hp * transition.maxHpMultiplier));
  });
  while (phaseMaxHp.length < template.configuredHpBars) phaseMaxHp.push(stats.hp);

  const resolvePhaseSkills = (maxHp, phaseIndex) => {
    const context = {
      attack: stats.attack,
      defense: stats.defense,
      maxHp,
      currentHp: runtime.currentHpByPhase?.[phaseIndex] ?? runtime.currentHp,
      playerMaxHp: runtime.playerMaxHp,
      playerHp: runtime.playerHp,
      playerGrowth: runtime.playerGrowth,
      stateLayers: runtime.stateLayers || {}
    };
    return Object.fromEntries(Object.entries(template.skills).map(([id, skill]) => [id, resolveSkill(skill, context)]));
  };
  const phaseSkills = phaseMaxHp.map((maxHp, index) => ({
    phaseIndex: index + 1,
    maxHp,
    skills: resolvePhaseSkills(maxHp, index + 1)
  }));
  const skills = phaseSkills[0].skills;
  const unresolved = phaseSkills.flatMap(phase => Object.values(phase.skills).flatMap(skill => skill.args
    .filter(arg => !arg.resolved)
    .map(arg => ({ kind: 'skill-argument', phaseIndex: phase.phaseIndex, skillId: skill.id, expression: arg.expression, error: arg.error }))));

  return {
    schemaVersion: template.schemaVersion,
    encounterId,
    monsterId: template.monsterId,
    name: template.name,
    description: template.description,
    stats,
    hpPhases: phaseMaxHp.map((hp, index) => ({ phaseIndex: index + 1, maxHp: hp })),
    effectiveHp: phaseMaxHp.reduce((sum, hp) => sum + hp, 0),
    patterns: template.patterns,
    initialStateIds: template.initialStateIds,
    skills,
    phaseSkills,
    states: template.states,
    transitions: template.transitions,
    conditionalActions: template.conditionalActions,
    conditionalStates: template.conditionalStates,
    diagnostics: unresolved,
    templateSource: template.source
  };
}
