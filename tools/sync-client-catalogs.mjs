import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const repositoryRoot = process.cwd();
const sourceRoot = path.resolve(process.argv[2] || '');
if (!sourceRoot || !fs.existsSync(path.join(sourceRoot, 'Config.Item.json'))) {
  throw new Error('사용법: node tools/sync-client-catalogs.mjs <static-json 디렉터리>');
}

const loadSource = name => JSON.parse(fs.readFileSync(path.join(sourceRoot, name), 'utf8')).data;
const readRepositoryJson = name => JSON.parse(fs.readFileSync(path.join(repositoryRoot, name), 'utf8'));
const writeRepositoryJson = (name, value) => fs.writeFileSync(
  path.join(repositoryRoot, name),
  `${JSON.stringify(value, null, 2)}\n`,
  'utf8'
);

function clean(value = '') {
  return String(value)
    .replace(/<[^:>]+:([^>]+)>/g, '$1')
    .replace(/[“”]/g, '"')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalize(value = '') {
  return clean(value).toLowerCase().replace(/[^a-z0-9가-힣]/g, '');
}

function numericReferences(value) {
  if (typeof value === 'number') return [value];
  if (typeof value === 'string') return (value.match(/\b\d{3,6}\b/g) || []).map(Number);
  if (value && typeof value === 'object') return Object.values(value).flatMap(numericReferences);
  return [];
}

function interpolate(rawText, parameters = {}) {
  let text = clean(rawText);
  for (const [key, value] of Object.entries(parameters)) {
    text = text
      .replaceAll(`[Arg${key}]`, String(value))
      .replaceAll(`[StateArg${key}]`, String(value))
      .replaceAll(`[DescArg${key}]`, String(value))
      .replaceAll(`Arg${key}`, String(value))
      .replaceAll(`StateArg${key}`, String(value))
      .replaceAll(`DescArg${key}`, String(value));
  }
  return text;
}

function skillParameters(skill) {
  if (!skill?.Para) return {};
  if (typeof skill.Para === 'object') return skill.Para;
  return Object.fromEntries(String(skill.Para).split(',').map((value, index) => [String(index + 1), value.trim()]));
}

const items = loadSource('Config.Item.json');
const itemText = loadSource('Text_KR.Text_Item.json');
const skills = loadSource('Config.Skill.json');
const skillText = loadSource('Text_KR.Text_Skill.json');
const states = loadSource('Config.State.json');
const commands = loadSource('Config.Cmd.json');
const relics = loadSource('Config.RelicConfig.json');
const relicText = loadSource('Text_KR.Text_RelicConfig.json');
const awakeners = loadSource('Config.AwakerConfig.json');
const awakenerText = loadSource('Text_KR.Text_AwakerConfig.json');

function collectDependencies({ skillIds = [], stateIds = [], seed = null }) {
  const visitedSkills = new Set();
  const visitedStates = new Set();
  const visitedCommands = new Set();
  const formulas = [];
  const collect = value => {
    if (typeof value === 'string' && /PlayerGrowth|GetAccountStageGrow|InsightResearchDepth|PlayerRole\.(?:max_hp|hp)/.test(value)) {
      formulas.push(value);
    } else if (value && typeof value === 'object') {
      Object.values(value).forEach(collect);
    }
  };
  const visitCommand = rawId => {
    const id = Number(rawId);
    if (!commands[id] || visitedCommands.has(id)) return;
    visitedCommands.add(id);
    const command = commands[id];
    collect(command);
    for (const entry of Object.values(command.data_list || {})) {
      const refs = numericReferences(entry.Para);
      if (/State/.test(String(entry.Type || ''))) refs.forEach(visitState);
      if (/Skill/.test(String(entry.Type || ''))) refs.forEach(visitSkill);
    }
  };
  const visitState = rawId => {
    const id = Number(rawId);
    if (!states[id] || visitedStates.has(id)) return;
    visitedStates.add(id);
    const state = states[id];
    collect(state);
    for (const [key, value] of Object.entries(state)) {
      if (/^TriggerCmd\d+$/.test(key)) visitCommand(value);
      if (/^State/.test(key)) numericReferences(value).forEach(visitState);
    }
  };
  const visitSkill = rawId => {
    const id = Number(rawId);
    if (!skills[id] || visitedSkills.has(id)) return;
    visitedSkills.add(id);
    const skill = skills[id];
    collect(skill);
    numericReferences(skill.CmdList).forEach(visitCommand);
    for (const [key, value] of Object.entries(skill)) {
      if (/State/.test(key)) numericReferences(value).forEach(visitState);
    }
  };
  if (seed) collect(seed);
  skillIds.forEach(visitSkill);
  stateIds.forEach(visitState);
  const uniqueFormulas = [...new Set(formulas)];
  return {
    material: uniqueFormulas.some(value => /PlayerGrowth|GetAccountStageGrow/.test(value)),
    spirit: uniqueFormulas.some(value => /InsightResearchDepth/.test(value)),
    vitalIndirect: uniqueFormulas.some(value => /PlayerRole\.(?:max_hp|hp)/.test(value)),
    formulas: uniqueFormulas
  };
}

const manifest = readRepositoryJson('data/character_manifest.json');
const characterEffects = readRepositoryJson('data/character_effects.json');
const manifestByNormalizedId = new Map(manifest.map(character => [normalize(character.id), character]));
const awakenerIdOverrides = new Map([
  [15601, '24'],
  [15590, 'dafoodil'],
  [77922, 'coporsant'],
  [130901, 'vortice']
]);

const dimensionImages = Object.values(awakeners)
  .filter(awakener => awakener.ExclusiveRelic)
  .map(awakener => {
    const relicId = Number(Object.values(awakener.ExclusiveRelic)[0]);
    const relic = relics[relicId];
    if (!relic) return null;
    const character = manifestByNormalizedId.get(normalize(awakener.NameEn))
      || manifest.find(entry => entry.id === awakenerIdOverrides.get(awakener.ID));
    const rawEffect = relicText[`RelicConfig_${relicId}_BattleDesc`]?.Text
      || relicText[`RelicConfig_${relicId}_Desc`]?.Text
      || '';
    const activeName = clean(relicText[`RelicConfig_${relicId}_Name`]?.Text);
    const stateIds = numericReferences(relic.State1).filter(id => states[id]);
    return {
      characterId: character?.id || null,
      characterName: character?.name
        || clean(awakenerText[`AwakerConfig_${awakener.ID}_Name`]?.Text)
        || clean(awakener.Name),
      clientAwakenerId: awakener.ID,
      clientRelicId: relicId,
      name: activeName,
      effect: interpolate(rawEffect, relic.StatePara || {}),
      rawEffect: clean(rawEffect),
      parameters: relic.StatePara || {},
      sourceIcon: relic.Icon || relic.SmallIcon || null,
      chapter: relic.StageChapter || null,
      researchDependencies: collectDependencies({ stateIds, seed: relic }),
      linkedToSiteCharacter: Boolean(character)
    };
  })
  .filter(Boolean)
  .sort((left, right) => left.clientAwakenerId - right.clientAwakenerId);

for (const row of dimensionImages) {
  if (!row.characterId || !characterEffects[row.characterId]) continue;
  characterEffects[row.characterId].dimensionalImage = {
    name: row.name,
    characterName: row.characterName,
    effect: row.effect,
    clientRelicId: row.clientRelicId,
    clientAwakenerId: row.clientAwakenerId,
    sourceIcon: row.sourceIcon,
    researchDependencies: row.researchDependencies
  };
}

const trinkets = Object.values(items).filter(item => item.SubType === 'Trinket' && item.Quality === 'Orange');
const covenantParts = [...new Set(trinkets.map(item => Number(item.SpParam?.['2'])))].sort((a, b) => a - b).map(suitId => {
  const parts = trinkets
    .filter(item => Number(item.SpParam?.['2']) === suitId)
    .map(item => {
      const slot = item.Position || item.TrinketPos || item.SpParam?.['1'];
      return {
        slot,
        clientItemId: item.ID,
        name: clean(itemText[`Item_${item.ID}_Name`]?.Text),
        sourceIcon: item.Icon,
        imagePath: `images/covenant-parts/${suitId}/${String(slot).toLowerCase()}.webp`
      };
    })
    .sort((left, right) => ['I', 'II', 'III', 'IV', 'V', 'VI'].indexOf(left.slot) - ['I', 'II', 'III', 'IV', 'V', 'VI'].indexOf(right.slot));
  return {
    suitId,
    name: parts[0]?.name.replace(/\s*[ⅠⅡⅢⅣⅤⅥ]+$/, '') || '',
    parts
  };
});

const officialNameAliases = new Map([
  ['봄의헌시', '봄의현시'],
  ['재회의소원', '소원을다시만나다'],
  ['안개속에서', '안개경계에서온'],
  ['운명의궤적', '운명의궤도'],
  ['저택의옛일', '심집순이의옛이야기'],
  ['연말불꽃', '세말불꽃놀이'],
  ['새로운세계에바치다', '신세계를위하여']
]);
const excludedSilverKeyItemIds = new Set([
  48014, // 시스템용 열쇠 지령 선택 효과: 획득·장착형 은열쇠가 아님
  89964, // 시스템용 열쇠 지령 선택 효과: 획득·장착형 은열쇠가 아님
  146947 // 서약을 저버린·오지에: 사이트 공개 대상에서 제외
]);
const silverKeyDisplayOverrides = new Map([
  [56638, {
    korean_name: '네 번째 악장',
    description: '이번 턴에 다음으로 사용하는 카드의 산출력 소모가 3 이상이면 산출력 2를 획득하고, 그렇지 않으면 카드 2장을 뽑습니다. 이번 전투에서 이 효과가 4번째로 발동하면, 대신 「영감」 4장을 획득합니다.'
  }]
]);
const currentSilverKeys = readRepositoryJson('data/silverkey_list.json');
let committedSilverKeys = [];
try {
  committedSilverKeys = JSON.parse(execFileSync('git', ['show', 'HEAD:data/silverkey_list.json'], {
    cwd: repositoryRoot,
    encoding: 'utf8'
  }));
} catch {
  // A source archive can be used outside Git; the current catalog remains enough.
}
const existingSilverKeys = [...committedSilverKeys, ...currentSilverKeys];
const existingByName = new Map(existingSilverKeys.map(entry => [normalize(entry.korean_name), entry]));
const findExistingSilverKey = name => {
  const alias = officialNameAliases.get(normalize(name));
  const candidates = [existingByName.get(normalize(name)), existingByName.get(normalize(alias))].filter(Boolean);
  return candidates.find(entry => !String(entry.english_name || '').startsWith('silverkey_')) || candidates[0];
};
const ordinarySilverKeys = Object.values(items)
  .filter(item => item.SubType === 'KeeperSkill' && !excludedSilverKeyItemIds.has(Number(item.ID)))
  .map(item => {
    const skillId = Number(item.SpParam?.['1']);
    const name = clean(itemText[`Item_${item.ID}_Name`]?.Text);
    if (!name || name === '임시 텍스트') return null;
    const displayOverride = silverKeyDisplayOverrides.get(Number(item.ID));
    const existing = findExistingSilverKey(name);
    const skill = skills[skillId];
    const rawDescription = skillText[`Skill_${skillId}_Desc`]?.Text
      || skillText[`Skill_${skillId}_BattleDesc`]?.Text
      || '';
    const formulaDescription = interpolate(rawDescription, skillParameters(skill));
    const imagePath = displayOverride?.image_path || existing?.image_path
      || `images/silverkeys/${item.ID}-${path.posix.basename(item.Icon, path.posix.extname(item.Icon)).toLowerCase()}.webp`;
    return {
      ...(existing || {}),
      korean_name: displayOverride?.korean_name || existing?.korean_name || name,
      english_name: displayOverride?.english_name || existing?.english_name || `silverkey_${item.ID}`,
      description: displayOverride?.description || existing?.description || formulaDescription,
      image_path: imagePath,
      tags: existing?.tags || [],
      source: displayOverride?.source || existing?.source || '인게임 데이터',
      clientItemId: item.ID,
      clientSkillId: skillId,
      effectFormula: formulaDescription,
      rawEffect: clean(rawDescription),
      sourceIcon: item.Icon,
      researchDependencies: collectDependencies({ skillIds: [skillId] })
    };
  })
  .filter(Boolean)
  .sort((left, right) => left.clientItemId - right.clientItemId);

writeRepositoryJson('data/dimension_image_list.json', dimensionImages);
writeRepositoryJson('data/character_effects.json', characterEffects);
writeRepositoryJson('data/covenant_parts.json', covenantParts);
writeRepositoryJson('data/silverkey_list.json', ordinarySilverKeys);

const summary = {
  dimensionImages: dimensionImages.length,
  dimensionImagesLinked: dimensionImages.filter(row => row.linkedToSiteCharacter).length,
  dimensionImagesUnlinked: dimensionImages.filter(row => !row.linkedToSiteCharacter).map(row => ({
    clientAwakenerId: row.clientAwakenerId,
    characterName: row.characterName,
    clientRelicId: row.clientRelicId
  })),
  covenantSets: covenantParts.length,
  covenantParts: covenantParts.reduce((sum, suit) => sum + suit.parts.length, 0),
  silverKeys: ordinarySilverKeys.length,
  excludedSilverKeys: [...excludedSilverKeyItemIds],
  excludedTemporarySilverKeys: Object.values(items)
    .filter(item => item.SubType === 'KeeperSkill' && clean(itemText[`Item_${item.ID}_Name`]?.Text) === '임시 텍스트')
    .map(item => item.ID)
};
console.log(JSON.stringify(summary, null, 2));
