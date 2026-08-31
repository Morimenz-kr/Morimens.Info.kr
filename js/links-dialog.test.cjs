const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const repositoryRoot = path.join(__dirname, '..');
const linksHtml = fs.readFileSync(path.join(repositoryRoot, 'links.html'), 'utf8');
const linksSource = fs.readFileSync(path.join(__dirname, 'links.js'), 'utf8');
const linksCss = fs.readFileSync(path.join(repositoryRoot, 'css', 'pages', 'links.css'), 'utf8');
const characterEffectsSource = fs.readFileSync(path.join(repositoryRoot, 'js', 'character-effects.js'), 'utf8');
const silverKeys = JSON.parse(fs.readFileSync(path.join(repositoryRoot, 'data', 'silverkey_list.json'), 'utf8'));

test('#219 꺼지지 않는 태양은 산출력·피해 강효 필터에 모두 포함된다', () => {
    const context = vm.createContext({ window: { characterNameSet: new Set(['카티구라']) } });
    vm.runInContext(linksSource.slice(
        linksSource.indexOf('function getDictionaryFilterMeta('),
        linksSource.indexOf('function uniqueSortedValues(')
    ), context);
    const key = silverKeys.find(item => item.english_name === 'key_never_falling_sun');
    const meta = context.getDictionaryFilterMeta(key, 'silverkey');
    assert.ok(meta.effectFilters.includes('산출력'));
    assert.ok(meta.effectFilters.includes('피해 강효'));
    assert.equal(meta.effectFilters.includes('카티구라'), false);
    for (const alias of ['강효', '피해강효', '피해 강효', '피해 증폭', '임시 피해 증폭']) {
        assert.equal(context.normalizeDictionaryFilterValue(alias, 'effect'), '피해 강효');
    }
    assert.equal(context.normalizeDictionaryFilterValue('최종 피해 증가', 'effect'), '최종 피해 증가');
});

test('은열쇠·비밀계약·명륜 도감은 공통 dialog 상세 UI를 사용한다', () => {
    assert.match(linksHtml, /<dialog id="dictionary-detail-dialog"/);
    assert.match(linksSource, /function openDictionaryDialog\(/);
    assert.match(linksSource, /card\.onclick = \(\) => openDictionaryDialog\(item, category, card\)/);
    assert.match(linksCss, /\.dictionary-detail-dialog::backdrop/);
    assert.match(linksCss, /margin:\s*auto auto 0\.375rem/);
});

test('시스템용 열쇠 지령 효과는 획득형 은열쇠 도감에서 제외한다', () => {
    assert.equal(silverKeys.some(item => item.clientItemId === 48014), false);
    assert.equal(silverKeys.some(item => item.clientItemId === 89964), false);
    assert.equal(silverKeys.some(item => item.clientItemId === 146947), false);
});

test('명륜 상세 dialog는 0강부터 15강까지 강화별 주옵션을 표시한다', () => {
    assert.match(linksSource, /function getWheelMainStatLevels\(/);
    assert.match(linksSource, /Array\.from\(\{ length: 16 \}/);
    assert.match(linksSource, /level <= 3 \? 1 : 1 \+ \(\(level - 3\) \/ 12\)/);
    assert.match(linksSource, /appendWheelMainStatSection\(content, item\.main_stat\)/);
    assert.match(linksSource, /statValue\.textContent = levels\[0\]\.value/);
    assert.match(linksSource, /dictionary-enhancement-slider/);
    assert.match(linksSource, /전체 강화 수치 표/);
    assert.match(linksSource, /aria-valuetext/);
    assert.match(linksSource, /<details|createElement\('details'\)/);
    assert.match(linksSource, /\['명함', '1돌', '2돌', '3돌'\]/);
    assert.match(linksSource, /dictionary-enhancement-table/);
    assert.match(linksCss, /\.dictionary-enhancement-table/);
    assert.match(linksCss, /\.dictionary-breakthrough-switch button \+ button/);
});

test('사이트의 details 접기 UI는 공통 disclosure 스타일을 사용한다', () => {
    const componentsCss = fs.readFileSync(path.join(repositoryRoot, 'css', 'components.css'), 'utf8');
    assert.match(componentsCss, /\.site-disclosure > summary/);
    assert.match(linksSource, /dictionary-enhancement-details site-disclosure/);
    assert.match(fs.readFileSync(path.join(repositoryRoot, 'covenant_simulator.html'), 'utf8'), /target-fold-section site-disclosure/g);
    assert.match(fs.readFileSync(path.join(repositoryRoot, 'rerun_schedule.html'), 'utf8'), /history-disclosure site-disclosure/);
    assert.match(fs.readFileSync(path.join(__dirname, 'dzone-info.js'), 'utf8'), /site-disclosure/g);
    assert.match(fs.readFileSync(path.join(__dirname, 'character-effects.js'), 'utf8'), /character-effect-card site-disclosure/);
});

test('dialog 안에서 연 키워드 툴팁은 같은 top layer 안에 생성한다', () => {
    assert.match(characterEffectsSource, /container\.closest\('dialog'\)/);
    assert.match(characterEffectsSource, /tooltipHost\.appendChild\(tooltipBox\)/);
});

test('은열쇠는 금기 학식 등급으로 효과 수치를 계산하고 정확한 연구 깊이는 노출하지 않는다', () => {
    assert.match(linksHtml, /loadJS\('js\/research-depth\.js'\)/);
    assert.match(linksSource, /id="dictionary-research-level"/);
    assert.match(linksSource, /function formatSilverKeyEffect\(/);
    assert.match(linksSource, /ResearchDepth\.evaluate\(expression, depth, variables\)/);
    assert.doesNotMatch(linksSource, /등급 기준/);
    assert.doesNotMatch(linksSource, /formatDepth\(/);
});
