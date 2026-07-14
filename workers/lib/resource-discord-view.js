import {
    RELEMS_LABELS,
    RELEMS_ORDER,
    RESOURCE_CATEGORIES,
    RESOURCE_CATEGORY_LABELS,
    defaultResourceSelection,
    formatTarget,
    normalizeRelems,
    normalizeTargets
} from './resource-schema.js';

function buildResourceComponents(issueNumber, disabled = false, selection = defaultResourceSelection(), registry) {
    if (!registry?.characters?.length) {
        throw new Error('Character manifest registry is unavailable');
    }
    const activeRelems = normalizeRelems(selection.activeRelems);
    const selectedKeys = new Set(normalizeTargets(selection.targets || [], registry).map(target => `${target.type}:${target.id}`));
    const activeCharacters = registry.characters.filter(character => character.relems === activeRelems);
    if (activeCharacters.length > 25) {
        throw new Error(`Discord character selector exceeds 25 options for relems: ${activeRelems}`);
    }

    return [
        {
            type: 1,
            components: [
                {
                    type: 2,
                    style: 3,
                    label: '추천대로 OK',
                    custom_id: `rl:approve:${issueNumber}`,
                    disabled
                },
                {
                    type: 2,
                    style: 1,
                    label: '선택 반영',
                    custom_id: `rl:approve-selected:${issueNumber}`,
                    disabled
                },
                {
                    type: 2,
                    style: 2,
                    label: '선택 초기화',
                    custom_id: `rl:clear-selection:${issueNumber}`,
                    disabled
                },
                {
                    type: 2,
                    style: 2,
                    label: '보류',
                    custom_id: `rl:hold:${issueNumber}`,
                    disabled
                }
            ]
        },
        {
            type: 1,
            components: [
                {
                    type: 3,
                    custom_id: `rl:categories:${issueNumber}`,
                    placeholder: '일반 카테고리 선택',
                    min_values: 0,
                    max_values: RESOURCE_CATEGORIES.length,
                    disabled,
                    options: RESOURCE_CATEGORIES.map(id => ({
                        label: RESOURCE_CATEGORY_LABELS[id] || id,
                        value: `category:${id}`,
                        description: id,
                        default: selectedKeys.has(`category:${id}`)
                    }))
                }
            ]
        },
        {
            type: 1,
            components: RELEMS_ORDER.map(relems => ({
                type: 2,
                style: relems === activeRelems ? 1 : 2,
                label: RELEMS_LABELS[relems] || relems,
                custom_id: `rl:relems:${relems}:${issueNumber}`,
                disabled
            }))
        },
        {
            type: 1,
            components: [
                {
                    type: 3,
                    custom_id: `rl:characters:${activeRelems}:${issueNumber}`,
                    placeholder: `${RELEMS_LABELS[activeRelems] || activeRelems} 캐릭터 선택`,
                    min_values: 0,
                    max_values: activeCharacters.length,
                    disabled,
                    options: activeCharacters.map(character => ({
                        label: character.name || character.id,
                        value: `character:${character.id}`,
                        description: character.id,
                        default: selectedKeys.has(`character:${character.id}`)
                    }))
                }
            ]
        }
    ];
}

function buildResourceMessageContent(selection = defaultResourceSelection(), registry = null) {
    return [
        'resource_links 등록 승인이 필요합니다.',
        `현재 선택: ${formatSelectionSummary(selection, registry)}`,
        `캐릭터 탭: ${RELEMS_LABELS[normalizeRelems(selection.activeRelems)]}`
    ].join('\n');
}

function formatSelectionSummary(selection, registry = null) {
    const targets = normalizeTargets(selection.targets || [], registry);
    if (targets.length === 0) return '없음';

    const labels = targets.map(target => formatTargetLabel(target, registry));
    const visible = labels.slice(0, 20).join(', ');
    const hiddenCount = labels.length - 20;
    return hiddenCount > 0 ? `${visible} 외 ${hiddenCount}개` : visible;
}

function formatTargetLabel(target, registry = null) {
    if (!target) return 'unknown';
    if (target.type === 'category') return RESOURCE_CATEGORY_LABELS[target.id] || target.id;
    if (target.type === 'character') return registry?.byId[target.id]?.name || target.id;
    return formatTarget(target);
}

export {
    buildResourceComponents,
    buildResourceMessageContent
};
