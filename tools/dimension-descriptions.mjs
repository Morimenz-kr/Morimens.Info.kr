import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const researchNames = {
  PlayerGrowth: '물상 연구 깊이',
  InsightResearchDepth: '영식 연구 깊이',
  'GetAccountStageGrow()': '기본 물상 연구 깊이'
};

export function describeResearchParameter(value) {
  if (Number.isFinite(Number(value)) && String(value).trim() !== '') return String(value);
  const source = String(value).replace(/\s+/g, '');
  const expression = source.startsWith('math.ceil(') && source.endsWith(')')
    ? source.slice(10, -1) : source;
  const match = expression.match(/^(PlayerGrowth|InsightResearchDepth|GetAccountStageGrow\(\))\*(\d+(?:\.\d+)?)$/);
  if (!match) throw new Error(`지원하지 않는 차원영상 수식: ${value}`);
  const percent = Number((Number(match[2]) * 100).toFixed(8));
  return `${researchNames[match[1]]}의 ${percent}%`;
}

export function dimensionDescription(row, sourceRelic = {}) {
  const parameters = { ...row.parameters };
  // KR RelicConfig 71263 references Arg2 absent from StatePara. The source
  // RelicConfig description supplies the endurance-cap percentage explicitly.
  if (Number(row.clientRelicId) === 71263 && parameters[2] === undefined) {
    const cap = String(sourceRelic.Desc || '').match(/忍耐上限提高\s*(\d+(?:\.\d+)?)%/);
    if (cap) parameters[2] = Number(cap[1]);
  }
  let text = String(row.rawEffect || '').replace(/\[(?:State|Desc)?Arg(\d+)\]/g, (token, key) => {
    if (parameters[key] === undefined) throw new Error(`차원영상 ${row.clientRelicId}: ${token} 누락`);
    return describeResearchParameter(parameters[key]);
  });
  const percent = '((?:기본 )?(?:물상|영식) 연구 깊이의 \\d+(?:\\.\\d+)?%)';
  text = text
    .replace(/예비\s+(\d+)/g, '예비$1')
    .replace(new RegExp(`${percent}\\s*(?:pt|점)(?:의)?\\s*(?=(?:임시 )?(?:힘|방어막|실드))`, 'g'), '$1에 해당하는 ')
    .replace(new RegExp(`${percent}\\s*(?:pt|점)(?:의)?\\s*`, 'g'), '$1만큼 ')
    .replace(new RegExp(`${percent}\\s+(?=(?:임시 )?힘)`, 'g'), '$1에 해당하는 ')
    .replace(new RegExp(`${percent}\\s+(?=회복)`, 'g'), '$1만큼 ');
  if (/math\.|PlayerGrowth|ResearchDepth|GetAccountStageGrow|\[(?:State|Desc)?Arg\d+\]/.test(text)) {
    throw new Error(`차원영상 ${row.clientRelicId}: 미해결 설명`);
  }
  return text;
}

export function refreshDimensionDescriptions(root, sourceRoot) {
  const read = file => JSON.parse(fs.readFileSync(file, 'utf8'));
  const relics = read(path.join(sourceRoot, 'Config.RelicConfig.json')).data;
  const rows = read(path.join(root, 'data/dimension_image_list.json'));
  const effects = read(path.join(root, 'data/character_effects.json'));
  const changed = [];
  for (const row of rows) {
    const relic = relics[row.clientRelicId];
    if (!relic) throw new Error(`원본 유물 ${row.clientRelicId} 누락`);
    if (JSON.stringify(relic.StatePara || {}) !== JSON.stringify(row.parameters || {})) {
      throw new Error(`차원영상 ${row.clientRelicId}: 원본 파라미터와 불일치`);
    }
    const effect = dimensionDescription(row, relic);
    if (row.effect !== effect) changed.push({ character: row.characterName, effect });
    row.effect = effect;
    const linked = effects[row.characterId]?.dimensionalImage;
    if (linked) {
      if (linked.clientRelicId !== row.clientRelicId) throw new Error(`차원영상 연결 불일치: ${row.characterId}`);
      linked.effect = effect;
    }
  }
  // Preserve raw text, parameters, and every unrelated character field.
  for (const [file, value] of [['dimension_image_list', rows], ['character_effects', effects]]) {
    fs.writeFileSync(path.join(root, `data/${file}.json`), `${JSON.stringify(value, null, 2)}\n`);
  }
  return { checked: rows.length, changed };
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const sourceRoot = process.argv[process.argv.indexOf('--static') + 1];
  if (!process.argv.includes('--static')) throw new Error('사용법: node tools/dimension-descriptions.mjs --static <추출 테이블 폴더>');
  console.log(JSON.stringify(refreshDimensionDescriptions(process.cwd(), sourceRoot), null, 2));
}
