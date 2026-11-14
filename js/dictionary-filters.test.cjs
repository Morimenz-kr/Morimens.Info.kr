const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const root = path.join(__dirname, '..');
const keys = JSON.parse(fs.readFileSync(path.join(root, 'data/silverkey_list.json'), 'utf8'));
const source = fs.readFileSync(path.join(__dirname, 'links.js'), 'utf8');
const context = vm.createContext({window: {characterNameSet: new Set()}});
vm.runInContext(source.slice(source.indexOf('function getDictionaryFilterMeta('), source.indexOf('function renderDictionaryFilters(')), context);
const meta = key => context.getDictionaryFilterMeta(key, 'silverkey');
const matches = (effects, action = '') => keys.filter(key => context.matchesDictionaryEffects(meta(key), effects, action));

test('힘 필터는 획득·감소·탈취 18개를 포함하고 세부 동작을 구분한다', () => {
    assert.equal(matches(['힘']).length, 18);
    assert.equal(matches(['힘'], '획득').length, 13);
    assert.equal(matches(['힘'], '감소').length, 3);
    assert.equal(matches(['힘'], '탈취').length, 2);
    for (const name of ['영원한 집착', '마음이 허한 사람', '잔혹한 인사', '고래를 삼킨 폭풍', '끝없이 쓰여지는 새 장']) {
        assert.ok(matches(['힘']).some(key => key.korean_name === name), name);
    }
    const criticalOnly = matches(['크리티컬 확률 증가']).filter(key => !meta(key).effectFilters.includes('힘'));
    assert.ok(criticalOnly.length > 0);
    // Strength details refine only the strength branch of an OR selection.
    for (const key of criticalOnly) assert.ok(matches(['힘', '크리티컬 확률 증가'], '탈취').includes(key));
    assert.equal(matches([]).length, 56);
});

test('임시·동의어 필터를 통합하되 다른 동작은 구분한다', () => {
    for (const [aliases, expected] of [
        [['힘 증가', '임시 힘 감소', '힘훔침'], '힘'],
        [['중독 획득', '중독 부여', '중독 발동'], '중독'],
        [['보호막 획득', '방어막 획득', '방어막 증가'], '방어막'],
        [['체력 회복', 'HP 회복'], 'HP 회복'],
        [['임시 크리티컬 확률 증가', '크리티컬 확률 증가'], '크리티컬 확률 증가'],
        [['임시 크리티컬 피해 증가', '크리티컬 피해 증가'], '크리티컬 피해 증가'],
        [['임시 피해 증폭', '피해 강효'], '피해 증폭']
    ]) for (const alias of aliases) assert.equal(context.normalizeDictionaryFilterValue(alias, 'effect'), expected);
    for (const value of ['카드 비용 감소', '산출력', '광기 감소', '광기 탈취', '은열쇠 충전', '최대 은열쇠 에너지 증가', '최종 피해 증가']) {
        assert.equal(context.normalizeDictionaryFilterValue(value, 'effect'), value);
    }
    assert.equal(matches(['크리티컬 확률 증가']).length, 7);
    assert.equal(matches(['크리티컬 피해 증가']).length, 4);
    assert.equal(matches(['중독']).length, 3);
    assert.equal(matches(['방어막']).length, 13);
    assert.equal(matches(['산출력']).length, 12);
    assert.equal(matches(['카드 비용 감소']).length, 6);
});

test('카드 추가·회수·드로우와 상태 획득을 구분한다', () => {
    for (const [name, expected, excluded] of [
        ['잔혹한 인사', ['힘', '잔해'], ['카드 추가']],
        ['안개 경계에서 온', ['드로우', '카드 비용 감소'], ['카드 추가']],
        ['회귀의 문을 넘어', ['카드 회수', '카드 비용 감소'], ['산출력', '카드 추가']],
        ['부패의 연회', ['반격', '힘'], []],
        ['포효하는 피와 모래', ['배아 융합', '광기'], []]
    ]) {
        const filters = meta(keys.find(key => key.korean_name === name)).effectFilters;
        for (const effect of expected) assert.ok(filters.includes(effect), `${name}: ${effect}`);
        for (const effect of excluded) assert.equal(filters.includes(effect), false, `${name}: ${effect}`);
    }
});

test('필터 아이콘과 개수는 접근 가능한 체크박스 레이블에 표시된다', () => {
    const markup = context.buildFilterCheckboxes('effects', ['힘', '카드 비용 감소'], {힘: 18});
    assert.match(markup, /dictionary-icons\/icons_buff_021.png/);
    assert.doesNotMatch(markup, /<svg/);
    assert.match(markup, /aria-hidden="true"/);
    assert.match(markup, /aria-label="18개"/);
    assert.match(markup, /value="힘"/);
    const grades = context.buildFilterCheckboxes('dictionary-grade-filter', ['SSR', 'SR', 'R']);
    assert.doesNotMatch(grades, /dictionary-filter-icon|<img|<svg/);
    assert.match(context.buildFilterCheckboxes('dictionary-main-filter', ['광기 회복']), /ui_battle_white_buff_003.png/);
    const options = [...new Set(keys.flatMap(key => Array.from(meta(key).effectFilters)))];
    for (const effect of options) {
        const icon = context.renderDictionaryFilterIcon(effect);
        const imagePath = icon.match(/src="([^"]+)"/)?.[1];
        if (imagePath) assert.ok(fs.existsSync(path.join(root, imagePath)), imagePath);
    }
});

test('필터 아이콘은 클라이언트 원본 크기를 유지하고 속성별 실제 스프라이트를 쓴다', () => {
    const manifest = JSON.parse(fs.readFileSync(path.join(root, 'images/dictionary-icons/manifest.json'), 'utf8'));
    for (const [effect, sprite] of Object.entries({
        '은열쇠 에너지 회복': 'battle_card_buff_035.png',
        '영역 숙련': 'ui_battle_white_buff_002.png',
        '피해 증폭': 'ui_battle_white_buff_004.png',
        '크리티컬 확률 증가': 'ui_battle_white_buff_008.png',
        '크리티컬 피해 증가': 'ui_battle_white_buff_007.png',
        '광기': 'battle_card_buff_032.png'
    })) assert.ok(context.renderDictionaryFilterIcon(effect).includes(sprite), effect);
    for (const [filename, asset] of Object.entries(manifest.assets)) {
        const bytes = fs.readFileSync(path.join(root, 'images/dictionary-icons', filename));
        assert.equal(bytes.subarray(1, 4).toString(), 'PNG');
        assert.deepEqual([bytes.readUInt32BE(16), bytes.readUInt32BE(20)], asset.size, filename);
        assert.ok(Math.min(...asset.size) >= 20, filename);
        assert.ok(asset.references.length > 0);
    }
    // An unsupported label must not silently receive a fabricated game symbol.
    assert.doesNotMatch(context.renderDictionaryFilterIcon('알 수 없는 효과'), /<img|<svg/);
});

test('은열쇠 효과 그룹은 모든 필터를 한 번씩 표시하고 힘을 먼저 배치한다', () => {
    const metadata = new Map(keys.map(key => [key, meta(key)]));
    const effects = [...new Set([...metadata.values()].flatMap(item => Array.from(item.effectFilters)))];
    const markup = context.renderSilverKeyEffectFilters(effects, {}, metadata);
    const rendered = [...markup.matchAll(/name="dictionary-effect-filter" value="([^"]+)"/g)].map(match => match[1]);
    assert.deepEqual(rendered.toSorted(), effects.toSorted());
    assert.equal(rendered[0], '힘');
    assert.match(markup, /class="dictionary-filter-section-title">관련 상태<\/span>/);
    assert.match(markup, /조건부·파생 카드 효과/);
});

// Reviewed against the 56 entries recorded in docs/silverkey-filter-audit.md.
const auditedTags = {
  "key_injection": [
    "방어막 획득",
    "HP 회복"
  ],
  "key_mouse_wisdom": [
    "산출력 획득"
  ],
  "key_pure_white": [
    "드로우",
    "카드 버리기"
  ],
  "key_unfair_exchange": [
    "드로우"
  ],
  "key_funeral": [
    "광기 획득",
    "희생"
  ],
  "key_eternal_obsession": [
    "힘 획득"
  ],
  "key_voice": [
    "허약",
    "취약",
    "힘 탈취"
  ],
  "key_tiny_wish": [
    "광기 획득"
  ],
  "key_aureta": [
    "드로우",
    "촉수 피해 증가"
  ],
  "key_blood": [
    "힘 획득",
    "광기 획득",
    "HP 감소",
    "배아 융합"
  ],
  "key_last_pledge": [
    "크리티컬 확률 증가",
    "힘 획득",
    "방어막 획득",
    "죽음 저항"
  ],
  "key_moment": [
    "카드 추가",
    "힘 획득",
    "경계",
    "산출력 획득",
    "소모",
    "허무"
  ],
  "key_born": [
    "방어막 획득",
    "촉수 생성",
    "산출력 획득"
  ],
  "key_lakeside": [
    "중독 부여",
    "방어막 획득",
    "중독 발동"
  ],
  "key_return": [
    "카드 회수",
    "카드 비용 감소"
  ],
  "key_rotten_party": [
    "초차원 턴",
    "힘 감소",
    "반격 획득",
    "반격 발동"
  ],
  "key_miracle": [
    "힘 획득",
    "방어막 획득",
    "핏빛 용광로"
  ],
  "key_giant": [
    "힘 획득",
    "광기 획득",
    "크리티컬 확률 증가",
    "크리티컬 피해 증가",
    "산출력 획득"
  ],
  "key_all_of_her": [
    "영역 숙련",
    "광기 획득"
  ],
  "key_rose": [
    "힘 획득",
    "드로우",
    "HP 감소"
  ],
  "key_grey_fog": [
    "힘 획득",
    "카드 추가",
    "초차원 턴"
  ],
  "key_summer_dream": [
    "드로우",
    "카드 비용 감소",
    "광기 획득",
    "카드 버리기"
  ],
  "key_spring": [
    "HP 회복",
    "힘 획득",
    "광기 획득",
    "크리티컬 확률 증가"
  ],
  "key_black_swan": [
    "크리티컬 확률 증가",
    "크리티컬 피해 증가",
    "광기 획득",
    "카드 추가",
    "소모"
  ],
  "key_sea": [
    "드로우",
    "중독 부여",
    "산출력 획득",
    "광기 감소"
  ],
  "key_gun_sound": [
    "카드 추가",
    "크리티컬 확률 증가"
  ],
  "key_mt_blessing": [
    "드로우"
  ],
  "key_seed": [
    "카드 추가",
    "광기 획득",
    "소모"
  ],
  "key_open_door": [
    "은열쇠 에너지 회복",
    "발견"
  ],
  "key_4th_music": [
    "드로우",
    "카드 추가",
    "산출력 획득"
  ],
  "key_void": [
    "광기 획득",
    "중독 부여",
    "중독 발동"
  ],
  "key_star_protect": [
    "방어막 획득",
    "광기 획득",
    "촉수 생성",
    "산출력 획득"
  ],
  "key_door_of_beer": [
    "카드 추가",
    "산출력 획득",
    "드로우",
    "소모",
    "유지"
  ],
  "key_special": [
    "HP 회복",
    "힘 획득",
    "방어막 획득",
    "광기 획득",
    "은열쇠 에너지 회복",
    "효과 추가 적용"
  ],
  "key_lightning": [
    "방어막 획득",
    "드로우",
    "카드 추가"
  ],
  "key_twisted_fate": [
    "광기 획득",
    "드로우",
    "피해 증폭"
  ],
  "key_hungry": [
    "카드 추가",
    "카드 비용 감소",
    "발견"
  ],
  "key_never_falling_sun": [
    "산출력 획득",
    "피해 증폭",
    "드로우",
    "활염"
  ],
  "key_keirei": [
    "힘 탈취",
    "잔해"
  ],
  "key_summer_time": [
    "카드 추가",
    "크리티컬 확률 증가"
  ],
  "key_paint": [
    "광기 획득",
    "카드 추가",
    "창의"
  ],
  "key_bloodtear": [
    "드로우",
    "카드 비용 감소",
    "크리티컬 피해 증가",
    "죄의 낙인"
  ],
  "key_dream_moment": [
    "방어막 획득",
    "힘 획득"
  ],
  "key_ship": [
    "강생 의식",
    "드로우",
    "산출력 획득"
  ],
  "key_wish_again": [
    "카드 회수",
    "효과 추가 적용"
  ],
  "key_from_fog": [
    "드로우",
    "카드 비용 감소"
  ],
  "key_arachne": [
    "방어막 획득",
    "피해 증폭",
    "드로우",
    "카드 비용 감소"
  ],
  "key_homegirl_story": [
    "힘 감소",
    "산출력 획득",
    "도취"
  ],
  "key_fireworks": [
    "크리티컬 확률 증가",
    "산출력 획득",
    "옛날 잔재"
  ],
  "key_saya": [
    "방어막 획득",
    "드로우",
    "인지 착란",
    "우종"
  ],
  "key_mosk": [
    "광기 획득",
    "추격"
  ],
  "key_pontos": [
    "크리티컬 피해 증가",
    "힘 감소",
    "사냥"
  ],
  "key_lotan_cetarchon": [
    "힘 획득",
    "광기 탈취",
    "효과 추가 적용"
  ],
  "key_caraboo": [
    "방어막 획득",
    "영역 숙련",
    "대가 무효"
  ],
  "key_GOgier": [
    "방어막 획득",
    "힘 획득",
    "광기 획득",
    "암류"
  ],
  "key_vivian": [
    "HP 회복",
    "광기 획득",
    "카운트다운 감소"
  ]
};
test('56개 은열쇠의 점검된 효과 태그를 빠짐없이 유지한다', () => {
    assert.equal(keys.length, 56);
    assert.deepEqual(keys.map(key => key.english_name).sort(), Object.keys(auditedTags).sort());
    for (const key of keys) {
        assert.deepEqual(key.tags, auditedTags[key.english_name], key.korean_name);
        assert.equal(new Set(key.tags).size, key.tags.length, key.korean_name);
        const filters = meta(key).effectFilters;
        assert.equal(new Set(filters).size, filters.length);
        assert.ok(filters.every(value => !value.startsWith('임시 ')));
    }
});
