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
    const current = JSON.parse(await fs.readFile(path.join(ROOT, 'data/dzone_current.json'), 'utf8')).period;
    const deployedDataFiles = await fs.readdir(path.join(OUTPUT, 'data'));
    assert.equal(deployedDataFiles.some(name => {
      const match = name.match(/^dzone_(?:maps_)?season(\d+)\.json$/);
      return match && Number(match[1]) > current;
    }), false, '차기 기수의 몬스터·지도 원본은 공개하지 않는다');
    const seasonCatalog = JSON.parse(await fs.readFile(path.join(OUTPUT, 'data/dzone_season_catalog.json'), 'utf8'));
    assert.ok(seasonCatalog.seasons.every(season => season.period <= current));
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
  const iconFixture = { contentAudit: { diagnostics: [], presentationAudit: { issues: [], expectedKeywordIcons: { kw_0123456789abcdef: 'images/keyword-icons/inline/battle_card_buff_021.png' } } }, waves: [], keywordGlossary: { kw_0123456789abcdef: { name: '힘', description: '피해 증가.', source: { type: 'State', id: 2900 } } } };
  assert.throws(() => validateDzoneContent(iconFixture), /Invalid D-Zone keyword icon/);
  iconFixture.keywordGlossary.kw_0123456789abcdef.icon = 'images/keyword-icons/inline/battle_card_buff_021.png';
  assert.doesNotThrow(() => validateDzoneContent(iconFixture));
  for (const name of ['dzone_current.json', 'dzone_season67.json']) {
    validateDzoneContent(JSON.parse(await fs.readFile(path.join(ROOT, 'data', name), 'utf8')));
  }
});

test('현재 시즌이 정상이어도 73기 미리보기 아이콘이 누락되면 배포를 차단한다', async t => {
  const { validateDzoneSnapshots } = await import('./prepare-pages-artifact.mjs');
  const directory = await fs.mkdtemp(path.join(ROOT, '.generated', 'season-validation-'));
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  await fs.writeFile(path.join(directory, 'dzone_current.json'), JSON.stringify({ period: 72 }));
  const preview = { period: 73, contentAudit: { diagnostics: [], presentationAudit: { issues: [], expectedKeywordIcons: { kw_0123456789abcdef: 'images/keyword-icons/inline/battle_card_buff_021.png' } } }, waves: [], keywordGlossary: { kw_0123456789abcdef: { name: '힘', description: '피해 증가.', source: { type: 'State', id: 2900 } } } };
  const file = path.join(directory, 'dzone_season73.json');
  await fs.writeFile(file, JSON.stringify(preview));
  await assert.rejects(validateDzoneSnapshots(directory), /dzone_season73.json: Invalid D-Zone keyword icon/);
  preview.keywordGlossary.kw_0123456789abcdef.icon = 'images/keyword-icons/inline/battle_card_buff_021.png';
  await fs.writeFile(file, JSON.stringify(preview));
  assert.deepEqual(await validateDzoneSnapshots(directory), ['dzone_current.json', 'dzone_season73.json']);
});
