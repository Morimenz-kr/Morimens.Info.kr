import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const ROOT = path.resolve(import.meta.dirname, '..');

const paths = {
  manifest: path.join(ROOT, 'data', 'character_manifest.json'),
  settings: path.join(ROOT, 'data', 'character_settings.json'),
  effects: path.join(ROOT, 'data', 'character_effects.json'),
  gachatype: path.join(ROOT, 'data', 'gachatype.json'),
  resourceLinks: path.join(ROOT, 'data', 'resource_links.json'),
  wheels: path.join(ROOT, 'data', 'wheel_list.json'),
  silverkeys: path.join(ROOT, 'data', 'silverkey_list.json'),
  covenants: path.join(ROOT, 'data', 'covenant_list.json'),
  partyBuilderRules: path.join(ROOT, 'data', 'party_builder_rules.json')
};

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function asArray(value) {
  if (Array.isArray(value)) return value;
  if (value === undefined || value === null || value === '') return [];
  return [value];
}

function normalize(value) {
  return String(value ?? '')
    .normalize('NFKC')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '');
}

function relPath(filePath) {
  return path.relative(ROOT, filePath).replace(/\\/g, '/');
}

function existsRelative(relativePath) {
  return fs.existsSync(path.join(ROOT, relativePath));
}

function addIssue(list, code, message) {
  list.push({ code, message });
}

function buildIdSet(items, field = 'english_name') {
  return new Set(items.map((item) => item?.[field]).filter(Boolean));
}

function hasTarget(values, targets) {
  return asArray(values).some((value) => targets.has(normalize(value)));
}

function itemMatchesCharacter(item, character, fields) {
  const targets = new Set([normalize(character.id), normalize(character.name)]);

  if (hasTarget(item.owner_character_ids, targets)) return { matched: true, via: 'owner_character_ids' };

  for (const field of fields) {
    if (hasTarget(item[field], targets)) return { matched: true, via: field };
  }

  const itemId = normalize(item.english_name);
  const charId = normalize(character.id);
  if (charId && itemId.includes(charId)) return { matched: true, via: 'english_name' };

  return { matched: false, via: null };
}

function collectSettingIds(settingsList, fieldName) {
  const ids = [];
  for (const setting of settingsList) {
    const block = setting?.[fieldName];
    if (!block) continue;
    ids.push(block.main_id);
    ids.push(...asArray(block.substitutes));
  }
  return ids.filter(Boolean);
}

function validateCharacter(character, db) {
  const errors = [];
  const warnings = [];
  const details = [];

  if (!character.id) addIssue(errors, 'manifest.id', 'Character has no id.');
  if (!character.name) addIssue(errors, 'manifest.name', `${character.id} has no name.`);
  if (!character.image_thumb) {
    addIssue(errors, 'manifest.image_thumb', `${character.id} has no image_thumb.`);
  } else if (!existsRelative(character.image_thumb)) {
    addIssue(errors, 'manifest.image_thumb.missing', `${character.image_thumb} does not exist.`);
  }

  const tidePath = `images/${character.id}_tide.webp`;
  if (!existsRelative(tidePath)) {
    addIssue(errors, 'image.tide.missing', `${tidePath} does not exist.`);
  }

  const settings = db.settings[character.id] ?? db.settings[character.name];
  const settingsList = Array.isArray(settings) ? settings : settings ? [settings] : [];
  if (settingsList.length === 0) {
    addIssue(errors, 'settings.missing', `${character.id} has no character_settings entry.`);
  } else {
    const wheelIds = [
      ...collectSettingIds(settingsList, 'myeongryun_ssr'),
      ...collectSettingIds(settingsList, 'myeongryun_sr')
    ];
    for (const wheelId of wheelIds) {
      if (!db.wheelIds.has(wheelId)) {
        addIssue(errors, 'settings.wheel.missing', `${character.id} references missing wheel: ${wheelId}`);
      }
    }

    const covenantIds = collectSettingIds(settingsList, 'covenant');
    for (const covenantId of covenantIds) {
      if (!db.covenantIds.has(covenantId)) {
        addIssue(errors, 'settings.covenant.missing', `${character.id} references missing covenant: ${covenantId}`);
      }
    }
  }

  if (!db.effects[character.id]) {
    addIssue(errors, 'effects.missing', `${character.id} has no character_effects entry.`);
  }

  const gachaGroups = Object.entries(db.gachatype)
    .filter(([, ids]) => asArray(ids).includes(character.id))
    .map(([group]) => group);
  if (gachaGroups.length === 0) {
    addIssue(errors, 'gachatype.missing', `${character.id} is not included in gachatype.json.`);
  }

  const resourceItems = db.resourceLinks.characters?.[character.id] ?? [];
  if (!Array.isArray(resourceItems) || resourceItems.length === 0) {
    addIssue(warnings, 'resource_links.empty', `${character.id} has no resource link entries.`);
  }

  for (const grade of ['SSR', 'SR']) {
    const dedicatedWheels = db.wheels.map((wheel) => {
      if (String(wheel.grade || '').toUpperCase() !== grade) return false;
      const match = itemMatchesCharacter(wheel, character, ['optimized_for']);
      return match.matched ? { wheel, via: match.via } : false;
    }).filter(Boolean);

    if (dedicatedWheels.length === 0) {
      addIssue(warnings, `dedicated_wheel.${grade}.missing`, `${character.id} has no detected dedicated ${grade} wheel.`);
    } else {
      for (const { wheel, via } of dedicatedWheels) {
        details.push(`${grade} wheel ${wheel.english_name} matched via ${via}.`);
        if (wheel.image_path && !existsRelative(wheel.image_path)) {
          addIssue(errors, `dedicated_wheel.${grade}.image_missing`, `${wheel.english_name} image does not exist: ${wheel.image_path}`);
        }
      }
    }
  }

  const dedicatedKeys = db.silverkeys.map((key) => {
    const match = itemMatchesCharacter(key, character, ['tags']);
    return match.matched ? { key, via: match.via } : false;
  }).filter(Boolean);
  if (dedicatedKeys.length === 0) {
    addIssue(warnings, 'dedicated_key.missing', `${character.id} has no detected dedicated silverkey.`);
  } else {
    for (const { key, via } of dedicatedKeys) {
      details.push(`silverkey ${key.english_name} matched via ${via}.`);
      if (key.image_path && !existsRelative(key.image_path)) {
        addIssue(errors, 'dedicated_key.image_missing', `${key.english_name} image does not exist: ${key.image_path}`);
      }
    }
  }

  return { character, errors, warnings, details };
}

function validatePartyBuilderRules(db) {
  const errors = [];
  const warnings = [];
  const details = [];
  const rules = db.partyBuilderRules;
  const manifestIds = new Set(db.manifest.map((character) => String(character.id)));

  function validateCharacterId(id, location) {
    const normalizedId = String(id ?? '').trim();
    if (!normalizedId) {
      addIssue(errors, 'party_builder_rules.character_id.empty', `${location} contains an empty character id.`);
      return;
    }
    if (!manifestIds.has(normalizedId)) {
      addIssue(errors, 'party_builder_rules.character_id.missing', `${location} references missing character id: ${normalizedId}`);
    }
  }

  if (!rules || typeof rules !== 'object' || Array.isArray(rules)) {
    addIssue(errors, 'party_builder_rules.invalid', `${relPath(paths.partyBuilderRules)} must be a JSON object.`);
    return { errors, warnings, details };
  }

  if (!Array.isArray(rules.exclusive_groups)) {
    addIssue(errors, 'party_builder_rules.exclusive_groups.invalid', 'exclusive_groups must be an array.');
  } else {
    rules.exclusive_groups.forEach((group, groupIndex) => {
      if (!Array.isArray(group)) {
        addIssue(errors, 'party_builder_rules.exclusive_groups.group_invalid', `exclusive_groups[${groupIndex}] must be an array.`);
        return;
      }
      if (group.length < 2) {
        addIssue(warnings, 'party_builder_rules.exclusive_groups.too_small', `exclusive_groups[${groupIndex}] has fewer than 2 character ids.`);
      }
      group.forEach((id, idIndex) => validateCharacterId(id, `exclusive_groups[${groupIndex}][${idIndex}]`));
    });
  }

  if (!rules.character_tags || typeof rules.character_tags !== 'object' || Array.isArray(rules.character_tags)) {
    addIssue(errors, 'party_builder_rules.character_tags.invalid', 'character_tags must be an object.');
  } else {
    for (const [tagName, characterIds] of Object.entries(rules.character_tags)) {
      if (!Array.isArray(characterIds)) {
        addIssue(errors, 'party_builder_rules.character_tags.tag_invalid', `character_tags.${tagName} must be an array.`);
        continue;
      }
      if (characterIds.length === 0) {
        addIssue(warnings, 'party_builder_rules.character_tags.empty', `character_tags.${tagName} has no character ids.`);
      }
      characterIds.forEach((id, idIndex) => validateCharacterId(id, `character_tags.${tagName}[${idIndex}]`));
    }
  }

  if (rules.tag_aliases !== undefined && (!rules.tag_aliases || typeof rules.tag_aliases !== 'object' || Array.isArray(rules.tag_aliases))) {
    addIssue(errors, 'party_builder_rules.tag_aliases.invalid', 'tag_aliases must be an object when present.');
  } else if (rules.tag_aliases) {
    for (const [tagName, aliases] of Object.entries(rules.tag_aliases)) {
      if (!rules.character_tags?.[tagName]) {
        addIssue(warnings, 'party_builder_rules.tag_aliases.unknown_tag', `tag_aliases.${tagName} has no matching character_tags entry.`);
      }
      if (!Array.isArray(aliases)) {
        addIssue(errors, 'party_builder_rules.tag_aliases.aliases_invalid', `tag_aliases.${tagName} must be an array.`);
      }
    }
  }

  if (errors.length === 0 && warnings.length === 0) {
    details.push(`${relPath(paths.partyBuilderRules)} references valid character ids.`);
  }

  return { errors, warnings, details };
}

function printGlobalResult(label, result, options = {}) {
  if (result.errors.length === 0 && result.warnings.length === 0) {
    if (options.verbose) {
      console.log(`[OK] ${label}`);
      for (const detail of result.details) console.log(`  - ${detail}`);
    }
    return;
  }

  console.log(result.errors.length > 0 ? `[ERROR] ${label}` : `[OK] ${label}`);
  for (const issue of result.errors) console.log(`  - ${issue.code}: ${issue.message}`);

  if (result.warnings.length > 0) {
    console.log(`  Warnings:`);
    for (const issue of result.warnings) console.log(`  - ${issue.code}: ${issue.message}`);
  }
}

function printResult(result, options = {}) {
  const label = `${result.character.id} (${result.character.name})`;
  if (result.errors.length === 0 && result.warnings.length === 0) {
    console.log(`[OK] ${label}`);
    if (options.verbose) {
      for (const detail of result.details) console.log(`  - ${detail}`);
    }
    return;
  }

  if (result.errors.length > 0) {
    console.log(`[ERROR] ${label}`);
    for (const issue of result.errors) console.log(`  - ${issue.code}: ${issue.message}`);
  } else {
    console.log(`[OK] ${label}`);
  }

  if (result.warnings.length > 0) {
    console.log(`  Warnings:`);
    for (const issue of result.warnings) console.log(`  - ${issue.code}: ${issue.message}`);
  }

  if (options.verbose && result.details.length > 0) {
    console.log(`  Details:`);
    for (const detail of result.details) console.log(`  - ${detail}`);
  }
}

function main() {
  const args = process.argv.slice(2);
  const verbose = args.includes('--verbose');
  const target = args.find((arg) => arg !== '--verbose');
  if (!target) {
    console.error('Usage: node tools/validate-character.mjs <characterId|--all> [--verbose]');
    process.exit(2);
  }

  const db = {
    manifest: readJson(paths.manifest),
    settings: readJson(paths.settings),
    effects: readJson(paths.effects),
    gachatype: readJson(paths.gachatype),
    resourceLinks: readJson(paths.resourceLinks),
    wheels: readJson(paths.wheels),
    silverkeys: readJson(paths.silverkeys),
    covenants: readJson(paths.covenants),
    partyBuilderRules: readJson(paths.partyBuilderRules)
  };
  db.wheelIds = buildIdSet(db.wheels);
  db.covenantIds = buildIdSet(db.covenants);

  const characters = target === '--all'
    ? db.manifest
    : db.manifest.filter((character) => character.id === target);

  if (characters.length === 0) {
    console.error(`[ERROR] Character id not found in ${relPath(paths.manifest)}: ${target}`);
    process.exit(1);
  }

  const results = characters.map((character) => validateCharacter(character, db));
  for (const result of results) printResult(result, { verbose });

  const partyBuilderRulesResult = validatePartyBuilderRules(db);
  printGlobalResult('party_builder_rules', partyBuilderRulesResult, { verbose });

  const errorCount = results.reduce((sum, result) => sum + result.errors.length, 0) + partyBuilderRulesResult.errors.length;
  const warningCount = results.reduce((sum, result) => sum + result.warnings.length, 0) + partyBuilderRulesResult.warnings.length;

  console.log('');
  console.log(`Summary: ${results.length} character(s), ${errorCount} error(s), ${warningCount} warning(s).`);

  if (errorCount > 0) process.exit(1);
}

main();
