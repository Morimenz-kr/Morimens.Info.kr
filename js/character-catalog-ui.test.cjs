const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ui = require('./character-catalog-ui.js');
const manifest = require('../data/character_manifest.json');

test('공유 계역 목록은 모든 각성체의 안정 ID와 정보 링크를 보존한다', () => {
    const html = ui.renderGroups(manifest, character => ui.renderCharacterCard(character, {
        href: `links.html?category=character&id=${encodeURIComponent(character.id)}`
    }));
    const ids = [...html.matchAll(/data-character-id="([^"]+)"/g)].map(match => match[1]);
    assert.deepEqual(ids.sort(), manifest.map(character => character.id).sort());
    assert.equal((html.match(/class="relems-section /g) || []).length, 4);
    for (const character of manifest) assert.ok(html.includes(`id=${encodeURIComponent(character.id)}`));
    assert.doesNotMatch(html, /role="button"|check-mark|breakthrough-stepper/);
});

test('공유 카드의 보유 선택 모드는 선택 상태와 돌파 컨트롤을 보존한다', () => {
    const html = ui.renderCharacterCard({ id: 'test', name: '<테스트>', image_thumb: 'test.webp' }, {
        selected: true, extraMarkup: '<span data-breakthrough-stepper>3돌</span>'
    });
    assert.match(html, /role="button" tabindex="0" aria-pressed="true"/);
    assert.match(html, /character-inventory-card selected/);
    assert.match(html, /check-mark/);
    assert.match(html, /data-breakthrough-stepper>3돌/);
    assert.match(html, /&lt;테스트&gt;/);
});

test('정보 목록과 보유 현황은 카드·계역·필터의 같은 구현을 호출한다', () => {
    for (const file of ['index.js', 'inventory_checker.js']) {
        const source = fs.readFileSync(path.join(__dirname, file), 'utf8');
        for (const method of ['renderGroups', 'renderCharacterCard', 'renderFilterOptions', 'bindFilterGroup']) {
            assert.ok(source.includes(method), `${file}: ${method}`);
        }
    }
    const html = ui.renderFilterOptions(ui.CLASS_OPTIONS, 'data-role-filter', 'chorus');
    assert.match(html, /class="filter-pill active" data-role-filter="chorus" aria-pressed="true"/);
});
