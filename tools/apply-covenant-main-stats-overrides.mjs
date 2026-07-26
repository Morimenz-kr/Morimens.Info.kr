import fs from 'node:fs/promises';

const positionalArgs = process.argv.slice(2).filter((value) => !value.startsWith('--'));
const sourcePath = positionalArgs[0] ?? 'data/covenant_main_stats.json';
const overridesPath = positionalArgs[1] ?? 'data/covenant_main_stats_overrides.json';
const shouldWrite = process.argv.includes('--write');

const [source, overrides] = await Promise.all([
  fs.readFile(sourcePath, 'utf8').then(JSON.parse),
  fs.readFile(overridesPath, 'utf8').then(JSON.parse),
]);

const seen = new Set();
const previouslyApplied = new Set(source.overrides?.applied_record_ids ?? []);
const records = source.records.flatMap((record) => {
  const override = overrides.records?.[record.id];
  if (!override) return [record];

  seen.add(record.id);
  if (override.remove) return [];

  const { remove, merged_into, ...values } = override;
  return [{ ...record, ...values }];
});

const unknownIds = Object.keys(overrides.records ?? {}).filter((id) => (
  !seen.has(id) && !previouslyApplied.has(id)
));
if (unknownIds.length > 0) {
  throw new Error(`원천 데이터에 없는 보정 ID: ${unknownIds.join(', ')}`);
}

const result = {
  ...source,
  records,
  overrides: {
    source: overridesPath,
    applied_record_ids: [...new Set([...previouslyApplied, ...seen])],
  },
};

if (shouldWrite) {
  await fs.writeFile(sourcePath, `${JSON.stringify(result, null, 2)}\n`, 'utf8');
}

const summary = records.reduce((counts, record) => {
  counts[record.mapping_status] = (counts[record.mapping_status] ?? 0) + 1;
  return counts;
}, {});

console.log(JSON.stringify({
  mode: shouldWrite ? 'write' : 'dry-run',
  records: records.length,
  applied_overrides: result.overrides.applied_record_ids.length,
  ...summary,
}, null, 2));
