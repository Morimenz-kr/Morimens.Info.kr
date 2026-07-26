import fs from 'node:fs/promises';

const [source, assetMap, wheelList, overrides] = await Promise.all([
  fs.readFile('data/covenant_main_stats.json', 'utf8').then(JSON.parse),
  fs.readFile('data/latest_settings_asset_map.json', 'utf8').then(JSON.parse),
  fs.readFile('data/wheel_list.json', 'utf8').then(JSON.parse),
  fs.readFile('data/latest_settings_overrides.json', 'utf8').then(JSON.parse),
]);

const wheelGrades = new Map(wheelList.map((wheel) => [wheel.english_name, String(wheel.grade ?? '').toLowerCase()]));
const wheelAssetIds = assetMap.wheel_asset_prefix_ids;
const covenantAssetIds = assetMap.covenant_asset_ids;

function resolveWheel(assetKey) {
  return wheelAssetIds[assetKey.slice(0, 10)] ?? null;
}

function unique(values) {
  return [...new Set(values)];
}

function classifyWheelIds(ids) {
  return {
    ssr: ids.filter((id) => wheelGrades.get(id) === 'ssr'),
    sr: ids.filter((id) => wheelGrades.get(id) === 'sr'),
    other: ids.filter((id) => !['ssr', 'sr'].includes(wheelGrades.get(id))),
  };
}

function buildGroups(section) {
  const wheelGroups = [];
  const covenantGroups = [];
  const unmappedAssets = [];
  const recentText = [];
  let mode = null;

  for (const paragraph of section.paragraphs) {
    if (/편.*끝|끝이다/u.test(paragraph.text)) {
      mode = null;
      recentText.length = 0;
      continue;
    }
    if (/^명륜$/u.test(paragraph.text)) {
      mode = 'wheel';
      recentText.length = 0;
      continue;
    }
    if (/^미스터리$/u.test(paragraph.text)) {
      mode = 'covenant';
      recentText.length = 0;
      continue;
    }

    if (paragraph.text) {
      recentText.push(paragraph.text);
      if (recentText.length > 4) recentText.shift();
    }
    if (paragraph.asset_keys.length === 0 || !mode) continue;

    if (mode === 'wheel') {
      const ids = unique(paragraph.asset_keys.map(resolveWheel).filter(Boolean));
      const missing = paragraph.asset_keys.filter((key) => !resolveWheel(key));
      if (ids.length > 0) {
        wheelGroups.push({
          context: [...recentText],
          asset_keys: paragraph.asset_keys,
          wheel_ids: ids,
          by_grade: classifyWheelIds(ids),
          mapping_status: missing.length === 0 ? 'confirmed' : 'needs_review',
        });
      }
      unmappedAssets.push(...missing);
    } else {
      const ids = unique(paragraph.asset_keys.map((key) => covenantAssetIds[key]).filter(Boolean));
      const missing = paragraph.asset_keys.filter((key) => !covenantAssetIds[key]);
      if (ids.length > 0) {
        const statSourceIds = source.records
          .filter((record) => record.character_id === section.character_id
            && record.covenant_ids.some((id) => ids.includes(id)))
          .map((record) => record.id);
        covenantGroups.push({
          context: [...recentText],
          asset_keys: paragraph.asset_keys,
          covenant_ids: ids,
          main_stat_source_ids: unique(statSourceIds),
          mapping_status: missing.length === 0 ? 'confirmed' : 'needs_review',
        });
      }
      unmappedAssets.push(...missing);
    }
    recentText.length = 0;
  }

  return {
    wheel_groups: wheelGroups,
    covenant_groups: covenantGroups,
    unmapped_asset_keys: unique(unmappedAssets),
  };
}

function proposeSettings(groups) {
  if (groups.unmapped_asset_keys.length > 0) {
    return { status: 'needs_review', settings: [] };
  }
  const primaryWheelGroups = groups.wheel_groups.filter((group, index) => {
    const context = group.context.join(' ');
    return index === 0 || /고점/u.test(context);
  });
  if (primaryWheelGroups.length !== 1 || groups.covenant_groups.length === 0) {
    return { status: 'needs_review', settings: [] };
  }

  const wheelGroup = primaryWheelGroups[0];
  const covenantIds = unique(groups.covenant_groups.flatMap((group) => group.covenant_ids));
  const [mainCovenantId, ...substituteCovenantIds] = covenantIds;
  const [mainSsrId, ...substituteSsrIds] = wheelGroup.by_grade.ssr;
  const [mainSrId, ...substituteSrIds] = wheelGroup.by_grade.sr;
  if (!mainSsrId || !mainCovenantId) return { status: 'needs_review', settings: [] };

  return {
    status: 'auto_ready',
    settings: [{
      settingName: '최신 추천',
      myeongryun_ssr: { main_id: mainSsrId, substitutes: substituteSsrIds },
      myeongryun_sr: { main_id: mainSrId ?? 'wheel_non-existent', substitutes: substituteSrIds },
      covenant: { main_id: mainCovenantId, substitutes: substituteCovenantIds },
    }],
  };
}

const sectionCountsByCharacter = source.character_sections.reduce((counts, section) => {
  counts.set(section.character_id, (counts.get(section.character_id) ?? 0) + 1);
  return counts;
}, new Map());

const characters = source.character_sections.map((section) => {
  const groups = buildGroups(section);
  const proposal = proposeSettings(groups);
  const hasMultipleRealmBuilds = sectionCountsByCharacter.get(section.character_id) > 1;
  const buildKey = `${section.character_id}:${section.source_key}`;
  const override = overrides.builds[buildKey];
  const baseSettings = override?.settings ?? proposal.settings;
  const proposedSettings = override?.contextual_variants
    ? override.contextual_variants.map((variant) => ({
        ...structuredClone(baseSettings[0]),
        ...variant,
        covenant: structuredClone(variant.covenant),
      }))
    : baseSettings;
  const proposalStatus = override?.keep_existing
    ? 'keep_existing'
    : override?.settings || override?.contextual_variants
      ? 'curated_ready'
      : hasMultipleRealmBuilds
        ? 'needs_review_multi_realm'
        : proposal.status;
  return {
    build_key: buildKey,
    character_id: section.character_id,
    character_label: section.character_label,
    source_key: section.source_key,
    setting_realm: section.source_key,
    ...groups,
    proposal_status: proposalStatus,
    proposed_settings: proposedSettings.map((setting) => ({
      ...setting,
      settingName: setting.settingName === '최신 추천'
        ? '범용'
        : setting.settingName,
    })),
  };
});

const output = {
  schema_version: 1,
  description: '최신 혼돈편·심해편의 추천 세팅을 원문 묶음 단위로 구조화한 검수용 데이터',
  sources: source.sources,
  characters,
};

await fs.writeFile('data/character_settings_latest.json', `${JSON.stringify(output, null, 2)}\n`, 'utf8');

console.log(JSON.stringify({
  characters: characters.length,
  wheel_groups: characters.reduce((sum, character) => sum + character.wheel_groups.length, 0),
  covenant_groups: characters.reduce((sum, character) => sum + character.covenant_groups.length, 0),
  ready_builds: characters.filter((character) => ['auto_ready', 'curated_ready'].includes(character.proposal_status)).length,
  unmapped_assets: unique(characters.flatMap((character) => character.unmapped_asset_keys)).length,
}, null, 2));
