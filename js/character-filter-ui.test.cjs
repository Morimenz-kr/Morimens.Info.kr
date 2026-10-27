const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ui = require('./character-filter-ui.js');

test('공유 필터는 버튼과 접근성 선택 상태를 제공하고 상시·한정을 구분한다', () => {
    const html = ui.renderFilterOptions([['all', '전체 등급'], ['상시 SSR', '상시 SSR'], ['한정 SSR', '한정 SSR']], 'data-grade-filter', '한정 SSR');
    assert.equal((html.match(/aria-pressed="true"/g) || []).length, 1);
    assert.match(html, /data-grade-filter="상시 SSR" aria-pressed="false"/);
    assert.match(html, /data-grade-filter="한정 SSR" aria-pressed="true"/);
    assert.equal((html.match(/type="button"/g) || []).length, 3);
    assert.match(ui.renderFilterOptions([['all', '<전체>']], 'data-filter'), /&lt;전체&gt;/);
});

test('두 페이지는 필터만 공통화하고 원래 카드 렌더러를 유지한다', () => {
    for (const file of ['index.js', 'inventory_checker.js']) {
        const source = fs.readFileSync(path.join(__dirname, file), 'utf8');
        assert.match(source, /CharacterFilterUI/);
        assert.match(source, /renderFilterOptions/);
        assert.match(source, /bindFilterGroup/);
        assert.doesNotMatch(source, /CharacterCatalogUI/);
    }
    const catalog = fs.readFileSync(path.join(__dirname, 'index.js'), 'utf8');
    assert.match(catalog, /class="card-link"/);
    assert.match(catalog, /class="character-card /);
    assert.match(catalog, /상시 SSR/);
    assert.match(catalog, /한정 SSR/);
});
