const fs = require('fs');
const path = require('path');
const cp = require('child_process');

const root = process.cwd();
const cacheDir = path.join(root, '.codex', 'tmp', 'namu-traits-cache');
fs.mkdirSync(cacheDir, { recursive: true });

const manifest = JSON.parse(fs.readFileSync('data/character_manifest.json', 'utf8'));
const effects = JSON.parse(fs.readFileSync('data/character_effects.json', 'utf8'));

const aliasesById = {
  '24': ['24', '「24」'],
  alva: ['앨바', '엘바'],
  goliath: ['골리앗', '골리아'],
  aurita: ['오리타', '오레타'],
  leigh: ['레아', '레이아'],
  faint: ['페인트', '파인트'],
  horla: ['오를라', '오를라'],
  winkle: ['웬코르', '윈클'],
  tinct: ['틴크트', '틴커트'],
  doll_inferno: ['융해 · 돌', '융해·돌'],
  helot_catena: ['혈쇄 · 히로', '혈쇄·히로'],
  Murphy_Fauxborn: ['탄망 · 머피', '탄망·머피'],
  ramona_timeworn: ['회귀 · 라모나', '회귀·라모나', '환행 · 라모나', '환행·라모나'],
  coporsant: ['코퍼산트', '코포상트'],
  'kathigu-ra': ['카티구라', '카티구-라'],
  caecus: ['카이커스', '카이쿠스'],
  mouchette: ['모샤', '무셰트'],
  vortice: ['모스', '모스크'],
  doresain: ['도어세인', '도레세인'],
  uvhash: ['유우하시', '우브하시']
};

function decodeHtml(text) {
  return text
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCharCode(parseInt(code, 16)))
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function htmlToText(html) {
  return decodeHtml(html)
    .replace(/<br[^>]*>/gi, '\n')
    .replace(/<\/tr>/gi, '\n')
    .replace(/<\/td>/gi, ' | ')
    .replace(/<\/th>/gi, ' | ')
    .replace(/<[^>]+>/g, '')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n[ \t]+/g, '\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
}

function urlForTitle(title) {
  return `https://namu.wiki/w/${encodeURIComponent(title)}`;
}

function fetchUrl(url, cacheKey) {
  const cachePath = path.join(cacheDir, `${cacheKey}.html`);
  if (fs.existsSync(cachePath)) {
    const cached = fs.readFileSync(cachePath, 'utf8');
    if (!cached.includes('\uFFFD') && cached.includes('나무위키')) return cached;
  }
  if (process.env.NAMU_OFFLINE === '1') {
    throw new Error(`No cached page for ${cacheKey}`);
  }

  cp.execFileSync('curl.exe', [
    '--location',
    '--fail',
    '--silent',
    '--show-error',
    '--output',
    cachePath,
    url
  ], {
    maxBuffer: 20 * 1024 * 1024
  });
  return fs.readFileSync(cachePath, 'utf8');
}

function parseCategoryLinks() {
  let html = '';
  const localIndexPath = path.join(root, '.codex', 'tmp', 'namu-awakeners.html');
  if (fs.existsSync(localIndexPath)) {
    html = fs.readFileSync(localIndexPath, 'utf8');
  } else {
    try {
      html = fetchUrl('https://namu.wiki/w/%EB%AA%A8%EB%A6%AC%EB%A9%98%EC%8A%A4/%EA%B0%81%EC%84%B1%EC%B2%B4', 'awakeners-index');
    } catch {
      return new Map();
    }
  }

  const links = new Map();
  const re = /<a[^>]+href=['"]([^'"]+)['"][^>]*title=['"]([^'"]+)['"][^>]*>/g;
  let match;
  while ((match = re.exec(html))) {
    if (!match[1].startsWith('/w/')) continue;
    const title = decodeHtml(match[2]);
    const url = `https://namu.wiki${match[1]}`;
    links.set(title, url);
    links.set(title.replace(/\(모리멘스\)$/, ''), url);
  }
  return links;
}

function extractTraitSegment(html) {
  const marker = /<span id=['"]특성['"][^>]*>특성/.exec(html);
  if (!marker) return null;

  const headingStart = html.lastIndexOf('<h', marker.index);
  const start = headingStart >= 0 ? headingStart : marker.index;
  const rest = html.slice(marker.index + marker[0].length);
  const next = /<h[23][^>]*class=/.exec(rest);
  const end = next ? marker.index + marker[0].length + next.index : Math.min(html.length, start + 20000);
  return html.slice(start, end);
}

function cleanNameAndLevel(rawName) {
  let token = decodeHtml(rawName)
    .replace(/^\d+(?:\.\d+)*\.\s*특성(?:\[편집\])?\s*/u, '')
    .replace(/^특성(?:\[편집\])?\s*/u, '')
    .trim();
  token = token.replace(/\s+/g, ' ');
  const levelMatch = /(Lv\.\s*\d+\s*~\s*\d+)/.exec(token);
  const levelRange = levelMatch ? levelMatch[1].replace(/\s+/g, ' ') : undefined;
  const name = token.replace(/Lv\.\s*\d+\s*~\s*\d+/, '').trim();
  return { name, levelRange };
}

function cleanEffect(rawEffect) {
  return decodeHtml(rawEffect)
    .replace(/\[\s*고정피해\s*\]/g, '[고정피해]')
    .replace(/\[\s*촉수피해\s*\]/g, '[촉수피해]')
    .replace(/'회명 · 심해'/g, "'[회명 · 심해]'")
    .replace(/`n/g, '\n')
    .replace(/\s*\n\s*/g, '\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
}

function parseTraits(segmentHtml) {
  const text = htmlToText(segmentHtml);
  const rawParts = text.split('|').map((part) => part.trim()).filter(Boolean);
  if (rawParts.length < 2) return [];

  const parts = [...rawParts];
  parts[0] = parts[0].replace(/^.*특성\[편집\]/, '').trim();

  const traits = [];
  for (let i = 0; i + 1 < parts.length; i += 2) {
    const { name, levelRange } = cleanNameAndLevel(parts[i]);
    const effect = cleanEffect(parts[i + 1]);
    if (!name || !effect || /^4\./.test(name) || /^5\./.test(name)) continue;
    const trait = { name, effect };
    if (levelRange) trait.level_range = levelRange;
    traits.push(trait);
  }

  return traits;
}

function candidatesFor(character, categoryLinks) {
  const names = [
    ...(aliasesById[character.id] || []),
    character.name,
    character.name.replace(/[「」]/g, ''),
    character.name.replace(/\s*·\s*/g, ' · '),
    character.name.replace(/\s*·\s*/g, '·')
  ].filter(Boolean);

  const seen = new Set();
  return names
    .filter((name) => {
      if (seen.has(name)) return false;
      seen.add(name);
      return true;
    })
    .map((name) => ({
      name,
      url: categoryLinks.get(name) || urlForTitle(name)
    }));
}

const categoryLinks = parseCategoryLinks();
const report = {
  updated: [],
  missingPage: [],
  missingTraits: [],
  errors: []
};

for (const character of manifest) {
  if (effects[character.id]?.traits?.length && process.env.NAMU_FORCE !== '1') {
    continue;
  }

  const candidates = candidatesFor(character, categoryLinks);
  let found = null;
  let lastError = null;

  for (let candidateIndex = 0; candidateIndex < candidates.length; candidateIndex += 1) {
    const candidate = candidates[candidateIndex];
    try {
      const html = fetchUrl(candidate.url, `${character.id}-${candidateIndex}`);
      if (!html.includes(`${candidate.name}(모리멘스)`) && !html.includes('특성')) {
        continue;
      }
      found = { candidate, html };
      break;
    } catch (error) {
      lastError = error;
    }
  }

  if (!found) {
    report.missingPage.push({ id: character.id, name: character.name, error: lastError ? lastError.message : '' });
    continue;
  }

  const segment = extractTraitSegment(found.html);
  if (!segment) {
    report.missingTraits.push({ id: character.id, name: character.name, page: found.candidate.name });
    continue;
  }

  const traits = parseTraits(segment);
  if (!traits.length) {
    report.missingTraits.push({ id: character.id, name: character.name, page: found.candidate.name });
    continue;
  }

  if (!effects[character.id]) effects[character.id] = { skills: [], breakthroughs: [] };
  effects[character.id].traits = traits;
  report.updated.push({ id: character.id, name: character.name, page: found.candidate.name, traits: traits.map((trait) => trait.name) });
}

fs.writeFileSync('data/character_effects.json', `${JSON.stringify(effects, null, 2)}\n`);
fs.writeFileSync(path.join('tools', 'traits-report.json'), `${JSON.stringify(report, null, 2)}\n`);

console.log(JSON.stringify(report, null, 2));
