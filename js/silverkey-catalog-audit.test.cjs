const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const root = path.join(__dirname, '..');
const keys = JSON.parse(fs.readFileSync(path.join(root, 'data/silverkey_list.json'), 'utf8'));
const levels = JSON.parse(fs.readFileSync(path.join(root, 'data/research_depth_levels.json'), 'utf8')).levels;
let selectedLevel = 81;
const context = vm.createContext({
    window: {},
    localStorage: { getItem: () => String(selectedLevel), setItem: (_, value) => { selectedLevel = Number(value); } },
    fetch: async () => ({ ok: true, json: async () => ({ levels }) })
});
vm.runInContext(fs.readFileSync(path.join(__dirname, 'research-depth.js'), 'utf8'), context);
const links = fs.readFileSync(path.join(__dirname, 'links.js'), 'utf8');
vm.runInContext(links.slice(links.indexOf('function formatSilverKeyEffect('), links.indexOf('function openDictionaryDialog(')), context);
const ready = context.window.ResearchDepth.load();
const key = id => keys.find(row => row.english_name === id);
const effect = (id, level = 81) => {
    selectedLevel = level;
    return context.formatSilverKeyEffect(key(id));
};

test('은열쇠 56개는 아이템·스킬 ID가 중복 없이 연결되고 시스템·임시 항목을 제외한다', () => {
    assert.equal(keys.length, 56);
    for (const field of ['clientItemId', 'clientSkillId']) {
        assert.ok(keys.every(row => Number.isInteger(row[field])), field);
        assert.equal(new Set(keys.map(row => row[field])).size, keys.length, field);
    }
    for (const id of [48014, 89964, 147549, 152378]) assert.ok(!keys.some(row => row.clientItemId === id));
    assert.equal(key('key_GOgier').clientSkillId, 149333);
    assert.equal(key('key_vivian').clientSkillId, 154015);
});

test('56개 은열쇠는 연구 등급 1~100에서 계산 토큰 없이 표시된다', async () => {
    await ready;
    for (let level = 1; level <= 100; level++) {
        for (const row of keys) {
            const text = effect(row.english_name, level);
            assert.doesNotMatch(text, /PlayerGrowth|InsightResearchDepth|chaostype2_|\[Arg|\[(?:Block|Heal|Energy|Exhaustion):|NaN|undefined/, `${row.english_name}/${level}`);
            assert.doesNotMatch(text, /실드|강효|점를|점와|웨이크업|산출력 소모pt/, `${row.english_name}/${level}/용어`);
        }
    }
});

test('서약·오지에와 비비안 은열쇠도 연구 등급에 따라 수치가 변한다', async () => {
    await ready;
    assert.match(effect('key_GOgier', 1), /방어막을 6점.*힘을 2점/s);
    assert.match(effect('key_GOgier', 100), /방어막을 109점.*힘을 26점/s);
    assert.match(effect('key_vivian', 1), /HP를 4점/);
    assert.match(effect('key_vivian', 100), /HP를 77점/);
    assert.match(effect('key_vivian'), /「가마술」의 카운트다운이 1 감소/);
});

test('기본 설명은 금기 학식 기본값 81의 실제 표시와 일치한다', async () => {
    await ready;
    for (const row of keys) assert.equal(row.description, effect(row.english_name), row.english_name);
});

test('누락된 조건·생성 카드·대상별 적용 범위를 복원한다', async () => {
    await ready;
    assert.match(effect('key_injection'), /25% 이하/);
    assert.match(effect('key_blood'), /광기를 20점.*힘을 22점/s);
    assert.match(effect('key_black_swan'), /부패 녹염/);
    assert.doesNotMatch(effect('key_black_swan'), /사멸 녹염/);
    assert.match(effect('key_lightning'), /「항해」/);
    assert.match(effect('key_rose'), /「성결의 자식」 1장당 150%/);
    assert.match(effect('key_miracle'), /다음 턴 시작 전까지 능동 또는 촉수 피해/);
    assert.match(effect('key_gun_sound'), /크리티컬 확률 15%/);
    assert.match(effect('key_lotan_cetarchon'), /각각에게서 광기를 최대 10점씩/);
});

test('시편과 별들의 가호의 선택지 및 지속·상한을 표시한다', async () => {
    await ready;
    const poems = effect('key_spring');
    for (const name of ['비의 찬가', '바람의 찬가', '꽃의 찬가', '달의 찬가']) assert.ok(poems.includes(name));
    assert.match(poems, /HP를 129점/);
    assert.match(effect('key_star_protect'), /방어막을 65점.*최대 5스택.*전투가 끝나도 사라지지 않는다/s);
    assert.match(effect('key_star_protect'), /소모한 스택만큼 산출력.*임시 촉수/s);
});
