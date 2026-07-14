export function encodeTooltipMainStats(stats) {
    if (!Array.isArray(stats) || stats.length === 0) return '';
    return encodeURIComponent(JSON.stringify(stats));
}

export function decodeTooltipMainStats(value) {
    if (!value) return [];
    try {
        const parsed = JSON.parse(decodeURIComponent(value));
        return Array.isArray(parsed) ? parsed.map(String).filter(Boolean) : [];
    } catch {
        return [];
    }
}

export function formatTooltipMainStats(stats) {
    const values = Array.isArray(stats) ? stats : [];
    const partLabels = ['Ⅰ', 'Ⅱ', 'Ⅲ', 'Ⅳ', 'Ⅴ', 'Ⅵ'];
    if (values.length !== partLabels.length) return values.join(', ');
    return values.map((stat, index) => `${partLabels[index]} ${stat}`).join('\n');
}

export function normalizeDictionaryFilterValue(value, type) {
    const raw = String(value || '').trim();
    if (!raw) return '';

    const normalized = raw
        .replace(/\s+/g, ' ')
        .replace(/드롭율/g, '드롭')
        .replace(/겅은 인장/g, '검은 인장')
        .trim();

    if (type === 'mainStat') {
        return normalized
            .replace(/^영역숙련/, '영역 숙련')
            .replace(/검은 인장 드롭\s*(\d)/, '검은 인장 드롭 $1')
            .replace(/\s+\d+(?:\.\d+)?%?$/, '');
    }

    const compact = normalized.replace(/\s+/g, '');
    if (/^광기(회복|획득|부여|획득량증가)$/.test(compact)) return '광기';
    if (/^HP회복(량증가)?$/.test(compact)) return 'HP 회복';
    if (/^은열쇠게이지(획득)?$/.test(compact)) return '은열쇠 게이지';
    if (/^배아융합(증가)?$/.test(compact)) return '배아 융합';
    if (/^죽음저항(제거)?$/.test(compact)) return '죽음 저항';
    if (/^검은인장드롭$/.test(compact)) return '검은 인장 드롭';
    if (/^방어막증가$/.test(compact)) return '방어막';

    const effectAliases = {
        광기소모량증가: '광기 소모량 증가',
        은열쇠소모량증가: '은열쇠 소모량 증가',
        은열쇠에너지회복: '은열쇠 에너지 회복',
        최대광기증가: '최대 광기 증가',
        최대은열쇠에너지증가: '최대 은열쇠 에너지 증가',
        최종피해증가: '최종 피해 증가',
        산출력획득: '산출력',
        힘획득: '힘',
        방어추가: '방어 추가',
        타격추가: '타격 추가',
        명령카드복제: '명령 카드 복제',
        크리티컬피해: '크리티컬 피해',
        크리티컬확률: '크리티컬 확률',
        피해증폭: '피해 증폭'
    };

    return effectAliases[compact] || raw;
}

export function uniqueSortedValues(values) {
    return [...new Set(values.map(value => String(value || '').trim()).filter(Boolean))]
        .sort((a, b) => a.localeCompare(b, 'ko'));
}

export function getDictionaryFilterMeta(item, category, characterNames = new Set()) {
    const tags = (item?.tags || item?.optimized_for || [])
        .map(tag => String(tag || '').trim())
        .filter(Boolean);
    const mainStat = category === 'myeongryun'
        ? normalizeDictionaryFilterValue(item?.main_stat, 'mainStat')
        : '';
    const effectFilters = category === 'myeongryun'
        ? []
        : tags
            .filter(tag => category !== 'silverkey' || !characterNames.has(tag))
            .map(tag => normalizeDictionaryFilterValue(tag, 'effect'))
            .filter(Boolean);

    return {
        nameText: [item?.korean_name, item?.english_name].filter(Boolean).join(' ').toLowerCase(),
        text: [
            item?.korean_name,
            item?.english_name,
            item?.description,
            item?.set_effect_3,
            item?.set_effect_6,
            item?.main_stat,
            tags.join(' ')
        ].filter(Boolean).join(' ').toLowerCase(),
        grade: category === 'myeongryun' ? String(item?.grade || '').trim() : '',
        mainStat,
        effectFilters
    };
}

const IMAGE_PROXY_HOSTS = Object.freeze(['namu.la', 'arca.live', 'dcinside.com']);

export function resolveSafeHttpUrl(value, baseUrl, fallback = '') {
    if (value === undefined || value === null || String(value).trim() === '') return fallback;
    try {
        const url = new URL(String(value).trim(), baseUrl);
        return url.protocol === 'http:' || url.protocol === 'https:' ? url.href : fallback;
    } catch {
        return fallback;
    }
}

export function requiresImageProxy(value, baseUrl) {
    const safeUrl = resolveSafeHttpUrl(value, baseUrl);
    if (!safeUrl) return false;
    const hostname = new URL(safeUrl).hostname.toLowerCase();
    return IMAGE_PROXY_HOSTS.some(domain => hostname === domain || hostname.endsWith(`.${domain}`));
}

export function createSafeImageUrl(value, options = {}) {
    const { baseUrl, fallback = '' } = options;
    const safeFallback = resolveSafeHttpUrl(fallback, baseUrl);
    const safeUrl = resolveSafeHttpUrl(value, baseUrl, safeFallback);
    if (!safeUrl || !requiresImageProxy(safeUrl, baseUrl)) return safeUrl;
    return `https://images.weserv.nl/?url=${encodeURIComponent(safeUrl)}&w=400&output=webp&n=-1`;
}
