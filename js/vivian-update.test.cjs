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
    assert.ok(!character.pending_data.includes('growth'));
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
    assert.match(key.description, /65점.*20점/);
    assert.match(key.description, /카운트다운이 1 감소/);
    assert.ok(fs.existsSync(path.join(root, key.image_path)));
    for (const image of [character.image_thumb, detail.images.full]) assert.ok(fs.existsSync(path.join(root, image)));
});

test('비비안 수면과 물약은 행동 제한 및 횟수와 초기화 조건을 보존한다', () => {
    const effect = read('character_effects').vivian;
    const tooltips = read('db_tooltips');
    const burst = effect.skills.find(row => row.name === '황무지에 잠든 자');
    assert.match(burst.effect, /5% 확률.*50% 증가/);
    assert.match(burst.effect, /크리티컬 확률 1%당.*1%씩 증가/);
    assert.match(burst.effect, /<SleepKeywords:완벽한 수면>/);
    assert.match(tooltips.SleepKeywords.description, /이번 턴에 해당 각성체는 행동이 불가/);
    assert.match(tooltips.WrathKeywords.description, /1 중첩을 소모.*턴 종료 시 제거/s);
    const potion = effect.skills.find(row => row.name === '있는 거 아무거나');
    assert.match(potion.effect, /<LianyaoKeywords:마법 물약 조제>/);
    assert.doesNotMatch(potion.effect, /SleepKeywords|완벽한 수면/);
    assert.match(tooltips.LianyaoKeywords.description, /카운트다운이 3 증가.*최대 3/);
    assert.match(tooltips.LianyaoKeywords.description, /손에.*없을 경우.*생성.*그렇지 않을 경우.*100% 증가/);
    assert.match(tooltips.MatterKeywords.description, /모든 재료가 선택될 때까지.*제거.*초기화/);
    const cauldron = effect.derivedCards.find(row => row.sourceId === 152499);
    assert.match(cauldron.effect, /카운트다운이 0일 때만/);
    assert.match(cauldron.effect, /이번 턴에는.*진행할 수 없다/);
    assert.match(cauldron.effect, /턴 시작 시.*1 감소/);
    assert.equal(effect.enlighten[3].name, '흑연이 만족한 순간');
    assert.equal(effect.enlighten[3].levels.at(-1).heal, '240');
});

test('비비안은 돌파별 스킬 계수와 재료 상태 및 최종 법칙 비용을 구분한다', () => {
    const window = {};
    new Function('window', fs.readFileSync(path.join(__dirname, 'character-effects.js'), 'utf8'))(window);
    const api = window.CharacterEffects;
    const effect = read('character_effects').vivian;
    const find = id => effect.skills.find(row => row.sourceId === id);
    assert.match(find(152584).effect, /1000/);
    assert.doesNotMatch(find(152584).effect, /SleepKeywords/);
    assert.match(api.getBreakthroughVariant(find(152584), 1).effect, /1100%.*크리티컬 확률 1%마다.*5%/);
    assert.equal(api.getBreakthroughVariant(find(152584), 15).cost.value, 1);
    assert.equal(api.getBreakthroughVariant(find(152503), 15).cost.value, 0);
    const badges = api.renderBreakthroughBadges(find(152503), 15);
    assert.match(badges, /data-breakthrough-stage="15"/);
    assert.match(badges, /aria-label="풀돌 효과 보기">풀돌/);
    assert.doesNotMatch(badges, /15돌/);
    const upgraded = api.getBreakthroughVariant(find(152503), 3);
    assert.match(upgraded.effect, /MatterKeywords1:재료/);
    assert.doesNotMatch(upgraded.effect, /MatterKeywords:1/);
    assert.match(api.interpolateEffect(api.getBreakthroughVariant(find(152500), 3).effect,
        api.getBreakthroughVariant(find(152500), 3).levels, 6), /공격력의 <Power:75%>에 해당하는/);
    const tooltips = read('db_tooltips');
    const html = api.renderRichText(upgraded.effect, tooltips);
    assert.match(html, /data-keyword="MatterKeywords1"/);
    assert.equal(tooltips.MatterKeywords.stateId, 152897);
    assert.equal(tooltips.MatterKeywords1.stateId, 154164);
    assert.doesNotMatch(tooltips.MatterKeywords.description, /피해가 10%/);
    assert.match(tooltips.MatterKeywords1.description, /피해가 10%/);
    assert.match(api.renderRichText('<WrathKeywords:불타는 분노>', tooltips), /battle_card_buff_097\.png/);
    assert.doesNotMatch(api.renderRichText('<WrathKeywords1:불타는 분노>', tooltips), /<img|tooltip-trigger/);
    for (const entry of Object.values(tooltips).filter(row => row?.sourceVersion === 15)) {
        if (entry.icon) assert.ok(fs.existsSync(path.join(root, entry.icon)), entry.icon);
    }
});

test('비비안 수치는 기존 백분율 문장으로 표시하고 힘 수치와 본문 상태를 색상·아이콘에 연결한다', () => {
    const window = {};
    new Function('window', fs.readFileSync(path.join(__dirname, 'character-effects.js'), 'utf8'))(window);
    const api = window.CharacterEffects;
    const effect = read('character_effects').vivian;
    const tooltips = read('db_tooltips');
    for (const skill of [...effect.skills, effect.enlighten[3]]) {
        for (const stage of [0, 1, 3, 15]) {
            const variant = api.getBreakthroughVariant(skill, stage);
            for (const level of variant.levels) {
                const text = api.interpolateEffect(variant.effect, variant.levels, level.level);
                assert.doesNotMatch(text, /×|%pt|\{\w+\}/, skill.name);
            }
        }
    }
    const burst = effect.skills.find(row => row.sourceId === 152500);
    const html = api.renderRichText(api.interpolateEffect(burst.effect, burst.levels, 6), tooltips);
    assert.match(html, /class="keyword-text" style="--keyword-color:#5e9177"><span>50%<\/span>/);
    assert.match(html, /data-keyword="PowerIconKeywords"/);
    const scroll = effect.skills.find(row => row.sourceId === 152501);
    assert.match(api.renderRichText(scroll.effect, tooltips), /data-keyword="SleepKeywords"[^>]*>.*battle_card_buff_016\.png/);
    assert.match(api.renderRichText(tooltips.MatterKeywords.description, tooltips), /data-keyword="WrathKeywords"[^>]*>.*battle_card_buff_097\.png/);
    assert.match(api.renderRichText(tooltips.WrathKeywords.description, tooltips), /data-keyword="SleepKeywords"[^>]*>.*battle_card_buff_016\.png/);
});

test('비비안 성장 데이터는 90레벨과 연결된 15단계 돌파 및 여섯 스킬을 제공한다', () => {
    const growth = read('character_growth').characters.vivian;
    assert.equal(growth.sourceId, 151844);
    assert.equal(growth.source.resourceVersion, 15);
    assert.equal(growth.levels.length, 90);
    assert.equal(growth.potencySteps.length, 15);
    assert.equal(growth.potencySteps[0].nodeId, 152491);
    assert.equal(growth.potencySteps.at(-1).nodeId, 152485);
    assert.equal(growth.skillUpgrades.length, 6);
    const resources = read('growth_resources').items;
    for (const step of growth.potencySteps) {
        for (const resource of step.resources) {
            assert.ok(resources[resource.itemId]);
            assert.ok(fs.existsSync(path.join(root, resources[resource.itemId].icon)));
        }
    }
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
