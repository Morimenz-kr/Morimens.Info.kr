const RESOURCE_CATEGORY_DEFINITIONS = Object.freeze([
    { id: 'event', label: '2.5주년 + 이벤트', title: '진행 중인 이벤트 정보' },
    { id: 'weekly_yungjae', label: '진행중인 융재금구 팁', title: '진행 중인 융재금구 팁' },
    { id: 'newbie', label: '뉴비 팁', title: '🐣 뉴비 필독 가이드' },
    { id: 'system', label: '시스템 정보', title: '시스템 정보' },
    { id: 'weapon', label: '융재금구 정보', title: '융재금구 정보' },
    { id: 'dreamdive', label: '환몽심잠 정보', title: '🌊 환몽심잠 공략' },
    { id: 'myeongryun', label: '명륜 정보', title: '명륜 정보' },
    { id: 'covenant', label: '비밀계약 정보', title: '📜 비밀계약 정보' },
    { id: 'code', label: '교환 코드', title: '교환 코드' },
    { id: 'faction', label: '계역별 정보', title: '🎭 계역별 정보' },
    { id: 'silverkey', label: '은열쇠 정보', title: '은열쇠 정보' },
    { id: 'chess', label: '페이즈 체스', title: '페이즈 체스' },
    { id: 'etc', label: '기타', title: '🎸 기타(과금 효율, 기타 등등..)' }
].map(definition => Object.freeze(definition)));

const RESOURCE_CATEGORY_IDS = Object.freeze(
    RESOURCE_CATEGORY_DEFINITIONS.map(definition => definition.id)
);

const RESOURCE_CATEGORY_LABELS = Object.freeze(Object.fromEntries(
    RESOURCE_CATEGORY_DEFINITIONS.map(definition => [definition.id, definition.label])
));

const RESOURCE_CATEGORY_TITLES = Object.freeze(Object.fromEntries(
    RESOURCE_CATEGORY_DEFINITIONS.map(definition => [definition.id, definition.title])
));

export {
    RESOURCE_CATEGORY_DEFINITIONS,
    RESOURCE_CATEGORY_IDS,
    RESOURCE_CATEGORY_LABELS,
    RESOURCE_CATEGORY_TITLES
};
