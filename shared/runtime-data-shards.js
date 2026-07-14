const SAFE_RUNTIME_ROUTE_KEY = /^[A-Za-z0-9_-]{1,80}$/;

function compareCodeUnits(left, right) {
    return left < right ? -1 : left > right ? 1 : 0;
}

function isPlainObject(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
    const prototype = Object.getPrototypeOf(value);
    return prototype === Object.prototype || prototype === null;
}

function sortJsonValue(value) {
    if (Array.isArray(value)) return value.map(sortJsonValue);
    if (!isPlainObject(value)) return value;

    const sorted = Object.create(null);
    for (const key of Object.keys(value).sort(compareCodeUnits)) {
        sorted[key] = sortJsonValue(value[key]);
    }
    return sorted;
}

function serializeDeterministicJson(value) {
    return `${JSON.stringify(sortJsonValue(value), null, 2)}\n`;
}

function assertSafeRuntimeRouteKey(value, label = 'runtime route key') {
    if (typeof value !== 'string' || !SAFE_RUNTIME_ROUTE_KEY.test(value)) {
        throw new Error(`${label} is unsafe: ${JSON.stringify(value)}`);
    }
    return value;
}

function getResourceLinkShardPath(target) {
    const id = assertSafeRuntimeRouteKey(target?.id, 'resource link target id');
    if (target?.type === 'category') {
        return `data/resource-links/categories/${id}.json`;
    }
    if (target?.type === 'character') {
        return `data/resource-links/characters/${id}.json`;
    }
    throw new Error(`Unsupported resource link target type: ${String(target?.type || '')}`);
}

function getCharacterEffectShardPath(characterId) {
    const id = assertSafeRuntimeRouteKey(characterId, 'character effect id');
    return `data/character-effects/${id}.json`;
}

function buildResourceLinkShardUpdates(canonicalContent, targets) {
    let database;
    try {
        database = typeof canonicalContent === 'string'
            ? JSON.parse(canonicalContent)
            : canonicalContent;
    } catch (error) {
        throw new Error(`data/resource_links.json is not valid JSON: ${error.message}`);
    }

    if (!isPlainObject(database)
        || !isPlainObject(database.categories)
        || !isPlainObject(database.characters)) {
        throw new Error('data/resource_links.json must contain categories and characters objects');
    }
    if (!Array.isArray(targets)) {
        throw new Error('resource link shard targets must be an array');
    }

    const updates = [];
    const seen = new Set();
    for (const target of targets) {
        const path = getResourceLinkShardPath(target);
        if (seen.has(path)) continue;
        seen.add(path);

        let value;
        if (target.type === 'category') {
            if (!Object.hasOwn(database.categories, target.id)) {
                throw new Error(`Missing resource link category: ${target.id}`);
            }
            value = database.categories[target.id];
            if (!isPlainObject(value)
                || typeof value.title !== 'string'
                || !value.title.trim()
                || value.title !== value.title.trim()
                || !Array.isArray(value.links)) {
                throw new Error(`Invalid resource link category: ${target.id}`);
            }
        } else {
            if (!Object.hasOwn(database.characters, target.id)) {
                throw new Error(`Missing resource link character: ${target.id}`);
            }
            value = database.characters[target.id];
            if (!Array.isArray(value)) {
                throw new Error(`Invalid resource link character: ${target.id}`);
            }
        }

        updates.push({
            target: { type: target.type, id: target.id },
            path,
            content: serializeDeterministicJson(value)
        });
    }
    return updates;
}

export {
    SAFE_RUNTIME_ROUTE_KEY,
    assertSafeRuntimeRouteKey,
    buildResourceLinkShardUpdates,
    compareCodeUnits,
    getCharacterEffectShardPath,
    getResourceLinkShardPath,
    isPlainObject,
    serializeDeterministicJson,
    sortJsonValue
};
