const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const data = JSON.parse(fs.readFileSync(path.join(__dirname, '../data/character_effects.json'), 'utf8'));
const window = {};
new Function('window', fs.readFileSync(path.join(__dirname, 'character-effects.js'), 'utf8'))(window);
const api = window.CharacterEffects;
const root = (id, sourceId) => data[id].skills.find(row => row.sourceId === sourceId);
const over = id => data[id].enlighten.find(row => row.type === '초월 폭발');
const display = (row, stage = 0, level = 6) => {
    const variant = api.getBreakthroughVariant(row, stage);
    return api.interpolateEffect(variant.effect, variant.levels, level);
};

test('전체 각성체의 기본·변환 스킬은 안정 ID를 가지며 초한 원본과 연결된다', () => {
    assert.equal(Object.keys(data).length, 62);
    let count = 0;
    for (const [id, character] of Object.entries(data)) {
        const ids = character.skills.map(row => row.sourceId);
        assert.ok(ids.every(Number.isInteger), id);
        assert.equal(new Set(ids).size, ids.length, id);
        const burst = character.skills.find(row => row.type === '광기 폭발');
        assert.equal(over(id).sourceId, burst.sourceId, id);
        count += ids.length;
    }
    assert.equal(count, 376); // six roots each and four transformed commands
});

test('전체 스킬·초한·파생 카드의 돌파 0~15와 1~6레벨에 미치환 수치가 없다', () => {
    let count = 0;
    const visit = (id, row) => {
        if (row.variants?.length) return row.variants.forEach(variant => visit(id, variant));
        for (let stage = 0; stage <= 15; stage++) {
            for (let level = 1; level <= 6; level++) {
                const text = display(row, stage, level);
                assert.doesNotMatch(text, /(?<![가-힣A-Za-z])[lmn]%|\*n|\{[A-Za-z]+\}|\[Arg\d/, `${id}/${row.name}/${stage}/${level}`);
                count++;
            }
        }
    };
    for (const [id, character] of Object.entries(data)) {
        [...character.skills, over(id), ...(character.derivedCards || [])].forEach(row => visit(id, row));
    }
    assert.ok(count >= 50000);
});

test('레벨별 전문은 순서 기반 숫자 치환 없이 선택된 레벨을 표시한다', () => {
    const levels = [{ level: 1, description: '공격력의 5%와 방어력의 10%.' },
        { level: 6, description: '공격력의 10%와 방어력의 20%.' }];
    assert.equal(api.interpolateEffect('기본 문장', levels, 1), levels[0].description);
    assert.equal(api.interpolateEffect('기본 문장', levels, 6), levels[1].description);
});

test('확정 계수 수정은 중간 레벨과 최종 레벨에 함께 반영된다', () => {
    const cases = [['nymphaea', 4375, '중독 증가', '5%', '15%'],
        ['pandia', 4776, '반격', '40%', '80%'], ['pandia', 4384, '힘', '4%', '8%'],
        ['erica', 4403, '임시 힘', '7.5%', '15%'], ['casiah', 3977, '임시 힘', '12%', '24%'],
        ['castor', 89782, '크리티컬 피해 비율', '25%', '35%'], ['ogier', 4195, '방어막', '7%', '14%']];
    for (const [id, sid, key, first, last] of cases) {
        assert.equal(root(id, sid).levels[0][key], first, `${id}/1`);
        assert.equal(root(id, sid).levels[5][key], last, `${id}/6`);
    }
});

test('돌파와 초한은 대체 계수와 누적 계수를 구분한다', () => {
    assert.match(display(over('nautila'), 3), /현재 반격 수치의 500%/);
    assert.doesNotMatch(display(over('nautila'), 3), /750%|550%/);
    assert.match(display(over('ogier'), 2), /방어력의 216%.*공격력의 36%.*방어력의 72%/s);
    assert.match(display(over('sanga'), 3), /방어력 187\.5%.*공격력 75%/s);
    assert.match(display(over('pandia'), 3), /공격력의 230%에 해당하는 반격/);
    assert.doesNotMatch(display(over('pandia'), 3), /30%의 반격|기본 피해가 2배/);
    assert.doesNotMatch(display(over('lotan_cetarchon'), 3), /힘 계수가 2배/);
});

test('남아 있던 돌파 수치와 초한 조건을 누락 없이 표시한다', () => {
    assert.match(display(root('tulu', 4714), 2), /촉수 피해가 공격력의 12%.*공격력의 12%에 해당하는 임시 힘/s);
    assert.match(display(root('salvador', 4460), 2), /체력의 36%.*체력의 1\.5%/s);
    assert.match(display(root('winkle', 4329), 2), /버린 카드 1장당.*방어력의 10%/s);
    assert.match(display(over('coporsant')), /임시 촉수 3개와 영구 촉수 3개/);
    assert.match(display(over('casiah')), /기본 피해가 영역 숙련의 20%/);
    assert.match(display(over('salvador'), 15), /피해의 45%.*영지 각성이 적용 중이면 이 전환 비율은 47\.5%/s);
});

test('누락 파생 스킬 다섯 개는 원본 ID로 확인할 수 있다', () => {
    for (const [id, sid] of [['hameln', 59490], ['hameln', 59491],
        ['doll_inferno', 71522], ['doll_inferno', 71523], ['vortice', 130934]]) {
        assert.ok(data[id].derivedCards.some(row => row.sourceId === sid), `${id}/${sid}`);
    }
    assert.match(display(root('caraboo', 144492), 15), /「축복」 3장/);
    assert.match(data.doresain.enlighten.at(-1).effect, /대상의 현재 HP의 20%/);
});
