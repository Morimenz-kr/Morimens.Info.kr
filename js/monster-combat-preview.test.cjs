const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'monster_combat_preview.html'), 'utf8');
const script = fs.readFileSync(path.join(__dirname, 'monster-combat-preview.js'), 'utf8');
const css = fs.readFileSync(path.join(root, 'css', 'pages', 'monster-combat-preview.css'), 'utf8');
const data = JSON.parse(fs.readFileSync(path.join(root, 'data', 'monster_combat_148007_preview.json'), 'utf8'));

test('공용 변환 결과를 사이트에서 직접 열 수 있다', () => {
  assert.match(html, /monster-preview-content/);
  assert.match(html, /monster-combat-preview\.css/);
  assert.match(html, /monster-combat-preview\.js/);
  assert.match(script, /monster_combat_148007_preview\.json/);
});

test('대표 화면은 자동 변환기의 실제 결과와 조건부 교체를 표시한다', () => {
  assert.equal(data.monsterId, 148007);
  assert.equal(data.name, '「혼을 거두는 자」');
  assert.deepEqual(data.hpPhases.map(item => item.maxHp), [18185348, 27278022]);
  assert.equal(data.effectiveHp, 45463370);
  assert.equal(data.states['148395'].name, '영혼을 거두리-피에 굶주린 철구');
  assert.equal(data.conditionalActions[0].skillId, 148364);
  assert.ok(data.conditionalStates.some(item => item.appliedStateId === 148395));
});

test('미리보기는 작은 화면에서 한 열로 흐르고 넓은 화면에서만 확장한다', () => {
  assert.match(css, /grid-template-columns:\s*repeat\(2, minmax\(0, 1fr\)\)/);
  assert.match(css, /@media \(min-width: 48rem\)/);
  assert.doesNotMatch(css, /white-space:\s*nowrap/);
  assert.match(css, /overflow-wrap:\s*anywhere/);
});
