const test = require('node:test');
const assert = require('node:assert/strict');
const { render } = require('./dzone-richtext.js');
const key = 'kw_0123456789abcdef';
test('only explicit state references get tooltips, ordinary 보유/소모 stay plain', () => {
    const output = render(`<game-text:방어막 보유 시 HP를 소모하고 <${key}:서리 방패>를 획득합니다.>`, { [key]: { name: '서리 방패' } });
    assert.equal((output.match(/tooltip-trigger/g) || []).length, 1);
    assert.match(output, /방어막 보유 시 HP를 소모/);
    assert.match(output, /tabindex="0"/);
});
test('generated rendering escapes labels and restricts image paths', () => {
    const output = render(`<game-text:<${key}:A & B> <script>alert(1)</script>>`, { [key]: { icon: 'javascript:alert(1)', color: 'red;display:none' } });
    assert.match(output, /A &amp; B/);
    assert.match(output, /&lt;script&gt;/);
    assert.doesNotMatch(output, /<img|style=/);
});
test('missing reference is an error, never a fallback to a same-named keyword', () => {
    assert.throws(() => render(`<game-text:<${key}:죽음 저항>>`, {}), /Missing generated tooltip/);
});
