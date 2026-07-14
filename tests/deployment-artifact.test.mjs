import test from 'node:test';
import assert from 'node:assert/strict';
import { access, readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import {
    DIST,
    ROOT,
    fileSize,
    relativeTo,
    walkFiles
} from './helpers/site-fixture.mjs';

const MIB = 1024 * 1024;
const MAX_DEPLOY_BYTES = 25 * MIB;
const MAX_SINGLE_FILE_BYTES = 2 * MIB;
const PUBLIC_DIRECTORIES = ['config', 'css', 'data', 'images', 'js'];
const FORBIDDEN_EXTENSIONS = new Set(['.zip', '.psd', '.ai', '.map']);
const CANONICAL_DATA_SOURCES = new Set([
    'data/character_effects.json',
    'data/resource_links.json'
]);

test('build publishes every root route and the GitHub Pages marker', async () => {
    await assert.doesNotReject(access(DIST), 'dist is missing; run npm run build before npm test');
    const sourceRoutes = (await readdir(ROOT, { withFileTypes: true }))
        .filter(entry => entry.isFile() && entry.name.endsWith('.html'))
        .map(entry => entry.name)
        .sort();
    const deployedRoutes = (await readdir(DIST, { withFileTypes: true }))
        .filter(entry => entry.isFile() && entry.name.endsWith('.html'))
        .map(entry => entry.name)
        .sort();

    assert.deepEqual(deployedRoutes, sourceRoutes, 'dist route set differs from source route set');
    assert.ok(sourceRoutes.includes('index.html'), 'index.html must be a public route');
    assert.equal(await readFile(path.join(DIST, '.nojekyll'), 'utf8'), '', '.nojekyll must be empty');

    for (const route of sourceRoutes) {
        const [source, deployed] = await Promise.all([
            readFile(path.join(ROOT, route)),
            readFile(path.join(DIST, route))
        ]);
        assert.deepEqual(deployed, source, `${route} changed during the copy-only build`);
    }
});

test('build contains all deployable source files without stale extras', async () => {
    const expected = new Set(['.nojekyll']);
    const rootRoutes = (await readdir(ROOT, { withFileTypes: true }))
        .filter(entry => entry.isFile() && entry.name.endsWith('.html'))
        .map(entry => entry.name);
    rootRoutes.forEach(route => expected.add(route));

    for (const directory of PUBLIC_DIRECTORIES) {
        for (const file of await walkFiles(path.join(ROOT, directory))) {
            const relative = relativeTo(ROOT, file);
            if (CANONICAL_DATA_SOURCES.has(relative)) continue;
            const name = path.basename(file);
            const extension = path.extname(name).toLowerCase();
            if (new Set(['Thumbs.db', '.DS_Store']).has(name)) continue;
            if (new Set(['.zip', '.psd', '.ai']).has(extension)) continue;
            if (extension === '.png' && name !== 'background.png') {
                const webp = file.replace(/\.png$/i, '.webp');
                try {
                    await access(webp);
                    continue;
                } catch {
                    // A PNG without a WebP peer is intentionally caught by the artifact policy test below.
                }
            }
            expected.add(relative);
        }
    }

    const actual = new Set((await walkFiles(DIST)).map(file => relativeTo(DIST, file)));
    assert.deepEqual([...actual].sort(), [...expected].sort(), 'dist has missing or stale files');
});

test('build deploys route shards and keeps canonical editing data private', async () => {
    const index = JSON.parse(await readFile(path.join(ROOT, 'data', 'runtime-index.json'), 'utf8'));
    const shardRoutes = [
        ...Object.values(index.resourceLinks?.categories || {}),
        ...Object.values(index.resourceLinks?.characters || {}),
        ...Object.values(index.characterEffects || {})
    ];

    assert.equal(index.schemaVersion, 1, 'runtime index schema version changed unexpectedly');
    assert.equal(new Set(shardRoutes).size, shardRoutes.length, 'runtime index contains duplicate shard routes');
    assert.ok(shardRoutes.length > 0, 'runtime index must expose route shards');
    await assert.doesNotReject(access(path.join(DIST, 'data', 'runtime-index.json')));

    for (const relative of CANONICAL_DATA_SOURCES) {
        await assert.doesNotReject(access(path.join(ROOT, ...relative.split('/'))), `${relative} must remain canonical source data`);
        await assert.rejects(
            access(path.join(DIST, ...relative.split('/'))),
            error => error?.code === 'ENOENT',
            `${relative} must not be deployed`
        );
    }

    for (const route of shardRoutes) {
        assert.match(
            route,
            /^data\/(?:resource-links\/(?:categories|characters)|character-effects)\/[A-Za-z0-9_-]+\.json$/,
            `unsafe runtime shard route: ${route}`
        );
        const [source, deployed] = await Promise.all([
            readFile(path.join(ROOT, ...route.split('/'))),
            readFile(path.join(DIST, ...route.split('/')))
        ]);
        assert.deepEqual(deployed, source, `${route} differs in dist`);
    }
});

test('deployment artifact stays web-optimized and free of editor files', async () => {
    const files = await walkFiles(DIST);
    let totalBytes = 0;
    const pngFiles = [];
    const jpegFiles = [];

    for (const file of files) {
        const relative = relativeTo(DIST, file);
        const extension = path.extname(relative).toLowerCase();
        const bytes = await fileSize(file);
        totalBytes += bytes;

        assert.ok(!FORBIDDEN_EXTENSIONS.has(extension), `forbidden deploy extension: ${relative}`);
        assert.ok(!new Set(['Thumbs.db', '.DS_Store']).has(path.basename(file)), `editor metadata leaked into dist: ${relative}`);
        if (relative !== '.nojekyll') assert.ok(bytes > 0, `${relative} is empty`);
        assert.ok(bytes <= MAX_SINGLE_FILE_BYTES, `${relative} exceeds the 2 MiB per-file budget (${bytes} bytes)`);
        if (extension === '.png') pngFiles.push(relative);
        if (new Set(['.jpg', '.jpeg']).has(extension)) jpegFiles.push(relative);
    }

    assert.deepEqual(pngFiles.sort(), ['images/background.png'], 'only the social-preview background may remain PNG');
    assert.deepEqual(jpegFiles, [], 'deployable raster images must use WebP instead of JPEG');
    assert.ok(totalBytes <= MAX_DEPLOY_BYTES, `dist exceeds the 25 MiB budget (${totalBytes} bytes)`);
});

test('deployed code, styles, and data are byte-identical to their sources', async () => {
    for (const directory of ['config', 'css', 'data', 'js']) {
        for (const sourceFile of await walkFiles(path.join(ROOT, directory))) {
            const relative = relativeTo(ROOT, sourceFile);
            if (CANONICAL_DATA_SOURCES.has(relative)) continue;
            const deployedFile = path.join(DIST, relative);
            const [source, deployed] = await Promise.all([readFile(sourceFile), readFile(deployedFile)]);
            assert.deepEqual(deployed, source, `${relative} differs in dist`);
        }
    }
});

test('repository tooling stays dependency-free and CI runs the same quality gate', async () => {
    const packageJson = JSON.parse(await readFile(path.join(ROOT, 'package.json'), 'utf8'));
    const [workflow, qualityGate] = await Promise.all([
        readFile(path.join(ROOT, '.github', 'workflows', 'pages.yml'), 'utf8'),
        readFile(path.join(ROOT, 'tests', 'run-quality-gate.mjs'), 'utf8')
    ]);

    assert.equal(packageJson.private, true, 'the repository package must remain private');
    assert.deepEqual(packageJson.dependencies || {}, {}, 'runtime npm dependencies are not allowed');
    assert.deepEqual(packageJson.devDependencies || {}, {}, 'development npm dependencies are not allowed');
    assert.equal(packageJson.engines?.node, '>=24', 'local and CI Node.js baselines must stay aligned');
    assert.equal(packageJson.scripts?.['generate:data-shards'], 'node tools/generate-data-shards.mjs');
    assert.equal(packageJson.scripts?.['check:data-shards'], 'node tools/generate-data-shards.mjs --check');
    assert.equal(packageJson.scripts?.check, 'node tests/run-quality-gate.mjs');
    const shardCheckPosition = qualityGate.indexOf("['tools/generate-data-shards.mjs', '--check']");
    const buildPosition = qualityGate.indexOf("['tools/build-site.mjs']");
    assert.ok(shardCheckPosition >= 0, 'quality gate must verify committed runtime shards');
    assert.ok(buildPosition > shardCheckPosition, 'runtime shard verification must run before the deployment build');
    assert.match(workflow, /^\s*pull_request:/m, 'the quality gate must run on pull requests');
    assert.match(workflow, /run:\s*node tests\/run-quality-gate\.mjs/, 'CI must use the shared quality-gate entry point');
    assert.match(workflow, /needs:\s*quality/, 'deployment must depend on the quality job');
    assert.match(workflow, /pages:\s*write/, 'the deployment job needs Pages write permission');
    assert.match(workflow, /id-token:\s*write/, 'the deployment job needs OIDC permission');
    assert.match(workflow, /path:\s*dist\s*$/m, 'CI must upload only dist');
    assert.match(workflow, /node-version:\s*24/, 'CI must run on the current LTS Node.js line');
    assert.match(workflow, /persist-credentials:\s*false/, 'checkout credentials must not persist after source retrieval');
    assert.match(workflow, /include-hidden-files:\s*true/, 'the Pages artifact must preserve .nojekyll');
    assert.doesNotMatch(workflow, /path:\s*\.\s*$/m, 'CI must never upload the repository root');

    const actionReferences = [...workflow.matchAll(/uses:\s*([^@\s]+)@([^\s#]+)/g)];
    assert.ok(actionReferences.length > 0, 'CI must declare its action references');
    for (const [, action, reference] of actionReferences) {
        assert.match(reference, /^[0-9a-f]{40}$/, `${action} must be pinned to a full commit SHA`);
    }
});

test('canonical data writers also maintain committed runtime shards', async () => {
    const [resourceRepository, effectUpdater, shardGenerator] = await Promise.all([
        readFile(path.join(ROOT, 'workers', 'lib', 'resource-repository.js'), 'utf8'),
        readFile(path.join(ROOT, 'tools', 'update-character-effects.mjs'), 'utf8'),
        readFile(path.join(ROOT, 'tools', 'generate-data-shards.mjs'), 'utf8')
    ]);

    assert.match(resourceRepository, /buildResourceLinkShardUpdates/);
    assert.match(resourceRepository, /commitGitHubFilesAtomically/);
    assert.ok(
        resourceRepository.indexOf('commitFiles(')
            < resourceRepository.indexOf('findOpenPullRequest()'),
        'the atomic source-and-shard commit must finish before PR lookup or creation'
    );
    assert.match(effectUpdater, /getCharacterEffectShardPath/);
    assert.match(effectUpdater, /serializeDeterministicJson/);
    assert.match(shardGenerator, /runtime-data-shards\.js/);
});
