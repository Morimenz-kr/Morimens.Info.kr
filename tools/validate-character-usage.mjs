// This tool validates sanitized public snapshots. It never connects to the game.
import fs from 'node:fs/promises';
import path from 'node:path';
import { normalizeUsage, validateUsageCatalog, sampleCount } from '../js/character-usage-model.mjs';
const file = process.argv[2];
if (!file) throw new Error('Usage: node tools/validate-character-usage.mjs <sanitized-snapshot.json>');
const root = path.join(import.meta.dirname, '..');
const read = async file => JSON.parse(await fs.readFile(file, 'utf8'));
const [manifest, wheels, covenants] = await Promise.all(['character_manifest', 'wheel_list', 'covenant_list'].map(name => read(path.join(root, 'data', `${name}.json`))));
const data = validateUsageCatalog(normalizeUsage(await read(file)), { manifest, wheels, covenants });
console.log(JSON.stringify({ characterId: data.characterId, period: data.period, rows: data.rows.length, records: sampleCount(data.rows), collectedAt: data.collectedAt }, null, 2));
