import fs from 'node:fs';

const dataUrl = new URL('../data/character_effects.json', import.meta.url);
const data = JSON.parse(fs.readFileSync(dataUrl, 'utf8'));
const ids = Object.keys(data);
const remainingIds = new Set(ids.slice(ids.indexOf('sanga')));

const keep = new Set([
  'Murphy_Fauxborn|타격|3',
  'Murphy_Fauxborn|방어|3',
  'faros|광열의 바다|1',
  'vortice|심연! 소용돌이! 대포!|1',
  'vortice|심연! 소용돌이! 대포!|3',
  'doresain|영원한 밤의 향연|3',
  'arachne|운명, 이로써 고하노라|1',
  'horla|광상의 시편|2',
  'horla|애통의 시편|2',
  'horla|환몽의 시편|2',
  'horla|기묘한 시편|2'
]);

let removed = 0;
let preserved = 0;
for (const [id, character] of Object.entries(data)) {
  if (!remainingIds.has(id)) continue;
  for (const item of [...(character.skills || []), ...(character.derivedCards || [])]) {
    if (!item.breakthroughs?.length) continue;
    item.breakthroughs = item.breakthroughs.filter(variant => {
      const approved = keep.has(`${id}|${item.name}|${variant.stage}`);
      if (approved) preserved += 1;
      else removed += 1;
      return approved;
    });
    if (!item.breakthroughs.length) delete item.breakthroughs;
  }
}

fs.writeFileSync(dataUrl, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
console.log(JSON.stringify({ removed, preserved }, null, 2));
