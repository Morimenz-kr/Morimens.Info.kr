import fs from 'node:fs/promises';

const [latest, mainStats, current] = await Promise.all([
  fs.readFile('data/character_settings_latest.json', 'utf8').then(JSON.parse),
  fs.readFile('data/covenant_main_stats.json', 'utf8').then(JSON.parse),
  fs.readFile('data/character_settings.json', 'utf8').then(JSON.parse),
]);
const settingNameAliases = {
  Murphy_Fauxborn: {
    '서포터': '서폿',
  },
  caecus: {
    '반격 딜러': '반격',
    '힐러': '탱커',
  },
};

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
      Object.entries(setting).forEach(([key, item], keyIndex, entries) => {
        lines.push(`      ${JSON.stringify(key)}: ${item && typeof item === 'object' ? inlineJson(item) : JSON.stringify(item)}${keyIndex < entries.length - 1 ? ',' : ''}`);
      });
      lines.push(`    }${settingIndex < characterSettings.length - 1 ? ',' : ''}`);
    });
    lines.push(`  ]${characterIndex < characterEntries.length - 1 ? ',' : ''}`);
  });
  lines.push('}');
  return `${lines.join('\n')}\n`;
}

function findStats(characterId, covenantId, sourceKey) {
  const matches = mainStats.records.filter((record) =>
    record.mapping_status === 'confirmed'
    && record.character_id === characterId
    && record.source_key === sourceKey
    && record.covenant_ids.includes(covenantId));
  const distinct = new Map(matches.map((record) => [JSON.stringify(record.main_stats), record.main_stats]));
  if (distinct.size !== 1) return null;
  return {
    stats: [...distinct.values()][0],
    sourceIds: matches.map((record) => record.id),
  };
}

for (const characterSettings of Object.values(current)) {
  for (const setting of characterSettings) {
    delete setting.covenant.main_stats;
    delete setting.covenant.main_stats_source_ids;
    delete setting.covenant.substitute_main_stats;
    delete setting.covenant.substitute_main_stats_source_ids;
  }
}

const readyByCharacter = new Map();
for (const character of latest.characters) {
  if (!['auto_ready', 'curated_ready'].includes(character.proposal_status)) continue;
  readyByCharacter.set(character.character_id, [
    ...(readyByCharacter.get(character.character_id) ?? []),
    character,
  ]);
}

let updatedCharacters = 0;
for (const [characterId, builds] of readyByCharacter) {
  const previous = current[characterId];
  const nextSettings = [];
  for (const character of builds) {
    for (const proposedSetting of character.proposed_settings) {
      const setting = structuredClone(proposedSetting);
      delete setting.wheelRecommendationSource;
      const previousName = settingNameAliases[characterId]?.[setting.settingName] ?? setting.settingName;
      const previousMatch = previous?.find((item) => item.settingName === previousName);
      setting.recommendStep = previousMatch?.recommendStep ?? previous?.[0]?.recommendStep ?? '정보글 기준';
      setting.settings_source = character.source_key;

      const main = setting.covenant?.main_id
        ? findStats(character.character_id, setting.covenant.main_id, character.source_key)
        : null;
      if (main) {
        setting.covenant.main_stats = main.stats;
        setting.covenant.main_stats_source_ids = main.sourceIds;
      }
      for (const covenantId of setting.covenant?.substitutes ?? []) {
        const substitute = findStats(character.character_id, covenantId, character.source_key);
        if (!substitute) continue;
        setting.covenant.substitute_main_stats ??= {};
        setting.covenant.substitute_main_stats_source_ids ??= {};
        setting.covenant.substitute_main_stats[covenantId] = substitute.stats;
        setting.covenant.substitute_main_stats_source_ids[covenantId] = substitute.sourceIds;
      }
      nextSettings.push(setting);
    }
  }

  current[characterId] = nextSettings;
  updatedCharacters += 1;
}

await fs.writeFile('data/character_settings.json', formatSettings(current), 'utf8');
console.log(JSON.stringify({ updated_characters: updatedCharacters }, null, 2));
