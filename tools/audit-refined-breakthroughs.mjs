import fs from 'node:fs';

const data = JSON.parse(fs.readFileSync(new URL('../data/character_effects.json', import.meta.url), 'utf8'));
const ids = Object.keys(data);
const remaining = ids.slice(ids.indexOf('caecus'));
const issues = [];
const duplicates = [];
const unresolved = [];

const source = fs.readFileSync(new URL('../js/character-effects.js', import.meta.url), 'utf8');
const window = {};
new Function('window', source)(window);
const api = window.CharacterEffects;

for (const id of remaining) {
  const character = data[id];
  const byStageText = new Map();
  for (const item of [...(character.skills || []), ...(character.derivedCards || [])]) {
    for (const variant of item.breakthroughs || []) {
      const append = variant.append || '';
      const patterns = [];
      if (append.includes("'")) patterns.push('작은따옴표');
      if (/타격과 방어|타격['」｣"]?\s*(?:및|과)\s*['「｢"]?방어/.test(append)) patterns.push('복합카드명');
      if (/\s+(?:이|가|을|를|은|는|과|와)(?=[\s.,]|$)/.test(append)) patterns.push('조사띄어쓰기');
      if (/합니다|됩니다|습니다/.test(append)) patterns.push('존댓말');
      if (item.name.length > 2 && append.includes(item.name)) patterns.push('자기카드명');
      if (patterns.length) issues.push({ id, card: item.name, stage: variant.stage, patterns, append });
      const displayed = api.getBreakthroughVariant(item, variant.stage);
      const level = displayed.levels?.at(-1)?.level;
      const rendered = api.interpolateEffect(displayed.effect, displayed.levels, level);
      if (/(?:^|[^가-힣A-Za-z])(?:n|l|m)(?:%|[^가-힣A-Za-z]|$)/.test(rendered)) {
        unresolved.push({ id, card: item.name, stage: variant.stage, rendered });
      }

      const key = `${variant.stage}\0${append}`;
      const same = byStageText.get(key) || [];
      same.push(item.name);
      byStageText.set(key, same);
    }
  }
  for (const [key, cards] of byStageText) {
    if (cards.length > 1) duplicates.push({ id, stage: Number(key.split('\0')[0]), cards, append: key.split('\0')[1] });
  }
}

console.log(JSON.stringify({ issueCount: issues.length, issues, unresolvedCount: unresolved.length, unresolved, duplicateCount: duplicates.length, duplicates }, null, 2));
