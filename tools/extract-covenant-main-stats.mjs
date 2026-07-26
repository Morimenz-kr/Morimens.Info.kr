import fs from 'node:fs/promises';
import path from 'node:path';

const SOURCES = {
  chaos: {
    articleId: '177290515',
    title: '(장문)모든 각성체 세팅 정리 -혼돈편-',
    url: 'https://arca.live/b/forgettingeve/177290515',
  },
  aequor: {
    articleId: '177935209',
    title: '모든 각성체 세팅 정리(심해편)',
    url: 'https://arca.live/b/forgettingeve/177935209',
  },
};

const STAT_ALIASES = new Map([
  ['은열', '은열쇠 충전'],
  ['영숙', '영역 숙련'],
  ['흑인', '검은 인장 획득'],
  ['뎀증', '피해 증폭'],
  ['피증', '피해 증폭'],
  ['치피', '크리티컬 피해'],
  ['크피', '크리티컬 피해'],
  ['치확', '크리티컬 확률'],
  ['크확', '크리티컬 확률'],
  ['죽저', '죽음 저항'],
  ['광기', '광기 회복'],
]);

const CHARACTER_ALIASES = new Map([
  ['혼돈24', '24'],
  ['심해24', '24'],
  ['혈육24', '24'],
  ['초차원24', '24'],
  ['라모나', 'ramona'],
  ['회귀라모나', 'ramona_timeworn'],
  ['회모나', 'ramona_timeworn'],
  ['융해돌', 'doll_inferno'],
  ['융돌', 'doll_inferno'],
  ['침식로탄', 'lotan_cetarchon'],
  ['침로탄', 'lotan_cetarchon'],
  ['침로롱', 'lotan_cetarchon'],
  ['탄망머피', 'Murphy_Fauxborn'],
  ['탄피', 'Murphy_Fauxborn'],
]);

const COVENANT_ASSET_IDS = new Map([
  ['0798249a916c7bd1fb1204c667ff2a5b8caac3ece6eacf96b42e264aed2d046e.png', 'covenant_April'],
  ['1771f62ccac1a0bc8274a1f1472a71d29c94b1af7e875f7b084882a346440cd6.png', 'covenant_ocean'],
  ['28236e184ab73ee5326e3bb0987cfaeea7f4f942e1ad8b458413c75df0be14b3.png', 'covenant_blood'],
  ['2ab63f7aeb697eaff74b5522ee0158f7f8fffb1ae2e14e242e53ddd750acf5e7.png', 'covenant_scarlet'],
  ['2d34cbf91ed1c26f936a7092b7c5497d18683d64819d6a9048f4e67bc970da1a.png', 'covenant_vampire'],
  ['371ac09b9c1457f0dfc7fc49e3598020814b3e30f2fe885a99dfa7e7bede115d.png', 'covenant_deus'],
  ['41cf74adc355e0dc20fffccd3f6ef9a20214fbe915655dfe39d8ac111cd37d4c.png', 'covenant_party'],
  ['4e4c9004af6f872382d0ad0af0c16deaf287ce5ebb844e108720ccfdc4724065.png', 'covenant_36rings'],
  ['5a8f18df4ebcb126da81080f40c0536d0be5dd9303ca18dcc29e15e27ead34f6.png', 'covenant_virgin'],
  ['86e7601d153601eab6d317f05be74eeacf187d3a387524865b40f88251018346.png', 'covenant_reEvolve'],
  ['8e2316cd93cccc988e16112165719dc483ee44de9a7e0a736123851f9fec0ffb.png', 'covenant_snail'],
  ['9bd89d01ac533a31222829ca77f185467e31ba55bf28e121d0500c3b8358bc6b.png', 'covenant_grave'],
  ['aa35485348bacfb2d7cd913249564ad9c74f183982c1a2c79dcf771927a19849.png', 'covenant_rabbit'],
  ['cf45eb431ae4474c07c196ce2725e8c8163730914877910c2fc204fbc9ea3213.png', 'covenant_medicine'],
  ['de9b52900d9dceea99d4da94a3ccc173c02631888fc6007bb5af465ec1ed239a.png', 'covenant_wolf'],
  ['eae2e3b48ae834822eb2e0ab9b8f9a48cd6abfc77b778b43d9e5d15c02b0a100.png', 'covenant_betray'],
]);

function decodeEntities(value) {
  return value
    .replace(/&nbsp;|&#160;| /g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

function cleanText(html) {
  return decodeEntities(
    html
      .replace(/<br\s*\/?>/gi, ' ')
      .replace(/<[^>]+>/g, ''),
  ).replace(/\s+/g, ' ').trim();
}

function normalizeLabel(value) {
  return value
    .toLowerCase()
    .replace(/[「」·ㆍ・\s()[\]{}"'.,/\\:;!?~\-]/g, '');
}

function imageKeys(html) {
  return [...html.matchAll(/<img\b[^>]*\bsrc="([^"]+)"/gi)].map((match) => {
    const pathname = match[1].replace(/^\/\//, 'https://').split('?')[0];
    return path.basename(pathname);
  });
}

function extractAssetSources(html) {
  const sources = new Map();
  for (const match of html.matchAll(/<img\b[^>]*\bsrc="([^"]+)"/gi)) {
    let url = decodeEntities(match[1]);
    if (url.startsWith('//')) url = `https:${url}`;
    const key = path.basename(url.split('?')[0]);
    sources.set(key, url);
  }
  return sources;
}

function parseParagraphs(html) {
  const marker = '<div class="fr-view article-content">';
  const start = html.indexOf(marker);
  if (start < 0) throw new Error('본문 영역을 찾지 못했습니다.');
  const adStart = html.indexOf('<div class="ad"', start + marker.length);
  const end = adStart >= 0 ? adStart : html.length;
  return [...html.slice(start + marker.length, end).matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/gi)]
    .map((match, index) => ({
      index,
      text: cleanText(match[1]),
      images: imageKeys(match[1]),
    }));
}

function buildCharacterLookup(manifest) {
  const lookup = new Map(CHARACTER_ALIASES);
  for (const character of manifest) {
    lookup.set(normalizeLabel(character.name), character.id);
  }
  return lookup;
}

function findCharacter(paragraph, previousParagraph, lookup) {
  const hasOwnPortrait = paragraph.images.length === 1;
  const hasPreviousPortrait = previousParagraph
    && !previousParagraph.text
    && previousParagraph.images.length === 1;
  if (!paragraph.text || paragraph.text.length > 40) return null;

  const candidates = paragraph.text
    .split(/[,，]/)
    .map(normalizeLabel)
    .filter(Boolean);

  for (const candidate of candidates) {
    if (lookup.has(candidate)) {
      const characterId = lookup.get(candidate);
      if (hasOwnPortrait || hasPreviousPortrait || candidate === normalizeLabel(paragraph.text)) {
        return characterId;
      }
    }
  }
  return null;
}

function splitStats(value) {
  const cleaned = value
    .replace(/^(주옵션?|부옵션?)\s*/u, '')
    .replace(/[.。]$/u, '')
    .trim();
  if (!cleaned) return [];

  return cleaned
    .split(/\s+/)
    .map((stat) => stat.trim())
    .filter(Boolean);
}

function normalizeStat(raw) {
  const alternatives = raw
    .split('/')
    .map((value) => value.trim())
    .filter(Boolean)
    .map((value) => STAT_ALIASES.get(value) ?? STAT_ALIASES.get(value.replace(/\s+/g, '')) ?? value);
  return alternatives.join(' / ');
}

function extractRecords(paragraphs, characterLookup, sourceKey) {
  const records = [];
  let characterId = null;
  let characterLabel = null;
  let mysteryStart = -1;
  let lastStatEnd = -1;

  for (let index = 0; index < paragraphs.length; index += 1) {
    const paragraph = paragraphs[index];
    const foundCharacter = findCharacter(paragraph, paragraphs[index - 1], characterLookup);
    if (foundCharacter) {
      characterId = foundCharacter;
      characterLabel = paragraph.text;
      mysteryStart = -1;
      lastStatEnd = index;
      continue;
    }

    if (/^미스터리$/u.test(paragraph.text)) {
      mysteryStart = index;
      lastStatEnd = index;
      continue;
    }

    if (!characterId || mysteryStart < 0 || !/^주옵션?(?:\s|$)/u.test(paragraph.text)) continue;

    let mainStatText = paragraph.text.replace(/^주옵션?\s*/u, '').trim();
    let cursor = index + 1;
    if (!mainStatText && paragraphs[cursor]) {
      mainStatText = paragraphs[cursor].text;
      cursor += 1;
    }

    let subStatText = '';
    while (cursor < paragraphs.length && cursor <= index + 4) {
      const candidate = paragraphs[cursor].text;
      if (/^부옵션?(?:\s|$)/u.test(candidate)) {
        subStatText = candidate.replace(/^부옵션?\s*/u, '').trim();
        if (!subStatText && paragraphs[cursor + 1]) subStatText = paragraphs[cursor + 1].text;
        break;
      }
      cursor += 1;
    }

    const mainStatsRaw = splitStats(mainStatText);
    const contextStart = Math.max(mysteryStart, lastStatEnd + 1);
    const context = paragraphs
      .slice(contextStart, index)
      .filter((item) => item.text)
      .map((item) => item.text)
      .slice(-4);
    const covenantAssetKeys = paragraphs
      .slice(contextStart, index)
      .flatMap((item) => item.images);

    const uniqueAssetKeys = [...new Set(covenantAssetKeys)];
    const covenantIds = [...new Set(uniqueAssetKeys.map((key) => COVENANT_ASSET_IDS.get(key)).filter(Boolean))];
    const mappingStatus = mainStatsRaw.length === 6 && covenantIds.length === 1
      ? 'confirmed'
      : 'needs_review';

    records.push({
      id: `${sourceKey}-${String(records.length + 1).padStart(3, '0')}`,
      source_key: sourceKey,
      character_id: characterId,
      character_label: characterLabel,
      usage_context: context,
      covenant_asset_keys: uniqueAssetKeys,
      covenant_ids: covenantIds,
      main_stats_text: mainStatText,
      main_stats_raw: mainStatsRaw,
      main_stats: mainStatsRaw.map(normalizeStat),
      sub_stats_text: subStatText,
      sub_stats_raw: splitStats(subStatText.replace(/[,，]/g, ' ')),
      mapping_status: mappingStatus,
    });
    lastStatEnd = cursor;
  }

  return records;
}

function extractCharacterSections(paragraphs, characterLookup, sourceKey) {
  const starts = [];
  for (let index = 0; index < paragraphs.length; index += 1) {
    const characterId = findCharacter(paragraphs[index], paragraphs[index - 1], characterLookup);
    if (characterId) {
      starts.push({
        index,
        characterId,
        characterLabel: paragraphs[index].text,
        portraitAssetKey: paragraphs[index].images[0] ?? paragraphs[index - 1]?.images[0] ?? null,
      });
    }
  }

  return starts.map((start, startIndex) => {
    const nextStart = starts[startIndex + 1];
    const end = nextStart ? nextStart.index - 1 : paragraphs.length;
    return {
      id: `${sourceKey}-${start.characterId}`,
      source_key: sourceKey,
      character_id: start.characterId,
      character_label: start.characterLabel,
      portrait_asset_key: start.portraitAssetKey,
      start_paragraph_index: start.index,
      end_paragraph_index: end,
      paragraphs: paragraphs.slice(start.index + 1, end).map((paragraph) => ({
        text: paragraph.text,
        asset_keys: paragraph.images,
      })).filter((paragraph) => paragraph.text || paragraph.asset_keys.length > 0),
    };
  });
}

function extractUnmatchedCharacterCandidates(paragraphs, characterLookup, sourceKey) {
  const ignored = new Set(['명륜', '고점', '대체', '미스터리', '주옵', '주옵션', '부옵', '부옵션']);
  return paragraphs.flatMap((paragraph, index) => {
    const previous = paragraphs[index - 1];
    const hasOwnPortrait = paragraph.images.length === 1;
    const hasPreviousPortrait = previous && !previous.text && previous.images.length === 1;
    if (!hasOwnPortrait && !hasPreviousPortrait) return [];
    if (!paragraph.text || paragraph.text.length > 40 || ignored.has(paragraph.text)) return [];
    if (findCharacter(paragraph, previous, characterLookup)) return [];
    return [{
      source_key: sourceKey,
      label: paragraph.text,
      portrait_asset_key: paragraph.images[0] ?? previous.images[0],
    }];
  });
}

function getArg(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : null;
}

async function loadHtml(sourceKey) {
  const inputPath = getArg(`--${sourceKey}-html`);
  if (inputPath) return fs.readFile(inputPath, 'utf8');

  const response = await fetch(SOURCES[sourceKey].url, {
    headers: { 'user-agent': 'Mozilla/5.0 (compatible; MorimensInfoDataBot/1.0)' },
  });
  if (!response.ok) throw new Error(`${sourceKey} 원문 요청 실패: HTTP ${response.status}`);
  return response.text();
}

const outputPath = getArg('--output') ?? 'data/covenant_main_stats.json';
const manifest = JSON.parse(await fs.readFile('data/character_manifest.json', 'utf8'));
const characterLookup = buildCharacterLookup(manifest);
const records = [];
const characterSections = [];
const unmatchedCharacterCandidates = [];
const assetSources = new Map();

for (const sourceKey of Object.keys(SOURCES)) {
  const html = await loadHtml(sourceKey);
  for (const [key, url] of extractAssetSources(html)) assetSources.set(key, url);
  const paragraphs = parseParagraphs(html);
  records.push(...extractRecords(paragraphs, characterLookup, sourceKey));
  characterSections.push(...extractCharacterSections(paragraphs, characterLookup, sourceKey));
  unmatchedCharacterCandidates.push(...extractUnmatchedCharacterCandidates(paragraphs, characterLookup, sourceKey));
}

const output = {
  schema_version: 1,
  description: '원문에서 추출한 비밀계약 주옵 자료. mapping_status가 confirmed가 되기 전에는 character_settings.json에 반영하지 않는다.',
  sources: SOURCES,
  stat_aliases: Object.fromEntries(STAT_ALIASES),
  covenant_asset_ids: Object.fromEntries(COVENANT_ASSET_IDS),
  records,
  character_sections: characterSections,
  unmatched_character_candidates: unmatchedCharacterCandidates,
};

await fs.writeFile(outputPath, `${JSON.stringify(output, null, 2)}\n`, 'utf8');

const assetsDir = getArg('--download-assets');
if (assetsDir) {
  await fs.mkdir(assetsDir, { recursive: true });
  const wantedAssets = process.argv.includes('--download-all-assets')
    ? new Set(assetSources.keys())
    : new Set(records.flatMap((record) => record.covenant_asset_keys));
  for (const key of wantedAssets) {
    const url = assetSources.get(key);
    if (!url) continue;
    const response = await fetch(url);
    if (!response.ok) throw new Error(`이미지 요청 실패: ${key} (HTTP ${response.status})`);
    await fs.writeFile(path.join(assetsDir, key), Buffer.from(await response.arrayBuffer()));
  }
}

const summary = records.reduce((result, record) => {
  result.total += 1;
  result[record.mapping_status] += 1;
  result.by_source[record.source_key] = (result.by_source[record.source_key] ?? 0) + 1;
  return result;
}, { total: 0, confirmed: 0, needs_review: 0, by_source: {} });

console.log(JSON.stringify(summary, null, 2));
