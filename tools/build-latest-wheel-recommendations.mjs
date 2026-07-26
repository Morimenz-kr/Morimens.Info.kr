import fs from 'node:fs/promises';

const [latest, overrides, wheelList] = await Promise.all([
  fs.readFile('data/character_settings_latest.json', 'utf8').then(JSON.parse),
  fs.readFile('data/latest_wheel_recommendation_overrides.json', 'utf8').then(JSON.parse),
  fs.readFile('data/wheel_list.json', 'utf8').then(JSON.parse),
]);

const wheelIds = new Set(wheelList.map((wheel) => wheel.english_name));
const unique = (values) => [...new Set(values.filter(Boolean))];
const errors = [];
const records = [];

function freeStats(setting) {
  return unique([
    ...(setting.myeongryun_ssr?.recommended_stats ?? []),
    ...(setting.myeongryun_sr?.recommended_stats ?? []),
  ]);
}

for (const build of latest.characters) {
  const manual = overrides.builds?.[build.build_key];
  const sourceWheelIds = unique(build.wheel_groups.flatMap((group) => group.wheel_ids));
  const buildReferencedIds = new Set();

  if (build.wheel_groups.length > 1 && !manual) {
    errors.push(`다중 명륜 그룹에 수동 분류가 없습니다: ${build.build_key}`);
    continue;
  }

  for (const setting of build.proposed_settings) {
    const override = manual?.[setting.settingName]
      ?? manual?.[setting.wheelRecommendationSource];
    if (manual && !override) {
      errors.push(`수동 분류에 세팅이 없습니다: ${build.build_key} / ${setting.settingName}`);
      continue;
    }

    const recommendation = override ?? {
      recommended_ids: sourceWheelIds,
      recommended_stats: freeStats(setting),
    };
    const recommendedIds = unique(recommendation.recommended_ids ?? []);
    const substituteIds = unique(recommendation.substitute_ids ?? []);
    const referencedIds = unique([...recommendedIds, ...substituteIds]);
    referencedIds.forEach((id) => buildReferencedIds.add(id));

    for (const id of referencedIds) {
      if (!wheelIds.has(id)) errors.push(`알 수 없는 명륜 ID: ${build.build_key} / ${id}`);
    }
    const duplicatedIds = recommendedIds.filter((id) => substituteIds.includes(id));
    if (duplicatedIds.length > 0) {
      errors.push(`고점과 대체에 중복된 명륜: ${build.build_key} / ${duplicatedIds.join(', ')}`);
    }
    records.push({
      build_key: build.build_key,
      character_id: build.character_id,
      character_label: build.character_label,
      source_key: build.source_key,
      setting_name: setting.settingName,
      selection_count: 2,
      recommended_ids: recommendedIds,
      substitute_ids: substituteIds,
      recommended_stats: unique(recommendation.recommended_stats ?? []),
      substitute_stats: unique(recommendation.substitute_stats ?? []),
      display_values: recommendation.display_values ?? [],
      note: recommendation.note ?? '',
      source_wheel_group_count: build.wheel_groups.length,
    });
  }

  const missingSourceIds = sourceWheelIds.filter((id) => !buildReferencedIds.has(id));
  if (missingSourceIds.length > 0) {
    errors.push(`원문 명륜 누락: ${build.build_key} / ${missingSourceIds.join(', ')}`);
  }
}

for (const buildKey of Object.keys(overrides.builds ?? {})) {
  if (!latest.characters.some((build) => build.build_key === buildKey)) {
    errors.push(`최신 원문에 없는 수동 분류: ${buildKey}`);
  }
}

if (errors.length > 0) {
  console.error(errors.join('\n'));
  process.exit(1);
}

const output = {
  schema_version: 1,
  description: '최신 혼돈·심해 원문의 명륜 추천을 2개 선택형 고점 후보, 대체 후보, 주옵 조건으로 구조화한 검수 데이터',
  source_sections: latest.characters.length,
  unique_characters: new Set(latest.characters.map((build) => build.character_id)).size,
  records,
};

await fs.writeFile('data/latest_wheel_recommendations.json', `${JSON.stringify(output, null, 2)}\n`, 'utf8');

console.log(JSON.stringify({
  source_sections: output.source_sections,
  unique_characters: output.unique_characters,
  setting_records: records.length,
  manual_builds: Object.keys(overrides.builds ?? {}).length,
  status: 'ok',
}, null, 2));
