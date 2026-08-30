import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

function argument(name) {
  const index = process.argv.indexOf(name);
  if (index === -1 || !process.argv[index + 1]) throw new Error(`${name} 값이 필요합니다.`);
  return path.resolve(process.argv[index + 1]);
}

async function readJson(filePath) {
  return JSON.parse(await fs.readFile(filePath, 'utf8'));
}

function orderedValues(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return [];
  return Object.keys(value).sort((a, b) => Number(a) - Number(b)).map(key => value[key]);
}

function textCatalog(document) {
  return Object.fromEntries(Object.entries(document.data || {}).map(([key, row]) => [key, row.Text || '']));
}

function localized(raw, catalog) {
  if (!raw) return '';
  if (typeof raw === 'object') return localized(orderedValues(raw)[0], catalog);
  const [key, ...fallback] = String(raw).split('|');
  return catalog[key] || fallback.join('|') || key;
}

function stripGameMarkup(value) {
  return String(value || '').replace(/<[^:>]+:([^>]+)>/g, '$1').replace(/\s+/g, ' ').trim();
}

function normalizeRichText(value) {
  return String(value || '')
    .replace(/<[^:>]+:([^>]+)>/g, '$1')
    .replace(/<\/?(?:color|size|b|i)(?:=[^>]*)?>/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function normalizeRelicEffectText(value) {
  return normalizeRichText(value)
    .replace(/[“"]타격[”"]이 피해를 입히고 \[Arg1\]%의 중독을 부여하며, 매 턴 최대 \[Arg2\] pt까지\./g,
      '「타격」으로 피해를 입힐 때 중독을 [Arg1]% 부여합니다. 한 턴에 이 효과로 부여할 수 있는 중독은 최대 [Arg2]pt입니다.')
    .replace(/피해 강화/g, '피해 강효')
    .replace(/방어막/g, '실드')
    .replace(/실드이/g, '실드가')
    .replace(/실드을/g, '실드를')
    .replace(/실드과/g, '실드와')
    .replace(/데스 리저스턴스/g, '죽음 저항')
    .replace(/죽음 저항를/g, '죽음 저항을')
    .replace(/죽음 저항가/g, '죽음 저항이')
    .replace(/획득하는 죽음 저항이/g, '획득하는 죽음 저항 수치가')
    .replace(/당신의\s*/g, '')
    .replace(/당신이\s*/g, '')
    .replace(/웨이크업 바디/g, '각성체')
    .replace(/모든 각성이/g, '모든 각성체가')
    .replace(/실드를 ([^,.]+)와 임시 힘을 ([^,.]+) 획득/g, '실드 $1와 임시 힘 $2를 획득')
    .replace(/HP이/g, 'HP가')
    .replace(/HP 답변/g, 'HP 회복')
    .replace(/HP력/g, 'HP')
    .replace(/최대 HP력/g, '최대 HP')
    .replace(/피해 강효\s*\+(\[Arg\d+\]%)/g, '피해 강효가 $1 증가합니다')
    .replace(/피해 강효가 (\[Arg\d+\]%)\.(?!\s*증가)/g, '피해 강효가 $1 증가합니다.')
    .replace(/임시힘/g, '임시 힘')
    .replace(/일시적인힘/g, '임시 힘')
    .replace(/일시적인 힘/g, '임시 힘')
    .replace(/일시적 힘/g, '임시 힘')
    .replace(/자신에게 영구 반격을/g, '자신의 영구 반격을')
    .replace(/모든 적으로 (?=\[Arg\d+\])/g, '모든 적으로부터 ')
    .replace(/은열쇠 에너지 획득합니다/g, '은열쇠 에너지를 획득합니다')
    .replace(/\[Arg(\d+)\]\s*스택의손상을/g, '[Arg$1]스택의 손상을')
    .replace(/\[Arg(\d+)\]\s*스택의허약을/g, '[Arg$1]스택의 허약을')
    .replace(/\[Arg(\d+)\]\s*층\s*약화를/g, '[Arg$1]스택의 허약을')
    .replace(/\[Arg(\d+)\]\s*층\s*허약과 손상을/g, '[Arg$1]스택의 허약과 손상을')
    .replace(/1층의약화/g, '1스택의 허약')
    .replace(/\[Arg(\d+)\]\s*보다 작거나 같음 경우/g, '[Arg$1] 이하인 경우')
    .replace(/이번 관카 내에서/g, '이번 스테이지에서')
    .replace(/지령 카드/g, '명령 카드')
    .replace(/정해 자세/g, '정해 태세')
    .replace(/노도 자세/g, '노도 태세')
    .replace(/쿨다운/g, '쿨타임')
    .replace(/비 파생/g, '비파생')
    .replace(/준비(\d+)/g, '준비 $1')
    .replace(/(\d|\])\s+턴/g, '$1턴')
    .replace(/(\d|\])\s+장/g, '$1장')
    .replace(/(\d|\])\s+번/g, '$1번')
    .replace(/(\d|\])\s+회/g, '$1회')
    .replace(/%，\s*/g, '%, ')
    .replace(/。/g, '.')
    .replace(/\s*;\s*/g, '. ')
    .replace(/\s+([,.])/g, '$1')
    .replace(/([:])(?=\S)/g, '$1 ')
    .replace(/(\[Arg\d+\])의 실드/g, '$1 실드')
    .replace(/턴 시작 시 배아 융합도 \+ (\[Arg\d+\]%),/g, '턴 시작 시 배아 융합도가 $1 증가하고,')
    .replace(/정해 태세를 사용하여 모든 적에게 (\[Arg\d+\] 점의 임시 힘)을 잃게 합니다\./g,
      '정해 태세를 사용하면 모든 적이 $1을 잃습니다.')
    .replace(/노도 태세를 사용하여 즉시 모든 촉수를 적에게 공격하게 하여 (\[Arg\d+\]회) 공격, 3턴 쿨타임\./g,
      '노도 태세를 사용하면 모든 촉수가 적을 $1 공격합니다. 3턴의 쿨타임이 적용됩니다.')
    .replace(/소멸로 인해 가장 낮은 광기의 각성체가/g, '소멸 시 광기가 가장 낮은 각성체가')
    .replace(/,?\s*3턴 쿨타임\.$/g, '. 3턴의 쿨타임이 적용됩니다.')
    .replace(/\.\.+/g, '.')
    .replace(/\s+/g, ' ')
    .trim();
}

function researchParameter(expression, index) {
  const source = String(expression ?? '');
  const numeric = Number(source);
  if (source !== '' && Number.isFinite(numeric)) {
    return { index, expression: source, kind: 'fixed', fixedValue: numeric };
  }
  const kind = source.includes('InsightResearchDepth')
    ? 'spirit'
    : source.includes('PlayerGrowth')
      ? 'material'
      : source.includes('GetAccountStageGrow()')
        ? 'material-base'
        : source.includes('PlayerRole.max_hp')
          ? 'max-hp'
          : 'formula';
  return { index, expression: source, kind, fixedValue: null };
}

function iconBasename(icon) {
  return path.posix.basename(String(icon || '')).replace(/\.png$/i, '.webp').toLowerCase();
}

// 전시관에는 유물과 별도 시스템인 차원 영상도 섞여 있다.
const NON_RELIC_COLLECTION_IDS = new Set([118586]);
// 한국어 클라이언트에 "기형" 접두어로 남아 있는 Green 품질 변형은
// 현재 전시용 유물 목록에서 제외한다.
const EXCLUDED_RELIC_VARIANT_IDS = new Set([13762, 13763, 13874, 13900, 13908]);

function variantTier(row, collectionId) {
  if (collectionId === 118573) return { id: 'pendulum', label: '시령배' };
  if ([118567, 118599, 118604].includes(collectionId)) {
    return row.Quality === 'Holy'
      ? { id: 'upgraded', label: '라이커 · 강화' }
      : { id: 'base', label: '라이커 · 기본' };
  }
  const tiers = {
    White: { id: 'silver', label: '백은' },
    Orange: { id: 'gold', label: '황금' },
    Red: { id: 'cursed', label: '저주' },
    Holy: { id: 'blessed', label: '축복' },
    Sin: { id: 'sinful', label: '사악' },
    Forged: { id: 'gold', label: '황금' },
    Purple: { id: 'special', label: '특수' },
    Grey: { id: 'special', label: '특수' }
  };
  return tiers[row.Quality] || { id: String(row.Quality || 'special').toLowerCase(), label: row.Quality || '특수' };
}

function variantChapter(row, collectionId, chapterMap) {
  if ([118573, 118567, 118599, 118604].includes(collectionId)) {
    return { id: 'special', label: '기타' };
  }
  return chapterMap[row.StageChapter] || { id: 'special', label: '기타' };
}

const PICKMAN_EQUIVALENT_VARIANT_IDS = new Set([
  100400, 100404, 100407, 100408, 100410,
  100412, 100539, 100540
]);

function variantSource(row) {
  return String(row.CnID || '').includes('皮克曼')
    ? { id: 'pickman', label: '픽맨 생성' }
    : { id: 'standard', label: '' };
}

function collectionRows(document) {
  if (Array.isArray(document)) return document;
  if (Array.isArray(document?.rows)) return document.rows;
  throw new Error('전시관 유물 목록 형식을 인식할 수 없습니다.');
}

export async function buildRelicCatalog({ staticDirectory, imageDirectory, outputDirectory, collectionFile }) {
  const [relicDocument, relicTextDocument, accountDocument, collectionDocument, collectionTextDocument] = await Promise.all([
    readJson(path.join(staticDirectory, 'Config.RelicConfig.json')),
    readJson(path.join(staticDirectory, 'Text_KR.Text_RelicConfig.json')),
    readJson(path.join(staticDirectory, 'Config.AcountLevelConfig.json')),
    readJson(collectionFile || path.join(staticDirectory, 'relic-collection-configs.json')),
    readJson(path.join(staticDirectory, 'Text_KR.Text_CollectionHall.json'))
  ]);
  const relicText = textCatalog(relicTextDocument);
  const collectionText = textCatalog(collectionTextDocument);
  const availableImages = new Set((await fs.readdir(imageDirectory).catch(() => []))
    .filter(name => /\.webp$/i.test(name)).map(name => name.toLowerCase()));
  const chapterMap = {
    StageChapterMorimens: { id: 'morimens', label: '망각편' },
    StageChapterStarsCameRight: { id: 'stars', label: '성신편' }
  };
  const relicConfig = relicDocument.data || {};
  const sinfulVariantsByIcon = new Map();
  Object.values(relicConfig).filter(row => row.Quality === 'Sin').forEach(row => {
    const key = String(row.Icon || '').replaceAll('\\', '/').toLowerCase();
    if (!key) return;
    if (!sinfulVariantsByIcon.has(key)) sinfulVariantsByIcon.set(key, []);
    sinfulVariantsByIcon.get(key).push(Number(row.ID));
  });
  const relics = collectionRows(collectionDocument).map(collection => {
    const config = collection.cfg || collection;
    const collectionId = Number(config.ID || collection.tid);
    if (NON_RELIC_COLLECTION_IDS.has(collectionId)) return null;
    const iconName = iconBasename(config.Picture);
    const iconKey = String(config.Picture || '').replaceAll('\\', '/').toLowerCase();
    const variantIds = [...new Set([
      ...orderedValues(config.UnlockCondPara).map(Number),
      ...(sinfulVariantsByIcon.get(iconKey) || [])
    ])];
    const variants = variantIds
      .map(rawId => relicConfig[String(rawId)])
      .filter(Boolean)
      .filter(row => !EXCLUDED_RELIC_VARIANT_IDS.has(Number(row.ID)))
      .map(row => {
        const chapter = variantChapter(row, collectionId, chapterMap);
        const tier = variantTier(row, collectionId);
        const source = variantSource(row);
        return {
          id: Number(row.ID),
          name: stripGameMarkup(localized(row.Name, relicText)),
          description: normalizeRelicEffectText(localized(row.Desc, relicText)),
          battleDescription: normalizeRelicEffectText(localized(row.BattleDesc || row.Desc, relicText)),
          story: stripGameMarkup(localized(row.StoryDesc, relicText)),
          chapter: chapter.id,
          chapterLabel: chapter.label,
          source: source.id,
          sourceLabel: source.label,
          tier: tier.id,
          tierLabel: tier.label,
          quality: row.Quality || 'Unknown',
          relicGroup: Number(row.RelicGroup),
          iconSource: row.Icon || '',
          parameters: orderedValues(row.StatePara).map((expression, index) => researchParameter(expression, index + 1))
        };
      })
      .filter(variant => !PICKMAN_EQUIVALENT_VARIANT_IDS.has(variant.id));
    const canonicalVariants = variants;
    const uniqueVariants = [...new Map(canonicalVariants.map(variant => [JSON.stringify([
      variant.chapter,
      variant.tier,
      variant.name,
      variant.battleDescription,
      variant.parameters.map(parameter => parameter.expression)
    ]), variant])).values()];
    return {
      id: collectionId,
      name: stripGameMarkup(localized(config.Title, collectionText)),
      story: stripGameMarkup(localized(config.Desc, collectionText)),
      acquisition: stripGameMarkup(localized(config.LockTip, collectionText)),
      iconSource: config.Picture || '',
      image: availableImages.has(iconName) ? `images/dzone/relic/${iconName}` : '',
      chapters: [...new Set(uniqueVariants.map(variant => variant.chapter))],
      tiers: [...new Set(uniqueVariants.map(variant => variant.tier))],
      variants: uniqueVariants
    };
  }).filter(relic => relic && relic.variants.length > 0);

  const levels = Object.values(accountDocument.data || {})
    .map(row => ({
      level: Number(row.Level),
      biological: Number(row.HpMultiplier),
      material: Number(row.StageGrow),
      spiritRate: Number(row.AccountDamagePower),
      spirit: Number(row.StageGrow) * Number(row.AccountDamagePower) / 100
    }))
    .filter(row => Number.isInteger(row.level) && row.level >= 1)
    .sort((a, b) => a.level - b.level);

  await fs.mkdir(outputDirectory, { recursive: true });
  await Promise.all([
    fs.writeFile(path.join(outputDirectory, 'relic_catalog.json'), `${JSON.stringify({
      schemaVersion: 3,
      scope: 'in-game-collection-hall',
      relics
    }, null, 2)}\n`, 'utf8'),
    fs.writeFile(path.join(outputDirectory, 'research_depth_levels.json'), `${JSON.stringify({ schemaVersion: 1, levels }, null, 2)}\n`, 'utf8')
  ]);
  return { relicCount: relics.length, levelCount: levels.length, imageCount: relics.filter(row => row.image).length };
}

const isMain = process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url;
if (isMain) {
  buildRelicCatalog({
    staticDirectory: argument('--static'),
    imageDirectory: argument('--images'),
    outputDirectory: argument('--out'),
    collectionFile: argument('--collections')
  }).then(summary => console.log(JSON.stringify(summary, null, 2))).catch(error => {
    console.error(error.stack || error.message || error);
    process.exitCode = 1;
  });
}
