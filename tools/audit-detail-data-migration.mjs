import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');

const paths = {
  awakeners: path.join(ROOT, 'data', 'awakener'),
  manifest: path.join(ROOT, 'data', 'character_manifest.json'),
  settings: path.join(ROOT, 'data', 'character_settings.json'),
  effects: path.join(ROOT, 'data', 'character_effects.json'),
  cards: path.join(ROOT, 'data', 'db_cards.json'),
  stats: path.join(ROOT, 'data', 'db_awakener_stats.json'),
  tooltips: path.join(ROOT, 'data', 'db_tooltips.json'),
  wheels: path.join(ROOT, 'data', 'wheel_list.json'),
  covenants: path.join(ROOT, 'data', 'covenant_list.json')
};

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function rel(filePath) {
  return path.relative(ROOT, filePath).replace(/\\/g, '/');
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function listAwakenerFiles() {
  if (!fs.existsSync(paths.awakeners)) return [];
  return fs.readdirSync(paths.awakeners)
    .filter((name) => name.endsWith('.json'))
    .map((name) => path.join(paths.awakeners, name));
}

function makeIdMap(items, field = 'id') {
  return new Map(asArray(items).map((item) => [item?.[field], item]).filter(([id]) => id));
}

function collectAwakenerCardIds(awakener) {
  const kit = awakener.skill_kit_ids || {};
  return [
    ...asArray(kit.command_cards),
    kit.rouse_skill,
    kit.exalt,
    kit.overexalt
  ].filter(Boolean);
}

function collectEffectSkillNames(effectEntry) {
  return new Set(asArray(effectEntry?.skills).map((skill) => skill?.name).filter(Boolean));
}

function findMissingIds(ids, idMap) {
  return ids.filter((id) => !idMap.has(id));
}

function main() {
  const manifest = readJson(paths.manifest);
  const settings = readJson(paths.settings);
  const effects = readJson(paths.effects);
  const cards = readJson(paths.cards);
  const stats = readJson(paths.stats);
  const wheels = readJson(paths.wheels);
  const covenants = readJson(paths.covenants);
  const tooltips = readJson(paths.tooltips);

  const manifestMap = makeIdMap(manifest);
  const cardMap = makeIdMap(cards.cards || []);
  const wheelMap = makeIdMap(wheels, 'english_name');
  const covenantMap = makeIdMap(covenants, 'english_name');
  const awakenerFiles = listAwakenerFiles();

  console.log('Detail data migration audit');
  console.log(`Awakener files: ${awakenerFiles.length}`);
  console.log(`Current detail.js legacy dependencies: ${rel(paths.cards)}, ${rel(paths.stats)}, ${rel(paths.tooltips)}, data/awakener/*.json`);
  console.log('');

  for (const file of awakenerFiles) {
    const awakener = readJson(file);
    const id = awakener.id || path.basename(file, '.json');
    const manifestEntry = manifestMap.get(id);
    const settingsEntry = settings[id];
    const effectEntry = effects[id];
    const legacyStats = stats[awakener.stats_id || id];
    const cardIds = collectAwakenerCardIds(awakener);
    const missingLegacyCards = findMissingIds(cardIds, cardMap);
    const effectSkillNames = collectEffectSkillNames(effectEntry);
    const legacyCardNames = cardIds.map((cardId) => cardMap.get(cardId)?.name).filter(Boolean);
    const matchingSkillNames = legacyCardNames.filter((name) => effectSkillNames.has(name));
    const guide = awakener.guide || {};
    const recommendedWheel = guide.recommended_wheel_id ? wheelMap.get(guide.recommended_wheel_id) : null;
    const guideCovenantRefs = asArray(guide.recommended_covenants)
      .flatMap((item) => [...asArray(item.covenant_ids), item.synergy_id])
      .filter(Boolean);
    const missingCovenants = findMissingIds(guideCovenantRefs, covenantMap);

    console.log(`- ${rel(file)} (${id})`);
    console.log(`  manifest: ${manifestEntry ? 'yes' : 'missing'}`);
    console.log(`  character_settings: ${settingsEntry ? 'yes' : 'missing'}`);
    console.log(`  character_effects: ${effectEntry ? 'yes' : 'missing'}`);
    console.log(`  legacy_stats: ${legacyStats ? 'yes' : 'missing'} (${awakener.stats_id || id})`);
    console.log(`  legacy_cards: ${cardIds.length - missingLegacyCards.length}/${cardIds.length} found`);
    if (missingLegacyCards.length > 0) console.log(`    missing cards: ${missingLegacyCards.join(', ')}`);
    console.log(`  skill_name_overlap_with_character_effects: ${matchingSkillNames.length}/${legacyCardNames.length}`);
    console.log(`  recommended_wheel_id: ${guide.recommended_wheel_id || 'none'} -> ${recommendedWheel ? 'found' : 'missing'}`);
    console.log(`  recommended_covenants: ${guideCovenantRefs.length - missingCovenants.length}/${guideCovenantRefs.length} found`);
    if (missingCovenants.length > 0) console.log(`    missing covenants: ${missingCovenants.join(', ')}`);
  }

  console.log('');
  console.log(`Tooltip dictionary entries: ${Object.keys(tooltips || {}).length}`);
  console.log('Recommendation: migrate detail.js only after defining how character_effects should render card UI, derived cards, stats, and tooltips.');
}

main();
