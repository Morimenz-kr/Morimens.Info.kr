/* Party Builder equipment-domain primitives.
 * These exports are deterministic and do not read or mutate DOM/application state.
 */

function toSet(value) {
    return value instanceof Set ? value : new Set(Array.isArray(value) ? value : []);
}

export function collectEquippedWheelIds(page) {
    const equipped = new Set();
    (Array.isArray(page?.teams) ? page.teams : []).forEach(team => {
        (Array.isArray(team?.wheels) ? team.wheels : []).forEach(slots => {
            (Array.isArray(slots) ? slots : []).forEach(wheelId => {
                if (wheelId) equipped.add(wheelId);
            });
        });
    });
    return equipped;
}

export function collectEquippedKeyIds(page, excludedTeamIndex = -1) {
    const equipped = new Set();
    (Array.isArray(page?.teams) ? page.teams : []).forEach((team, teamIndex) => {
        if (teamIndex !== excludedTeamIndex && team?.key) equipped.add(team.key);
    });
    return equipped;
}

export function createWheelOptionModels(wheels, options = {}) {
    const currentWheelId = options.currentWheelId || null;
    const usedWheelIds = toSet(options.usedWheelIds);
    const ownedWheelIds = toSet(options.ownedWheelIds);
    const activeTags = toSet(options.activeTags);
    const activeMainStats = toSet(options.activeMainStats);
    const normalizeMainStat = typeof options.normalizeMainStat === 'function'
        ? options.normalizeMainStat
        : value => String(value || '').trim();
    const matchesSearch = typeof options.matchesSearch === 'function'
        ? options.matchesSearch
        : () => true;

    return (Array.isArray(wheels) ? wheels : [])
        .filter(wheel => {
            const wheelId = wheel?.english_name;
            if (!wheelId) return false;
            if (options.ownedOnly && !ownedWheelIds.has(wheelId) && wheelId !== currentWheelId) return false;
            if (activeTags.size && ![...activeTags].every(tag => (wheel.tags || []).includes(tag))) return false;
            if (activeMainStats.size && !activeMainStats.has(normalizeMainStat(wheel.main_stat))) return false;
            return matchesSearch(wheel);
        })
        .map(wheel => Object.freeze({
            item: wheel,
            isSelected: wheel.english_name === currentWheelId,
            isUsed: usedWheelIds.has(wheel.english_name) && wheel.english_name !== currentWheelId
        }));
}

export function createKeyOptionModels(keys, options = {}) {
    const currentKeyId = options.currentKeyId || null;
    const usedKeyIds = toSet(options.usedKeyIds);
    const recentKeyIds = Array.isArray(options.recentKeyIds) ? options.recentKeyIds : null;
    const matchesSearch = typeof options.matchesSearch === 'function'
        ? options.matchesSearch
        : () => true;
    const filtered = (Array.isArray(keys) ? keys : []).filter(key => (
        key?.english_name && matchesSearch(key)
    ));

    if (recentKeyIds) {
        const rank = new Map(recentKeyIds.map((keyId, index) => [keyId, index]));
        filtered.sort((left, right) => (
            (rank.get(left.english_name) ?? Number.MAX_SAFE_INTEGER)
            - (rank.get(right.english_name) ?? Number.MAX_SAFE_INTEGER)
        ));
    }

    return filtered.map(key => Object.freeze({
        item: key,
        isSelected: key.english_name === currentKeyId,
        isUsed: usedKeyIds.has(key.english_name) && key.english_name !== currentKeyId
    }));
}

export function findDedicatedKey(keys, characterName) {
    return (Array.isArray(keys) ? keys : []).find(key => {
        const tags = Array.isArray(key?.Tag) ? key.Tag : key?.tags;
        return Array.isArray(tags) && tags[0] === characterName;
    }) || null;
}

export function findDedicatedWheel(wheels, options = {}) {
    const normalizeTarget = typeof options.normalizeTarget === 'function'
        ? options.normalizeTarget
        : value => String(value || '').trim().toLowerCase();
    const targets = new Set([
        options.characterId,
        options.character?.id,
        options.character?.name,
        ...(Array.isArray(options.aliases) ? options.aliases : [])
    ].map(normalizeTarget).filter(Boolean));

    return (Array.isArray(wheels) ? wheels : []).find(wheel => (
        wheel?.grade === options.grade
        && Array.isArray(wheel.optimized_for)
        && wheel.optimized_for.some(target => targets.has(normalizeTarget(target)))
    )) || null;
}

export function withEquippedWheel(team, characterIndex, slotIndex, wheelId) {
    if (!Array.isArray(team?.wheels)
        || !Number.isInteger(characterIndex)
        || !Number.isInteger(slotIndex)
        || characterIndex < 0
        || characterIndex >= team.wheels.length
        || slotIndex < 0
        || slotIndex >= 2) {
        return team;
    }

    return {
        ...team,
        wheels: team.wheels.map((slots, index) => {
            const nextSlots = Array.isArray(slots) ? [...slots] : [null, null];
            if (index === characterIndex) nextSlots[slotIndex] = wheelId || null;
            return nextSlots;
        })
    };
}

export function withEquippedKey(team, keyId) {
    if (!team || typeof team !== 'object') return team;
    return { ...team, key: keyId || null };
}
