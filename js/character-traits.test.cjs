const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.join(__dirname, '..');
const effects = JSON.parse(fs.readFileSync(path.join(root, 'data/character_effects.json'), 'utf8'));
const tooltips = JSON.parse(fs.readFileSync(path.join(root, 'data/db_tooltips.json'), 'utf8'));

function renderTraits(traits) {
    const window = {};
    new Function('window', fs.readFileSync(path.join(__dirname, 'character-effects.js'), 'utf8'))(window);
    const listeners = {};
    const container = {
        dataset: { tooltipEventsBound: 'true' },
        innerHTML: '',
        addEventListener(name, handler) { (listeners[name] ||= []).push(handler); }
    };
    window.CharacterEffects.render(container, { traits }, '비비안', tooltips);
    return { api: window.CharacterEffects, container, listeners };
}

test('비비안 영역 설명은 서약 오지에와 같은 툴팁을 사용한다', () => {
    const [realm, omen, training] = effects.vivian.traits;
    assert.match(realm.effect, /혼돈.*원초·혼돈/);
    assert.doesNotMatch(realm.effect, /만열의 근원|기억의 파편/);
    assert.equal(realm.details, undefined);
    assert.deepEqual(omen.levels.map(row => row.level), Array.from({ length: 12 }, (_, i) => i + 1));
    assert.deepEqual(training.levels.map(row => row.level), Array.from({ length: 10 }, (_, i) => i + 1));
    for (const trait of [omen, training]) {
        for (const level of trait.levels) {
            assert.doesNotMatch(level.description, /\[Arg\d+\]|\{\w+\}|\d\s*\/\s*\d/);
        }
    }
    const { container } = renderTraits(effects.vivian.traits);
    assert.match(container.innerHTML, /aria-label="광기의 징조 특성 레벨 선택"/);
    assert.match(container.innerHTML, /aria-label="영혼 단련 특성 레벨 선택"/);
    assert.doesNotMatch(container.innerHTML, /character-trait-details|<details/);
    assert.match(container.innerHTML, /data-keyword="원초·혼돈"/);
    assert.doesNotMatch(container.innerHTML, /<details[^>]*\bopen\b/);
});

test('특성 레벨을 바꾸면 선택한 단계의 수치로 설명을 갱신한다', () => {
    const trait = effects.vivian.traits.find(item => item.sourceId === 151847);
    const { api, listeners } = renderTraits([trait]);
    const description = { dataset: { effectTemplate: trait.effect }, innerHTML: '' };
    const scope = {
        dataset: { effectDefinition: JSON.stringify(trait) },
        querySelector(selector) {
            assert.equal(selector, '.character-effect-description');
            return description;
        }
    };
    for (const level of [1, 9, 10]) {
        const target = {
            matches: () => true,
            closest(selector) { return selector.includes('.character-trait-card') ? scope : null; },
            dataset: { levels: JSON.stringify(trait.levels) },
            value: String(level)
        };
        for (const handler of listeners.change) handler({ target });
        const expected = trait.levels.find(row => row.level === level).description;
        assert.equal(description.innerHTML, api.renderRichText(expected, tooltips, {
            plainKeywords: trait.plainKeywords
        }));
    }
});

test('레벨 정보가 없는 기존 특성은 범위 표시와 본문을 유지한다', () => {
    const trait = { name: '기존 특성', level_range: 'Lv. 1 ~ 12', effect: '광기를 5 ~ 60 획득한다.' };
    const { container } = renderTraits([trait]);
    assert.match(container.innerHTML, /Lv\. 1 ~ 12/);
    assert.match(container.innerHTML, /광기를 5 ~ 60 획득한다\./);
    assert.doesNotMatch(container.innerHTML, /<select|character-trait-details/);
});
