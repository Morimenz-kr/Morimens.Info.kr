const { test } = require('node:test');
const assert = require('node:assert/strict');
const C = require('./account-store.js');
const memory = () => { const map = new Map(); return { getItem: key => map.get(key) ?? null, setItem: (key, value) => map.set(key, value), removeItem: key => map.delete(key) }; };
const roster = (owned = true, level = 1) => ({ version: 1, characters: { a: { owned, potency: 0, level, talents: {}, skills: {} } }, wheels: {}, presets: [] });
const team = (id, name = 'TEAM I') => ({ id, name, chars: [null, null, null, null], wheels: Array.from({ length: 4 }, () => [null, null]), key: null, supportIdx: -1 });

test('oversized cloud payload remains readable in guest and account local storage', () => {
    const store = C.createStore(memory());
    const data = [{ id: 'large', pageName: 'P', teams: [{ ...team('t'), usageSource: { a: '가'.repeat(16000), b: '나'.repeat(16000) } }] }];
    store.write('parties', data); assert.deepEqual(store.read('parties'), data);
    store.activate('large-account'); store.write('parties', data);
    assert.deepEqual(store.read('parties'), data); assert.equal(store.snapshot('parties').dirty, true);
    assert.throws(() => C.encode(store.read('parties')), /64KiB/);
});

test('guest migration reads old ownership and zero without rewriting originals', () => {
    const storage = memory(), raw = JSON.stringify({ characters: ['a'], wheels: ['w'], characterBreakthroughs: { a: 0 }, wheelBreakthroughs: { w: 15 } });
    storage.setItem(C.KEYS.legacy, raw); const store = C.createStore(storage);
    assert.equal(store.read('roster').characters.a.potency, 0);
    assert.equal(store.read('roster').wheels.w.potency, 15);
    assert.equal(storage.getItem(C.KEYS.legacy), raw); assert.equal(storage.getItem(C.KEYS.roster), null);
});
test('account switching isolates guest, two users and dirty changes', () => {
    const storage = memory(), store = C.createStore(storage);
    store.write('roster', roster(true, 10)); store.activate('user-a');
    assert.equal(store.read('roster'), null); store.write('roster', roster(false, 20));
    store.activate('user-b'); assert.equal(store.read('roster'), null); store.write('roster', roster(true, 30));
    store.activate('user-a'); assert.equal(store.read('roster').characters.a.level, 20); assert.equal(store.snapshot('roster').dirty, true);
    store.activate(null); assert.equal(store.read('roster').characters.a.level, 10);
});
test('corrupt source is rejected and retained', () => {
    const storage = memory(); storage.setItem(C.KEYS.parties, '{broken');
    assert.throws(() => C.createStore(storage).read('parties'));
    assert.equal(storage.getItem(C.KEYS.parties), '{broken');
});
test('atomic import fails without partially changing either document', () => {
    const store = C.createStore(memory()); store.activate('a');
    assert.throws(() => store.writeMany({ roster: roster(), parties: [{ invalid: true }] }));
    assert.equal(store.read('roster'), null); assert.equal(store.read('parties'), null);
});
test('two tabs rebase disk changes and reject overlapping edits instead of dropping them', () => {
    const storage = memory(), a = C.createStore(storage), b = C.createStore(storage);
    a.activate('user'); a.accept('roster', roster()); b.activate('user');
    a.write('roster', roster(false)); const second = roster(true, 2); b.write('roster', second);
    assert.equal(b.read('roster').characters.a.owned, false);
    a.activate('user'); b.activate('user'); a.write('roster', roster(false, 3));
    assert.throws(() => b.write('roster', roster(false, 4)), /다른 탭/);
    const fresh = C.createStore(storage); fresh.activate('user'); assert.equal(fresh.read('roster').characters.a.level, 3);
});
test('storage failure restores in-memory data and outbox', () => {
    const storage = memory(), store = C.createStore(storage); store.activate('a'); store.accept('roster', roster());
    storage.setItem = () => { throw Error('full'); };
    assert.throws(() => store.write('roster', roster(false)));
    assert.equal(store.read('roster').characters.a.owned, true); assert.equal(store.snapshot('roster').dirty, false);
});
test('zero and false are meaningful changes in a three-way merge', () => {
    const b = { owned: true, potency: 3, level: 10 };
    assert.deepEqual(C.threeWay(b, { ...b, owned: false, potency: 0 }, { ...b, level: 20 }), { value: { owned: false, potency: 0, level: 20 }, conflicts: [] });
    assert.deepEqual(C.threeWay(b, { ...b, level: 0 }, { ...b, level: 20 }).conflicts, ['/level']);
});
test('deleted properties remain deleted and delete/edit races are conflicts', () => {
    assert.deepEqual(C.threeWay({ a: 1, b: 1 }, { b: 1 }, { a: 1, b: 2 }).value, { b: 2 });
    assert.deepEqual(C.threeWay({ a: 1 }, {}, { a: 2 }).conflicts, ['/a']);
});
test('party edits merge by stable IDs despite order changes', () => {
    const a = { id: 'p', pageName: 'P', teams: [team('a'), team('b')] };
    const l = C.clone(a), r = C.clone(a); l.teams[0].name = '내 수정'; r.teams.reverse(); r.teams[0].name = '다른 수정';
    const merged = C.threeWay([a], [l], [r]);
    assert.equal(merged.conflicts.length, 0);
    assert.equal(merged.value[0].teams.find(t => t.id === 'a').name, '내 수정');
    assert.equal(merged.value[0].teams.find(t => t.id === 'b').name, '다른 수정');
});
test('in-flight saves rebase newer local edits on remote-only changes', () => {
    const store = C.createStore(memory()); store.activate('a'); const base = roster(true, 1); store.accept('roster', base);
    const sent = roster(true, 2); store.write('roster', sent);
    const newer = roster(false, 2); store.write('roster', newer);
    const remote = roster(true, 2); remote.wheels.w = { owned: true, potency: 1 };
    store.accept('roster', remote, sent);
    assert.equal(store.read('roster').characters.a.owned, false);
    assert.equal(store.read('roster').wheels.w.potency, 1);
    assert.equal(store.snapshot('roster').dirty, true);
});
test('ASCII JSON round trip and byte limit protect document size', () => {
    const value = { name: '각성체 😀', level: 0 }, encoded = C.encode(value);
    assert.match(encoded, /^[ -~]*$/); assert.equal(Buffer.byteLength(encoded), encoded.length); assert.deepEqual(JSON.parse(encoded), value);
    assert.throws(() => C.encode({ text: 'x'.repeat(65536) }), /64KiB/);
});
test('prototype keys and malformed growth are rejected', () => {
    assert.throws(() => C.canonical(JSON.parse('{"__proto__":{"polluted":true}}')));
    const value = roster(); value.characters.a.potency = 16; assert.throws(() => C.validateRoster(value));
    assert.equal({}.polluted, undefined);
});
test('saved observed loadout source survives party validation', () => {
    const source = { row: { members: [{ characterId: 'a', wheels: [{ id: 'w' }], covenants: [{ id: 'c', options: [1, 2] }] }] } };
    const data = [{ id: 'p', pageName: 'P', usagePeriod: 73, teams: [{ ...team('a'), usageSource: source }] }];
    assert.deepEqual(C.validateParties(data)[0].teams[0].usageSource, source);
});
test('import retains explicit account false and deduplicates presets', () => {
    const store = C.createStore(memory()), local = roster(false), incoming = roster(true);
    local.presets = incoming.presets = [{ name: '프리셋', patch: { owned: false } }];
    assert.equal(store.importRoster(local, incoming).characters.a.owned, false);
    assert.equal(store.importRoster(local, incoming).presets.length, 1);
});

test('sync skips unchanged writes and preserves an edit made during save', async () => {
    const { AccountSync } = await import('./account-sync.mjs');
    const store = C.createStore(memory()); let resolveSave, writes = 0;
    const driver = { load: async () => ({ profile: { status: 'active' }, roster: roster(), parties: null }), save: async () => { writes++; return new Promise(resolve => { resolveSave = resolve; }); } };
    const sync = new AccountSync(store, driver, { debounceMs: 100000 });
    await sync.connect({ uid: 'a' }); await sync.flush(); assert.equal(writes, 0);
    store.write('roster', roster(true, 2)); const flush = sync.flush();
    store.write('roster', roster(false, 2)); resolveSave({ data: roster(true, 2) }); await flush;
    assert.equal(store.snapshot('roster').dirty, true); assert.equal(store.read('roster').characters.a.owned, false); clearTimeout(sync.timer);
});
test('late account A load cannot change account B data', async () => {
    const { AccountSync } = await import('./account-sync.mjs'); const store = C.createStore(memory()); let resolveA;
    const sync = new AccountSync(store, { load: uid => uid === 'a' ? new Promise(resolve => { resolveA = resolve; }) : Promise.resolve({ profile: { status: 'active' }, roster: roster(false, 20), parties: null }) });
    const first = sync.connect({ uid: 'a' }); await sync.connect({ uid: 'b' }); resolveA({ profile: { status: 'active' }, roster: roster(true, 10), parties: null }); await first;
    assert.equal(store.uid, 'b'); assert.equal(store.read('roster').characters.a.level, 20);
});
test('bootstrap failure blocks empty-cache uploads', async () => {
    const { AccountSync } = await import('./account-sync.mjs'); const store = C.createStore(memory()); let saves = 0;
    const sync = new AccountSync(store, { load: async () => { throw Error('offline'); }, save: async () => saves++ });
    await sync.connect({ uid: 'a' }); assert.equal(sync.state, 'error'); assert.equal(store.blocked, true);
    assert.throws(() => store.write('roster', roster())); await sync.flush(); assert.equal(saves, 0);
});
test('conflict waits for a choice then retries against the observed remote', async () => {
    const { AccountSync } = await import('./account-sync.mjs'); const store = C.createStore(memory());
    const remote = roster(true, 3); let writes = 0;
    const driver = { load: async () => ({ profile: { status: 'active' }, roster: roster(), parties: null }), save: async (uid, kind, base, local) => { writes++; const m = C.threeWay(base, local, remote); return m.conflicts.length ? { conflicts: m.conflicts, remote } : { data: m.value }; } };
    const sync = new AccountSync(store, driver, { debounceMs: 100000 }); await sync.connect({ uid: 'a' });
    store.write('roster', roster(true, 2)); await sync.flush(); assert.equal(sync.state, 'conflict'); assert.equal(writes, 1);
    sync.resolve('remote'); await sync.flush(); assert.equal(store.read('roster').characters.a.level, 3); assert.equal(store.snapshot('roster').dirty, false); clearTimeout(sync.timer);
});
