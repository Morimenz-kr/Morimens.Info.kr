const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { create } = require('./character-identity.js');
const read = name => JSON.parse(fs.readFileSync(path.join(__dirname, '../data', name + '.json'), 'utf8'));
const manifest = read('character_manifest');

test('전체 전용 장비는 표시명과 무관한 기존 ID를 유지한다', () => {
    const renamed = manifest.map(character => ({ ...character, name: `검증이름_${character.id}` }));
    const identity = create(renamed);
    for (const file of ['wheel_list', 'silverkey_list']) for (const original of read(file)) {
        const item = structuredClone(original);
        identity.hydrate(item);
        assert.equal(item.english_name, original.english_name);
        for (const id of item.owner_character_ids) assert.ok(identity.isOwner(item, id));
        for (const id of item.recommended_character_ids || []) assert.ok(item.optimized_for.includes(identity.name(id)));
        for (const id of item.related_character_ids || []) assert.ok(item.tags.includes(identity.name(id)));
    }
});
test('이름과 예전 표기는 설명에 반영하고 원문 보관 필드는 유지한다', () => {
    const renamed = manifest.map(character => ({ ...character, name: character.id === 'alva' ? '새 이름' : character.name }));
    const identity = create(renamed);
    const record = { description: '앨바가 혈육 적을 공격한다. 엘바의 방어막.', rawEffect: '앨바가 공격한다.', source: { title: '앨바 공략' } };
    identity.hydrate(record);
    assert.equal(record.description, '새 이름가 혈육 적을 공격한다. 새 이름의 방어막.');
    assert.equal(record.rawEffect, '앨바가 공격한다.');
    assert.equal(record.source.title, '앨바 공략');
    assert.equal(identity.resolveId('앨바'), 'alva');
    assert.equal(identity.resolveId('페인트'), 'faint');
    assert.equal(identity.resolveId('레아'), 'leigh');
});
test('한 글자 이름은 일반 단어와 기본·변형 각성체를 오염시키지 않는다', () => {
    const renamed = manifest.map(character => ({ ...character, name: ['xu', 'doll', 'sanga', 'ramona'].includes(character.id) ? `새이름_${character.id}` : character.name }));
    const identity = create(renamed);
    assert.equal(identity.format('산출력 돌파 서포터 융해 · 돌 회귀 · 라모나'), '산출력 돌파 서포터 융해 · 돌 회귀 · 라모나');
    assert.equal(identity.format('융해돌 회귀 라모나'), '융해 · 돌 회귀 · 라모나');
    assert.equal(identity.format('서의 광기와 「돌」, 산이 회복한다.'), '새이름_xu의 광기와 「새이름_doll」, 새이름_sanga이 회복한다.');
    assert.equal(identity.format('{character:xu}'), '새이름_xu');
});
test('읽기 전용 툴팁 정의는 원본을 보존하고 표시용 복사본만 갱신한다', () => {
    const identity = create(manifest.map(character => ({ ...character, name: character.id === 'alva' ? '새이름' : character.name })));
    const original = Object.freeze({ name: '앨바', description: '앨바의 방어막', rawEffect: '앨바의 방어막' });
    const tooltips = { effect: original };
    identity.hydrate(tooltips, true);
    assert.equal(tooltips.effect.description, '새이름의 방어막');
    assert.equal(tooltips.effect.rawEffect, original.rawEffect);
    assert.equal(original.description, '앨바의 방어막');
});
test('수동 표시명 변경 뒤 재생성된 구 이름과 잘못된 ID를 검사한다', async () => {
    const { validateIdentityData } = await import('../tools/validate-character-identity.mjs');
    assert.deepEqual(validateIdentityData(manifest, { wheels: read('wheel_list'), keys: read('silverkey_list') }), []);
    const diagnostics = validateIdentityData(manifest, { bad: [{ english_name: 'test', owner_character_ids: ['missing'], optimized_for: ['앨바'] }] });
    assert.ok(diagnostics.some(line => line.includes('missing')));
    assert.ok(diagnostics.some(line => line.includes('이전 이름 관계')));
});
test('모든 전용 SSR·SR·은열쇠 버튼은 임의 표시명 변경 후에도 같은 장비를 저장한다', () => {
    const source = fs.readFileSync(path.join(__dirname, 'party_builder.js'), 'utf8');
    const characters = manifest.map(character => ({ ...character, name: `검증_${character.id}` }));
    const wheels = read('wheel_list'), keys = read('silverkey_list');
    let checked = 0;
    for (const character of characters) {
        const team = { chars: [character.id], wheels: [[null, null]], key: null };
        let saved = 0;
        const context = vm.createContext({ DB: { chars: characters, wheels, keys }, allPages: [{ teams: [team] }], currentPageIdx: 0, currentTeamIdx: 0, editingCharIdx: 0, selectedWheelSlotIdx: 0,
            openSystemAlert() {}, renderAll() {}, renderWheelModalUI() {}, closeModal() {}, saveAllData() { saved++; } });
        vm.runInContext(source.slice(source.indexOf('function equipDedicatedWheel(')), context);
        vm.runInContext(source.slice(source.indexOf('function equipDedicatedKey('), source.indexOf('function setupKeySearchEvents(')), context);
        for (const [slot, grade] of ['SSR', 'SR'].entries()) {
            const expected = wheels.find(item => item.grade === grade && item.owner_character_ids.includes(character.id));
            context.equipDedicatedWheel(grade);
            assert.equal(team.wheels[0][slot], expected?.english_name || null, `${character.id} ${grade}`);
            if (expected) { checked++; }
        }
        const expected = keys.find(item => item.owner_character_ids.includes(character.id));
        context.equipDedicatedKey();
        assert.equal(team.key, expected?.english_name || null, character.id);
        const equipped = team.wheels[0].filter(Boolean).length + Number(Boolean(team.key));
        assert.equal(saved, equipped);
    }
    assert.ok(checked > 70);
});
test('융재 편성 기록은 원문의 이름·이미지와 무관하게 클라이언트 ID로 표시한다', () => {
    const source = fs.readFileSync(path.join(__dirname, 'dzone-info.js'), 'utf8');
    const renamed = manifest.map(character => ({ ...character, name: character.id === 'alva' ? '새 이름' : character.name }));
    const context = vm.createContext({ usageCharacterManifest: renamed, safeImage: value => value || '', escapeHtml: String, encodeURIComponent });
    vm.runInContext(source.slice(source.indexOf('    function usageAwakener('), source.indexOf('    function loadDzoneUsageOverview(')), context);
    const alva = renamed.find(character => character.id === 'alva');
    const html = context.usageAwakener({ tid: alva.client_id, name: '알 수 없는 원문명', image_thumb: 'images/obsolete.png' });
    assert.ok(html.includes('새 이름'));
    assert.ok(html.includes(alva.image_thumb));
    assert.ok(html.includes('id=alva'));
    assert.ok(!html.includes('알 수 없는 원문명'));
});
