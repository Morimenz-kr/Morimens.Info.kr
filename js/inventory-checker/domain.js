import {
    CHARACTER_CLASS_LABELS,
    RELEMS_LABELS,
    RELEMS_ORDER
} from '../domain/character-taxonomy.js?v=v1.4.0-site-quality-20260713-r4';

export const STORAGE_SCHEMA_VERSION = 3;

export const GROUP_LABELS = Object.freeze({
    standard: '통상',
    forgotten: '망각편',
    celestial: '성신편'
});

export const CLASS_LABELS = CHARACTER_CLASS_LABELS;
export { RELEMS_LABELS, RELEMS_ORDER };
export const BREAKTHROUGH_LABELS = Object.freeze([
    '명함', '1돌', '2돌', '3돌', '4돌', '5돌', '6돌', '초한',
    '8돌', '9돌', '10돌', '11돌', '12돌', '13돌', '14돌', '풀돌'
]);

export const LINKED_CHARACTER_BREAKTHROUGH_GROUPS = Object.freeze([
    Object.freeze(['ramona', 'ramona_timeworn'])
]);

const LINKED_CHARACTER_BREAKTHROUGH_MAP = Object.freeze(
    Object.fromEntries(LINKED_CHARACTER_BREAKTHROUGH_GROUPS.flatMap(group => group.map(id => [id, group])))
);
const UNSAFE_RECORD_KEYS = new Set(['__proto__', 'constructor', 'prototype']);
const SAFE_CATALOG_ID_PATTERN = /^[A-Za-z0-9_-]{1,80}$/;

function isRecord(value) {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function sameRecord(first, second) {
    const firstEntries = Object.entries(first);
    const secondEntries = Object.entries(second);
    if (firstEntries.length !== secondEntries.length) return false;
    return firstEntries.every(([key, value]) => second[key] === value);
}

function defaultMatchesSearch(text, query) {
    return String(text || '').toLowerCase().includes(String(query || '').toLowerCase());
}

export function buildGroupMap(gachatype) {
    if (!isRecord(gachatype)) return {};
    const map = {};
    Object.entries(gachatype).forEach(([group, ids]) => {
        if (!Array.isArray(ids)) return;
        ids.forEach(id => {
            if (typeof id !== 'string' || !id) return;
            if (!map[id]) map[id] = [];
            map[id].push(group);
        });
    });
    return map;
}

export function createInventoryCatalog({ characters, wheels, gachatype }) {
    if (!Array.isArray(characters) || characters.length === 0) {
        throw new TypeError('각성체 목록이 비어 있거나 올바른 배열이 아닙니다.');
    }
    if (!Array.isArray(wheels) || wheels.length === 0) {
        throw new TypeError('명륜 목록이 비어 있거나 올바른 배열이 아닙니다.');
    }
    if (!isRecord(gachatype)) {
        throw new TypeError('각성체 분류 데이터가 올바른 객체가 아닙니다.');
    }

    const characterIds = new Set();
    for (const character of characters) {
        const id = typeof character?.id === 'string' ? character.id.trim() : '';
        if (!SAFE_CATALOG_ID_PATTERN.test(id) || characterIds.has(id)) {
            throw new TypeError(`각성체 식별자가 없거나 중복되었습니다: ${id || '(empty)'}`);
        }
        characterIds.add(id);
    }

    const shareWheels = filterShareWheels(wheels);
    if (shareWheels.length === 0) throw new TypeError('표시할 SR/SSR 명륜이 없습니다.');
    const wheelIds = new Set();
    for (const wheel of shareWheels) {
        const id = typeof wheel?.english_name === 'string' ? wheel.english_name.trim() : '';
        if (!SAFE_CATALOG_ID_PATTERN.test(id) || wheelIds.has(id)) {
            throw new TypeError(`명륜 식별자가 없거나 중복되었습니다: ${id || '(empty)'}`);
        }
        wheelIds.add(id);
    }

    const groupedIds = new Set();
    for (const group of Object.keys(GROUP_LABELS)) {
        const ids = gachatype[group];
        if (!Array.isArray(ids) || ids.length === 0) {
            throw new TypeError(`각성체 분류 ${group}가 비어 있거나 올바른 배열이 아닙니다.`);
        }
        for (const id of ids) {
            if (typeof id !== 'string' || !characterIds.has(id)) {
                throw new TypeError(`각성체 분류 ${group}가 알 수 없는 식별자를 참조합니다: ${id}`);
            }
            groupedIds.add(id);
        }
    }
    if (groupedIds.size !== characterIds.size) {
        throw new TypeError('각성체 분류 데이터가 모든 각성체를 포함하지 않습니다.');
    }

    return {
        characters,
        wheels: shareWheels,
        groupByCharacterId: buildGroupMap(gachatype)
    };
}

export function getCharacterGroups(groupByCharacterId, id) {
    const groups = groupByCharacterId?.[id];
    return Array.isArray(groups) && groups.length > 0 ? groups : ['standard'];
}

export function matchesInventorySearch(text, query, matchesSearch = defaultMatchesSearch) {
    if (!query) return true;
    return Boolean(matchesSearch(text, query));
}

export function normalizeGrade(grade) {
    return String(grade || '').trim().toUpperCase();
}

export function isShareWheel(wheel) {
    const grade = normalizeGrade(wheel?.grade);
    return grade === 'SSR' || grade === 'SR';
}

export function filterShareWheels(wheels) {
    return (Array.isArray(wheels) ? wheels : []).filter(isShareWheel);
}

export function filterCharacters({
    characters,
    groupByCharacterId,
    groupFilter = 'all',
    classFilter = 'all',
    search = '',
    matchesSearch = defaultMatchesSearch
}) {
    return (Array.isArray(characters) ? characters : []).filter(character => {
        const groupMatch = groupFilter === 'all'
            || getCharacterGroups(groupByCharacterId, character.id).includes(groupFilter);
        const classMatch = classFilter === 'all' || character.class === classFilter;
        return groupMatch
            && classMatch
            && matchesInventorySearch(character.name, search, matchesSearch);
    });
}

export function groupCharactersByRelems(characters) {
    const source = Array.isArray(characters) ? characters : [];
    return RELEMS_ORDER.map(relems => ({
        relems,
        characters: source.filter(character => character.relems === relems)
    })).filter(group => group.characters.length > 0);
}

export function filterWheels({
    wheels,
    gradeFilter = 'all',
    search = '',
    matchesSearch = defaultMatchesSearch
}) {
    return (Array.isArray(wheels) ? wheels : []).filter(wheel => {
        if (!isShareWheel(wheel)) return false;
        const gradeMatch = gradeFilter === 'all' || normalizeGrade(wheel.grade) === gradeFilter;
        const text = `${wheel.korean_name || ''} ${wheel.main_stat || ''}`;
        return gradeMatch && matchesInventorySearch(text, search, matchesSearch);
    });
}

export function getVisibleInventoryIds({
    tab,
    characters,
    wheels,
    groupByCharacterId,
    characterFilter,
    characterClassFilter,
    wheelFilter,
    search,
    matchesSearch = defaultMatchesSearch
}) {
    if (tab === 'characters') {
        return filterCharacters({
            characters,
            groupByCharacterId,
            groupFilter: characterFilter,
            classFilter: characterClassFilter,
            search,
            matchesSearch
        }).map(character => character.id);
    }
    return filterWheels({ wheels, gradeFilter: wheelFilter, search, matchesSearch })
        .map(wheel => wheel.english_name);
}

export function filterSelectedCharacters({
    characters,
    selectedCharacters,
    groupByCharacterId,
    groupFilter,
    classFilter,
    search,
    matchesSearch = defaultMatchesSearch
}) {
    return filterCharacters({
        characters,
        groupByCharacterId,
        groupFilter,
        classFilter,
        search,
        matchesSearch
    }).filter(character => selectedCharacters.has(character.id));
}

export function filterSelectedWheels({
    wheels,
    selectedWheels,
    gradeFilter,
    search,
    matchesSearch = defaultMatchesSearch
}) {
    return filterWheels({ wheels, gradeFilter, search, matchesSearch })
        .filter(wheel => selectedWheels.has(wheel.english_name));
}

export function clampBreakthrough(value) {
    const parsed = Number.parseInt(value, 10);
    if (!Number.isFinite(parsed)) return 0;
    return Math.max(0, Math.min(BREAKTHROUGH_LABELS.length - 1, parsed));
}

export function stepBreakthrough(value, direction) {
    const parsedDirection = Number.parseInt(direction, 10);
    const next = clampBreakthrough(value) + (Number.isFinite(parsedDirection) ? parsedDirection : 0);
    if (next < 0) return BREAKTHROUGH_LABELS.length - 1;
    if (next >= BREAKTHROUGH_LABELS.length) return 0;
    return next;
}

export function getBreakthroughLabel(value) {
    return BREAKTHROUGH_LABELS[clampBreakthrough(value)];
}

export function normalizeBreakthroughs(values) {
    if (!isRecord(values)) return {};
    return Object.entries(values).reduce((result, [id, value]) => {
        if (!UNSAFE_RECORD_KEYS.has(id)) result[id] = clampBreakthrough(value);
        return result;
    }, {});
}

export function getLinkedCharacterBreakthroughIds(id) {
    return LINKED_CHARACTER_BREAKTHROUGH_MAP[id] || [id];
}

export function getCharacterBreakthrough(characterBreakthroughs, id) {
    return getLinkedCharacterBreakthroughIds(id).reduce((value, linkedId) => {
        if (!Object.prototype.hasOwnProperty.call(characterBreakthroughs, linkedId)) return value;
        return Math.max(value, clampBreakthrough(characterBreakthroughs[linkedId]));
    }, 0);
}

export function setCharacterBreakthrough(characterBreakthroughs, selectedCharacters, id, value) {
    const next = { ...characterBreakthroughs };
    const breakthrough = clampBreakthrough(value);
    getLinkedCharacterBreakthroughIds(id).forEach(linkedId => {
        if (selectedCharacters.has(linkedId)) next[linkedId] = breakthrough;
    });
    return next;
}

export function getWheelBreakthrough(wheelBreakthroughs, id) {
    return clampBreakthrough(wheelBreakthroughs[id]);
}

export function normalizeInventorySnapshot(saved) {
    if (!isRecord(saved)) return null;
    return {
        schemaVersion: saved.schemaVersion,
        characters: Array.isArray(saved.characters)
            ? saved.characters.filter(id => typeof id === 'string')
            : [],
        wheels: Array.isArray(saved.wheels)
            ? saved.wheels.filter(id => typeof id === 'string')
            : [],
        characterBreakthroughs: normalizeBreakthroughs(saved.characterBreakthroughs),
        wheelBreakthroughs: normalizeBreakthroughs(saved.wheelBreakthroughs)
    };
}

export function createInventorySnapshot(state) {
    return {
        schemaVersion: STORAGE_SCHEMA_VERSION,
        characters: Array.from(state.selectedCharacters),
        wheels: Array.from(state.selectedWheels),
        characterBreakthroughs: normalizeBreakthroughs(state.characterBreakthroughs),
        wheelBreakthroughs: normalizeBreakthroughs(state.wheelBreakthroughs)
    };
}

export function reconcileWheelState(wheels, selectedWheels, wheelBreakthroughs) {
    const available = new Set(filterShareWheels(wheels).map(wheel => wheel.english_name));
    const nextSelected = new Set(Array.from(selectedWheels).filter(id => available.has(id)));
    const nextBreakthroughs = normalizeBreakthroughs(wheelBreakthroughs);
    Object.keys(nextBreakthroughs).forEach(id => {
        if (!available.has(id) || !nextSelected.has(id)) delete nextBreakthroughs[id];
    });
    nextSelected.forEach(id => {
        if (!Object.prototype.hasOwnProperty.call(nextBreakthroughs, id)) nextBreakthroughs[id] = 0;
    });
    const changed = nextSelected.size !== selectedWheels.size
        || Array.from(nextSelected).some(id => !selectedWheels.has(id))
        || !sameRecord(nextBreakthroughs, wheelBreakthroughs);
    return { selectedWheels: nextSelected, wheelBreakthroughs: nextBreakthroughs, changed };
}

export function reconcileCharacterBreakthroughs(characters, selectedCharacters, characterBreakthroughs) {
    const available = new Set(characters.map(character => character.id));
    let next = normalizeBreakthroughs(characterBreakthroughs);

    Object.keys(next).forEach(id => {
        if (!available.has(id) || !selectedCharacters.has(id)) delete next[id];
    });
    selectedCharacters.forEach(id => {
        if (!Object.prototype.hasOwnProperty.call(next, id)) {
            next = setCharacterBreakthrough(next, selectedCharacters, id, getCharacterBreakthrough(next, id));
        }
    });
    LINKED_CHARACTER_BREAKTHROUGH_GROUPS.forEach(group => {
        const selectedIds = group.filter(id => selectedCharacters.has(id));
        if (selectedIds.length < 2) return;
        const breakthrough = selectedIds.reduce(
            (value, id) => Math.max(value, getCharacterBreakthrough(next, id)),
            0
        );
        selectedIds.forEach(id => { next[id] = breakthrough; });
    });

    return {
        characterBreakthroughs: next,
        changed: !sameRecord(next, characterBreakthroughs)
    };
}

export function calculateShareCanvasScale(
    width,
    height,
    devicePixelRatio = 1,
    { maxPixels = 16000000, maxDimension = 8192 } = {}
) {
    const safeWidth = Math.max(1, Number(width) || 1);
    const safeHeight = Math.max(1, Number(height) || 1);
    const deviceScale = Math.max(1, Number(devicePixelRatio) || 1);
    const pixelScale = Math.sqrt(maxPixels / (safeWidth * safeHeight));
    const dimensionScale = maxDimension / Math.max(safeWidth, safeHeight);
    return Math.max(0.25, Math.min(deviceScale, pixelScale, dimensionScale));
}
