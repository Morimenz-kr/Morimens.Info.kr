import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';

export const FIRESTORE_SCHEMA_VERSION = 2;
export const MAX_SAFE_DOCUMENT_BYTES = 750_000;

export const OPERATING_DATASETS = Object.freeze([
  'character_manifest.json',
  'character_settings.json',
  'character_effects.json',
  'gachatype.json',
  'resource_links.json',
  'wheel_list.json',
  'silverkey_list.json',
  'covenant_list.json',
  'party_builder_rules.json',
  'db_tooltips.json',
  'latest_wheel_recommendations.json',
  'rerun_schedule.json',
  'patch_notes.json'
]);

export const EXCLUDED_LEGACY_DATASETS = Object.freeze([
  'awakener/tawil.json',
  'db_cards.json',
  'db_awakener_stats.json'
]);

export const MAINTENANCE_DATASETS = Object.freeze([
  'covenant_main_stats.json',
  'covenant_main_stats_overrides.json',
  'character_settings_latest.json',
  'latest_settings_asset_map.json',
  'latest_settings_overrides.json',
  'latest_wheel_recommendation_overrides.json'
]);

const STATIC_DOCUMENTS = Object.freeze([
  ['catalog__wheels', 'catalog', 'wheel_list.json'],
  ['catalog__silverkeys', 'catalog', 'silverkey_list.json'],
  ['catalog__covenants', 'catalog', 'covenant_list.json'],
  ['config__party_builder', 'config', 'party_builder_rules.json'],
  ['dictionary__tooltips', 'dictionary', 'db_tooltips.json'],
  ['content__wheel_recommendations', 'content', 'latest_wheel_recommendations.json'],
  ['content__rerun_schedule', 'content', 'rerun_schedule.json'],
  ['content__patch_notes', 'content', 'patch_notes.json']
]);

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function sortForCanonicalJson(value) {
  if (Array.isArray(value)) return value.map(sortForCanonicalJson);
  if (!isPlainObject(value)) return value;

  const sorted = {};
  for (const key of Object.keys(value).sort()) {
    sorted[key] = sortForCanonicalJson(value[key]);
  }
  return sorted;
}

export function canonicalJson(value) {
  return JSON.stringify(sortForCanonicalJson(value));
}

export function checksum(value) {
  return crypto.createHash('sha256').update(canonicalJson(value)).digest('hex');
}

export function estimateDocumentBytes(document) {
  return Buffer.byteLength(JSON.stringify(document), 'utf8');
}

function assertDatasetShape(data) {
  for (const fileName of OPERATING_DATASETS) {
    if (!Object.hasOwn(data, fileName)) {
      throw new Error(`운영 데이터셋이 없습니다: ${fileName}`);
    }
  }

  if (!Array.isArray(data['character_manifest.json'])) {
    throw new TypeError('character_manifest.json은 배열이어야 합니다.');
  }

  for (const fileName of [
    'character_settings.json',
    'character_effects.json',
    'gachatype.json',
    'resource_links.json'
  ]) {
    if (!isPlainObject(data[fileName])) {
      throw new TypeError(`${fileName}은 객체여야 합니다.`);
    }
  }
}

function assertCharacterReferences(data) {
  const manifest = data['character_manifest.json'];
  const ids = manifest.map(character => character?.id);
  const invalidId = ids.find(id => typeof id !== 'string' || id.length === 0 || id.includes('/'));
  if (invalidId !== undefined) throw new Error(`유효하지 않은 캐릭터 ID: ${String(invalidId)}`);

  const uniqueIds = new Set(ids);
  if (uniqueIds.size !== ids.length) throw new Error('character_manifest.json에 중복 ID가 있습니다.');

  const keyedSources = [
    ['character_settings.json', data['character_settings.json']],
    ['character_effects.json', data['character_effects.json']],
    ['resource_links.json.characters', data['resource_links.json'].characters ?? {}]
  ];

  for (const [source, values] of keyedSources) {
    if (!isPlainObject(values)) throw new TypeError(`${source}는 객체여야 합니다.`);
    for (const id of Object.keys(values)) {
      if (!uniqueIds.has(id)) throw new Error(`${source}의 캐릭터가 manifest에 없습니다: ${id}`);
    }
  }

  for (const [category, categoryIds] of Object.entries(data['gachatype.json'])) {
    if (!Array.isArray(categoryIds)) throw new TypeError(`gachatype.${category}는 배열이어야 합니다.`);
    for (const id of categoryIds) {
      if (!uniqueIds.has(id)) throw new Error(`gachatype.${category}의 캐릭터가 manifest에 없습니다: ${id}`);
    }
  }
}

function createDocument(id, kind, source, payload) {
  const document = {
    schemaVersion: FIRESTORE_SCHEMA_VERSION,
    kind,
    source: Array.isArray(source) ? source : [source],
    // Firestore rejects arrays nested directly inside arrays. Keep each source
    // payload as JSON text so arbitrary repository JSON and key order remain lossless.
    payloadJson: JSON.stringify(payload)
  };
  document.checksum = checksum(payload);

  const bytes = estimateDocumentBytes(document);
  if (bytes > MAX_SAFE_DOCUMENT_BYTES) {
    throw new Error(`Firestore 문서가 안전 크기를 초과합니다: ${id} (${bytes} bytes)`);
  }

  return { id, data: document, bytes };
}

function calculateReleaseChecksum(sourceChecksums, documents) {
  return checksum({
    schemaVersion: FIRESTORE_SCHEMA_VERSION,
    sourceChecksums,
    documentChecksums: [...documents]
      .sort((left, right) => left.id.localeCompare(right.id))
      .map(document => [document.id, document.data.checksum])
  });
}

function characterMemberships(gachaType, id) {
  return Object.entries(gachaType)
    .filter(([, ids]) => ids.includes(id))
    .map(([category]) => category);
}

export function createReleaseBundle(data, options = {}) {
  assertDatasetShape(data);
  assertCharacterReferences(data);

  const manifest = data['character_manifest.json'];
  const settings = data['character_settings.json'];
  const effects = data['character_effects.json'];
  const gachaType = data['gachatype.json'];
  const resourceLinks = data['resource_links.json'];
  const documents = [];

  documents.push(createDocument('site__structure', 'structure', OPERATING_DATASETS, {
    characterOrder: manifest.map(character => character.id),
    gachaType,
    resourceCategories: resourceLinks.categories ?? {}
  }));

  for (const character of manifest) {
    const id = character.id;
    const hasSettings = Object.hasOwn(settings, id);
    const hasEffects = Object.hasOwn(effects, id);
    const hasResourceLinks = Object.hasOwn(resourceLinks.characters ?? {}, id);

    documents.push(createDocument(`character__${id}`, 'character', [
      'character_manifest.json',
      'character_settings.json',
      'character_effects.json',
      'gachatype.json',
      'resource_links.json'
    ], {
      id,
      manifest: character,
      hasSettings,
      settings: hasSettings ? settings[id] : null,
      hasEffects,
      effects: hasEffects ? effects[id] : null,
      gachaTypes: characterMemberships(gachaType, id),
      hasResourceLinks,
      resourceLinks: hasResourceLinks ? resourceLinks.characters[id] : null
    }));
  }

  for (const [id, kind, fileName] of STATIC_DOCUMENTS) {
    documents.push(createDocument(id, kind, fileName, data[fileName]));
  }

  const sourceChecksums = Object.fromEntries(
    OPERATING_DATASETS.map(fileName => [fileName, checksum(data[fileName])])
  );
  const releaseChecksum = calculateReleaseChecksum(sourceChecksums, documents);
  const releaseId = `release-${releaseChecksum.slice(0, 20)}`;
  if (options.releaseId && options.releaseId !== releaseId) {
    throw new Error(`릴리스 ID와 체크섬이 일치하지 않습니다: ${options.releaseId}`);
  }

  return {
    releaseId,
    schemaVersion: FIRESTORE_SCHEMA_VERSION,
    checksum: releaseChecksum,
    sourceChecksums,
    documentCount: documents.length,
    documents
  };
}

function parseDocumentPayload(document) {
  if (typeof document?.data?.payloadJson !== 'string') {
    throw new Error(`문서 payload JSON이 없습니다: ${document?.id ?? 'unknown'}`);
  }
  try {
    return JSON.parse(document.data.payloadJson);
  } catch {
    throw new Error(`문서 payload JSON이 올바르지 않습니다: ${document.id}`);
  }
}

function verifyDocument(document) {
  if (!document?.id || !document?.data) throw new Error('잘못된 Firestore 문서입니다.');
  if (document.data.schemaVersion !== FIRESTORE_SCHEMA_VERSION) {
    throw new Error(`문서 스키마 버전이 일치하지 않습니다: ${document.id}`);
  }
  const actual = checksum(parseDocumentPayload(document));
  if (actual !== document.data.checksum) {
    throw new Error(`문서 체크섬이 일치하지 않습니다: ${document.id}`);
  }
}

export function restoreDatasets(bundle) {
  if (!bundle || !Array.isArray(bundle.documents)) throw new TypeError('릴리스 문서가 필요합니다.');
  if (bundle.schemaVersion !== FIRESTORE_SCHEMA_VERSION) {
    throw new Error(`지원하지 않는 스키마 버전: ${bundle.schemaVersion}`);
  }

  if (!Number.isInteger(bundle.documentCount) || bundle.documentCount !== bundle.documents.length) {
    throw new Error(`릴리스 문서 수가 일치하지 않습니다: ${bundle.documentCount}/${bundle.documents.length}`);
  }
  if (!isPlainObject(bundle.sourceChecksums)) throw new Error('릴리스 원본 체크섬이 없습니다.');
  for (const fileName of OPERATING_DATASETS) {
    if (typeof bundle.sourceChecksums[fileName] !== 'string') {
      throw new Error(`릴리스 원본 체크섬이 없습니다: ${fileName}`);
    }
  }

  bundle.documents.forEach(verifyDocument);
  const documentIds = bundle.documents.map(document => document.id);
  if (new Set(documentIds).size !== documentIds.length) {
    throw new Error('릴리스에 중복 문서 ID가 있습니다.');
  }
  const byId = new Map(bundle.documents.map(document => [document.id, {
    ...document.data,
    payload: parseDocumentPayload(document)
  }]));
  const structure = byId.get('site__structure')?.payload;
  if (!structure || !Array.isArray(structure.characterOrder)) {
    throw new Error('site__structure 문서가 없습니다.');
  }

  const expectedDocumentIds = new Set([
    'site__structure',
    ...structure.characterOrder.map(id => `character__${id}`),
    ...STATIC_DOCUMENTS.map(([id]) => id)
  ]);
  if (expectedDocumentIds.size !== bundle.documents.length) {
    throw new Error('릴리스의 예상 문서 수가 일치하지 않습니다.');
  }
  for (const id of documentIds) {
    if (!expectedDocumentIds.has(id)) throw new Error(`예상하지 않은 릴리스 문서입니다: ${id}`);
  }

  const manifest = [];
  const settings = {};
  const effects = {};
  const characters = {};

  for (const id of structure.characterOrder) {
    const payload = byId.get(`character__${id}`)?.payload;
    if (!payload || payload.id !== id) throw new Error(`캐릭터 문서가 없습니다: ${id}`);
    manifest.push(payload.manifest);
    if (payload.hasSettings) settings[id] = payload.settings;
    if (payload.hasEffects) effects[id] = payload.effects;
    if (payload.hasResourceLinks) characters[id] = payload.resourceLinks;
  }

  const restored = {
    'character_manifest.json': manifest,
    'character_settings.json': settings,
    'character_effects.json': effects,
    'gachatype.json': structure.gachaType,
    'resource_links.json': {
      categories: structure.resourceCategories,
      characters
    }
  };

  for (const [id, , fileName] of STATIC_DOCUMENTS) {
    const document = byId.get(id);
    if (!document) throw new Error(`정적 데이터 문서가 없습니다: ${id}`);
    restored[fileName] = document.payload;
  }

  const restoredChecksums = Object.fromEntries(
    OPERATING_DATASETS.map(fileName => [fileName, checksum(restored[fileName])])
  );
  for (const fileName of OPERATING_DATASETS) {
    if (bundle.sourceChecksums[fileName] !== restoredChecksums[fileName]) {
      throw new Error(`복원 데이터 체크섬이 일치하지 않습니다: ${fileName}`);
    }
  }

  const rebuiltChecksum = calculateReleaseChecksum(restoredChecksums, bundle.documents);
  if (bundle.checksum !== rebuiltChecksum) throw new Error('릴리스 전체 체크섬이 일치하지 않습니다.');
  const expectedReleaseId = `release-${rebuiltChecksum.slice(0, 20)}`;
  if (bundle.releaseId !== expectedReleaseId) {
    throw new Error(`릴리스 ID와 체크섬이 일치하지 않습니다: ${bundle.releaseId}`);
  }

  return restored;
}

export async function readDatasets(dataDirectory) {
  const entries = await Promise.all(OPERATING_DATASETS.map(async fileName => {
    const contents = await fs.readFile(path.join(dataDirectory, fileName), 'utf8');
    return [fileName, JSON.parse(contents)];
  }));
  return Object.fromEntries(entries);
}

export async function writeDatasets(dataDirectory, data) {
  await fs.mkdir(dataDirectory, { recursive: true });
  await Promise.all(OPERATING_DATASETS.map(async fileName => {
    if (!Object.hasOwn(data, fileName)) throw new Error(`출력 데이터셋이 없습니다: ${fileName}`);
    await fs.writeFile(
      path.join(dataDirectory, fileName),
      `${JSON.stringify(data[fileName], null, 2)}\n`,
      'utf8'
    );
  }));
}

export function releaseSummary(bundle) {
  return {
    releaseId: bundle.releaseId,
    schemaVersion: bundle.schemaVersion,
    checksum: bundle.checksum,
    documentCount: bundle.documentCount,
    maximumDocumentBytes: Math.max(...bundle.documents.map(document => document.bytes)),
    totalDocumentBytes: bundle.documents.reduce((sum, document) => sum + document.bytes, 0)
  };
}
