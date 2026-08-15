import { applicationDefault, deleteApp, getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  FIRESTORE_SCHEMA_VERSION,
  createReleaseBundle,
  readDatasets,
  releaseSummary,
  restoreDatasets,
  writeDatasets
} from './firebase-data-core.mjs';

const RELEASE_COLLECTION = 'releases';
const RELEASE_DOCUMENT_COLLECTION = 'documents';
const PUBLISHED_META_PATH = 'published/meta';
const BATCH_LIMIT = 400;

function getArgument(name, fallback = null) {
  const index = process.argv.indexOf(name);
  if (index === -1) return fallback;
  const value = process.argv[index + 1];
  if (!value || value.startsWith('--')) throw new Error(`${name} 값이 필요합니다.`);
  return value;
}

function hasFlag(name) {
  return process.argv.includes(name);
}

export function resolveProjectId(explicitProjectId = null) {
  const projectId = explicitProjectId
    ?? process.env.FIREBASE_PROJECT_ID
    ?? process.env.GCLOUD_PROJECT
    ?? process.env.GOOGLE_CLOUD_PROJECT
    ?? (process.env.FIRESTORE_EMULATOR_HOST ? 'morimens-emulator' : null);

  if (!projectId) {
    throw new Error(
      'Firebase 프로젝트 ID가 필요합니다. --project 또는 FIREBASE_PROJECT_ID를 설정하세요.'
    );
  }
  return projectId;
}

export function initializeFirestore(options = {}) {
  const projectId = resolveProjectId(options.projectId);
  const emulator = Boolean(process.env.FIRESTORE_EMULATOR_HOST);
  const appName = options.appName ?? `morimens-data-${projectId}`;
  const existing = getApps().find(app => app.name === appName);
  const app = existing ?? initializeApp(
    emulator ? { projectId } : { projectId, credential: applicationDefault() },
    appName
  );
  return { app, db: getFirestore(app), projectId, emulator };
}

async function writeInBatches(db, operations) {
  for (let start = 0; start < operations.length; start += BATCH_LIMIT) {
    const batch = db.batch();
    for (const operation of operations.slice(start, start + BATCH_LIMIT)) operation(batch);
    await batch.commit();
  }
}

export async function readRelease(db, releaseId, options = {}) {
  const releaseRef = db.collection(RELEASE_COLLECTION).doc(releaseId);
  const [releaseSnapshot, documentsSnapshot] = await Promise.all([
    releaseRef.get(),
    releaseRef.collection(RELEASE_DOCUMENT_COLLECTION).get()
  ]);

  if (!releaseSnapshot.exists) throw new Error(`Firestore 릴리스가 없습니다: ${releaseId}`);
  const metadata = releaseSnapshot.data();
  if (options.requireReady !== false && metadata.status !== 'ready') {
    throw new Error(`Firestore 릴리스가 준비되지 않았습니다: ${releaseId} (${metadata.status})`);
  }
  const documents = documentsSnapshot.docs.map(snapshot => ({
    id: snapshot.id,
    data: snapshot.data(),
    bytes: Buffer.byteLength(JSON.stringify(snapshot.data()), 'utf8')
  }));

  if (metadata.documentCount !== documents.length) {
    throw new Error(
      `Firestore 릴리스 문서 수가 일치하지 않습니다: ${metadata.documentCount}/${documents.length}`
    );
  }

  const bundle = {
    releaseId,
    schemaVersion: metadata.schemaVersion,
    checksum: metadata.checksum,
    sourceChecksums: metadata.sourceChecksums,
    documentCount: metadata.documentCount,
    documents
  };

  const restored = restoreDatasets(bundle);
  const rebuilt = createReleaseBundle(restored, { releaseId });
  if (rebuilt.checksum !== bundle.checksum) {
    throw new Error(`Firestore 릴리스 전체 체크섬이 일치하지 않습니다: ${releaseId}`);
  }
  return bundle;
}

export async function uploadRelease(db, bundle, options = {}) {
  const releaseRef = db.collection(RELEASE_COLLECTION).doc(bundle.releaseId);
  const existing = await releaseRef.get();

  if (existing.exists && existing.data().checksum !== bundle.checksum) {
    throw new Error(`같은 ID의 다른 Firestore 릴리스가 이미 있습니다: ${bundle.releaseId}`);
  }

  if (!existing.exists) {
    const createdAt = options.createdAt ?? new Date().toISOString();
    await releaseRef.create({
      schemaVersion: bundle.schemaVersion,
      checksum: bundle.checksum,
      sourceChecksums: bundle.sourceChecksums,
      documentCount: bundle.documentCount,
      status: 'uploading',
      createdAt
    });
  }

  if (!existing.exists || existing.data().status !== 'ready') {
    const operations = bundle.documents.map(document => batch => batch.set(
      releaseRef.collection(RELEASE_DOCUMENT_COLLECTION).doc(document.id),
      document.data
    ));
    await writeInBatches(db, operations);
    await readRelease(db, bundle.releaseId, { requireReady: false });
    await releaseRef.update({
      status: 'ready',
      readyAt: options.readyAt ?? new Date().toISOString()
    });
  } else {
    await readRelease(db, bundle.releaseId);
  }

  if (options.activate === true) {
    await activateRelease(db, bundle.releaseId, options);
  }

  return {
    ...releaseSummary(bundle),
    created: !existing.exists,
    activated: options.activate === true
  };
}

export async function activateRelease(db, releaseId, options = {}) {
  const releaseRef = db.collection(RELEASE_COLLECTION).doc(releaseId);
  const activationSequence = Number(options.activationSequence ?? Date.now());
  if (!Number.isSafeInteger(activationSequence) || activationSequence < 0) {
    throw new Error('activationSequence는 0 이상의 안전한 정수여야 합니다.');
  }

  await db.runTransaction(async transaction => {
    const publishedRef = db.doc(PUBLISHED_META_PATH);
    const [releaseSnapshot, publishedSnapshot] = await Promise.all([
      transaction.get(releaseRef),
      transaction.get(publishedRef)
    ]);
    if (!releaseSnapshot.exists || releaseSnapshot.data().status !== 'ready') {
      throw new Error(`준비되지 않은 릴리스는 활성화할 수 없습니다: ${releaseId}`);
    }

    const currentSequence = publishedSnapshot.exists
      ? Number(publishedSnapshot.data().activationSequence ?? -1)
      : -1;
    if (activationSequence < currentSequence) {
      throw new Error(
        `이전 배포가 최신 릴리스를 덮을 수 없습니다: ${activationSequence} < ${currentSequence}`
      );
    }
    if (currentSequence === activationSequence
        && publishedSnapshot.data()?.currentReleaseId !== releaseId) {
      throw new Error(`같은 활성화 순서에 다른 릴리스가 있습니다: ${activationSequence}`);
    }

    const release = releaseSnapshot.data();
    transaction.set(publishedRef, {
      currentReleaseId: releaseId,
      schemaVersion: release.schemaVersion,
      checksum: release.checksum,
      activationSequence,
      sourceRevision: options.sourceRevision ?? null,
      activatedAt: options.activatedAt ?? new Date().toISOString()
    });
  });

  return { releaseId, activationSequence, activated: true };
}

async function deleteRelease(db, releaseId) {
  const releaseRef = db.collection(RELEASE_COLLECTION).doc(releaseId);
  const documents = await releaseRef.collection(RELEASE_DOCUMENT_COLLECTION).get();
  await writeInBatches(db, documents.docs.map(document => batch => batch.delete(document.ref)));
  await releaseRef.delete();
}

export async function garbageCollectReleases(db, options = {}) {
  const retain = Number(options.retain ?? 10);
  const minAgeDays = Number(options.minAgeDays ?? 7);
  if (!Number.isInteger(retain) || retain < 1) throw new Error('retain은 1 이상의 정수여야 합니다.');
  if (!Number.isFinite(minAgeDays) || minAgeDays < 0) throw new Error('minAgeDays는 0 이상이어야 합니다.');

  const now = new Date(options.now ?? Date.now()).getTime();
  const minimumCreatedAt = now - (minAgeDays * 24 * 60 * 60 * 1000);
  const [publishedSnapshot, releasesSnapshot] = await Promise.all([
    db.doc(PUBLISHED_META_PATH).get(),
    db.collection(RELEASE_COLLECTION).get()
  ]);
  const activeReleaseId = publishedSnapshot.exists
    ? publishedSnapshot.data().currentReleaseId ?? null
    : null;
  const releases = releasesSnapshot.docs
    .map(snapshot => ({ id: snapshot.id, ...snapshot.data() }))
    .sort((left, right) => String(right.createdAt ?? '').localeCompare(String(left.createdAt ?? '')));
  const protectedRecentIds = new Set(
    releases.filter(release => release.id !== activeReleaseId).slice(0, retain).map(release => release.id)
  );
  const candidates = releases.filter(release => {
    if (release.id === activeReleaseId || protectedRecentIds.has(release.id)) return false;
    const createdAt = Date.parse(String(release.createdAt ?? ''));
    return !Number.isFinite(createdAt) || createdAt <= minimumCreatedAt;
  });

  if (options.apply === true) {
    for (const release of candidates) await deleteRelease(db, release.id);
  }

  return {
    activeReleaseId,
    releaseCount: releases.length,
    retain,
    minAgeDays,
    applied: options.apply === true,
    candidates: candidates.map(release => release.id)
  };
}

export async function getCurrentReleaseId(db) {
  const snapshot = await db.doc(PUBLISHED_META_PATH).get();
  if (!snapshot.exists || !snapshot.data().currentReleaseId) {
    throw new Error('활성화된 Firestore 릴리스가 없습니다.');
  }
  if (snapshot.data().schemaVersion !== FIRESTORE_SCHEMA_VERSION) {
    throw new Error(`활성 릴리스 스키마를 지원하지 않습니다: ${snapshot.data().schemaVersion}`);
  }
  return snapshot.data().currentReleaseId;
}

export async function exportRelease(db, outputDirectory, releaseId = null) {
  const resolvedReleaseId = releaseId ?? await getCurrentReleaseId(db);
  const bundle = await readRelease(db, resolvedReleaseId);
  const restored = restoreDatasets(bundle);
  await writeDatasets(outputDirectory, restored);
  return releaseSummary(bundle);
}

async function runCommand() {
  const command = process.argv[2] ?? 'help';
  const sourceDirectory = path.resolve(getArgument('--source', 'data'));

  if (command === 'validate') {
    const source = await readDatasets(sourceDirectory);
    const bundle = createReleaseBundle(source);
    restoreDatasets(bundle);
    console.log(JSON.stringify(releaseSummary(bundle), null, 2));
    return;
  }

  if (command === 'help' || hasFlag('--help')) {
    console.log([
      '사용법:',
      '  node tools/firebase-data.mjs validate --source data',
      '  node tools/firebase-data.mjs import --source data [--project ID] [--activate]',
      '  node tools/firebase-data.mjs activate --release ID [--project ID]',
      '  node tools/firebase-data.mjs export --out DIR [--project ID] [--release ID]',
      '  node tools/firebase-data.mjs gc [--retain 10] [--min-age-days 7] [--apply]',
      '',
      '에뮬레이터는 FIRESTORE_EMULATOR_HOST가 설정되면 자동으로 사용합니다.'
    ].join('\n'));
    return;
  }

  const projectId = getArgument('--project');
  const context = initializeFirestore({ projectId });
  try {
    if (command === 'import') {
      const source = await readDatasets(sourceDirectory);
      const bundle = createReleaseBundle(source);
      if (hasFlag('--dry-run')) {
        console.log(JSON.stringify(releaseSummary(bundle), null, 2));
        return;
      }
      const result = await uploadRelease(context.db, bundle, {
        activate: hasFlag('--activate'),
        activationSequence: Number(getArgument('--activation-sequence')
          ?? process.env.RELEASE_ACTIVATION_SEQUENCE
          ?? 0),
        sourceRevision: getArgument('--source-revision')
          ?? process.env.GITHUB_SHA
          ?? null
      });
      console.log(JSON.stringify({ projectId: context.projectId, emulator: context.emulator, ...result }, null, 2));
      return;
    }

    if (command === 'activate') {
      const releaseId = getArgument('--release');
      if (!releaseId) throw new Error('activate에는 --release ID가 필요합니다.');
      const result = await activateRelease(context.db, releaseId, {
        activationSequence: Number(getArgument('--activation-sequence')
          ?? process.env.RELEASE_ACTIVATION_SEQUENCE
          ?? 0),
        sourceRevision: getArgument('--source-revision')
          ?? process.env.GITHUB_SHA
          ?? null
      });
      console.log(JSON.stringify({ projectId: context.projectId, emulator: context.emulator, ...result }, null, 2));
      return;
    }

    if (command === 'export') {
      const outputDirectory = path.resolve(getArgument('--out', '.generated/data'));
      const releaseId = getArgument('--release');
      const result = await exportRelease(context.db, outputDirectory, releaseId);
      console.log(JSON.stringify({ projectId: context.projectId, emulator: context.emulator, ...result }, null, 2));
      return;
    }

    if (command === 'gc') {
      const result = await garbageCollectReleases(context.db, {
        retain: Number(getArgument('--retain', '10')),
        minAgeDays: Number(getArgument('--min-age-days', '7')),
        apply: hasFlag('--apply')
      });
      console.log(JSON.stringify({ projectId: context.projectId, emulator: context.emulator, ...result }, null, 2));
      return;
    }

    throw new Error(`지원하지 않는 명령입니다: ${command}`);
  } finally {
    await deleteApp(context.app);
  }
}

const isMain = process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url;
if (isMain) {
  runCommand().catch(error => {
    console.error(error.stack || error.message || error);
    process.exitCode = 1;
  });
}
