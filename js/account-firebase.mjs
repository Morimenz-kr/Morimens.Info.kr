import './account-store.js';
const { encode, validate, threeWay } = globalThis.MorimensAccountStore || (await import('./account-store.js')).default;

export async function createFirebaseDriver(settings, injectedSdk) {
    if (!settings?.enabled) return null;
    const config = settings.config;
    if (!config?.apiKey || !config?.projectId || !config?.authDomain || !config?.appId) throw Error('로그인 설정이 아직 준비되지 않았습니다.');
    if (settings.emulators && (!['localhost', '127.0.0.1', '[::1]'].includes(globalThis.location?.hostname || '') || !config.projectId.startsWith('demo-'))) throw Error('에뮬레이터는 로컬 데모 프로젝트에서만 사용할 수 있습니다.');
    const sdk = injectedSdk || await import('./firebase-sdk.generated.mjs').then(s => [s.app, s.auth, s.firestore]);
    const [A, H, F] = sdk;
    const app = A.initializeApp(config, 'morimens-account');
    const auth = H.getAuth(app), db = F.initializeFirestore(app, { localCache: F.memoryLocalCache() });
    if (settings.emulators) {
        H.connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
        F.connectFirestoreEmulator(db, '127.0.0.1', 8080);
    }
    const provider = new H.GoogleAuthProvider(); provider.setCustomParameters({ prompt: 'select_account' });
    const profileRef = uid => F.doc(db, 'users', uid);
    const stateRef = (uid, kind) => F.doc(db, 'users', uid, 'state', kind);
    const parse = (kind, snapshot) => {
        if (!snapshot.exists()) return null;
        const data = snapshot.data();
        if (data.schemaVersion !== 1 || !Number.isInteger(data.revision) || data.revision < 1 || typeof data.payloadJson !== 'string' || data.payloadJson.length > 65536) throw Error('이 계정 기록의 버전을 확인해주세요. 로컬 기록은 유지됩니다.');
        return validate(kind, JSON.parse(data.payloadJson));
    };
    async function ensureProfile(uid) {
        return F.runTransaction(db, async tx => {
            const ref = profileRef(uid), snapshot = await tx.get(ref);
            if (snapshot.exists()) {
                const data = snapshot.data();
                if (data.schemaVersion !== 1 || !['active', 'deleting'].includes(data.status)) throw Error('지원하지 않는 계정 상태입니다.');
                return data;
            }
            const data = { schemaVersion: 1, revision: 1, status: 'active', gameUid: null, createdAt: F.serverTimestamp(), updatedAt: F.serverTimestamp() };
            tx.set(ref, data); return data;
        }, { maxAttempts: 3 });
    }
    return {
        emulator: !!settings.emulators,
        observe: callback => H.onAuthStateChanged(auth, callback),
        login: () => H.signInWithPopup(auth, provider),
        logout: () => H.signOut(auth),
        async loginTest(email, password, create = false) {
            if (!settings.emulators) throw Error('운영에서는 사용할 수 없는 기능입니다.');
            return create ? H.createUserWithEmailAndPassword(auth, email, password) : H.signInWithEmailAndPassword(auth, email, password);
        },
        async load(uid) {
            const profile = await ensureProfile(uid);
            if (profile.status === 'deleting') return { profile, roster: null, parties: null };
            const [roster, parties] = await Promise.all(['roster', 'parties'].map(kind => F.getDocFromServer(stateRef(uid, kind))));
            return { profile, roster: parse('roster', roster), parties: parse('parties', parties) };
        },
        async save(uid, kind, base, local) {
            const checked = validate(kind, local);
            return F.runTransaction(db, async tx => {
                const ref = stateRef(uid, kind), snapshot = await tx.get(ref), remote = parse(kind, snapshot);
                const merged = threeWay(base, checked, remote);
                if (merged.conflicts.length) return { conflicts: merged.conflicts, remote };
                const data = validate(kind, merged.value);
                tx.set(ref, { schemaVersion: 1, revision: snapshot.exists() ? snapshot.data().revision + 1 : 1, updatedAt: F.serverTimestamp(), payloadJson: encode(data) });
                return { data };
            }, { maxAttempts: 3 });
        },
        async updateProfile(uid, gameUid) {
            return F.runTransaction(db, async tx => {
                const ref = profileRef(uid), snapshot = await tx.get(ref), previous = snapshot.data();
                if (previous?.status !== 'active') throw Error('이 계정은 삭제 중입니다.');
                const data = { ...previous, gameUid, revision: previous.revision + 1, updatedAt: F.serverTimestamp() };
                tx.set(ref, data); return data;
            }, { maxAttempts: 3 });
        },
        async reauthenticate() {
            if (!auth.currentUser) throw Error('먼저 로그인해주세요.');
            if (settings.emulators && auth.currentUser.providerData.some(p => p.providerId === 'password')) {
                const password = globalThis.prompt('테스트 계정 비밀번호를 다시 입력해주세요.');
                if (!password) throw Error('삭제를 취소했습니다.');
                return H.reauthenticateWithCredential(auth.currentUser, H.EmailAuthProvider.credential(auth.currentUser.email, password));
            }
            return H.reauthenticateWithPopup(auth.currentUser, provider);
        },
        async deleteData(uid) {
            await F.runTransaction(db, async tx => {
                const ref = profileRef(uid), snap = await tx.get(ref), data = snap.data();
                if (!data) throw Error('계정 상태를 확인할 수 없습니다.');
                if (data.status === 'deleting') return;
                tx.set(ref, { schemaVersion: 1, revision: data.revision + 1, status: 'deleting', createdAt: data.createdAt, updatedAt: F.serverTimestamp(), deleteRequestedAt: F.serverTimestamp(), gameUid: null });
            });
            const batch = F.writeBatch(db);
            for (const kind of ['roster', 'parties']) batch.delete(stateRef(uid, kind));
            await batch.commit();
        },
        deleteIdentity: uid => {
            if (auth.currentUser?.uid !== uid) throw Error('계정이 변경돼 삭제를 중단했습니다.');
            return H.deleteUser(auth.currentUser);
        }
    };
}
