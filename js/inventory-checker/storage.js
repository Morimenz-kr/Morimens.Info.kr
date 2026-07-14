export const INVENTORY_STORAGE_KEYS = Object.freeze({
    current: 'morimens_inventory_checker_v3',
    legacy: Object.freeze(['morimens_inventory_checker_v2', 'morimens_inventory_checker_v1'])
});

function resolveStorage(storageProvider) {
    return typeof storageProvider === 'function' ? storageProvider() : storageProvider;
}

export function createInventoryStorage(storageProvider) {
    return Object.freeze({
        readLatest() {
            for (const key of [INVENTORY_STORAGE_KEYS.current, ...INVENTORY_STORAGE_KEYS.legacy]) {
                let raw;
                try {
                    raw = resolveStorage(storageProvider).getItem(key);
                } catch (error) {
                    return { ok: false, reason: 'access', error };
                }
                if (raw === null) continue;
                try {
                    return { ok: true, found: true, sourceKey: key, value: JSON.parse(raw) };
                } catch (error) {
                    return { ok: false, reason: 'parse', sourceKey: key, error };
                }
            }
            return { ok: true, found: false };
        },

        write(snapshot) {
            try {
                resolveStorage(storageProvider).setItem(INVENTORY_STORAGE_KEYS.current, JSON.stringify(snapshot));
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
        },

        removeLegacy() {
            for (const key of INVENTORY_STORAGE_KEYS.legacy) {
                const result = this.remove(key);
                if (!result.ok) return result;
            }
            return { ok: true };
        }
    });
}
