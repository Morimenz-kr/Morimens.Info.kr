import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const values = object => Array.isArray(object) ? object : Object.keys(object || {}).sort((a, b) => Number(a) - Number(b)).map(key => object[key]);
const clean = text => parseGameText(String(text || '')).map(node => node.text ?? cleanTextNodes(node.children)).join('').trim();
const cleanTextNodes = nodes => nodes.map(node => node.text ?? cleanTextNodes(node.children)).join('');
const fallback = text => String(text || '').split('|').slice(1).join('|');
const colors = { redword: '#bb646d', blueword: '#76aac8', greenword: '#71aa86', purpleword: '#af6bb0', orangeword: '#c48662', yellowword: '#b6ad65', silveryword: '#6baa83' };
const aliases = { 81341: ['광기 봉인'], 3786: ['심잠 인장', '심해 낙인'], 149167: ['뼈를 에는 일격'] };
const tagLabels = { HeavyInjuryKeywords: '중상', MonsterB05EXFever: '임시 열광', ReinforcePVEKeywords: '보강' };

export function splitArguments(input) {
  const result = []; let start = 0, depth = 0;
  const text = String(input ?? '');
  for (let i = 0; i < text.length; i++) {
    if ('({['.includes(text[i])) depth++;
    if (')}]'.includes(text[i])) depth--;
    if (text[i] === ',' && depth === 0) { result.push(text.slice(start, i).trim()); start = i + 1; }
  }
  if (text.slice(start).trim()) result.push(text.slice(start).trim());
  return result;
}

// Preserve nested game tags: a number/color wrapper must not consume a state link.
export function parseGameText(text) {
  const nodes = []; let cursor = 0; const re = /<([A-Za-z_][\w.]*):/g; let match;
  while ((match = re.exec(text))) {
    let depth = 1, end = re.lastIndex;
    for (; end < text.length && depth; end++) { if (text[end] === '<') depth++; if (text[end] === '>') depth--; }
    if (depth) break;
    if (match.index > cursor) nodes.push({ text: text.slice(cursor, match.index) });
    nodes.push({ tag: match[1], children: parseGameText(text.slice(re.lastIndex, end - 1)) });
    cursor = end; re.lastIndex = end;
  }
  if (cursor < text.length) nodes.push({ text: text.slice(cursor) });
  return nodes;
}

export async function loadContentTables(staticDirectory, keywordPath) {
  const names = ['State', 'Skill', 'Cmd', 'MonsterConfig'];
  const result = {};
  for (const name of names) {
    result[name] = JSON.parse(await fs.readFile(path.join(staticDirectory, `Config.${name}.json`), 'utf8')).data;
    if (name !== 'Cmd') result[`${name}Text`] = JSON.parse(await fs.readFile(path.join(staticDirectory, `Text_KR.Text_${name}.json`), 'utf8')).data;
  }
  const keywords = JSON.parse(await fs.readFile(keywordPath, 'utf8'));
  result.keywords = Object.fromEntries((keywords.records || []).map(row => [row.tag, row]));
  result.keywordVersion = keywords.sourceVersion;
  return result;
}

export function validateDzoneContent(document) {
  if (!document.contentAudit) return; // Archived pre-semantic snapshots keep their existing checks.
  if (document.contentAudit.diagnostics?.length) throw new Error('Unresolved D-Zone content diagnostics');
  for (const match of JSON.stringify(document.waves).matchAll(/<(kw_[a-f0-9]{16}):/g)) {
    if (!document.keywordGlossary?.[match[1]]?.description) throw new Error(`Missing D-Zone reference ${match[1]}`);
  }
  for (const item of Object.values(document.keywordGlossary || {})) {
    if (!item.source?.id || /\[(?:[A-Za-z]+:)?(?:Arg|StateArg|DescArg)\d+\]|NaN|\[object Object\]/.test(item.description)) throw new Error(`Invalid D-Zone tooltip ${item.name}`);
  }
}

// Only unconditional self-state additions at entry are initial states.
// Attacks, death/phase transitions and conditional effects must not leak into this list.
export function entryStateReferences(definition, tables) {
  const found = [], visited = new Set();
  const roots = new Set((definition.states || []).map(state => state.id));
  function walk(id, stateArgs = [], sourceStateId = id) {
    if (visited.has(id)) return;
    visited.add(id);
    const state = tables.State[id];
    if (!state) return;
    for (const key of Object.keys(state).filter(key => /^TriggerCmd\d+$/.test(key))) {
      const suffix = key.slice(10);
      const events = values(state[`TriggerCond${suffix}`]);
      if (!events.some(event => ['BSTStateOnAdd', 'BSTBattleBegin'].includes(event))) continue;
      if (state[`Judgement${suffix}`]) continue;
      if (!['StateOwner', 'CmdCaster'].includes(state[`TriggerTarget${suffix}`])) continue;
      const args = splitArguments(state[`TriggerPara${suffix}`]).map(value => value.replace(/StateArg(\d+)/g, (all, n) => stateArgs[n - 1] ?? all));
      for (const entry of values(tables.Cmd[state[key]]?.data_list)) {
        if (entry.Type !== 'BEAddState' || entry.Cond || !['UpperTarget', 'CmdCaster', 'StateOwner'].includes(entry.Target)) continue;
        const params = splitArguments(entry.Para).map(value => value.replace(/\bArg(\d+)\b/g, (all, n) => args[n - 1] ?? all));
        const targetId = Number(params[0]);
        if (!Number.isInteger(targetId)) continue;
        const row = tables.State[targetId];
        if (!row) throw new Error(`Missing entry state ${targetId} from ${id}`);
        if (!roots.has(targetId) && !found.some(ref => ref.id === targetId) && row.ShowType === 'Normal' && row.Desc) {
          found.push({ type: 'State', id: targetId, args: params.slice(2), layer: params[1], sourceStateId });
        }
        walk(targetId, params.slice(2), sourceStateId);
      }
    }
  }
  for (const state of definition.states || []) walk(state.id, state.stateParamExpressions);
  return found;
}

export function enrichDzoneContent(document, tables) {
  const glossary = {}, diagnostics = [], warnings = [], reviewed = new Set();
  const text = (type, field) => tables[`${type}Text`]?.[String(field || '').split('|')[0]]?.Text || fallback(field);
  const name = (type, id) => clean(text(type, tables[type][id]?.Name || tables[type][id]?.MonsterName));
  const cnName = (type, id) => clean(fallback(tables[type][id]?.Name));
  const interpolate = (expression, args = []) => String(expression ?? '').replace(/\bArg(\d+)\b/g, (all, n) => args[n - 1] === undefined ? all : `(${args[n - 1]})`);
  function scalar(expression, stats) {
    let source = String(expression ?? '').replace(/\bBattleAtkForce\b/g, String(stats.attack)).replace(/\bBattleDefForce\b/g, String(stats.defense))
      .replace(/(?:CmdCaster|StateOwner)\.max_hp/g, String(stats.hp))
      .replace(/(?:CmdCaster|StateOwner)\.atk/g, String(stats.attack)).replace(/(?:CmdCaster|StateOwner)\.def/g, String(stats.defense))
      .replace(/math\.(ceil|floor|min|max)/g, 'Math.$1');
    if (/^(?:[0-9+\-*/(),.\s]|Math\.(?:ceil|floor|min|max))+$/.test(source)) {
      try { const value = Function(`"use strict";return (${source})`)(); if (Number.isFinite(value)) return new Intl.NumberFormat('ko-KR', { maximumFractionDigits: 6 }).format(value); } catch {}
    }
    return null;
  }
  function symbolic(expression, stats) {
    const number = scalar(expression, stats); if (number !== null) return number;
    const hp = String(expression || '').match(/^(?:CmdCaster|StateOwner)\.hp\*(\d+(?:\.\d+)?)$/);
    if (hp) return `발동 시 현재 HP의 ${Number(hp[1]) * 100}%`;
    const stage = String(expression || '').match(/^math.floor\(GetStagePower\(\)\*(0?\.\d+)\)$/);
    if (stage) return `스테이지 기준 힘의 ${Number(stage[1]) * 100}%(내림)`;
    return null;
  }
  function references(type, id, args = [], visited = new Set()) {
    const key = `${type}:${id}`; if (visited.has(key)) return [];
    const row = tables[type][id]; if (!row) return [];
    visited = new Set([...visited, key]); const refs = [];
    const cmds = type === 'Skill'
      ? (typeof row.CmdList === 'object' ? values(row.CmdList) : [row.CmdList]).map(cmd => ({ id: cmd, args }))
      : Object.keys(row).filter(key => /^TriggerCmd\d+$/.test(key)).map(key => {
        const suffix = key.slice(10);
        return { id: row[key], args: splitArguments(row[`TriggerPara${suffix}`]).map(value => value.replace(/StateArg(\d+)/g, (all, n) => args[n - 1] ?? all)) };
      });
    for (const cmd of cmds) for (const entry of values(tables.Cmd[cmd.id]?.data_list)) {
      const params = splitArguments(entry.Para).map(value => interpolate(value, cmd.args));
      let targetType, targetId;
      if (entry.Type === 'BEAddState') { targetType = 'State'; targetId = Number(params[0]); }
      if (entry.Type === 'BEActiveDamage.State') { targetType = 'State'; targetId = Number(params[2]); }
      if (entry.Type === 'BECreateCard') { targetType = 'Skill'; targetId = Number(String(entry.Target).match(/GetCardByID\((\d+)/)?.[1]); }
      if (!targetType || !Number.isInteger(targetId)) continue;
      if (!tables[targetType][targetId]) { diagnostics.push({ kind: 'missing-reference', source: key, target: `${targetType}:${targetId}` }); continue; }
      const stateArgs = entry.Type === 'BEAddState' ? params.slice(2) : [];
      refs.push({ type: targetType, id: targetId, args: stateArgs, layer: entry.Type === 'BEAddState' ? params[1] : undefined });
      if (visited.size < 8) refs.push(...references(targetType, targetId, stateArgs, visited));
    }
    return refs;
  }
  function directDescription(ref, stats) {
    const row = tables[ref.type][ref.id]; let description = text(ref.type, row.Desc || row.BattleDesc);
    // Reviewed source corrections are keyed by actual state/command identity, never by monster name.
    if (ref.type === 'State' && ref.id === 3786 && /StateArg1/.test(description)) {
      description = '이 카드를 사용하면 모든 몬스터가 [StateArg1]의 임시 힘을 획득하고, 이 카드의 심잠 인장이 제거됩니다.';
      reviewed.add('State:3786');
    }
    if (ref.type === 'State' && ref.id === 149167 && /\[Layer\]/.test(description)) {
      description = '최대 HP가 스택 수만큼 감소합니다. 전투 종료 후 감소량이 절반으로 줄어듭니다.';
      reviewed.add('State:149167');
    }
    if (ref.type === 'Skill' && ref.id === 59665) {
      description = description.replace(/당신은 이미 경비원에게 발각되었다…/, '').trim();
      reviewed.add('Skill:59665');
    }
    const descArgs = values(row.DescPara).map(exp => String(exp)
      .replace(/StateArg(\d+)/g, (all, n) => ref.args?.[n - 1] ?? all)
      .replace(/StateOwner\.([a-z_]+)\b/g, (all, field) => row.ExistProperty?.[field] ?? all));
    const skillArgs = splitArguments(row.Para);
    description = description.replace(/\[(?:[A-Za-z]+:)?(StateArg|DescArg|Arg)(\d+)\]/g, (all, kind, n) => {
      const expression = (kind === 'StateArg' ? ref.args : kind === 'DescArg' ? descArgs : skillArgs)?.[n - 1];
      const value = symbolic(expression, stats);
      if (value !== null) return value;
      // Victim-side modifiers must remain formulas, not an invented zero-stack total.
      const state = String(expression).match(/^StateOwner.GetStateLayer\((\d+)\)\+(\d+)$/);
      if (state) return `${state[2]} + ${name('State', state[1]) || '추가 보정'} 스택 수`;
      const additive = String(expression).match(/^(\d+)\+StateOwner.GetStateLayer\((\d+)\)$/);
      if (additive) return `(${additive[1]} + 추가 보정 스택 수)`;
      const subtractive = String(expression).match(/^(\d+)-StateOwner.GetStateLayer\((\d+)\)\*(\d+)$/);
      if (subtractive) return `(${subtractive[1]} − ${name('State', subtractive[2])} 스택 수 × ${subtractive[3]})`;
      diagnostics.push({ kind: 'unresolved-argument', source: `${ref.type}:${ref.id}`, expression, token: all }); return all;
    });
    description = description.replace(/\[Layer\]/g, scalar(ref.layer, stats) ?? '스택 수');
    description = clean(description).replace(/스택 수턴/g, '스택 수만큼의 턴');
    // Named hidden modifiers express the base effect without leaking internal property names.
    description = description.replace(/\(25 \+ 추가 보정 스택 수\)\s*%/g, '기본 25%');
    if (!description) diagnostics.push({ kind: 'empty-description', source: `${ref.type}:${ref.id}` });
    return description;
  }
  function register(ref, cfg, label, stats) {
    const description = directDescription(ref, stats); if (!description) return null;
    const heading = ref.type === 'Skill' ? `카드 | ${label} · 산출력 ${tables.Skill[ref.id].Cost ?? 0}` : `상태 | ${label}`;
    const item = { name: label, description: `${heading}\n\n${description}`, source: { type: ref.type, id: ref.id } };
    if (cfg?.img && /^Battle_Card_Buff_\d+$/.test(cfg.img)) item.icon = `images/keyword-icons/inline/${cfg.img.toLowerCase()}.png`;
    if (colors[cfg?.color]) item.color = colors[cfg.color];
    const key = 'kw_' + crypto.createHash('sha256').update(JSON.stringify(item)).digest('hex').slice(0, 16);
    glossary[key] = item; return key;
  }
  function richDescription(type, id, stats, resolved, externalArgs = [], contextStates = []) {
    const row = tables[type][id]; if (!row) throw new Error(`Missing ${type} TID ${id}`);
    const args = type === 'Skill' ? splitArguments(row.Para) : externalArgs;
    const refs = references(type, id, args);
    for (const state of contextStates) {
      if (!refs.some(ref => ref.type === 'State' && ref.id === state.id)) refs.push({ type: 'State', id: state.id, args: state.stateParamExpressions || [] });
    }
    let raw = text(type, type === 'Skill' ? (row.BattleDesc || row.Desc) : row.Desc);
    if (!raw) return null;
    raw = raw.replace(/(<HeavyInjuryKeywords:치명타>)를/g, '$1을');
    // Source text and command both request Arg2, but this shipped skill supplies only Arg1.
    // Do not invent a hit count. Keep the damage/action, and retain an explicit audit warning.
    if (type === 'Skill' && Number(id) === 73477 && args.length === 1 && raw.includes('[AttackTimes:Arg2]')) {
      raw = raw.replace(/\s*\[AttackTimes:Arg2\]회/, '');
      warnings.push({ kind: 'source-missing-hit-count', source: 'Skill:73477', field: 'Para.Arg2', presentation: '횟수 생략; 피해량과 자멸 효과 표시' });
      reviewed.add('Skill:73477');
    }
    // Only apply a numeric slot replacement after checking the actual command chain.
    const commands = type === 'Skill' ? values(tables.Cmd[row.CmdList]?.data_list) : [];
    if (commands.some(e => e.Type === 'BEGainBlock' && /TempArg1\*Arg3\/100/.test(e.Para || ''))) {
      raw = raw.replace(/(\[Arg3\]%\s*(?:<CardKeyWord:)?(?:서리|저주) 방패)/, '잃은 HP의 $1');
    }
    if (refs.some(ref => ref.type === 'State' && ref.id === 149162)) raw = raw.replace(/죽음 저항을 (\[Arg\d+\])% 제거/g, '죽음 저항 확률을 $1%p 감소');
    if (type === 'Skill' && /CmdCaster.hp\*2/.test(row.Para || '')) raw = raw.replace(/\(\[Arg2\]\)/, '');
    raw = raw.replace(/\[(?:[A-Za-z]+:)?(Arg|DescArg|StateArg)(\d+)\]/g, (all, kind, n) => {
      if (type === 'Skill' && kind === 'Arg') {
        const value = resolved?.args?.[n - 1]?.value;
        if (value) {
          const extra = /FrontEnemy.GetStateLayer\(2840\)\/3/.test(args[n - 1] || '') ? '(대상의 출혈 3스택당 +1)' : '';
          return `${value.dynamic ? '기본 ' : ''}${new Intl.NumberFormat('ko-KR').format(value.display)}${extra}`;
        }
        return symbolic(args[n - 1], stats) ?? all;
      }
      const value = (kind === 'StateArg' ? resolved?.stateArgs : resolved?.descArgs)?.[n - 1]?.value;
      return value ? new Intl.NumberFormat('ko-KR').format(value.display) : all;
    }).replace(/\[Layer\]/g, String(resolved?.initialLayer?.value?.display ?? '스택 수'));
    const scopedRefs = [...new Map(refs.map(ref => [`${ref.type}:${ref.id}`, ref])).values()];
    const entries = scopedRefs.flatMap(ref => [name(ref.type, ref.id), ...(aliases[ref.id] || [])].filter(Boolean).map(label => ({ label, ref })))
      .sort((a, b) => b.label.length - a.label.length);
    function linkPlain(value) {
      // Match only entities reached from this skill/state's commands, not the global Korean dictionary.
      const alternatives = entries.filter(e => e.label.length > 1 && !['보유', '소모', '예비'].includes(e.label));
      if (!alternatives.length) return value;
      const regex = new RegExp(alternatives.map(e => e.label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|'), 'g');
      return value.replace(regex, (label, offset) => {
        if (/[가-힣A-Za-z]/.test(value[offset - 1] || '')) return label;
        const matches = alternatives.filter(e => e.label === label);
        const ids = new Set(matches.map(e => `${e.ref.type}:${e.ref.id}`));
        // A state can refer to its own stack when its command also creates alternate versions.
        if (ids.size !== 1 && type === 'State' && label === name(type, id)) return label;
        if (ids.size !== 1) { diagnostics.push({ kind: 'ambiguous-reference', source: `${type}:${id}`, label }); return label; }
        const ref = matches[0].ref, key = register(ref, null, label, stats);
        return key ? `<${key}:${label}>` : label;
      });
    }
    function render(nodes) {
      return nodes.map(node => {
        if (!node.tag) return linkPlain(node.text);
        const cfg = tables.keywords[node.tag];
        if (!cfg) { diagnostics.push({ kind: 'unknown-tag', source: `${type}:${id}`, tag: node.tag }); return render(node.children); }
        const label = node.children.map(n => n.text || clean(render([n]))).join('');
        let ref = cfg.stateLink ? { type: 'State', id: cfg.stateLink } : cfg.skillLink ? { type: 'Skill', id: cfg.skillLink } : null;
        if (ref) {
          const matches = scopedRefs.filter(r => r.type === ref.type && (r.id === ref.id || cnName(r.type, r.id) === cnName(ref.type, ref.id)));
          if (matches.length === 1) ref = matches[0];
          const shown = tagLabels[node.tag] || label;
          const key = register(ref, cfg, shown, stats);
          return key ? `<${key}:${shown}>` : shown;
        }
        return render(node.children);
      }).join('');
    }
    let body = render(parseGameText(raw));
    if (/\[(?:[A-Za-z]+:)?(?:Arg|StateArg|DescArg)\d+\]|NaN|undefined/.test(body)) diagnostics.push({ kind: 'unresolved-text', source: `${type}:${id}`, text: body });
    return `<game-text:${body}>`;
  }
  function condition(action) {
    const events = action.triggerEvents || [], source = [action.judgement, action.commandCondition].filter(Boolean).join(' and ');
    if (events.includes('BSTRoleBeforeDeath')) return '치명적인 피해를 받아 쓰러지기 직전';
    if (events.includes('BSTAfterBlockChange') && /(?:StateOwner|CmdCaster).block==0/.test(source)) return '방어막이 모두 파괴되었을 때';
    const skillId = source.match(/(?:TriggerValue2|Arg[12])==(\d+)/)?.[1];
    const parts = skillId ? [`「${name('Skill', skillId)}」 의도로 전환할 때`] : [];
    for (const match of source.matchAll(/(?:UpperTarget|CmdCaster|StateOwner)\.GetStateLayer\((\d+)\)(>=|==)(\d+)/g)) {
      const desc = text('State', tables.State[match[1]]?.Desc);
      const limit = desc.match(/최대 (\d+)\s*스택/)?.[1];
      const layer = match[1] === '148383' && match[3] === '4' && limit === '3' ? '3' : match[3];
      parts.push(`${name('State', match[1])} ${layer}스택${match[2] === '>=' ? ' 이상' : ''} 보유`);
    }
    if (parts.length) return parts.join(' · ');
    diagnostics.push({ kind: 'unresolved-condition', source: `State:${action.stateId}`, target: action.skillId });
    return '';
  }
  for (const wave of document.waves) {
    const definitions = [...wave.monsters, ...(wave.summonDefinitions || [])];
    const byId = new Map(definitions.map(m => [m.tid, m]));
    for (const definition of definitions) {
      for (const action of definition.conditionalActions || []) action.conditionText = condition(action);
      for (const transition of definition.phaseTransitions || []) {
        for (const state of transition.addedStates || []) state.richDescriptionTemplate = richDescription('State', state.id, {}, null);
        for (const card of transition.createdCards || []) card.richDescriptionTemplate = richDescription('Skill', card.id, {}, null);
      }
    }
    for (const alert of wave.alerts) for (const stats of [...alert.monsters, ...(alert.summonedMonsters || [])]) {
      const definition = byId.get(stats.tid); if (!definition) throw new Error(`Missing monster definition ${stats.tid}`);
      for (const [id, resolved] of Object.entries(stats.resolvedSkills || {})) resolved.richDescription = richDescription('Skill', id, stats, resolved, [], definition.states);
      for (const resolved of stats.resolvedStates || []) {
        if (!resolved.visible) continue;
        const state = definition.states.find(state => state.id === resolved.id);
        resolved.richDescription = richDescription('State', resolved.id, stats, resolved, state?.stateParamExpressions || []);
      }
      stats.entryStates = entryStateReferences(definition, tables).map(ref => {
        const row = tables.State[ref.id];
        const description = directDescription(ref, stats);
        const iconName = String(row.Icon || '').toLowerCase();
        const layer = scalar(ref.layer, stats);
        return {
          id: ref.id, name: name('State', ref.id), visible: true, description,
          richDescription: `<game-text:${description}>`,
          icon: /^icons_buff_\d+\.png$/.test(iconName) ? `images/keyword-icons/original/${iconName}` : '',
          ...(layer === null ? {} : { initialLayer: { value: { display: Number(layer.replaceAll(',', '')) } } }),
          sourceStateId: ref.sourceStateId
        };
      });
    }
  }
  document.keywordGlossary = glossary;
  document.contentAudit = {
    schemaVersion: 1, keywordVersion: tables.keywordVersion,
    glossaryCount: Object.keys(glossary).length,
    diagnostics: [...new Map(diagnostics.map(row => [JSON.stringify(row), row])).values()],
    warnings: [...new Map(warnings.map(row => [JSON.stringify(row), row])).values()],
    reviewedSourceCorrections: [...reviewed]
  };
  return document.contentAudit;
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  const arg = key => process.argv[process.argv.indexOf(key) + 1];
  for (const required of ['--base', '--static', '--keywords', '--out']) if (!process.argv.includes(required)) throw new Error(`${required} required`);
  const document = JSON.parse(await fs.readFile(arg('--base'), 'utf8'));
  const audit = enrichDzoneContent(document, await loadContentTables(arg('--static'), arg('--keywords')));
  console.log(JSON.stringify(audit, null, 2));
  if (process.argv.includes('--strict') && audit.diagnostics.length) throw new Error('Content validation failed; output was not written.');
  await fs.mkdir(path.dirname(path.resolve(arg('--out'))), { recursive: true });
  await fs.writeFile(arg('--out'), JSON.stringify(document, null, 2) + '\n');
}
