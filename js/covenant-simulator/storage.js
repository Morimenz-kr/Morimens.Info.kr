export const STORAGE_KEYS = Object.freeze({
    state: 'morimens_covenant_simulator_state_v1',
    presets: 'morimens_covenant_simulator_presets_v1',
    targetPresets: 'morimens_covenant_target_presets_v1'
});

function resolveStorage(storageProvider) {
    return typeof storageProvider === 'function' ? storageProvider() : storageProvider;
}

export function createJsonStorage(storageProvider) {
    return Object.freeze({
        read(key) {
            let raw;
            try {
                raw = resolveStorage(storageProvider).getItem(key);
            } catch (error) {
                return { ok: false, reason: 'access', error };
            }
            if (raw === null) return { ok: true, found: false, value: undefined };
            try {
                return { ok: true, found: true, value: JSON.parse(raw) };
            } catch (error) {
                return { ok: false, reason: 'parse', error };
            }
        },

        write(key, value) {
            try {
                resolveStorage(storageProvider).setItem(key, JSON.stringify(value));
                return { ok: true };
            } catch (error) {
                return { ok: false, reason: 'write', error };
            }
        },

        remove(key) {
            try {
                resolveStorage(storageProvider).removeItem(key);
                return { ok: true };
            } catch (error) {
                return { ok: false, reason: 'remove', error };
            }
        }
    });
}
