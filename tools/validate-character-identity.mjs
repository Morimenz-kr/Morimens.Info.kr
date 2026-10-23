import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { create } = require('../js/character-identity.js');
export function validateIdentityData(manifest, datasets) {
    const errors = [];
    let identity;
    try { identity = create(manifest); } catch (error) { return [error.message]; }
    const clientIds = new Set();
    for (const character of manifest) {
        if (!Number.isInteger(character.client_id) || clientIds.has(character.client_id)) errors.push(`잘못되거나 중복된 client_id: ${character.id}`);
        clientIds.add(character.client_id);
        if (!character.name_aliases?.length) errors.push(`검색 별칭 누락: ${character.id}`);
    }
    for (const [file, records] of Object.entries(datasets)) for (const record of records) {
        if (!Array.isArray(record.owner_character_ids)) errors.push(`${file}/${record.english_name}: owner_character_ids 누락; 관계 마이그레이션 필요`);
        for (const field of ['owner_character_ids', 'recommended_character_ids', 'related_character_ids']) {
            if (field in record && !Array.isArray(record[field])) { errors.push(`${file}/${record.english_name}: ${field} 배열 필요`); continue; }
            for (const id of record[field] || []) if (!identity.byId.has(id)) errors.push(`${file}/${record.english_name}: 없는 ${field} ${id}`);
        }
        for (const field of ['tags', 'optimized_for']) for (const tag of record[field] || []) {
            if (identity.resolveId(tag)) errors.push(`${file}/${record.english_name}: 이전 이름 관계 ${field}=${tag}; migrate-character-identity --write 필요`);
        }
        const walk = value => {
            if (!value || typeof value !== 'object') return;
            for (const [key, child] of Object.entries(value)) {
                if (/^(raw|source|original|research|provenance)/i.test(key)) continue;
                if (typeof child === 'string') {
                    for (const match of child.matchAll(/\{character:([^{}]+)\}/g)) {
                        if (!identity.byId.has(match[1])) errors.push(`${file}/${record.english_name}: 없는 이름 참조 ${match[1]}`);
                    }
                } else if (child && typeof child === 'object') walk(child);
            }
        };
        walk(record);
    }
    return errors;
}
if (process.argv[1] && path.resolve(process.argv[1]) === import.meta.filename) {
    const root = path.resolve(import.meta.dirname, '..', 'data');
    const read = name => JSON.parse(fs.readFileSync(path.join(root, `${name}.json`), 'utf8'));
    const errors = validateIdentityData(read('character_manifest'), { wheel_list: read('wheel_list'), silverkey_list: read('silverkey_list') });
    console.log(JSON.stringify({ errors: errors.length, diagnostics: errors }, null, 2));
    if (errors.length) process.exitCode = 1;
}
