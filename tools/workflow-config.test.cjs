const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const ROOT = path.join(__dirname, '..');
const PAGES_WORKFLOW = fs.readFileSync(
  path.join(ROOT, '.github', 'workflows', 'pages.yml'),
  'utf8'
);
const VALIDATION_WORKFLOW = fs.readFileSync(
  path.join(ROOT, '.github', 'workflows', 'data-validation.yml'),
  'utf8'
);
const FIREBASE_DATA_TOOL = fs.readFileSync(
  path.join(ROOT, 'tools', 'firebase-data.mjs'),
  'utf8'
);

test('Pages는 허용된 생성 아티팩트만 배포하고 저장소에 다시 쓰지 않는다', () => {
  assert.match(PAGES_WORKFLOW, /contents:\s*read/);
  assert.doesNotMatch(PAGES_WORKFLOW, /contents:\s*write/);
  assert.doesNotMatch(PAGES_WORKFLOW, /git\s+push|create-or-update-file|contents api/i);
  assert.match(PAGES_WORKFLOW, /path:\s*\.generated\/site/);
  assert.doesNotMatch(PAGES_WORKFLOW, /path:\s*\.\s*$/m);
});

test('Firestore 릴리스는 Pages 성공 뒤에만 활성화한다', () => {
  const importPosition = PAGES_WORKFLOW.indexOf('Upload inactive Firestore release');
  const deployPosition = PAGES_WORKFLOW.indexOf('- name: Deploy GitHub Pages');
  const activatePosition = PAGES_WORKFLOW.indexOf('- name: Activate deployed Firestore release');
  assert.ok(importPosition >= 0 && deployPosition > importPosition && activatePosition > deployPosition);
  assert.doesNotMatch(PAGES_WORKFLOW.slice(importPosition, deployPosition), /--activate(?:\s|$)/);
  assert.match(PAGES_WORKFLOW, /RELEASE_ACTIVATION_SEQUENCE:\s*\$\{\{ github\.run_id \}\}/);
});

test('수동 Firestore 실행은 운영 run ID보다 큰 순번을 자동 생성하지 않는다', () => {
  assert.doesNotMatch(FIREBASE_DATA_TOOL, /RELEASE_ACTIVATION_SEQUENCE[\s\S]{0,80}Date\.now\(\)/);
  assert.equal(
    (FIREBASE_DATA_TOOL.match(/process\.env\.RELEASE_ACTIVATION_SEQUENCE\s*\n\s*\?\? 0/g) ?? []).length,
    2
  );
});

test('Firebase 장애와 무관한 repository 롤백 경로가 유지된다', () => {
  assert.match(PAGES_WORKFLOW, /SITE_DATA_SOURCE:\s*\$\{\{ vars\.SITE_DATA_SOURCE \|\| 'repository' \}\}/);
  assert.match(PAGES_WORKFLOW, /pages:prepare -- --data-source repository/);
  assert.match(PAGES_WORKFLOW, /if: env\.SITE_DATA_SOURCE == 'repository'/);
});

test('PR 데이터 검증은 Java와 Firestore Emulator를 자동 준비한다', () => {
  assert.match(VALIDATION_WORKFLOW, /actions\/setup-java@v4/);
  assert.match(VALIDATION_WORKFLOW, /java-version:\s*'21'/);
  assert.match(VALIDATION_WORKFLOW, /npm run firebase:emulator-test/);
  assert.doesNotMatch(VALIDATION_WORKFLOW, /GCP_WORKLOAD_IDENTITY_PROVIDER|GCP_FIREBASE_SERVICE_ACCOUNT/);
});

test('Worker 변경은 PR 검증 워크플로를 반드시 실행한다', () => {
  assert.match(VALIDATION_WORKFLOW, /- 'workers\/\*\*'/);
  assert.match(VALIDATION_WORKFLOW, /- 'wrangler\.jsonc'/);
  assert.match(VALIDATION_WORKFLOW, /run:\s*npm test/);
});
