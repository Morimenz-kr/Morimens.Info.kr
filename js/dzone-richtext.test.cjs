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
test('generated state references render verified original and state-card icons inline', () => {
    const original = render(`<game-text:<${key}:임시 봉인>>`, {
        [key]: { icon: 'images/keyword-icons/original/icons_buff_073.png' }
    });
    const stateCard = render(`<game-text:<${key}:상처>>`, {
        [key]: { icon: 'images/dzone/cards/portrait_card_state_skull.png' }
    });
    assert.match(original, /class="tooltip-trigger keyword-iconized"/);
    assert.match(original, /src="images\/keyword-icons\/original\/icons_buff_073\.png"/);
    assert.match(stateCard, /src="images\/dzone\/cards\/portrait_card_state_skull\.png"/);
});
test('missing reference is an error, never a fallback to a same-named keyword', () => {
    assert.throws(() => render(`<game-text:<${key}:죽음 저항>>`, {}), /Missing generated tooltip/);
});

test('원본 피해·실드·광기 색상을 유지하고 중첩 키워드도 안전하게 렌더링한다', () => {
    const output = render(`<game-text:<fmt_bb646d:123> 피해, <fmt_76aac8:456> 실드, <fmt_b6ad65:20> 광기. <fmt_bb646d:<${key}:상처>>>`, { [key]: { name: '상처' } });
    assert.match(output, /data-game-color="#bb646d" style="color:#bb646d">123/);
    assert.match(output, /data-game-color="#76aac8" style="color:#76aac8">456/);
    assert.match(output, /data-game-color="#b6ad65" style="color:#b6ad65">20/);
    assert.equal((output.match(/tooltip-trigger/g) || []).length, 1);
    assert.doesNotMatch(output, /&lt;fmt_/);
    const unsafe = render('<game-text:<fmt_bb646d:<img src=x onerror=alert(1)>>>', {});
    assert.doesNotMatch(unsafe, /<img/);
    assert.match(unsafe, /&lt;img/);
});
