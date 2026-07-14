const REQUIRED_DATA_FILES = Object.freeze({
    characters: 'data/character_manifest.json',
    wheels: 'data/wheel_list.json',
    keys: 'data/silverkey_list.json',
    rules: 'data/party_builder_rules.json'
});

function isPlainObject(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
    const prototype = Object.getPrototypeOf(value);
    return prototype === Object.prototype || prototype === null;
}

function assertArray(value, label) {
    if (!Array.isArray(value) || value.length === 0) {
        throw new TypeError(`${label} must be a non-empty array.`);
    }
    return value;
}

function assertUniqueStringField(items, field, label) {
    const seen = new Set();
    items.forEach((item, index) => {
        if (!isPlainObject(item)) throw new TypeError(`${label}[${index}] must be an object.`);
        const value = item[field];
        if (typeof value !== 'string' || value.trim() !== value || !value) {
            throw new TypeError(`${label}[${index}].${field} must be a non-empty trimmed string.`);
        }
        if (seen.has(value)) throw new TypeError(`${label} contains a duplicate ${field}: ${value}`);
        seen.add(value);
    });
}

function assertStringArrayMap(value, label) {
    if (!isPlainObject(value)) throw new TypeError(`${label} must be an object.`);
    Object.entries(value).forEach(([key, entries]) => {
        if (!key.trim() || !Array.isArray(entries) || entries.some(entry => typeof entry !== 'string' || !entry.trim())) {
            throw new TypeError(`${label}.${key || '(empty)'} must be an array of non-empty strings.`);
        }
    });
}

function validateRules(rules) {
    if (!isPlainObject(rules)) throw new TypeError('party_builder_rules must be an object.');
    if (
        !Array.isArray(rules.exclusive_groups)
        || rules.exclusive_groups.some(group => (
            !Array.isArray(group)
            || group.length < 2
            || group.some(id => typeof id !== 'string' || !id.trim())
        ))
    ) {
        throw new TypeError('party_builder_rules.exclusive_groups must contain string groups.');
    }
    assertStringArrayMap(rules.character_tags, 'party_builder_rules.character_tags');
    assertStringArrayMap(rules.tag_aliases, 'party_builder_rules.tag_aliases');
    assertStringArrayMap(rules.dedicated_wheel_aliases, 'party_builder_rules.dedicated_wheel_aliases');
    return rules;
}

export function validatePartyBuilderData(data) {
    if (!isPlainObject(data)) throw new TypeError('Party builder data must be an object.');
    const characters = assertArray(data.characters, 'character_manifest');
    const wheels = assertArray(data.wheels, 'wheel_list');
    const keys = assertArray(data.keys, 'silverkey_list');
    assertUniqueStringField(characters, 'id', 'character_manifest');
    assertUniqueStringField(wheels, 'english_name', 'wheel_list');
    assertUniqueStringField(keys, 'english_name', 'silverkey_list');

    return Object.freeze({
        characters,
        wheels,
        keys,
        rules: validateRules(data.rules)
    });
}

async function fetchRequiredJson(fetchImpl, url, label) {
    const response = await fetchImpl(url, { credentials: 'same-origin' });
    if (!response?.ok) throw new Error(`${label} request failed (${response?.status || 'network'}).`);
    try {
        return await response.json();
    } catch (error) {
        throw new Error(`${label} contains invalid JSON.`, { cause: error });
    }
}

export async function loadRequiredPartyBuilderData(options = {}) {
    const { fetchImpl, version = 'party-builder' } = options;
    if (typeof fetchImpl !== 'function') throw new TypeError('A fetch implementation is required.');
    const versionQuery = encodeURIComponent(String(version || 'party-builder'));
    const entries = Object.entries(REQUIRED_DATA_FILES);
    const values = await Promise.all(entries.map(([label, path]) => (
        fetchRequiredJson(fetchImpl, `${path}?v=${versionQuery}`, label)
    )));
    return validatePartyBuilderData(Object.fromEntries(
        entries.map(([label], index) => [label, values[index]])
    ));
}

export async function bootstrapPartyBuilder(options = {}) {
    const { loadData, onDataReady } = options;
    if (typeof loadData !== 'function' || typeof onDataReady !== 'function') {
        throw new TypeError('Party builder bootstrap requires loadData and onDataReady callbacks.');
    }
    const data = await loadData();
    return onDataReady(data);
}
