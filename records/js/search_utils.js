(function () {
    const CHOSEONG = [
        'ㄱ', 'ㄲ', 'ㄴ', 'ㄷ', 'ㄸ', 'ㄹ', 'ㅁ', 'ㅂ', 'ㅃ', 'ㅅ',
        'ㅆ', 'ㅇ', 'ㅈ', 'ㅉ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ'
    ];
    const HANGUL_BASE = 0xac00;
    const HANGUL_LAST = 0xd7a3;
    const SYLLABLES_PER_INITIAL = 21 * 28;
    const CHOSEONG_PATTERN = /^[ㄱ-ㅎ]+$/;

    function normalizeSearchText(value) {
        return String(value || '')
            .normalize('NFC')
            .toLowerCase()
            .replace(/\s+/g, '');
    }

    function getChoseong(value) {
        return normalizeSearchText(value).split('').map(char => {
            const code = char.charCodeAt(0);
            if (code < HANGUL_BASE || code > HANGUL_LAST) return char;
            return CHOSEONG[Math.floor((code - HANGUL_BASE) / SYLLABLES_PER_INITIAL)];
        }).join('');
    }

    function isChoseongQuery(query) {
        return CHOSEONG_PATTERN.test(normalizeSearchText(query));
    }

    function isSearchQueryActive(query) {
        const normalizedQuery = normalizeSearchText(query);
        if (!normalizedQuery) return false;
        return !(isChoseongQuery(normalizedQuery) && normalizedQuery.length < 2);
    }

    function matchesSearchText(source, query) {
        const normalizedQuery = normalizeSearchText(query);
        if (!isSearchQueryActive(normalizedQuery)) return true;

        const normalizedSource = normalizeSearchText(source);
        if (normalizedSource.includes(normalizedQuery)) return true;

        if (!isChoseongQuery(normalizedQuery)) return false;
        return getChoseong(source).includes(normalizedQuery);
    }

    window.SearchUtils = {
        normalizeSearchText,
        getChoseong,
        isChoseongQuery,
        isSearchQueryActive,
        matchesSearchText
    };
})();
