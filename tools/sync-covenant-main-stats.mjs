import fs from 'node:fs/promises';

const sourcePath = 'data/covenant_main_stats.json';
const settingsPath = 'data/character_settings.json';
const shouldWrite = process.argv.includes('--write');

const source = JSON.parse(await fs.readFile(sourcePath, 'utf8'));
const settings = JSON.parse(await fs.readFile(settingsPath, 'utf8'));
const targets = new Map();

function inlineJson(value) {
  return JSON.stringify(value)
    .replace(/,/g, ', ')
    .replace(/:/g, ': ')
    .replace(/\{/g, '{ ')
    .replace(/\}/g, ' }');
}

function formatSettings(value) {
  const characterEntries = Object.entries(value);
  const lines = ['{'];
  characterEntries.forEach(([characterId, characterSettings], characterIndex) => {
    lines.push(`  ${JSON.stringify(characterId)}: [`);
    characterSettings.forEach((setting, settingIndex) => {
      lines.push('    {');
      const settingEntries = Object.entries(setting);
      settingEntries.forEach(([key, item], keyIndex) => {
        const formatted = item && typeof item === 'object'
          ? inlineJson(item)
          : JSON.stringify(item);
        lines.push(`      ${JSON.stringify(key)}: ${formatted}${keyIndex < settingEntries.length - 1 ? ',' : ''}`);
      });
      lines.push(`    }${settingIndex < characterSettings.length - 1 ? ',' : ''}`);
    });
    lines.push(`  ]${characterIndex < characterEntries.length - 1 ? ',' : ''}`);
  });
  lines.push('}');
  return `${lines.join('\n')}\n`;
}

for (const record of source.records) {
  if (record.mapping_status !== 'confirmed') continue;
  const canApplyToAll = record.covenant_ids.length === 1
    || (record.shared_main_stats === true && record.covenant_ids.length > 1);
  if (!canApplyToAll || record.main_stats.length !== 6) continue;

  const characterSettings = Array.isArray(settings[record.character_id])
    ? settings[record.character_id]
    : settings[record.character_id]
      ? [settings[record.character_id]]
      : [];

  characterSettings.forEach((setting, settingIndex) => {
    const covenant = setting.covenant;
    if (!covenant) return;
    record.covenant_ids.forEach((covenantId) => {
      const targetKind = covenant.main_id === covenantId
        ? 'main'
        : (covenant.substitutes ?? []).includes(covenantId)
          ? 'substitute'
          : null;
      if (!targetKind) return;

      const key = `${record.character_id}#${settingIndex}#${covenantId}`;
      const previous = targets.get(key);
      const statsKey = JSON.stringify(record.main_stats);
      if (previous && previous.statsKey !== statsKey) {
        throw new Error(`서로 다른 주옵이 같은 세팅에 연결됩니다: ${key}`);
      }
      targets.set(key, {
        characterId: record.character_id,
        settingIndex,
        covenantId,
        targetKind,
        stats: record.main_stats,
        statsKey,
        sourceIds: [...new Set([...(previous?.sourceIds ?? []), record.id])],
      });
    });
  });
}

for (const target of targets.values()) {
  const list = Array.isArray(settings[target.characterId])
    ? settings[target.characterId]
    : [settings[target.characterId]];
  const covenant = list[target.settingIndex].covenant;

  if (target.targetKind === 'main') {
    covenant.main_stats = target.stats;
    covenant.main_stats_source_ids = target.sourceIds;
  } else {
    covenant.substitute_main_stats ??= {};
    covenant.substitute_main_stats_source_ids ??= {};
    covenant.substitute_main_stats[target.covenantId] = target.stats;
    covenant.substitute_main_stats_source_ids[target.covenantId] = target.sourceIds;
  }
}

if (shouldWrite) {
  await fs.writeFile(settingsPath, formatSettings(settings), 'utf8');
}

const summary = [...targets.values()].reduce((result, target) => {
  result.total += 1;
  result[target.targetKind] += 1;
  return result;
}, { total: 0, main: 0, substitute: 0 });

console.log(JSON.stringify({ mode: shouldWrite ? 'write' : 'dry-run', ...summary }, null, 2));
