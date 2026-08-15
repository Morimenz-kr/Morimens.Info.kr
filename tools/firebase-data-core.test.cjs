const assert = require('node:assert/strict');
const path = require('node:path');
const test = require('node:test');

const ROOT = path.join(__dirname, '..');

async function loadCore() {
  return import('./firebase-data-core.mjs');
}

test('실제 운영 JSON을 Firestore 문서로 분해하고 의미 손실 없이 복원한다', async () => {
  const core = await loadCore();
  const source = await core.readDatasets(path.join(ROOT, 'data'));
  const bundle = core.createReleaseBundle(source);
  const restored = core.restoreDatasets(bundle);
  const rebuilt = core.createReleaseBundle(restored);

  assert.equal(bundle.documents.filter(document => document.data.kind === 'character').length, 59);
  assert.equal(bundle.documentCount, 68);
  for (const fileName of core.OPERATING_DATASETS) {
    assert.deepEqual(restored[fileName], source[fileName], fileName);
  }
  assert.equal(rebuilt.releaseId, bundle.releaseId);
});

test('모든 Firestore 문서는 1MiB보다 충분히 작은 안전 제한을 만족한다', async () => {
  const core = await loadCore();
  const source = await core.readDatasets(path.join(ROOT, 'data'));
  const bundle = core.createReleaseBundle(source);
  const summary = core.releaseSummary(bundle);

  assert.ok(summary.maximumDocumentBytes < core.MAX_SAFE_DOCUMENT_BYTES);
  assert.ok(bundle.documents.every(document => document.bytes < 1_048_576));
  assert.ok(bundle.documents.every(document => typeof document.data.payloadJson === 'string'));
  assert.ok(bundle.documents.every(document => !Object.hasOwn(document.data, 'payload')));

  const hasNestedArray = value => Array.isArray(value)
    ? value.some(item => Array.isArray(item) || hasNestedArray(item))
    : value !== null && typeof value === 'object'
      ? Object.values(value).some(hasNestedArray)
      : false;
  assert.ok(bundle.documents.every(document => !hasNestedArray(document.data)));
});

test('legacy와 유지보수 전용 데이터는 Firestore 운영 범위에 포함하지 않는다', async () => {
  const core = await loadCore();
  const included = new Set(core.OPERATING_DATASETS);

  for (const fileName of [...core.EXCLUDED_LEGACY_DATASETS, ...core.MAINTENANCE_DATASETS]) {
    assert.equal(included.has(fileName), false, fileName);
  }
});

test('캐릭터 참조가 manifest 밖을 가리키면 릴리스를 만들지 않는다', async () => {
  const core = await loadCore();
  const source = await core.readDatasets(path.join(ROOT, 'data'));
  source['character_settings.json'].unknown_character = {};

  assert.throws(
    () => core.createReleaseBundle(source),
    /manifest에 없습니다: unknown_character/
  );
});

test('문서 payload가 바뀌면 체크섬 검증에서 복원을 거부한다', async () => {
  const core = await loadCore();
  const source = await core.readDatasets(path.join(ROOT, 'data'));
  const bundle = core.createReleaseBundle(source);
  const character = bundle.documents.find(document => document.data.kind === 'character');
  const payload = JSON.parse(character.data.payloadJson);
  payload.manifest.name = '변조됨';
  character.data.payloadJson = JSON.stringify(payload);

  assert.throws(() => core.restoreDatasets(bundle), /문서 체크섬이 일치하지 않습니다/);
});

test('잘못된 payload JSON과 이전 스키마 문서를 거부한다', async () => {
  const core = await loadCore();
  const source = await core.readDatasets(path.join(ROOT, 'data'));

  const invalidJsonBundle = core.createReleaseBundle(source);
  invalidJsonBundle.documents[0].data.payloadJson = '{';
  assert.throws(() => core.restoreDatasets(invalidJsonBundle), /payload JSON이 올바르지 않습니다/);

  const oldSchemaBundle = core.createReleaseBundle(source);
  oldSchemaBundle.documents[0].data.schemaVersion = core.FIRESTORE_SCHEMA_VERSION - 1;
  assert.throws(() => core.restoreDatasets(oldSchemaBundle), /문서 스키마 버전/);
});

test('중복되거나 예상하지 않은 Firestore 문서를 거부한다', async () => {
  const core = await loadCore();
  const source = await core.readDatasets(path.join(ROOT, 'data'));
  const duplicateBundle = core.createReleaseBundle(source);
  duplicateBundle.documents.push(duplicateBundle.documents[0]);
  duplicateBundle.documentCount += 1;
  assert.throws(() => core.restoreDatasets(duplicateBundle), /중복 문서 ID/);

  const extraBundle = core.createReleaseBundle(source);
  extraBundle.documents.push({
    id: 'unexpected',
    data: { ...extraBundle.documents[0].data },
    bytes: extraBundle.documents[0].bytes
  });
  extraBundle.documentCount += 1;
  assert.throws(() => core.restoreDatasets(extraBundle), /예상 문서 수|예상하지 않은/);
});

test('릴리스 메타데이터와 전체 체크섬 변조를 거부한다', async () => {
  const core = await loadCore();
  const source = await core.readDatasets(path.join(ROOT, 'data'));

  const countBundle = core.createReleaseBundle(source);
  countBundle.documentCount -= 1;
  assert.throws(() => core.restoreDatasets(countBundle), /릴리스 문서 수/);

  const checksumBundle = core.createReleaseBundle(source);
  checksumBundle.checksum = '0'.repeat(64);
  assert.throws(() => core.restoreDatasets(checksumBundle), /릴리스 전체 체크섬/);

  const idBundle = core.createReleaseBundle(source);
  idBundle.releaseId = 'release-invalid';
  assert.throws(() => core.restoreDatasets(idBundle), /릴리스 ID와 체크섬/);
});
