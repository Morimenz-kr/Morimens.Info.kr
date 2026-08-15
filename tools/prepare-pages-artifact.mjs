import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { createReleaseBundle, readDatasets, releaseSummary } from './firebase-data-core.mjs';

const ROOT_FILES = Object.freeze([
  '.nojekyll',
  'covenant_simulator.html',
  'detail.html',
  'index.html',
  'inventory_checker.html',
  'links.html',
  'list.html',
  'party_builder.html',
  'payment_efficiency.html',
  'rerun_schedule.html'
]);
const SITE_DIRECTORIES = Object.freeze(['config', 'css', 'data', 'images', 'js']);

function getArgument(name, fallback = null) {
  const index = process.argv.indexOf(name);
  if (index === -1) return fallback;
  const value = process.argv[index + 1];
  if (!value || value.startsWith('--')) throw new Error(`${name} 값이 필요합니다.`);
  return value;
}

function assertGeneratedPath(rootDirectory, targetDirectory) {
  const generatedRoot = path.resolve(rootDirectory, '.generated');
  const resolvedTarget = path.resolve(targetDirectory);
  const relative = path.relative(generatedRoot, resolvedTarget);
  if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error(`Pages 출력 경로는 .generated 내부여야 합니다: ${resolvedTarget}`);
  }
}

async function pathExists(filePath) {
  return fs.access(filePath).then(() => true, () => false);
}

export async function preparePagesArtifact(options = {}) {
  const rootDirectory = path.resolve(options.rootDirectory ?? path.join(import.meta.dirname, '..'));
  const outputDirectory = path.resolve(options.outputDirectory ?? path.join(rootDirectory, '.generated/site'));
  const dataSource = options.dataSource ?? process.env.SITE_DATA_SOURCE ?? 'repository';
  if (!['repository', 'firestore'].includes(dataSource)) {
    throw new Error(`지원하지 않는 SITE_DATA_SOURCE입니다: ${dataSource}`);
  }
  assertGeneratedPath(rootDirectory, outputDirectory);

  const tempDirectory = path.join(
    path.dirname(outputDirectory),
    `.site-build-${process.pid}-${Date.now()}`
  );
  await fs.rm(tempDirectory, { recursive: true, force: true });
  await fs.mkdir(tempDirectory, { recursive: true });

  try {
    for (const fileName of ROOT_FILES) {
      const source = path.join(rootDirectory, fileName);
      if (await pathExists(source)) await fs.copyFile(source, path.join(tempDirectory, fileName));
    }
    for (const directory of SITE_DIRECTORIES) {
      await fs.cp(
        path.join(rootDirectory, directory),
        path.join(tempDirectory, directory),
        { recursive: true }
      );
    }

    let summary;
    if (dataSource === 'firestore') {
      const firestore = await import('./firebase-data.mjs');
      const context = firestore.initializeFirestore({ projectId: options.projectId });
      try {
        summary = await firestore.exportRelease(
          context.db,
          path.join(tempDirectory, 'data'),
          options.releaseId ?? null
        );
      } finally {
        const { deleteApp } = await import('firebase-admin/app');
        await deleteApp(context.app);
      }
    } else {
      const source = await readDatasets(path.join(rootDirectory, 'data'));
      summary = releaseSummary(createReleaseBundle(source));
    }

    const outputData = await readDatasets(path.join(tempDirectory, 'data'));
    const outputBundle = createReleaseBundle(outputData);
    if (outputBundle.checksum !== summary.checksum) {
      throw new Error('Pages 아티팩트 데이터 체크섬이 선택한 릴리스와 일치하지 않습니다.');
    }

    await fs.writeFile(path.join(tempDirectory, '.data-release.json'), `${JSON.stringify({
      dataSource,
      releaseId: outputBundle.releaseId,
      schemaVersion: outputBundle.schemaVersion,
      checksum: outputBundle.checksum,
      generatedAt: new Date().toISOString()
    }, null, 2)}\n`, 'utf8');

    await fs.rm(outputDirectory, { recursive: true, force: true });
    await fs.rename(tempDirectory, outputDirectory);
    return { dataSource, outputDirectory, ...releaseSummary(outputBundle) };
  } catch (error) {
    await fs.rm(tempDirectory, { recursive: true, force: true });
    throw error;
  }
}

async function runCommand() {
  const rootDirectory = path.resolve(getArgument('--root', path.join(import.meta.dirname, '..')));
  const outputDirectory = path.resolve(getArgument('--out', path.join(rootDirectory, '.generated/site')));
  const dataSource = getArgument('--data-source', process.env.SITE_DATA_SOURCE ?? 'repository');
  const projectId = getArgument('--project', process.env.FIREBASE_PROJECT_ID ?? null);
  const releaseId = getArgument('--release');
  const result = await preparePagesArtifact({
    rootDirectory,
    outputDirectory,
    dataSource,
    projectId,
    releaseId
  });
  console.log(JSON.stringify(result, null, 2));
}

const isMain = process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url;
if (isMain) {
  runCommand().catch(error => {
    console.error(error.stack || error.message || error);
    process.exitCode = 1;
  });
}
