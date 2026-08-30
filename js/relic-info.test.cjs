const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.resolve(__dirname, '..');

test('유물 목록은 아이콘과 이름만 노출하고 상세 정보는 dialog에 표시한다', () => {
    const html = fs.readFileSync(path.join(root, 'relic_info.html'), 'utf8');
    const source = fs.readFileSync(path.join(root, 'js/relic-info.js'), 'utf8');
    assert.doesNotMatch(source, /catalog-relic-source/);
    assert.doesNotMatch(source, /catalog-relic-story/);
    assert.match(source, /data-open-relic/);
    assert.match(source, /showModal\(\)/);
    assert.match(html, /<dialog id="relic-detail-dialog"/);
    assert.match(html, /id="relic-dialog-effect"/);
});

test('선택한 일반·황금·저주 변형은 배경 채움 없이 테두리와 글자색만 바꿘다', () => {
    const css = fs.readFileSync(path.join(root, 'css/pages/relic-info.css'), 'utf8');
    assert.match(css, /button\[aria-pressed="true"\][^{]*\{[^}]*background:\s*transparent/);
    assert.match(css, /data-tier="gold"/);
    assert.match(css, /data-tier="cursed"/);
});

test('계산된 유물 수치는 본문과 같은 색과 굵기로 표시한다', () => {
    const css = fs.readFileSync(path.join(root, 'css/pages/relic-info.css'), 'utf8');
    assert.match(css, /\.catalog-relic-effect \.dynamic-value\s*\{[^}]*color:\s*inherit[^}]*font-weight:\s*inherit/);
});

test('유물은 편과 분류 필터를 조합해 볼 수 있다', () => {
    const html = fs.readFileSync(path.join(root, 'relic_info.html'), 'utf8');
    const source = fs.readFileSync(path.join(root, 'js/relic-info.js'), 'utf8');
    assert.match(html, /id="relic-tier-filter"[^>]*aria-label="유물 분류"/);
    assert.match(source, /selectedTier === 'all' \|\| filterTier\(variant\) === selectedTier/);
    assert.match(source, /data-tier-filter/);
    assert.match(source, /\['other', '기타'\]/);
    assert.match(source, /\['special', 'base', 'upgraded', 'pendulum', 'sinful'\]/);
    assert.doesNotMatch(source, /전용 유형/);
});

test('금기 학식 등급 입력은 간결하게 표시하고 연구 깊이 요약은 노출하지 않는다', () => {
    const html = fs.readFileSync(path.join(root, 'relic_info.html'), 'utf8');
    const css = fs.readFileSync(path.join(root, 'css/pages/relic-info.css'), 'utf8');
    assert.doesNotMatch(html, /relic-depth-summary/);
    assert.match(css, /\.research-level-control\s*\{\s*width:\s*min\(100%,\s*9rem\)/);
});

test('유물 검색·계산과 수록 편·분류 필터는 반응형 그룹으로 구분한다', () => {
    const html = fs.readFileSync(path.join(root, 'relic_info.html'), 'utf8');
    const css = fs.readFileSync(path.join(root, 'css/pages/relic-info.css'), 'utf8');
    assert.match(html, /class="relic-toolbar-controls"/);
    assert.match(html, /class="relic-toolbar-filters"/);
    assert.match(html, /class="relic-filter-label">수록 편/);
    assert.match(css, /@media \(max-width: 720px\)[\s\S]*?grid-template-columns:\s*repeat\(3, minmax\(0, 1fr\)\)/);
});

test('전투 중 가변 수치는 기본값과 변동 원인을 함께 표시한다', () => {
    const source = fs.readFileSync(path.join(root, 'js/relic-info.js'), 'utf8');
    assert.doesNotMatch(source, /전투 상황에 따라 결정되는 수치/);
    assert.match(source, /전투 중 중독 증가 효과에 따라 함께 증가합니다/);
    assert.match(source, /팀 피해 증폭 0%, 이번 전투 은열쇠 사용 0회 기준/);
    assert.match(source, /GetStagePower/);
});
