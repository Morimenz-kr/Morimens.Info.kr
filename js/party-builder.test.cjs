const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.join(__dirname, '..');
const rules = JSON.parse(fs.readFileSync(path.join(root, 'data', 'party_builder_rules.json'), 'utf8'));
const source = fs.readFileSync(path.join(__dirname, 'party_builder.js'), 'utf8');

test('원본·회귀 라모나는 같은 편성에서 함께 사용할 수 없다', () => {
    assert.ok(rules.exclusive_groups.some(group => (
        group.includes('ramona') && group.includes('ramona_timeworn')
    )));
});

test('원본·침식 로탄은 같은 편성에서 함께 사용할 수 있다', () => {
    assert.equal(rules.exclusive_groups.some(group => (
        group.includes('lotan') && group.includes('lotan_cetarchon')
    )), false);
    assert.doesNotMatch(source, /\["lotan",\s*"lotan_cetarchon"\]/);
});
