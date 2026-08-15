const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const ROOT = path.join(__dirname, '..');
const PROJECT_ID = 'morimens-emulator-test';

async function clearEmulator() {
  const host = process.env.FIRESTORE_EMULATOR_HOST;
  assert.ok(host, 'FIRESTORE_EMULATOR_HOST가 필요합니다.');
  const response = await fetch(
    `http://${host}/emulator/v1/projects/${PROJECT_ID}/databases/(default)/documents`,
    { method: 'DELETE' }
  );
  assert.equal(response.ok, true, await response.text());
}

test('Firestore Emulator에서 import, 명시적 활성화, export가 원본을 보존한다', async () => {
  const core = await import('./firebase-data-core.mjs');
  const firestore = await import('./firebase-data.mjs');
  const { deleteApp } = await import('firebase-admin/app');
  await clearEmulator();

  const source = await core.readDatasets(path.join(ROOT, 'data'));
  const bundle = core.createReleaseBundle(source);
  const context = firestore.initializeFirestore({
    projectId: PROJECT_ID,
    appName: `emulator-test-${Date.now()}`
  });
  const outputDirectory = await fs.mkdtemp(path.join(os.tmpdir(), 'morimens-firestore-'));

  try {
    const uploaded = await firestore.uploadRelease(context.db, bundle, {
      activate: false
    });
    assert.equal(uploaded.created, true);
    assert.equal(uploaded.activated, false);
    await assert.rejects(firestore.getCurrentReleaseId(context.db), /활성화된 Firestore 릴리스가 없습니다/);

    await firestore.activateRelease(context.db, bundle.releaseId, {
      activationSequence: 100
    });
    assert.equal(await firestore.getCurrentReleaseId(context.db), bundle.releaseId);

    const exported = await firestore.exportRelease(context.db, outputDirectory);
    assert.equal(exported.checksum, bundle.checksum);

    const restored = await core.readDatasets(outputDirectory);
    for (const fileName of core.OPERATING_DATASETS) {
      assert.deepEqual(restored[fileName], source[fileName], fileName);
    }

    const duplicate = await firestore.uploadRelease(context.db, bundle, {
      activate: false
    });
    assert.equal(duplicate.created, false);
  } finally {
    await deleteApp(context.app);
    await fs.rm(outputDirectory, { recursive: true, force: true });
  }
});

test('늦게 끝난 이전 배포는 최신 활성 릴리스를 덮지 못한다', async () => {
  const core = await import('./firebase-data-core.mjs');
  const firestore = await import('./firebase-data.mjs');
  const { deleteApp } = await import('firebase-admin/app');
  await clearEmulator();

  const source = await core.readDatasets(path.join(ROOT, 'data'));
  const newerSource = structuredClone(source);
  newerSource['patch_notes.json'].push({ __emulatorTestMarker: 'newer' });
  const older = core.createReleaseBundle(source);
  const newer = core.createReleaseBundle(newerSource);
  const context = firestore.initializeFirestore({
    projectId: PROJECT_ID,
    appName: `emulator-race-test-${Date.now()}`
  });

  try {
    await firestore.uploadRelease(context.db, older, { activate: false });
    await firestore.uploadRelease(context.db, newer, { activate: false });
    await firestore.activateRelease(context.db, newer.releaseId, {
      activationSequence: 200
    });
    await assert.rejects(
      firestore.activateRelease(context.db, older.releaseId, {
        activationSequence: 100
      }),
      /이전 배포가 최신 릴리스를 덮을 수 없습니다/
    );
    assert.equal(await firestore.getCurrentReleaseId(context.db), newer.releaseId);
  } finally {
    await deleteApp(context.app);
  }
});

test('릴리스 GC는 dry-run을 지원하고 활성 릴리스를 삭제하지 않는다', async () => {
  const firestore = await import('./firebase-data.mjs');
  const { deleteApp } = await import('firebase-admin/app');
  await clearEmulator();
  const context = firestore.initializeFirestore({
    projectId: PROJECT_ID,
    appName: `emulator-gc-test-${Date.now()}`
  });

  try {
    const releases = context.db.collection('releases');
    await Promise.all([
      releases.doc('release-new').set({ createdAt: '2026-08-12T00:00:00.000Z' }),
      releases.doc('release-active').set({ createdAt: '2026-08-01T00:00:00.000Z' }),
      releases.doc('release-old-a').set({ createdAt: '2026-07-01T00:00:00.000Z' }),
      releases.doc('release-old-b').set({ createdAt: '2026-06-01T00:00:00.000Z' }),
      context.db.doc('published/meta').set({ currentReleaseId: 'release-active' })
    ]);

    const dryRun = await firestore.garbageCollectReleases(context.db, {
      retain: 1,
      minAgeDays: 7,
      now: '2026-08-13T00:00:00.000Z'
    });
    assert.deepEqual(dryRun.candidates.sort(), ['release-old-a', 'release-old-b']);
    assert.equal((await releases.doc('release-old-a').get()).exists, true);

    await firestore.garbageCollectReleases(context.db, {
      retain: 1,
      minAgeDays: 7,
      now: '2026-08-13T00:00:00.000Z',
      apply: true
    });
    assert.equal((await releases.doc('release-active').get()).exists, true);
    assert.equal((await releases.doc('release-new').get()).exists, true);
    assert.equal((await releases.doc('release-old-a').get()).exists, false);
    assert.equal((await releases.doc('release-old-b').get()).exists, false);
  } finally {
    await deleteApp(context.app);
  }
});

test('Firestore 보안 규칙은 비로그인·로그인 브라우저의 읽기와 쓰기를 모두 거부한다', async () => {
  const host = process.env.FIRESTORE_EMULATOR_HOST;
  assert.ok(host, 'FIRESTORE_EMULATOR_HOST가 필요합니다.');
  const [hostname, portText] = host.split(':');
  const { initializeTestEnvironment, assertFails } = require('@firebase/rules-unit-testing');
  const { doc, getDoc, setDoc } = require('firebase/firestore');
  const testEnvironment = await initializeTestEnvironment({
    projectId: `${PROJECT_ID}-rules`,
    firestore: {
      host: hostname,
      port: Number(portText),
      rules: await fs.readFile(path.join(ROOT, 'firestore.rules'), 'utf8')
    }
  });

  try {
    const unauthenticated = testEnvironment.unauthenticatedContext().firestore();
    const authenticated = testEnvironment.authenticatedContext('test-user').firestore();
    await assertFails(getDoc(doc(unauthenticated, 'published/meta')));
    await assertFails(getDoc(doc(authenticated, 'published/meta')));
    await assertFails(setDoc(doc(unauthenticated, 'published/meta'), { invalid: true }));
    await assertFails(setDoc(doc(authenticated, 'published/meta'), { invalid: true }));
  } finally {
    await testEnvironment.cleanup();
  }
});
