const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');
const root = path.join(__dirname, '..');
const read = name => JSON.parse(fs.readFileSync(path.join(root, 'data', name + '.json'), 'utf8'));

test('비비안 공개 카드와 전용 장비는 안정 ID로 연결되며 이미지가 존재한다', () => {
    const character = read('character_manifest').find(row => row.id === 'vivian');
    const detail = read('awakener/vivian');
    const cards = new Map(read('db_cards').cards.map(row => [row.id, row]));
    assert.equal(character.class, 'chorus');
    assert.equal(character.relems, 'chaos');
    assert.ok(character.pending_data.includes('growth'));
    assert.deepEqual(read('character_effects').vivian.baseStats, read('db_awakener_stats').vivian.base_stats);
    for (const id of [...detail.skill_kit_ids.command_cards, detail.skill_kit_ids.rouse_skill,
        detail.skill_kit_ids.exalt, detail.skill_kit_ids.overexalt]) assert.ok(cards.has(id), id);
    for (const grade of ['SSR', 'SR']) {
        const matches = read('wheel_list').filter(row => row.grade === grade && row.owner_character_ids?.includes('vivian'));
        assert.equal(matches.length, 1);
        assert.ok(fs.existsSync(path.join(root, matches[0].image_path)));
    }
    const key = read('silverkey_list').find(row => row.owner_character_ids?.includes('vivian'));
    assert.equal(key.korean_name, '밤에서 태어난 알');
    assert.match(key.description, /47pt.*20pt/);
    assert.match(key.description, /카운트다운이 1 감소/);
    assert.ok(fs.existsSync(path.join(root, key.image_path)));
    for (const image of [character.image_thumb, detail.images.full]) assert.ok(fs.existsSync(path.join(root, image)));
});

test('비비안 수면과 물약은 행동 제한 및 횟수와 초기화 조건을 보존한다', () => {
    const effect = read('character_effects').vivian;
    const burst = effect.skills.find(row => row.name === '황무지에 잠든 자');
    assert.match(burst.effect, /5% 확률.*50% 증가/);
    assert.match(burst.effect, /크리티컬률 1%당.*1%씩 증가/);
    assert.match(burst.effect, /이번 턴에 해당 각성체는 행동이 불가/);
    assert.match(burst.effect, /1스택을 소모.*턴 종료 시 제거/s);
    const potion = effect.skills.find(row => row.name === '있는 거 아무거나');
    assert.match(potion.effect, /카운트다운이 3 증가.*최대 3회/);
    assert.match(potion.effect, /손에.*없을 경우.*생성.*그렇지 않을 경우.*100% 증가/);
    assert.match(potion.effect, /모든 재료가 선택될 때까지.*제거.*초기화/);
    const cauldron = effect.derivedCards.find(row => row.name === '가마술: X');
    assert.match(cauldron.effect, /카운트다운이 0일 때만/);
    assert.match(cauldron.effect, /이번 턴에는.*진행할 수 없다/);
    assert.match(cauldron.effect, /턴 시작 시.*1 감소/);
    assert.equal(effect.enlighten[3].name, '흑연이 만족한 순간');
    assert.match(effect.enlighten[3].effect, /3배/);
});

test('이마고 명륜은 강화 중첩과 탐색 누적 조건을 보존하며 픽맨 SR을 은열쇠로 중복 등록하지 않는다', () => {
    const wheel = read('wheel_list').find(row => row.english_name === 'wheel_imago_clinic');
    assert.match(wheel.description, /「강화」를 4\/6\/8\/10스택/);
    assert.match(wheel.description, /최대 5스택.*턴 종료 시 제거/s);
    assert.match(wheel.description, /이번 탐색.*누적 5·10·15·20·25스택/s);
    assert.match(wheel.description, /「원초의 기억」/);
    assert.ok(!wheel.owner_character_ids?.length);
    assert.equal(read('wheel_list').find(row => row.english_name === 'wheel_brush_of_yearning').grade, 'SR');
    assert.ok(!read('silverkey_list').some(row => row.korean_name === '갈망의 붓'));
});

test('11월 복각은 한국 시간 10시에 예정에서 현재로 전환되고 종료 시 제거된다', () => {
    const source = fs.readFileSync(path.join(__dirname, 'rerun_schedule.js'), 'utf8');
    const window = {};
    new Function('window', source.replace('const currentBox =',
        'window.normalizeScheduleBuckets = normalizeScheduleBuckets; return; const currentBox ='))(window);
    const data = read('rerun_schedule');
    const ids = ['pickman', 'tulu', 'lily'];
    const upcoming = data.next_pickups.filter(row => ids.includes(row.id) && row.start_date === '2026-11-02');
    assert.equal(upcoming.length, 3);
    upcoming.forEach(row => {
        assert.equal(row.start_time, '10:00');
        assert.equal(row.end_date, '2026-11-30');
        assert.equal(row.end_time, '10:00');
        assert.equal(row.timezone, 'Asia/Seoul');
    });
    const state = at => window.normalizeScheduleBuckets(data.current_pickups, data.next_pickups, new Date(at));
    assert.deepEqual(state('2026-11-02T00:59:59Z').next.map(row => row.id), ids);
    assert.deepEqual(state('2026-11-02T01:00:00Z').current.filter(row => ids.includes(row.id)).map(row => row.id), ids);
    assert.equal(state('2026-11-30T00:59:59Z').current.filter(row => ids.includes(row.id)).length, 3);
    assert.equal(state('2026-11-30T01:00:00Z').current.length, 0);
    // Preserve the client-verified release period already published on main.
    const vivian = [...data.current_pickups, ...data.next_pickups].find(row => row.id === 'vivian');
    assert.equal(vivian.start_date, '2026-10-19');
    assert.equal(vivian.end_date, '2026-11-16');
    assert.equal(vivian.client_summon_id, 151579);
});

test('공통 명륜 상세창은 공지의 강화 시작값과 끝값 및 누적 조건을 표시한다', () => {
    const source = fs.readFileSync(path.join(__dirname, 'links.js'), 'utf8');
    const context = vm.createContext({});
    vm.runInContext(source.slice(source.indexOf('function parseWheelMainStat('),
        source.indexOf('function appendWheelEffectSection(')), context);
    for (const [id, start, end] of [
        ['wheel_vivian_ssr', '14.4%', '28.8%'],
        ['wheel_vivian_sr', '7.2%', '14.4%'],
        ['wheel_imago_clinic', '14.4%', '28.8%']
    ]) {
        const wheel = read('wheel_list').find(row => row.english_name === id);
        const levels = context.getWheelMainStatLevels(wheel.main_stat);
        assert.equal(levels[0].value, start);
        assert.equal(levels[15].value, end);
    }
    const clinic = read('wheel_list').find(row => row.english_name === 'wheel_imago_clinic');
    for (let stage = 0; stage < 4; stage++) {
        const rendered = context.getWheelEffectAtBreakthrough(clinic.description, stage);
        assert.match(rendered, /누적 5·10·15·20·25스택/);
        assert.match(rendered, new RegExp('「강화」를 ' + [4, 6, 8, 10][stage] + '스택'));
    }
});
