import './account-store.js';
const { kinds, equal, threeWay, validate, clone } = globalThis.MorimensAccountStore || (await import('./account-store.js')).default;

export class AccountSync {
    constructor(store, driver, { notify = () => {}, debounceMs = 15000, minIntervalMs = 60000 } = {}) {
        Object.assign(this, { store, driver, notify, debounceMs, minIntervalMs });
        this.generation = 0; this.lastWrite = 0; this.state = 'guest'; this.profile = null; this.conflict = null;
        store.subscribe(event => { if (event.reason === 'local' && event.uid) this.schedule(); });
    }
    emit(state, message = '') { this.state = state; this.notify({ state, message, profile: this.profile, conflict: this.conflict }); }
    async connect(user) {
        const generation = ++this.generation;
        clearTimeout(this.timer); this.conflict = null; this.profile = null;
        try {
            this.store.activate(user?.uid || null);
            if (!user) { this.emit('guest'); return; }
            this.store.setBlocked(true); this.emit('loading');
            const remote = await this.driver.load(user.uid);
            if (generation !== this.generation) return;
            this.profile = remote.profile;
            if (remote.profile.status === 'deleting') { this.emit('deleting', '삭제를 마저 진행해주세요.'); return; }
            this.store.setBlocked(false);
            for (const kind of kinds) {
                const snap = this.store.snapshot(kind), data = remote[kind];
                if (!snap.dirty) this.store.accept(kind, data);
                else {
                    const merged = threeWay(snap.base, snap.local, data);
                    if (merged.conflicts.length) { this.conflict = { kind, ...snap, remote: clone(data), paths: merged.conflicts }; break; }
                    this.store.reconcile(kind, data, merged.value);
                }
            }
            this.store.setBlocked(false);
            if (this.conflict) this.emit('conflict');
            else { this.emit(this.dirty() ? 'pending' : 'saved'); if (this.dirty()) this.schedule(); }
        } catch (error) {
            if (generation !== this.generation) return;
            // A failed bootstrap must not upload an empty or unverified cache.
            if (user && this.store.uid !== user.uid) this.store.activate(null);
            this.store.setBlocked(!!user); this.emit('error', this.message(error));
        }
    }
    dirty() { return !!this.store.uid && kinds.some(kind => this.store.snapshot(kind).dirty); }
    message(error) {
        const code = error?.code || '';
        if (/resource-exhausted/.test(code)) return '동기화 한도에 도달했습니다. 변경은 이 기기에 보관했습니다. 나중에 다시 시도해주세요.';
        if (/permission-denied/.test(code)) return '계정 저장 권한을 확인할 수 없습니다. 변경은 이 기기에 보관했습니다.';
        if (/network|unavailable/.test(code)) return '연결을 확인해주세요. 변경은 이 기기에 보관했습니다.';
        return error?.message || '동기화에 실패했습니다. 변경은 이 기기에 보관했습니다.';
    }
    schedule() {
        clearTimeout(this.timer);
        if (!this.store.uid || this.store.blocked || this.conflict || this.state === 'error' || this.state === 'deleting') return;
        if (this.busy) return;
        this.emit('pending');
        const delay = Math.max(this.debounceMs, this.lastWrite + this.minIntervalMs - Date.now());
        this.timer = setTimeout(() => this.flush(), delay);
    }
    async flush() {
        clearTimeout(this.timer);
        if (this.busy) return this.busy;
        if (!this.store.uid || this.store.blocked || this.conflict || this.state === 'deleting') return;
        const generation = this.generation, uid = this.store.uid;
        this.emit('saving');
        const task = (async () => {
            try {
                for (const kind of kinds) {
                    if (generation !== this.generation) return;
                    const snap = this.store.snapshot(kind);
                    if (!snap.dirty) continue;
                    const result = await this.driver.save(uid, kind, snap.base, snap.local);
                    if (generation !== this.generation) return;
                    if (result.conflicts?.length) {
                        this.conflict = { kind, ...snap, remote: result.remote, paths: result.conflicts };
                        this.emit('conflict'); return;
                    }
                    const rebased = this.store.accept(kind, result.data, snap.local); this.lastWrite = Date.now();
                    if (rebased?.conflicts.length) {
                        this.conflict = { uid, kind, ...rebased, paths: rebased.conflicts };
                        this.emit('conflict'); return;
                    }
                }
                if (generation === this.generation) this.emit(this.dirty() ? 'pending' : 'saved');
            } catch (error) { if (generation === this.generation) this.emit('error', this.message(error)); }
        })();
        this.busy = task;
        try { await task; } finally {
            if (this.busy === task) this.busy = null;
            if (this.state === 'pending') this.schedule();
        }
    }
    resolve(preference) {
        const conflict = this.conflict;
        if (!conflict || conflict.uid !== this.store.uid || !['local', 'remote'].includes(preference)) return;
        // Include edits made while the conflict dialog was open.
        const latest = this.store.snapshot(conflict.kind);
        const resolved = threeWay(conflict.base, latest.local, conflict.remote, preference);
        const value = resolved.value === null ? null : validate(conflict.kind, resolved.value);
        this.conflict = null;
        this.store.reconcile(conflict.kind, conflict.remote, value);
        this.emit(this.dirty() ? 'pending' : 'saved');
    }
    async refresh() {
        if (this.busy) await this.busy;
        // connect performs a 3-way merge and preserves unsent local changes.
        return this.connect(this.store.uid ? { uid: this.store.uid } : null);
    }
    async updateGameUid(gameUid) {
        if (!this.store.uid || this.store.blocked || this.state === 'deleting') throw Error('계정 상태를 먼저 확인해주세요.');
        if (typeof gameUid !== 'string' || gameUid.trim().length > 64 || /[\u0000-\u001f]/.test(gameUid)) throw Error('게임 UID는 64자 이내로 입력해주세요.');
        const generation = this.generation;
        const profile = await this.driver.updateProfile(this.store.uid, gameUid.trim() || null);
        if (generation === this.generation) { this.profile = profile; this.emit(this.state); }
    }
    async deleteAccount() {
        if (!this.store.uid) return;
        const uid = this.store.uid, generation = this.generation;
        // Reauthentication cancellation leaves both local and remote records untouched.
        await this.driver.reauthenticate();
        if (generation !== this.generation || uid !== this.store.uid) return;
        clearTimeout(this.timer);
        if (this.busy) await this.busy;
        if (generation !== this.generation || uid !== this.store.uid) return;
        this.store.setBlocked(true); this.emit('deleting');
        try {
            await this.driver.deleteData(uid);
            if (generation !== this.generation) return;
            await this.driver.deleteIdentity(uid);
            this.store.clearAccount(uid);
        } catch (error) { if (generation === this.generation) this.emit('deleting', this.message(error)); throw error; }
    }
}
