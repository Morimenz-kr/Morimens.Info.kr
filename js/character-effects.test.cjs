const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

function loadClassifier() {
    const source = fs.readFileSync(path.join(__dirname, 'character-effects.js'), 'utf8')
        .replace(
            'window.CharacterEffects = { render };',
            'window.CharacterEffects = { render, classifyCharacterEffects };'
        );
    const window = {};
    new Function('window', source)(window);
    return window.CharacterEffects.classifyCharacterEffects;
}

const classifyCharacterEffects = loadClassifier();

test('초월 폭발은 스킬과 계령 양쪽에서 같은 데이터 객체를 사용한다', () => {
    const normalSkill = { type: '스킬', name: '일반 스킬' };
    const transcendentBurst = { type: '초월 폭발', name: '초월 능력' };
    const finalLaw = { type: '최종 법칙', name: '최종 법칙 능력' };
    const breakthrough = { name: '계령 1' };

    const result = classifyCharacterEffects({
        skills: [normalSkill],
        enlighten: [breakthrough, transcendentBurst, finalLaw]
    });

    assert.deepEqual(result.skills, [normalSkill, transcendentBurst]);
    assert.deepEqual(result.enlighten, [breakthrough]);
    assert.deepEqual(result.enlightenSkills, [transcendentBurst, finalLaw]);
    assert.equal(result.skills[1], result.enlightenSkills[0]);
});

test('최종 법칙은 계령에만 표시한다', () => {
    const finalLaw = { type: '최종 법칙', name: '최종 법칙 능력' };
    const result = classifyCharacterEffects({ skills: [finalLaw] });

    assert.equal(result.skills.length, 0);
    assert.deepEqual(result.enlightenSkills, [finalLaw]);
});
