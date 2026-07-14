const INDEX_PATH = 'data/runtime-index.json';
const SAFE_KEY = /^[A-Za-z0-9_-]{1,80}$/;
const SHARD_TYPES = Object.freeze({
    category: {
        prefix: 'data/resource-links/categories',
        select: index => index.resourceLinks.categories
    },
    characterLinks: {
        prefix: 'data/resource-links/characters',
        select: index => index.resourceLinks.characters
    },
    characterEffects: {
        prefix: 'data/character-effects',
        select: index => index.characterEffects
    }
});

function isPlainObject(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
    const prototype = Object.getPrototypeOf(value);
    return prototype === Object.prototype || prototype === null;
}

function assertExactKeys(value, expected, label) {
    const actual = Object.keys(value).sort();
    const sortedExpected = [...expected].sort();
    if (actual.length !== sortedExpected.length || actual.some((key, index) => key !== sortedExpected[index])) {
        throw new TypeError(`${label} has an unsupported schema.`);
    }
}

function validateRouteMap(value, prefix, label) {
    if (!isPlainObject(value)) throw new TypeError(`${label} must be an object.`);
    Object.entries(value).forEach(([key, route]) => {
        if (!SAFE_KEY.test(key) || route !== `${prefix}/${key}.json`) {
            throw new TypeError(`${label}.${key || '(empty)'} has an unsafe shard route.`);
        }
    });
}

function assertObjectEntries(value, label) {
    value.forEach((entry, index) => {
        if (!isPlainObject(entry)) throw new TypeError(`${label}[${index}] must be an object.`);
    });
}

export function validateRuntimeIndex(index) {
    if (!isPlainObject(index)) throw new TypeError('Runtime index must be an object.');
    assertExactKeys(index, ['schemaVersion', 'resourceLinks', 'characterEffects'], 'Runtime index');
    if (index.schemaVersion !== 1) throw new TypeError('Unsupported runtime index schema version.');
    if (!isPlainObject(index.resourceLinks)) throw new TypeError('runtimeIndex.resourceLinks must be an object.');
    assertExactKeys(index.resourceLinks, ['categories', 'characters'], 'runtimeIndex.resourceLinks');
    validateRouteMap(index.resourceLinks.categories, SHARD_TYPES.category.prefix, 'runtimeIndex.resourceLinks.categories');
    validateRouteMap(index.resourceLinks.characters, SHARD_TYPES.characterLinks.prefix, 'runtimeIndex.resourceLinks.characters');
    validateRouteMap(index.characterEffects, SHARD_TYPES.characterEffects.prefix, 'runtimeIndex.characterEffects');
    return index;
}

export function getRuntimeShardPath(index, type, key) {
    validateRuntimeIndex(index);
    const definition = SHARD_TYPES[type];
    if (!definition) throw new TypeError(`Unknown runtime shard type: ${type}`);
    if (typeof key !== 'string' || !SAFE_KEY.test(key)) throw new TypeError('Runtime shard key is invalid.');
    const route = definition.select(index)[key];
    if (route !== `${definition.prefix}/${key}.json`) {
        throw new Error(`Runtime shard route is missing for ${type}:${key}.`);
    }
    return route;
}

export function validateRuntimeShard(type, data) {
    if (type === 'category') {
        if (!isPlainObject(data) || typeof data.title !== 'string' || !data.title.trim() || !Array.isArray(data.links)) {
            throw new TypeError('Resource category shard has an invalid shape.');
        }
        assertObjectEntries(data.links, 'Resource category links');
        return data;
    }
    if (type === 'characterLinks') {
        if (!Array.isArray(data)) throw new TypeError('Character resource-link shard must be an array.');
        assertObjectEntries(data, 'Character resource links');
        return data;
    }
    if (type === 'characterEffects') {
        if (!isPlainObject(data)) throw new TypeError('Character-effect shard must be an object.');
        return data;
    }
    throw new TypeError(`Unknown runtime shard type: ${type}`);
}

export function createRuntimeDataLoader(options = {}) {
    const { fetchJson, version = 'current' } = options;
    if (typeof fetchJson !== 'function') throw new TypeError('Runtime data loader requires fetchJson.');
    const versionQuery = encodeURIComponent(String(version || 'current'));
    const versioned = path => `${path}?v=${versionQuery}`;

    return Object.freeze({
        async loadIndex() {
            return validateRuntimeIndex(await fetchJson(versioned(INDEX_PATH)));
        },
        async loadShard(index, type, key) {
            const route = getRuntimeShardPath(index, type, key);
            return validateRuntimeShard(type, await fetchJson(versioned(route)));
        }
    });
}

export async function settleRuntimeShard(loader, index, type, key) {
    if (!loader?.loadShard) throw new TypeError('Runtime shard settlement requires a loader.');
    try {
        return Object.freeze({ data: await loader.loadShard(index, type, key), error: null });
    } catch (error) {
        return Object.freeze({ data: null, error });
    }
}
