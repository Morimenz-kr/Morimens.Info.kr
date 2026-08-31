const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const test = require('node:test');

const ROOT = path.join(__dirname, '..');
const OUTPUT = path.join(ROOT, '.generated', 'artifact-test');

test('repository 모드는 현재 사이트와 운영 데이터를 안전한 Pages 아티팩트로 만든다', async () => {
  const { preparePagesArtifact } = await import('./prepare-pages-artifact.mjs');
  const core = await import('./firebase-data-core.mjs');
  await fs.rm(OUTPUT, { recursive: true, force: true });

  try {
    const result = await preparePagesArtifact({
      rootDirectory: ROOT,
      outputDirectory: OUTPUT,
      dataSource: 'repository'
    });
    assert.equal(result.dataSource, 'repository');

    const [source, output] = await Promise.all([
      core.readDatasets(path.join(ROOT, 'data')),
      core.readDatasets(path.join(OUTPUT, 'data'))
    ]);
    for (const fileName of core.OPERATING_DATASETS) {
      assert.deepEqual(output[fileName], source[fileName], fileName);
    }

    assert.equal(await fs.stat(path.join(OUTPUT, 'index.html')).then(() => true), true);
    assert.equal(await fs.stat(path.join(OUTPUT, 'links.html')).then(() => true), true);
    assert.equal(await fs.stat(path.join(OUTPUT, '.data-release.json')).then(() => true), true);
    assert.equal(await fs.access(path.join(OUTPUT, 'node_modules')).then(() => true, () => false), false);
    assert.equal(await fs.access(path.join(OUTPUT, '.idea')).then(() => true, () => false), false);
    assert.equal(await fs.access(path.join(OUTPUT, 'tools')).then(() => true, () => false), false);
    assert.equal(await fs.access(path.join(OUTPUT, 'js', 'links-dialog.test.cjs')).then(() => true, () => false), false);
  } finally {
    await fs.rm(OUTPUT, { recursive: true, force: true });
  }
});

test('Pages 아티팩트는 .generated 밖에 쓸 수 없다', async () => {
  const { preparePagesArtifact } = await import('./prepare-pages-artifact.mjs');
  await assert.rejects(
    preparePagesArtifact({
      rootDirectory: ROOT,
      outputDirectory: path.join(ROOT, 'unsafe-output'),
      dataSource: 'repository'
    }),
    /.generated 내부/
  );
});


test('분리된 배포 검증은 진단 오류와 끊어진 툴팁 참조를 차단한다', async () => {
  const { validateDzoneContent } = await import('./validate-dzone-content.mjs');
  assert.throws(() => validateDzoneContent({ contentAudit: { diagnostics: [{ kind: 'unknown-tag' }] } }), /diagnostics/);
  assert.throws(() => validateDzoneContent({ contentAudit: { diagnostics: [] }, waves: ['<kw_0123456789abcdef:효과>'] }), /Missing D-Zone reference/);
  for (const name of ['dzone_current.json', 'dzone_season67.json']) {
    validateDzoneContent(JSON.parse(await fs.readFile(path.join(ROOT, 'data', name), 'utf8')));
  }
});
