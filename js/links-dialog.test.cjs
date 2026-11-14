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
const wheels = JSON.parse(fs.readFileSync(path.join(repositoryRoot, 'data', 'wheel_list.json'), 'utf8'));

test('#246 탄피 전용 명륜은 미리암의 의식 대신 강생 의식 툴팁을 표시한다', () => {
    const window = {};
    new Function('window', characterEffectsSource)(window);
    const tooltips = JSON.parse(fs.readFileSync(path.join(repositoryRoot, 'data', 'db_tooltips.json'), 'utf8'));
    window.CharacterEffects.configureTooltips(tooltips);
    const wheel = wheels.find(item => item.english_name === 'wheel_peace_sleep_in_dark');
    const html = window.CharacterEffects.renderRichText(wheel.description);
    assert.match(html, /data-keyword="강생 의식"/);
    assert.match(html, /incarnation-ritual\.png/);
    assert.doesNotMatch(html, /data-keyword="의식"/);
    assert.match(tooltips['강생 의식'], /희생/);
    assert.match(window.CharacterEffects.renderRichText('의식을 사용한다.'), /data-keyword="의식"/);
    assert.match(tooltips['의식'], /성례.*집착/);
});

test('#219 꺼지지 않는 태양은 산출력·피해 증폭 필터에 모두 포함된다', () => {
    const context = vm.createContext({ window: { characterNameSet: new Set(['카티구라']) } });
    vm.runInContext(linksSource.slice(
        linksSource.indexOf('function getDictionaryFilterMeta('),
        linksSource.indexOf('function uniqueSortedValues(')
    ), context);
    const key = silverKeys.find(item => item.english_name === 'key_never_falling_sun');
    const meta = context.getDictionaryFilterMeta(key, 'silverkey');
    assert.ok(meta.effectFilters.includes('산출력'));
    assert.ok(meta.effectFilters.includes('피해 증폭'));
    assert.equal(meta.effectFilters.includes('카티구라'), false);
    for (const alias of ['강효', '피해강효', '피해 강효', '피해 증폭', '임시 피해 증폭']) {
        assert.equal(context.normalizeDictionaryFilterValue(alias, 'effect'), '피해 증폭');
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

test('#78 추천 장비는 공통 상세 dialog를 열고 주옵 추천은 일치하는 명륜을 표시한다', () => {
    assert.match(linksSource, /class="equip-recommendation-trigger" data-tooltip-kind="wheel"/);
    assert.match(linksSource, /class="equip-recommendation-trigger" data-tooltip-kind="covenant"/);
    assert.match(linksSource, /function findWheelsByRecommendedStat\(/);
    assert.match(linksSource, /function renderWheelStatMatches\(/);
    assert.match(linksSource, /조건에 맞는 명륜/);
    assert.match(linksCss, /\.wheel-stat-match-grid/);
    assert.match(linksCss, /--recommend-artwork-height:/);
    assert.match(linksCss, /\.recommend-right\s*\{[^}]*grid-template-columns:\s*repeat\(2, max-content\)/s);
    assert.match(linksCss, /\.wheel-pair\s*\{[^}]*grid-template-rows:\s*auto auto minmax\(44px, auto\)/s);
    assert.match(linksCss, /\.equip-slot\s*\{[^}]*grid-template-rows:\s*auto auto minmax\(44px, auto\)/s);

    const context = vm.createContext({ window: { wheelMap: {} } });
    const filterStart = linksSource.indexOf('function normalizeDictionaryFilterValue(');
    const filterEnd = linksSource.indexOf('function uniqueSortedValues(');
    const matchStart = linksSource.indexOf('function findWheelsByRecommendedStat(');
    const matchEnd = linksSource.indexOf('function renderCovenantFreeModal(');
    vm.runInContext(`${linksSource.slice(filterStart, filterEnd)}\n${linksSource.slice(matchStart, matchEnd)}`, context);
    context.window.wheelMap = Object.fromEntries(wheels.flatMap(wheel => [
        [wheel.english_name, wheel],
        [wheel.korean_name, wheel]
    ]));
    const matches = context.findWheelsByRecommendedStat('검은 인장 획득');
    assert.ok(matches.length > 0);
    assert.ok(matches.every(wheel => /검은 인장 드롭/.test(wheel.main_stat)));
    assert.equal(new Set(matches.map(wheel => wheel.english_name)).size, matches.length);
});

test('시스템용 열쇠 지령 효과는 획득형 은열쇠 도감에서 제외한다', () => {
    assert.equal(silverKeys.some(item => item.clientItemId === 48014), false);
    assert.equal(silverKeys.some(item => item.clientItemId === 89964), false);
    assert.equal(silverKeys.some(item => item.clientItemId === 146947), false);
});

test('명륜 상세 dialog는 0강부터 15강까지 강화별 주옵션을 표시한다', () => {
    assert.match(linksSource, /function getWheelMainStatLevels\(/);
    assert.match(linksSource, /Array\.from\(\{ length: 16 \}/);
    assert.match(linksSource, /grade === 'R' \? 6 : 12/);
    assert.match(linksSource, /appendWheelMainStatSection\(content, item\.main_stat, item\.grade\)/);
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

test('연구 깊이로 은열쇠 수치를 계산한 뒤에도 기존 효과 용어를 보존한다', () => {
    const context = vm.createContext({ window: { ResearchDepth: {
        depthAt: () => 2,
        selectedLevel: () => 1,
        evaluate: () => 24
    } } });
    vm.runInContext(linksSource.slice(
        linksSource.indexOf('function formatSilverKeyEffect('),
        linksSource.indexOf('function openDictionaryDialog(')
    ), context);
    const text = context.formatSilverKeyEffect({
        effectFormula: '방어막을 PlayerGrowth*12 획득하고, 피해 증폭이 10% 증가한다.'
    });
    assert.match(text, /방어막을 24 획득/);
    assert.match(text, /피해 증폭이 10%/);
    assert.doesNotMatch(text, /실드|피해 강효/);
});

test('활동 유물의 가마술은 비비안 가마술과 서로 다른 안정 태그로 연결된다', () => {
    const tooltips = JSON.parse(fs.readFileSync(path.join(repositoryRoot, 'data/db_tooltips.json'), 'utf8'));
    const window = {};
    new Function('window', characterEffectsSource)(window);
    window.CharacterEffects.configureTooltips(tooltips);
    const html = window.CharacterEffects.renderRichText('<DerivativeCardKeywords_164:가마술> <DerivativeCardKeywords_166:가마술>');
    assert.match(html, /data-keyword="DerivativeCardKeywords_164"/);
    assert.match(html, /data-keyword="DerivativeCardKeywords_166"/);
    assert.equal(tooltips.DerivativeCardKeywords_164.sourceId, 152979);
    assert.equal(tooltips.DerivativeCardKeywords_166.skillId, 152499);
    assert.doesNotMatch(tooltips.DerivativeCardKeywords_164.description, /카운트다운/);
    assert.match(tooltips.DerivativeCardKeywords_164.description, /카드 3장/);
});

test('R 명륜의 강화 주옵은 SSR·SR과 다른 성장 폭을 적용한다', () => {
    const context = vm.createContext({});
    vm.runInContext(linksSource.slice(
        linksSource.indexOf('function parseWheelMainStat('),
        linksSource.indexOf('function appendWheelEffectSection(')
    ), context);
    const rare = context.getWheelMainStatLevels('광기 회복 1.2', 'R');
    assert.equal(rare[3].value, '1.2');
    assert.equal(rare[4].value, '1.4');
    assert.equal(rare[15].value, '3.6');
    assert.equal(context.getWheelMainStatLevels('영역 숙련 18', 'SR')[15].value, '36');
    assert.equal(context.getWheelMainStatLevels('영역 숙련 36', 'SSR')[15].value, '72');
    assert.match(linksSource, /appendWheelMainStatSection\(content, item\.main_stat, item\.grade\)/);
});

test('#227 모스·무셰트 전용 명륜은 돌파별 효과 수치와 인게임 이름을 표시한다', () => {
    const eden = wheels.find(item => item.english_name === 'wheel_eden');
    const rampage = wheels.find(item => item.english_name === 'wheel_doomsday_rampage');
    assert.equal(eden.korean_name, '먼 곳의 에덴');
    assert.match(eden.description, /기본 광기의 11\/14\/17\/20%/);
    assert.equal(rampage.korean_name, '광란의 세계 끝에서');
    assert.match(rampage.description, /기본 피해가 30\/40\/50\/60%/);
    assert.match(rampage.description, /공격력의 13\/17\/21\/25%/);
});
