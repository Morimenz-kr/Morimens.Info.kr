/**
 * Party Builder state validation, bound to the currently loaded data IDs.
 * This module has no browser or DOM dependencies.
 */

export function createValidator(options) {
    const {
        characters = [],
        wheels = [],
        keys = [],
        maxTeams,
        maxPages,
        createEmptyTeam,
        createEmptyPage
    } = options || {};

    if (!Number.isInteger(maxTeams) || maxTeams < 1 || !Number.isInteger(maxPages) || maxPages < 1) {
        throw new TypeError('Party Builder validator requires positive maxTeams and maxPages values.');
    }
    if (typeof createEmptyTeam !== 'function' || typeof createEmptyPage !== 'function') {
        throw new TypeError('Party Builder validator requires empty-state factories.');
    }

    const characterIds = new Set(characters.map(character => String(character.id)));
    const wheelIds = new Set(wheels.map(wheel => String(wheel.english_name)));
    const keyIds = new Set(keys.map(key => String(key.english_name)));

    function sanitizeName(value, fallback) {
        if (typeof value !== 'string') return fallback;
        const normalized = value.trim().slice(0, 15);
        return normalized || fallback;
    }

    function sanitizeReference(value, allowedValues) {
        if (value === null || value === undefined || value === '') return null;
        const normalized = String(value);
        return allowedValues.has(normalized) ? normalized : null;
    }

    function sanitizeTeam(rawTeam, index) {
        const fallback = createEmptyTeam(index);
        if (!rawTeam || typeof rawTeam !== 'object' || Array.isArray(rawTeam)) return fallback;

        const rawChars = Array.isArray(rawTeam.chars) ? rawTeam.chars.slice(0, 4) : [];
        const chars = Array.from(
            { length: 4 },
            (_, slotIndex) => sanitizeReference(rawChars[slotIndex], characterIds)
        );
        const rawWheels = Array.isArray(rawTeam.wheels) ? rawTeam.wheels.slice(0, 4) : [];
        const sanitizedWheels = Array.from({ length: 4 }, (_, slotIndex) => {
            const row = Array.isArray(rawWheels[slotIndex]) ? rawWheels[slotIndex].slice(0, 2) : [];
            return [sanitizeReference(row[0], wheelIds), sanitizeReference(row[1], wheelIds)];
        });

        let supportIdx = Number.isInteger(rawTeam.supportIdx) && rawTeam.supportIdx >= 0 && rawTeam.supportIdx < 4
            ? rawTeam.supportIdx
            : -1;
        if (supportIdx !== -1 && !chars[supportIdx]) supportIdx = -1;

        return {
            name: sanitizeName(rawTeam.name, fallback.name),
            chars,
            wheels: sanitizedWheels,
            key: sanitizeReference(rawTeam.key, keyIds),
            supportIdx
        };
    }

    function sanitizePage(rawPage, index) {
        const fallbackName = `PAGE ${index + 1}`;
        const rawTeams = rawPage && typeof rawPage === 'object' && Array.isArray(rawPage.teams)
            ? rawPage.teams.slice(0, maxTeams)
            : [];
        return {
            pageName: sanitizeName(rawPage?.pageName, fallbackName),
            teams: Array.from({ length: maxTeams }, (_, teamIndex) => sanitizeTeam(rawTeams[teamIndex], teamIndex))
        };
    }

    function sanitizePages(rawPages) {
        if (!Array.isArray(rawPages) || rawPages.length === 0) return [createEmptyPage('PAGE 1')];
        return rawPages.slice(0, maxPages).map(sanitizePage);
    }

    function isClipboardTeamPayload(data) {
        if (!data || typeof data !== 'object' || Array.isArray(data)) return false;
        if (!Array.isArray(data.chars) || data.chars.length !== 4) return false;
        if (!Array.isArray(data.wheels) || data.wheels.length !== 4) return false;
        if (!data.wheels.every(row => Array.isArray(row) && row.length === 2)) return false;
        return Number.isInteger(data.supportIdx) && data.supportIdx >= -1 && data.supportIdx < 4;
    }

    return Object.freeze({ sanitizeTeam, sanitizePages, isClipboardTeamPayload });
}
