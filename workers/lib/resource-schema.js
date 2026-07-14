import {
    SAFE_HTTPS_PROTOCOLS,
    ValidationError,
    assertPlainObject,
    normalizeHttpUrl,
    normalizeTextField,
    safeErrorMessage
} from './http.js';
import {
    RELEMS_LABELS,
    RELEMS_ORDER
} from '../../js/domain/character-taxonomy.js';
import {
    RESOURCE_CATEGORY_IDS,
    RESOURCE_CATEGORY_LABELS
} from '../../shared/resource-categories.js';

const CHARACTER_MANIFEST_PATH = 'data/character_manifest.json';

const DEFAULT_ACTIVE_RELEMS = 'chaos';

const SAFE_CHARACTER_ID_PATTERN = /^[A-Za-z0-9_-]{1,80}$/;

const RESOURCE_CATEGORIES = RESOURCE_CATEGORY_IDS;

function resourceProposalFingerprint(proposal) {
    return {
        link: proposal.link,
        targets: proposal.targets,
        sourceTab: proposal.sourceTab,
        submittedBy: proposal.submittedBy
    };
}

function normalizeResourceProposal(payload, registry = null) {
    assertPlainObject(payload, 'payload');
    const link = payload.link === undefined ? payload : payload.link;
    assertPlainObject(link, 'link');

    const normalized = {
        link: {
            url: normalizeHttpUrl(link.url, 'link.url', {
                maxLength: 800,
                required: true,
                protocols: SAFE_HTTPS_PROTOCOLS
            }),
            title: normalizeTextField(link.title, 'link.title', {
                maxLength: 240,
                required: true,
                forbidHtml: true
            }),
            desc: normalizeTextField(link.desc, 'link.desc', {
                maxLength: 1200,
                multiline: true,
                forbidHtml: true
            }),
            image: normalizeHttpUrl(link.image, 'link.image', {
                maxLength: 1000,
                required: false,
                protocols: SAFE_HTTPS_PROTOCOLS
            })
        },
        targets: normalizeTargets(payload.targets || [], registry, { strict: true }),
        sourceTab: normalizeTextField(payload.sourceTab, 'sourceTab', {
            maxLength: 80,
            forbidHtml: true
        }),
        submittedBy: normalizeTextField(payload.submittedBy, 'submittedBy', {
            maxLength: 80,
            defaultValue: 'bookmarklet',
            forbidHtml: true
        }),
        submittedAt: new Date().toISOString()
    };

    if (normalized.targets.length === 0) {
        normalized.targets = suggestTargets(normalized);
    }

    return normalized;
}

function normalizeTargets(targets, registry = null, options = {}) {
    const strict = Boolean(options.strict);
    if (!Array.isArray(targets)) {
        if (strict) throw new ValidationError('targets must be an array');
        return [];
    }
    if (strict && targets.length > 80) {
        throw new ValidationError('targets must contain at most 80 entries');
    }

    const result = [];
    const seen = new Set();

    for (const target of targets) {
        const normalized = normalizeTarget(target, registry);
        if (!normalized) {
            if (strict) throw new ValidationError('targets contains an unknown or invalid target');
            continue;
        }

        const key = `${normalized.type}:${normalized.id}`;
        if (seen.has(key)) continue;
        seen.add(key);
        result.push(normalized);
    }

    return result.slice(0, 80);
}

function normalizeTarget(target, registry = null) {
    if (typeof target === 'string') {
        if (RESOURCE_CATEGORIES.includes(target)) return { type: 'category', id: target };
        if (target.startsWith('category:')) {
            const id = target.slice('category:'.length);
            if (RESOURCE_CATEGORIES.includes(id)) return { type: 'category', id };
        }
        if (target.startsWith('character:')) {
            const id = target.slice('character:'.length).trim();
            if (isKnownCharacterId(id, registry)) return { type: 'character', id };
        }
        return null;
    }

    if (!target || typeof target !== 'object') return null;
    const type = String(target.type || '').trim();
    const id = String(target.id || '').trim();

    if (type === 'category' && RESOURCE_CATEGORIES.includes(id)) return { type, id };
    if (type === 'character' && isKnownCharacterId(id, registry)) return { type, id };
    return null;
}

function isKnownCharacterId(id, registry) {
    if (!SAFE_CHARACTER_ID_PATTERN.test(id)) return false;
    return registry ? Boolean(registry.byId[id]) : true;
}

function suggestTargets(proposal) {
    const text = `${proposal.sourceTab} ${proposal.link.title} ${proposal.link.desc}`.toLowerCase();
    const targets = [];

    const add = id => targets.push({ type: 'category', id });

    if (hasAny(text, ['쿠폰', '코드', 'coupon', 'giftcode', 'redeem'])) add('code');
    if (hasAny(text, ['은열쇠', '실버키', '열쇠'])) add('silverkey');
    if (hasAny(text, ['명륜'])) add('myeongryun');
    if (hasAny(text, ['비밀계약', '계약', '밀계'])) add('covenant');
    if (hasAny(text, ['융재', '융재금구', '융재 금구', '금구'])) add('weapon');
    if (hasAny(text, ['융재 후기', '이번주 융재', '융재 금구', '금구', '융재'])) add('weekly_yungjae');
    if (hasAny(text, ['뉴비', '초보', '유입', '입문'])) add('newbie');
    if (hasAny(text, ['체스'])) add('chess');
    if (hasAny(text, ['환몽심잠', '환몽 심잠'])) add('dreamdive');
    if (hasAny(text, ['이벤트', 'event'])) add('event');

    return normalizeTargets(targets);
}

function hasAny(text, keywords) {
    return keywords.some(keyword => text.includes(keyword.toLowerCase()));
}

function defaultResourceSelection() {
    return {
        targets: [],
        activeRelems: DEFAULT_ACTIVE_RELEMS
    };
}

function normalizeResourceSelection(selection, registry = null) {
    return {
        targets: normalizeTargets(selection?.targets || [], registry),
        activeRelems: normalizeRelems(selection?.activeRelems),
        updatedAt: selection?.updatedAt || null,
        updatedBy: selection?.updatedBy || null
    };
}

function normalizeRelems(relems) {
    return RELEMS_ORDER.includes(relems) ? relems : DEFAULT_ACTIVE_RELEMS;
}

function replaceTargetsByType(currentTargets, type, replacementTargets, registry = null) {
    return normalizeTargets([
        ...normalizeTargets(currentTargets || [], registry).filter(target => target.type !== type),
        ...normalizeTargets(replacementTargets || [], registry).filter(target => target.type === type)
    ], registry);
}

function replaceCharacterTargetsByRelems(currentTargets, relems, replacementTargets, registry) {
    const normalizedRelems = normalizeRelems(relems);
    const retainedTargets = normalizeTargets(currentTargets || [], registry).filter(target => {
        if (target.type !== 'character') return true;
        return registry.byId[target.id]?.relems !== normalizedRelems;
    });
    const selectedTargets = normalizeTargets(replacementTargets || [], registry).filter(target => {
        return target.type === 'character' && registry.byId[target.id]?.relems === normalizedRelems;
    });

    return normalizeTargets([...retainedTargets, ...selectedTargets], registry);
}

function buildCharacterRegistry(manifest) {
    if (!Array.isArray(manifest) || manifest.length === 0 || manifest.length > 200) {
        throw new Error(`${CHARACTER_MANIFEST_PATH} must contain 1-200 characters`);
    }

    const characters = [];
    const byId = Object.create(null);
    for (const [index, entry] of manifest.entries()) {
        if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
            throw new Error(`${CHARACTER_MANIFEST_PATH}[${index}] must be an object`);
        }
        let id;
        let name;
        let relems;
        try {
            id = normalizeTextField(entry.id, `character_manifest[${index}].id`, {
                maxLength: 80,
                required: true
            });
            name = normalizeTextField(entry.name, `character_manifest[${index}].name`, {
                maxLength: 100,
                required: true,
                forbidHtml: true
            });
            relems = normalizeTextField(entry.relems, `character_manifest[${index}].relems`, {
                maxLength: 20,
                required: true
            });
        } catch (error) {
            throw new Error(`${CHARACTER_MANIFEST_PATH} is invalid: ${safeErrorMessage(error)}`);
        }
        if (!SAFE_CHARACTER_ID_PATTERN.test(id)) {
            throw new Error(`Invalid character id in ${CHARACTER_MANIFEST_PATH}: ${id}`);
        }
        if (!RELEMS_ORDER.includes(relems)) {
            throw new Error(`Invalid relems in ${CHARACTER_MANIFEST_PATH}: ${relems}`);
        }
        if (byId[id]) {
            throw new Error(`Duplicate character id in ${CHARACTER_MANIFEST_PATH}: ${id}`);
        }

        const character = Object.freeze({ id, name, relems });
        characters.push(character);
        byId[id] = character;
    }

    for (const relems of RELEMS_ORDER) {
        const count = characters.filter(character => character.relems === relems).length;
        if (count === 0 || count > 25) {
            throw new Error(`${CHARACTER_MANIFEST_PATH} must contain 1-25 ${relems} characters for Discord selection`);
        }
    }

    return Object.freeze({
        characters: Object.freeze(characters),
        byId: Object.freeze(byId)
    });
}

function formatTarget(target) {
    if (!target) return 'unknown';
    if (target.type === 'category') {
        return `category:${target.id}`;
    }
    return `${target.type}:${target.id}`;
}

function getResourceCategories() {
    return RESOURCE_CATEGORIES.map(id => ({ id, label: RESOURCE_CATEGORY_LABELS[id] || id }));
}

export {
    CHARACTER_MANIFEST_PATH,
    RELEMS_LABELS,
    RELEMS_ORDER,
    RESOURCE_CATEGORIES,
    RESOURCE_CATEGORY_LABELS,
    buildCharacterRegistry,
    defaultResourceSelection,
    formatTarget,
    getResourceCategories,
    normalizeRelems,
    normalizeResourceProposal,
    normalizeResourceSelection,
    normalizeTargets,
    replaceCharacterTargetsByRelems,
    replaceTargetsByType,
    resourceProposalFingerprint
};
