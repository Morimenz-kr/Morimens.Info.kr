import fs from 'node:fs/promises';
import path from 'node:path';
import { gunzipSync } from 'node:zlib';
import { compactUsage, validateUsageCatalog, normalizeMember, teamKey } from '../js/character-usage-model.mjs';
import { usageExtraWheels } from '../js/character-usage-equipment.mjs';
import { normalizeClearIndex } from '../js/dzone-clear-model.mjs';

const [archiveDirectory, catalogDirectory] = process.argv.slice(2);
const period = Number(process.argv[4] || 73);
const perStage = Number(process.argv[5] || 0);
const seasonPath = process.argv[6]; // Server-confirmed metadata; no future combat archive required.
if (!archiveDirectory || !catalogDirectory || !Number.isInteger(period) || period < 70 || period > 9999 || !Number.isSafeInteger(perStage) || perStage < 0) {
    throw new Error('node tools/build-dzone-clear-snapshots.mjs <review-archive-dir> <private-catalog-dir> [period] [sample-per-stage]');
}
const root = path.join(import.meta.dirname, '..');
const read = async file => JSON.parse(await fs.readFile(file, 'utf8'));
const dataFiles = ['character_manifest', 'wheel_list', 'covenant_list', 'covenant_parts', 'covenant_editor'];
const catalogs = ['game-build-content', 'game-wheel-index', 'game-attribute-index'];
const [manifest, wheels, covenants, parts, editor, season, build, wheelIndex, attributes, verifiedWheelMap] = await Promise.all([
    ...dataFiles.map(name => read(path.join(root, 'data', name + '.json'))),
    read(seasonPath || path.join(root, 'data', `dzone_season${period}.json`)),
    ...catalogs.map(name => read(path.join(catalogDirectory, name + '.json'))),
    read(path.join(root, 'scarecrow/runtime/site-equipment-map.json'))
]);
if (season.period !== period || !Number.isSafeInteger(season.usageSince) || [build, wheelIndex, attributes].some(data => data.source !== 'client-config')) {
    throw new Error('Missing verified season or client catalogs');
}
const characterIds = new Map(manifest.map(c => [c.client_id, c.id]));
const siteWheels = new Set([...wheels, ...usageExtraWheels].map(w => w.english_name));
const wheelIds = new Map(wheelIndex.entries.filter(w => siteWheels.has(w.siteId)).map(w => [w.clientId, w.siteId]));
for (const [siteId, clientId] of Object.entries(verifiedWheelMap)) {
    if (!siteWheels.has(siteId) || !Number.isSafeInteger(clientId)) continue;
    // The site runtime map links renamed entries by original item ID.
    wheelIds.set(clientId, siteId);
}
for (const [clientId, siteId] of [[129628, 'wheel_ramona_n'], [73582, 'wheel_unsent_flower_n']]) {
    if (siteWheels.has(siteId) && build.items[clientId]?.SubType === 'Weapon') wheelIds.set(clientId, siteId);
}
const setIds = new Map(Object.entries(editor.setIds).map(([id, tid]) => [tid, id]));
const partIds = new Map(parts.flatMap(set => set.parts.map(p => [p.clientItemId, { slot: ['I', 'II', 'III', 'IV', 'V', 'VI'].indexOf(p.slot) + 1, suitId: set.suitId }])));
const constants = build.growth.constants;
const mainPoints = constants.TrinketMainAttrValue.Data;
const subPoints = constants.TrinketSubAttrValueLevel.Data;
const maxPoints = 6 * (mainPoints.at(-1) + subPoints.at(-2) * constants.TrinketSubAttrNumWeight.Data[0]);
if (maxPoints !== 132) throw new Error('Contract completion maximum needs verification');

const diagnostics = { archiveRows: 0, duplicate: 0, outsideSeason: 0, invalid: 0, matchedClears: 0, fullGearClears: 0, members: 0,
    wheelsKnown: 0, covenantsKnown: 0, completionKnown: 0, options90: 0, unknownWheelTypes: {}, unknownPartTypes: {}, unknownAttributes: {} };
const missing = (field, id) => { diagnostics[field][id ?? 'missing'] = (diagnostics[field][id ?? 'missing'] || 0) + 1; return null; };

function loadWheels(awakener, items) {
    const slots = awakener.weaponSlots;
    if (!Array.isArray(slots) || slots.length > 2) return null;
    const wheels = [];
    for (const slot of slots) {
        if (slot.weaponUid === 0) continue;
        const item = items[slot.weaponUid];
        const id = item ? wheelIds.get(item.tid) : null;
        if (!id) return missing('unknownWheelTypes', item?.tid);
        const level = Number.isInteger(item.level) && item.level >= 0 && item.level <= 30 ? item.level : null;
        wheels.push({ id, level });
    }
    return wheels;
}

function loadContract(awakener, items) {
    if (!Array.isArray(awakener.trinkets) || awakener.trinkets.length !== 6 || new Set(awakener.trinkets).size !== 6) return null;
    const parts = [];
    let points = 0;
    for (const itemId of awakener.trinkets) {
        const item = items[itemId];
        const part = partIds.get(item?.tid);
        if (!part || !part.slot || part.suitId !== item.suitId || !setIds.has(item.suitId)) return missing('unknownPartTypes', item?.tid);
        if (!Array.isArray(item.attrs) || item.attrs[0]?.index !== 1 || item.attrs.length > 9) return null;
        const stats = [];
        points += mainPoints[item.level] ?? NaN;
        for (const [index, attr] of item.attrs.entries()) {
            const definition = attributes.attributes[attr.attrId];
            if (!definition?.name || !Number.isFinite(attr.val) || attr.val < 0) return missing('unknownAttributes', attr.attrId);
            stats.push({ id: String(attr.attrId), label: definition.name, value: attr.val, unit: definition.percentage ? '%' : '' });
            if (index) points += definition.equivalency > 0 ? attr.val / definition.equivalency : NaN;
        }
        parts.push({ slot: part.slot, setId: setIds.get(item.suitId), main: stats[0], subs: stats.slice(1) });
    }
    if (new Set(parts.map(p => p.slot)).size !== 6) return null;
    const completion = Math.floor(points / maxPoints * 1000) / 10;
    return { completion: Number.isFinite(completion) && completion >= 0 && completion <= 100 ? completion : null, parts };
}

const groups = new Map(), teams = new Map();
let capturedAt = 0;
for (const wave of season.waves) {
    for (const alert of wave.alerts) {
        const stagePath = path.join(archiveDirectory, String(alert.stageId));
        const files = (await fs.readdir(stagePath)).filter(name => /^[a-f0-9]{64}\.json\.gz$/.test(name)).sort();
        const names = perStage ? files.slice(0, perStage) : files;
        const unique = new Set();
        for (let offset = 0; offset < names.length; offset += 32) {
            const batch = await Promise.all(names.slice(offset, offset + 32).map(async name => {
                try {
                    return JSON.parse(gunzipSync(await fs.readFile(path.join(stagePath, name)), { maxOutputLength: 2_000_000 }).toString('utf8'));
                } catch {
                    return null;
                }
            }));
            for (const record of batch) {
                diagnostics.archiveRows++;
                if (!record) { diagnostics.invalid++; continue; }
                const detail = record.detail?.data, summary = record.summary, team = detail?.teamData;
                if (record.stageTid !== alert.stageId || detail?.stageTid !== alert.stageId || summary?.stageTid !== alert.stageId
                    || !summary.battleUuid || detail.battleUuid !== summary.battleUuid || !team?.items || !Array.isArray(team.awakers)
                    || team.awakers.length !== 4 || !Number.isSafeInteger(record.fetchedAt)) { diagnostics.invalid++; continue; }
                if (!Number.isSafeInteger(detail.timestamp) || detail.timestamp < season.usageSince || detail.timestamp >= season.usageSince + 14 * 86400) {
                    diagnostics.outsideSeason++; continue;
                }
                if (unique.has(summary.battleUuid)) { diagnostics.duplicate++; continue; }

                const ids = team.awakers.map(a => characterIds.get(a.tid));
                if (ids.some(id => !id) || new Set(ids).size !== 4) { diagnostics.invalid++; continue; }
                const outlineIds = summary.awakerOutlineList?.map(a => characterIds.get(a.tid));
                if (!outlineIds || outlineIds.slice().sort().join('|') !== ids.slice().sort().join('|')) { diagnostics.invalid++; continue; }
                unique.add(summary.battleUuid);
                const members = team.awakers.map((a, index) => normalizeMember({
                    characterId: ids[index],
                    enlightenment: Number.isInteger(a.potencyLevel) && a.potencyLevel >= 0 && a.potencyLevel <= 30 ? a.potencyLevel : null,
                    borrowed: Number.isSafeInteger(a.assistPlayerId) ? a.assistPlayerId > 0 : null,
                    wheels: loadWheels(a, team.items),
                    covenant: loadContract(a, team.items)
                })).sort((a, b) => a.characterId.localeCompare(b.characterId));
                const row = { wave: wave.wave, difficulty: String(alert.alert), count: 1, members };
                const fullGear = members.every(m => m.wheels !== null && m.covenant !== null);
                const teamId = teamKey(row);
                const teamEntry = teams.get(teamId) || { members: ids.sort(), buckets: {} };
                const bucketId = `${row.wave}:${row.difficulty}`;
                const bucket = teamEntry.buckets[bucketId] || { wave: row.wave, difficulty: row.difficulty, count: 0, gearCount: 0 };
                bucket.count++;
                bucket.gearCount += Number(fullGear);
                teamEntry.buckets[bucketId] = bucket;
                teams.set(teamId, teamEntry);
                const rowId = JSON.stringify(row);
                const existing = groups.get(rowId);
                if (existing) existing.count++;
                else groups.set(rowId, row);
                capturedAt = Math.max(capturedAt, record.fetchedAt);
                diagnostics.matchedClears++;
                diagnostics.fullGearClears += Number(fullGear);
                diagnostics.members += 4;
                diagnostics.wheelsKnown += members.filter(m => m.wheels !== null).length;
                diagnostics.covenantsKnown += members.filter(m => m.covenant !== null).length;
                diagnostics.completionKnown += members.filter(m => m.covenant?.completion != null).length;
                diagnostics.options90 += members.filter(m => m.covenant?.completion >= 90).length;
            }
        }
        console.log(`${wave.wave}구역 ${alert.alert}급: ${names.length}건 읽음`);
    }
}

if (!diagnostics.fullGearClears) throw new Error('No season clears with full equipment passed validation');
if (diagnostics.invalid) throw new Error('Invalid review records; retaining the previous published recommendations');
const meta = { period, collectedAt: capturedAt, coverage: 'sample', source: '융재금구 공개 클리어 상세 수집분' };
const clearIndex = normalizeClearIndex({ ...meta, schemaVersion: 1, teams: [...teams.values()].map(t => ({ members: t.members, buckets: Object.values(t.buckets) })) }, new Set(characterIds.values()));
const byCharacter = new Map();
for (const row of groups.values()) for (const { characterId } of row.members) {
    if (!byCharacter.has(characterId)) byCharacter.set(characterId, []);
    byCharacter.get(characterId).push(row);
}
// Only the explicitly projected, anonymous schemas are written. Never copy source files.
const out = path.join(root, '.generated', perStage ? 'dzone-recommendations-sample' : 'dzone-recommendations', String(period));
await fs.mkdir(path.join(out, 'characters'), { recursive: true });
for (const [characterId, rows] of byCharacter) {
    const snapshot = validateUsageCatalog({ ...meta, schemaVersion: 1, characterId, rows }, { manifest, wheels, covenants });
    await fs.writeFile(path.join(out, 'characters', characterId + '.json'), JSON.stringify({ data: compactUsage(snapshot), periods: [period] }));
}
await fs.writeFile(path.join(out, 'teams.json'), JSON.stringify({ data: clearIndex }));
// Written last: publication must not enumerate stale files from a previous build.
await fs.writeFile(path.join(out, 'publication.json'), JSON.stringify({ schemaVersion: 1, period,
    collectedAt: capturedAt, records: diagnostics.matchedClears, characters: [...byCharacter.keys()].sort() }));
console.log(JSON.stringify({ ...diagnostics, period, characters: byCharacter.size, teams: teams.size, collectedAt: capturedAt }, null, 2));
