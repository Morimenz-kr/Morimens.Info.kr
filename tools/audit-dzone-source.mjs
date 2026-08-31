import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { isDeepStrictEqual } from 'node:util';
import { splitArguments } from './dzone-content.mjs';

const ordered = value => Object.keys(value || {}).sort((a, b) => Number(a) - Number(b)).map(key => value[key]);
const flatten = value => value && typeof value === 'object' ? Object.values(value).flatMap(flatten) : [value];

// Independent read-only comparisons against the packaged tables, not a second
// invocation of the site generator. Runtime-dependent values remain explicit.
export async function auditDzoneSource(document, directory, waveNumbers = [1, 3, 4, 5]) {
  const tables = {};
  for (const name of ['MonsterConfig', 'Skill', 'State', 'Cmd', 'Stage', 'StageGroup', 'StageMonsterData', 'BattleConfig', 'Map', 'MapNode']) {
    tables[name] = JSON.parse(await fs.readFile(path.join(directory, `Config.${name}.json`), 'utf8')).data;
  }
  const issues = [], counts = { waves: 0, encounters: 0, monsterDefinitions: 0, summonDefinitions: 0, statRows: 0, skillValues: 0 };
  const check = (ok, kind, context, expected, actual) => { if (!ok) issues.push({ kind, ...context, expected, actual }); };
  const equal = isDeepStrictEqual;
  for (const wave of document.waves.filter(w => waveNumbers.includes(w.wave))) {
    counts.waves++;
    const mapBattles = new Set(flatten(tables.Map[wave.mapId]?.data_list).flatMap(node => ordered(tables.MapNode[node]?.Effect)).filter(id => tables.BattleConfig[id]));
    check(equal([...mapBattles].sort(), wave.encounters.map(e => e.battleId).sort()), 'map-battles', { wave: wave.wave }, [...mapBattles], wave.encounters.map(e => e.battleId));
    for (const encounter of wave.encounters) {
      counts.encounters++;
      const raw = tables.BattleConfig[encounter.battleId];
      const members = Array.from({ length: 9 }, (_, i) => ({ tid: raw?.[`Monster${i + 1}`], position: raw?.[`MonsterPoint${i + 1}`] })).filter(m => m.tid);
      // Slot serialization is not a left-to-right coordinate system. Compare
      // each monster/placement pair without rewriting the verified UI order.
      const byPlacement = rows => [...rows].sort((a, b) => a.position - b.position || a.tid - b.tid);
      check(equal(byPlacement(members), byPlacement(encounter.members)), 'encounter-members-and-placements', { wave: wave.wave, battle: encounter.battleId }, members, encounter.members);
    }
    const definitions = [...wave.monsters, ...(wave.summonDefinitions || [])];
    counts.monsterDefinitions += wave.monsters.length;
    counts.summonDefinitions += (wave.summonDefinitions || []).length;
    for (const definition of definitions) {
      const cfg = tables.MonsterConfig[definition.tid];
      const context = { wave: wave.wave, tid: definition.tid, name: definition.nameKo };
      check(Boolean(cfg), 'missing-monster', context, true, Boolean(cfg));
      if (!cfg) continue;
      for (const key of Object.keys(cfg).filter(k => k === 'InitSkillList' || /^CycleSkillList\d+$/.test(k))) {
        const id = key === 'InitSkillList' ? 'opening' : key.replace('CycleSkillList', 'cycle-');
        check(equal(ordered(cfg[key]), definition.patterns.find(p => p.id === id)?.skillIds), 'pattern-order', context, ordered(cfg[key]), definition.patterns.find(p => p.id === id)?.skillIds);
      }
      check(equal(ordered(cfg.ExistState), definition.states.map(s => s.id)), 'initial-state-list', context, ordered(cfg.ExistState), definition.states.map(s => s.id));
      const layers = splitArguments(cfg.StateLayers);
      for (const [index, state] of definition.states.entries()) {
        check(state.initialLayerExpression === (layers[index] || null), 'initial-state-stack', { ...context, state: state.id }, layers[index] || null, state.initialLayerExpression);
        check(Boolean(tables.State[state.id]), 'missing-state', { ...context, state: state.id }, true, Boolean(tables.State[state.id]));
      }
      for (const skill of definition.skills) {
        const raw = tables.Skill[skill.id];
        check(Boolean(raw), 'missing-skill', { ...context, skill: skill.id }, true, Boolean(raw));
        check(equal(splitArguments(raw?.Para), skill.expressions), 'skill-formula', { ...context, skill: skill.id }, splitArguments(raw?.Para), skill.expressions);
        for (const cmd of typeof raw?.CmdList === 'object' ? ordered(raw.CmdList) : [raw?.CmdList].filter(Boolean)) check(Boolean(tables.Cmd[cmd]), 'missing-command', { ...context, skill: skill.id }, cmd, null);
      }
      for (const stateId of ordered(cfg.ExistState)) {
        const state = tables.State[stateId];
        for (const key of Object.keys(state || {}).filter(k => /^TriggerCmd\d+$/.test(k))) {
          for (const cmd of ordered(tables.Cmd[state[key]]?.data_list)) {
            if (cmd.Type !== 'BEMonsterChangeSkill') continue;
            const targetId = Number(String(cmd.Target || '').match(/^GetMonsterByID\((\d+)\)$/)?.[1] || definition.tid);
            const target = definitions.find(m => m.tid === targetId);
            if (!target) continue; // Shared command targets a variant not in this wave.
            const skillId = Number(splitArguments(cmd.Para)[0]);
            check(target.conditionalActions.some(a => a.stateId === stateId && a.skillId === skillId), 'conditional-action-target', { ...context, targetTid: targetId }, skillId, target.conditionalActions.map(a => a.skillId));
          }
        }
      }
    }
    for (const alert of wave.alerts) {
      const stage = tables.Stage[alert.stageId];
      const standardRows = ordered(tables.StageMonsterData[stage?.StageMonsterData]?.data_list);
      check(stage?.BelongGroup === wave.stageGroupId, 'stage-group', { wave: wave.wave, alert: alert.alert }, wave.stageGroupId, stage?.BelongGroup);
      check(equal(standardRows, alert.standardRows), 'standard-stat-table', { wave: wave.wave, alert: alert.alert }, stage?.StageMonsterData, alert.stageMonsterDataId);
      for (const stats of alert.monsters) {
        counts.statRows++;
        const cfg = tables.MonsterConfig[stats.tid], std = standardRows.find(s => s.BattleTag === cfg.BattleTag);
        const context = { wave: wave.wave, alert: alert.alert, tid: stats.tid };
        const hp = Math.ceil(std.StandardHp * cfg.MonsterProportion * cfg.MonsterHpPercent - std.StandardDef * cfg.MonsterDefPercent * std.StandardTurn / 20);
        const attack = Math.ceil(std.StandardAtk * cfg.MonsterProportion * cfg.MonsterAtkPercent);
        const defense = Math.floor(std.StandardDef / 10);
        for (const [field, expected] of Object.entries({ hp, attack, defense })) check(stats[field] === expected, field, context, expected, stats[field]);
        check(stats.phases.length === (cfg.MonsterHpNum || 1), 'hp-bar-count', context, cfg.MonsterHpNum || 1, stats.phases.length);
        check(stats.phases[0]?.hp === stats.hp, 'first-bar-hp', context, stats.hp, stats.phases[0]?.hp);
      }
      for (const stats of [...alert.monsters, ...(alert.summonedMonsters || [])]) {
        for (const [phase, skills] of Object.entries({ 1: stats.resolvedSkills, ...stats.phaseResolvedSkills })) {
          const hp = stats.phases?.find(p => p.bar === Number(phase))?.hp ?? stats.hp;
          for (const [id, skill] of Object.entries(skills || {})) {
            for (const [index, arg] of skill.args.entries()) {
              let expression = String(arg.expression).replaceAll('BattleAtkForce', String(stats.attack)).replaceAll('BattleDefForce', String(stats.defense)).replaceAll('CmdCaster.max_hp', String(hp));
              if (!/^[\d.\s+*/()-]+$/.test(expression)) continue;
              const expected = Math.ceil(Function(`return (${expression})`)());
              counts.skillValues++;
              check(arg.value?.display === expected, 'numeric-skill-value', { wave: wave.wave, alert: alert.alert, tid: stats.tid, skill: id, arg: index + 1, phase }, expected, arg.value?.display);
            }
          }
        }
        if (stats.parentTid) {
          const parent = alert.monsters.find(m => m.tid === stats.parentTid);
          const fixed = stats.rule?.hpExpression?.match(/^CmdCaster.max_hp\*(\d*\.?\d+)$/);
          if (fixed) check(stats.hp === Math.ceil(parent.hp * Number(fixed[1])), 'summon-hp', { wave: wave.wave, alert: alert.alert, tid: stats.tid }, Math.ceil(parent.hp * Number(fixed[1])), stats.hp);
          if (/BattleStats.BoutCount/.test(stats.rule?.hpExpression || '')) check(Boolean(stats.hpDisplay), 'turn-dependent-summon-hp', { wave: wave.wave, tid: stats.tid }, 'explicit formula', stats.hp);
          check(stats.phases[0]?.hp === stats.hp && stats.effectiveHp === stats.hp, 'summon-hp-consistency', { wave: wave.wave, tid: stats.tid }, stats.hp, stats.effectiveHp);
        }
      }
    }
  }
  return { scope: waveNumbers, counts, issues, limitations: ['Static-table comparison, not a live battle replay.', 'Runtime stacks, turn number and current HP are not fixed constants.', 'MonsterPoint assignments are compared; screen left-to-right order is not inferred from slot order.'] };
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  const arg = name => process.argv[process.argv.indexOf(name) + 1];
  const report = await auditDzoneSource(JSON.parse(await fs.readFile(arg('--data'), 'utf8')), arg('--static'));
  if (process.argv.includes('--out')) await fs.writeFile(arg('--out'), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify(report, null, 2));
  if (report.issues.length) process.exitCode = 1;
}
