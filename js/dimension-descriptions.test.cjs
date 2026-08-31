const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.join(__dirname, '..');
const read = name => JSON.parse(fs.readFileSync(path.join(root, 'data', name), 'utf8'));

test('산 차원영상은 예비1로 붙여 쓰며 원문은 보존한다', async () => {
  const { dimensionDescription } = await import('../tools/dimension-descriptions.mjs');
  const row = read('dimension_image_list.json').find(row => row.characterId === 'sanga');
  assert.match(row.rawEffect, /예비 1/);
  assert.match(dimensionDescription(row), /보존, 예비1,/);
  assert.match(read('character_effects.json').sanga.dimensionalImage.effect, /보존, 예비1,/);
});

test('차원영상 수식은 연구 깊이 종류와 정확한 백분율로 변환한다', async () => {
  const { describeResearchParameter } = await import('../tools/dimension-descriptions.mjs');
  assert.equal(describeResearchParameter('math.ceil(PlayerGrowth*0.03)'), '물상 연구 깊이의 3%');
  assert.equal(describeResearchParameter('math.ceil(PlayerGrowth*0.0125)'), '물상 연구 깊이의 1.25%');
  assert.equal(describeResearchParameter('InsightResearchDepth*0.06'), '영식 연구 깊이의 6%');
  assert.equal(describeResearchParameter('GetAccountStageGrow()*0.1'), '기본 물상 연구 깊이의 10%');
  assert.throws(() => describeResearchParameter('PlayerGrowth*0.03*UnknownBuff'), /지원하지 않는/);
});

test('연구 깊이 백분율에 pt나 점 단위를 중복하지 않는다', async () => {
  const { dimensionDescription } = await import('../tools/dimension-descriptions.mjs');
  const row = { clientRelicId: 1, parameters: { 1: 'math.ceil(PlayerGrowth*0.03)' } };
  for (const [rawEffect, expected] of [
    ['[Arg1] 점 방어막을 부여합니다.', '물상 연구 깊이의 3%에 해당하는 방어막을 부여합니다.'],
    ['[Arg1] pt의 임시 힘을 얻습니다.', '물상 연구 깊이의 3%에 해당하는 임시 힘을 얻습니다.'],
    ['HP를 [Arg1] 회복합니다.', 'HP를 물상 연구 깊이의 3%만큼 회복합니다.'],
    ['힘을 [Arg1]pt 획득한다.', '힘을 물상 연구 깊이의 3%만큼 획득한다.']
  ]) assert.equal(dimensionDescription({ ...row, rawEffect }), expected);
  assert.throws(() => dimensionDescription({ ...row, rawEffect: '[Arg2]' }), /누락/);
});

test('릴리 번역에 누락된 인내 상한은 원본 유물 설명에서만 복원한다', async () => {
  const { dimensionDescription } = await import('../tools/dimension-descriptions.mjs');
  const row = { clientRelicId: 71263, parameters: { 1: 15 }, rawEffect: '인내 상한이 [Arg2]% 증가합니다.' };
  assert.equal(dimensionDescription(row, { Desc: '忍耐上限提高 100%' }), '인내 상한이 100% 증가합니다.');
  assert.throws(() => dimensionDescription(row), /누락/);
  assert.deepEqual(row.parameters, { 1: 15 });
});

test('전체 차원영상과 캐릭터 상세 설명에는 내부 수식이나 Arg 토큰이 없다', () => {
  const rows = read('dimension_image_list.json');
  const effects = read('character_effects.json');
  for (const row of rows) {
    assert.doesNotMatch(row.effect, /math\.|PlayerGrowth|ResearchDepth|\[Arg\d+\]/, row.characterName);
    assert.doesNotMatch(row.effect, /연구 깊이의 [\d.]+%\s*(?:pt|점)/, row.characterName);
    if (effects[row.characterId]?.dimensionalImage) assert.equal(effects[row.characterId].dimensionalImage.effect, row.effect);
  }
  const expected = { sanga: 3, celeste: 2, casiah: 3, aigis: 1.25, thais: 12, leigh: 1, castor: 7.5, doresain: 2 };
  for (const [id, percent] of Object.entries(expected)) {
    const row = rows.find(row => row.characterId === id);
    assert.ok(row.effect.includes(`물상 연구 깊이의 ${percent}%`), id);
    assert.ok(Object.values(row.parameters).some(value => String(value).includes('PlayerGrowth')), '원본 수식 보존');
  }
});
