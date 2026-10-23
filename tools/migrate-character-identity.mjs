import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { create } = require('../js/character-identity.js');
const root = path.resolve(import.meta.dirname, '..');
const write = process.argv.includes('--write');
const read = name => JSON.parse(fs.readFileSync(path.join(root, 'data', `${name}.json`), 'utf8'));
const aliases = { alva: ['앨바'], faint: ['페인트'], leigh: ['레아'], mouchette: ['모샤'], winkle: ['웬코르'], celeste: ['살레스트'], ramona_timeworn: ['환행 · 라모나'] };
const manifest = read('character_manifest');
for (const character of manifest) character.name_aliases = [...new Set([...(character.name_aliases || []), character.name, ...(aliases[character.id] || [])])];
const identity = create(manifest);
const report = { wheels: 0, keys: 0, unresolved: [] };
const migrated = { character_manifest: manifest };
for (const file of ['wheel_list', 'silverkey_list']) {
    const records = read(file);
    for (const record of records) {
        const field = file === 'wheel_list' ? 'optimized_for' : 'tags';
        const relation = file === 'wheel_list' ? 'recommended_character_ids' : 'related_character_ids';
        const targets = [...new Set([...(record[relation] || []), ...(record[field] || []).map(identity.resolveId).filter(Boolean)])];
        record[relation] = targets;
        record.owner_character_ids = [...new Set([...(record.owner_character_ids || []), ...targets])];
        record[field] = (record[field] || []).filter(value => value && !identity.resolveId(value));
        if (record.owner_character_ids.length) report[file === 'wheel_list' ? 'wheels' : 'keys']++;
        for (const id of [...targets, ...record.owner_character_ids]) if (!identity.byId.has(id)) report.unresolved.push({ file, item: record.english_name, id });
    }
    migrated[file] = records;
}
if (report.unresolved.length) throw new Error(JSON.stringify(report.unresolved));
if (write) for (const [name, data] of Object.entries(migrated)) fs.writeFileSync(path.join(root, 'data', `${name}.json`), JSON.stringify(data, null, 2) + '\n');
console.log(JSON.stringify({ write, ...report }, null, 2));
