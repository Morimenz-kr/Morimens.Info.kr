import fs from 'node:fs/promises';

const [source, settings, manifest, covenants] = await Promise.all([
  fs.readFile('data/covenant_main_stats.json', 'utf8').then(JSON.parse),
  fs.readFile('data/character_settings.json', 'utf8').then(JSON.parse),
  fs.readFile('data/character_manifest.json', 'utf8').then(JSON.parse),
  fs.readFile('data/covenant_list.json', 'utf8').then(JSON.parse),
]);

const errors = [];
const recordIds = new Set();
const characterIds = new Set(manifest.map((item) => item.id));
const covenantIds = new Set(covenants.map((item) => item.english_name));

for (const record of source.records) {
  if (recordIds.has(record.id)) errors.push(`중복 원천 ID: ${record.id}`);
  recordIds.add(record.id);
  if (!characterIds.has(record.character_id)) errors.push(`알 수 없는 캐릭터: ${record.id} / ${record.character_id}`);
  for (const covenantId of record.covenant_ids) {
    if (!covenantIds.has(covenantId)) errors.push(`알 수 없는 비밀계약: ${record.id} / ${covenantId}`);
  }
  if (record.mapping_status === 'confirmed') {
    const validCovenantCount = record.covenant_ids.length === 1
      || (record.shared_main_stats === true && record.covenant_ids.length > 1);
    if (!validCovenantCount) errors.push(`확정 행의 계약 수 오류: ${record.id}`);
    if (record.main_stats.length !== 6) errors.push(`확정 행의 주옵 수 오류: ${record.id}`);
    if (record.main_stats.some((stat) => typeof stat !== 'string' || !stat.trim())) {
      errors.push(`확정 행의 주옵 형식 오류: ${record.id}`);
    }
  }
}

for (const [characterId, rawSettings] of Object.entries(settings)) {
  const list = Array.isArray(rawSettings) ? rawSettings : [rawSettings];
  list.forEach((setting, settingIndex) => {
    const covenant = setting.covenant;
    if (!covenant) return;
    const validateStats = (stats, label) => {
      if (!Array.isArray(stats) || stats.length !== 6 || stats.some((stat) => typeof stat !== 'string' || !stat.trim())) {
        errors.push(`운영 주옵 형식 오류: ${characterId}#${settingIndex} / ${label}`);
      }
    };
    if (covenant.main_stats) validateStats(covenant.main_stats, covenant.main_id);
    for (const [covenantId, stats] of Object.entries(covenant.substitute_main_stats ?? {})) {
      if (!(covenant.substitutes ?? []).includes(covenantId)) {
        errors.push(`대체 목록에 없는 주옵: ${characterId}#${settingIndex} / ${covenantId}`);
      }
      validateStats(stats, covenantId);
    }
    for (const sourceId of covenant.main_stats_source_ids ?? []) {
      if (!recordIds.has(sourceId)) errors.push(`알 수 없는 주옵 출처: ${characterId}#${settingIndex} / ${sourceId}`);
    }
    for (const sourceIds of Object.values(covenant.substitute_main_stats_source_ids ?? {})) {
      for (const sourceId of sourceIds) {
        if (!recordIds.has(sourceId)) errors.push(`알 수 없는 대체 주옵 출처: ${characterId}#${settingIndex} / ${sourceId}`);
      }
    }
  });
}

if (errors.length > 0) {
  console.error(errors.join('\n'));
  process.exit(1);
}

console.log(JSON.stringify({
  records: source.records.length,
  confirmed_records: source.records.filter((record) => record.mapping_status === 'confirmed').length,
  review_records: source.records.filter((record) => record.mapping_status === 'needs_review').length,
  status: 'ok',
}, null, 2));
