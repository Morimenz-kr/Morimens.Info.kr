/**
 * Guarded storage primitives for the party builder.
 *
 * The adapter accepts a provider so merely accessing browser storage cannot
 * crash module evaluation in privacy-restricted browsers. The same boundary also
 * makes the persistence layer independently testable in Node.
 */

export function parseJson(value, fallback = null) {
    if (typeof value !== 'string' || value.trim() === '') return fallback;
    try {
        return JSON.parse(value);
    } catch {
        return fallback;
    }
}

export function normalizeStringArray(values, limit = Number.POSITIVE_INFINITY) {
    if (!Array.isArray(values)) return [];
    const normalizedLimit = Number.isFinite(limit) ? Math.max(0, Math.floor(limit)) : Number.POSITIVE_INFINITY;
    return [...new Set(
        values
            .filter(value => typeof value === 'string' && value.trim())
            .map(value => value.trim())
    )].slice(0, normalizedLimit);
}

export function createStorageAdapter(storageProvider, logger = console) {
    const getStorage = typeof storageProvider === 'function'
        ? storageProvider
        : () => storageProvider;

    function getRaw(key) {
        try {
            return getStorage()?.getItem(key) ?? null;
        } catch (error) {
            logger?.warn?.(`Unable to read local storage key '${key}'.`, error);
            return null;
        }
    }

    function setRaw(key, value) {
        try {
            const storage = getStorage();
            if (!storage?.setItem) return false;
            storage.setItem(key, value);
            return true;
        } catch (error) {
            logger?.warn?.(`Unable to write local storage key '${key}'.`, error);
            return false;
        }
    }

    function remove(key) {
        try {
            const storage = getStorage();
            if (!storage?.removeItem) return false;
            storage.removeItem(key);
            return true;
        } catch (error) {
            logger?.warn?.(`Unable to remove local storage key '${key}'.`, error);
            return false;
        }
    }

    function readStringArray(key, limit = Number.POSITIVE_INFINITY) {
        return normalizeStringArray(parseJson(getRaw(key), []), limit);
    }

    return Object.freeze({ getRaw, setRaw, remove, readStringArray });
}

export function createVersionedStateStore(options) {
    const { storage, key, legacyKey, version, maxTeams, validator } = options || {};
    if (!storage?.getRaw || !storage?.setRaw || !storage?.remove) {
        throw new TypeError('Party Builder state store requires a storage adapter.');
    }
    if (!key || !legacyKey || !Number.isInteger(version) || version < 1 || !Number.isInteger(maxTeams) || maxTeams < 1) {
        throw new TypeError('Party Builder state store requires keys, version, and maxTeams.');
    }
    if (!validator?.sanitizePages) {
        throw new TypeError('Party Builder state store requires a state validator.');
    }

    function load(defaultPages) {
        const rawSaved = storage.getRaw(key);
        const parsed = parseJson(rawSaved);
        let loadedPages = null;
        let currentPageIdx = 0;
        let currentTeamIdx = 0;
        let needsRewrite = false;
        let recoveredCorruption = false;
        let usedLegacy = false;

        if (Array.isArray(parsed)) {
            loadedPages = parsed;
            needsRewrite = true;
        } else if (parsed && typeof parsed === 'object' && Array.isArray(parsed.pages)) {
            loadedPages = parsed.pages;
            currentPageIdx = Number.isInteger(parsed.currentPageIdx) ? parsed.currentPageIdx : 0;
            currentTeamIdx = Number.isInteger(parsed.currentTeamIdx) ? parsed.currentTeamIdx : 0;
            needsRewrite = parsed.version !== version;
        } else if (rawSaved) {
            needsRewrite = true;
            recoveredCorruption = true;
        }

        if (!loadedPages) {
            const legacyTeams = parseJson(storage.getRaw(legacyKey));
            if (Array.isArray(legacyTeams)) {
                loadedPages = [{ pageName: 'PAGE 1', teams: legacyTeams }];
                needsRewrite = true;
                usedLegacy = true;
            }
        }

        const pages = validator.sanitizePages(loadedPages || defaultPages);
        return Object.freeze({
            pages,
            currentPageIdx: Math.max(0, Math.min(currentPageIdx, pages.length - 1)),
            currentTeamIdx: Math.max(0, Math.min(currentTeamIdx, maxTeams - 1)),
            needsRewrite,
            recoveredCorruption,
            usedLegacy
        });
    }

    function save(state) {
        return storage.setRaw(key, JSON.stringify({
            version,
            currentPageIdx: state.currentPageIdx,
            currentTeamIdx: state.currentTeamIdx,
            pages: state.pages
        }));
    }

    function clearLegacy() {
        return storage.remove(legacyKey);
    }

    return Object.freeze({ load, save, clearLegacy });
}
