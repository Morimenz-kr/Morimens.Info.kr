const test = require('node:test');
const assert = require('node:assert/strict');
const { create } = require('./summon-classification.js');
const groups = require('../data/gachatype.json');
const characters = require('../data/character_manifest.json');
const wheels = require('../data/wheel_list.json');
const classification = create(groups);

test('#236 모든 각성체와 SSR 명륜의 전용 각성체를 안정 ID로 분류한다', () => {
    for (const character of characters) {
        assert.ok(['상시 SSR', '한정 SSR', 'SR'].includes(classification.characterGrade(character)), character.id);
    }
    for (const wheel of wheels.filter(item => item.grade === 'SSR')) {
        for (const id of wheel.owner_character_ids || []) {
            assert.ok(characters.some(character => character.id === id), `${wheel.english_name}: ${id}`);
            assert.ok(classification.characterGrade(characters.find(character => character.id === id)), id);
        }
        assert.ok(['상시 SSR', '한정 SSR'].includes(classification.wheelGrade(wheel)), wheel.english_name);
    }
});

test('#236 상시 편입 여부 대신 최초 출시 분류를 유지하고 SR을 SSR에 포함하지 않는다', () => {
    assert.equal(classification.characterGrade(characters.find(item => item.id === 'tulu')), '한정 SSR');
    assert.equal(classification.characterGrade(characters.find(item => item.id === 'vivian')), '한정 SSR');
    assert.equal(classification.characterGrade(characters.find(item => item.id === 'faros')), '상시 SSR');
    assert.equal(classification.wheelGrade(wheels.find(item => item.english_name === 'wheel_hymn_of_godking')), '한정 SSR');
    assert.equal(classification.wheelGrade(wheels.find(item => item.english_name === 'wheel_in_the_hard_rain')), '상시 SSR');
    for (const wheel of wheels.filter(item => item.grade === 'SR')) assert.equal(classification.wheelGrade(wheel), 'SR');
    for (const character of characters.filter(item => item.grade === 'sr')) assert.equal(classification.characterGrade(character), 'SR');
});

test('상시·한정 분류는 등급과 별개로 SR에도 적용한다', () => {
    for (const character of characters) assert.ok(['standard', 'limited'].includes(classification.characterAvailability(character)), character.id);
    for (const character of characters.filter(item => item.grade === 'sr')) assert.equal(classification.characterAvailability(character), 'standard');
    assert.equal(classification.characterAvailability(characters.find(item => item.id === 'tulu')), 'limited');
});
