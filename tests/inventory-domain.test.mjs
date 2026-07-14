import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

import {
    STORAGE_SCHEMA_VERSION,
    buildGroupMap,
    calculateShareCanvasScale,
    clampBreakthrough,
    createInventoryCatalog,
    createInventorySnapshot,
    filterCharacters,
    filterSelectedCharacters,
    filterSelectedWheels,
    filterShareWheels,
    filterWheels,
    getBreakthroughLabel,
    getCharacterBreakthrough,
    getCharacterGroups,
    getVisibleInventoryIds,
    groupCharactersByRelems,
    normalizeInventorySnapshot,
    reconcileCharacterBreakthroughs,
    reconcileWheelState,
    setCharacterBreakthrough,
    stepBreakthrough
} from '../js/inventory-checker/domain.js';
import {
    INVENTORY_STORAGE_KEYS,
    createInventoryStorage
} from '../js/inventory-checker/storage.js';
import { ROOT } from './helpers/site-fixture.mjs';

const CHARACTERS = [
    { id: 'ramona', name: '라모나', class: 'chorus', relems: 'chaos' },
    { id: 'ramona_timeworn', name: '환행 라모나', class: 'chorus', relems: 'ultra' },
    { id: 'alva', name: '엘바', class: 'assault', relems: 'aequor' }
];

const WHEELS = [
    { english_name: 'ssr-one', korean_name: '첫 번째', main_stat: '공격', grade: 'ssr' },
    { english_name: 'sr-one', korean_name: '두 번째', main_stat: '방어', grade: ' SR ' },
    { english_name: 'r-one', korean_name: '세 번째', main_stat: '회복', grade: 'R' }
];

test('catalog validation fails closed before an empty payload can reconcile saved selections', () => {
    const gachatype = {
        standard: ['alva'],
        forgotten: ['ramona'],
        celestial: ['ramona_timeworn']
    };
    const catalog = createInventoryCatalog({ characters: CHARACTERS, wheels: WHEELS, gachatype });
    assert.equal(catalog.characters.length, 3);
    assert.deepEqual(catalog.wheels.map(wheel => wheel.english_name), ['ssr-one', 'sr-one']);
    assert.deepEqual(catalog.groupByCharacterId.ramona, ['forgotten']);

    assert.throws(() => createInventoryCatalog({ characters: [], wheels: WHEELS, gachatype }), /각성체 목록/);
    assert.throws(() => createInventoryCatalog({ characters: CHARACTERS, wheels: [], gachatype }), /명륜 목록/);
    assert.throws(() => createInventoryCatalog({
        characters: CHARACTERS,
        wheels: WHEELS,
        gachatype: { ...gachatype, celestial: ['missing'] }
    }), /알 수 없는 식별자/);
    assert.throws(() => createInventoryCatalog({
        characters: [...CHARACTERS, { ...CHARACTERS[0] }],
        wheels: WHEELS,
        gachatype
    }), /중복/);
});

test('inventory bootstrap validates remote catalogs before reading or rewriting storage', async () => {
    const source = await readFile(path.join(ROOT, 'js/inventory_checker.js'), 'utf8');
    const start = source.indexOf('async function initialize()');
    const end = source.indexOf('\n    async function fetchJson', start);
    const initializeSource = source.slice(start, end);
    const validationIndex = initializeSource.indexOf('createInventoryCatalog({ characters, wheels, gachatype })');
    const storageReadIndex = initializeSource.indexOf('loadSavedState();');
    const reconciliationIndex = initializeSource.indexOf('removeUnavailableCharacterBreakthroughs();');

    assert.ok(validationIndex >= 0, 'bootstrap must validate all remote catalogs');
    assert.ok(storageReadIndex > validationIndex, 'saved state must not be read or migrated before catalog validation');
    assert.ok(reconciliationIndex > storageReadIndex, 'catalog reconciliation must happen only after validated load');
    assert.match(initializeSource, /catch \(error\)[\s\S]*renderLoadError\(\);/);
});

test('group maps and character filters preserve catalog order and default groups', () => {
    const groups = buildGroupMap({
        forgotten: ['ramona', 'ramona_timeworn'],
        celestial: ['ramona_timeworn'],
        invalid: 'alva'
    });
    assert.deepEqual(groups, {
        ramona: ['forgotten'],
        ramona_timeworn: ['forgotten', 'celestial']
    });
    assert.deepEqual(getCharacterGroups(groups, 'alva'), ['standard']);

    const filtered = filterCharacters({
        characters: CHARACTERS,
        groupByCharacterId: groups,
        groupFilter: 'forgotten',
        classFilter: 'chorus',
        search: '환행',
        matchesSearch: (text, query) => text.includes(query)
    });
    assert.deepEqual(filtered.map(character => character.id), ['ramona_timeworn']);

    const grouped = groupCharactersByRelems([CHARACTERS[2], CHARACTERS[1], CHARACTERS[0]]);
    assert.deepEqual(grouped.map(group => group.relems), ['chaos', 'aequor', 'ultra']);
});

test('wheel filtering admits only SR and SSR and applies grade and search together', () => {
    assert.deepEqual(filterShareWheels(WHEELS).map(wheel => wheel.english_name), ['ssr-one', 'sr-one']);
    const filtered = filterWheels({
        wheels: WHEELS,
        gradeFilter: 'SR',
        search: '방어',
        matchesSearch: (text, query) => text.includes(query)
    });
    assert.deepEqual(filtered.map(wheel => wheel.english_name), ['sr-one']);
});

test('visible and selected projections share the same filter contract', () => {
    const groupByCharacterId = buildGroupMap({ forgotten: ['ramona', 'ramona_timeworn'] });
    const selectedCharacters = new Set(['ramona_timeworn', 'alva']);
    const selectedWheels = new Set(['ssr-one', 'r-one']);
    const matchesSearch = (text, query) => text.includes(query);

    assert.deepEqual(getVisibleInventoryIds({
        tab: 'characters',
        characters: CHARACTERS,
        wheels: WHEELS,
        groupByCharacterId,
        characterFilter: 'forgotten',
        characterClassFilter: 'all',
        wheelFilter: 'all',
        search: '라모나',
        matchesSearch
    }), ['ramona', 'ramona_timeworn']);

    assert.deepEqual(filterSelectedCharacters({
        characters: CHARACTERS,
        selectedCharacters,
        groupByCharacterId,
        groupFilter: 'forgotten',
        classFilter: 'all',
        search: '',
        matchesSearch
    }).map(character => character.id), ['ramona_timeworn']);

    assert.deepEqual(filterSelectedWheels({
        wheels: WHEELS,
        selectedWheels,
        gradeFilter: 'all',
        search: '',
        matchesSearch
    }).map(wheel => wheel.english_name), ['ssr-one']);
});

test('breakthrough calculations clamp, wrap, and synchronize linked characters immutably', () => {
    assert.equal(clampBreakthrough(-3), 0);
    assert.equal(clampBreakthrough(99), 15);
    assert.equal(stepBreakthrough(15, 1), 0);
    assert.equal(stepBreakthrough(0, -1), 15);
    assert.equal(getBreakthroughLabel(7), '초한');

    const current = { ramona: 2, ramona_timeworn: 6 };
    assert.equal(getCharacterBreakthrough(current, 'ramona'), 6);
    const next = setCharacterBreakthrough(
        current,
        new Set(['ramona', 'ramona_timeworn']),
        'ramona',
        5
    );
    assert.deepEqual(next, { ramona: 5, ramona_timeworn: 5 });
    assert.deepEqual(current, { ramona: 2, ramona_timeworn: 6 });
});

test('v1/v2-shaped inventory snapshots normalize into the unchanged v3 contract', () => {
    const normalized = normalizeInventorySnapshot({
        characters: ['ramona', 42, 'ramona'],
        wheels: ['ssr-one', null],
        characterBreakthroughs: { ramona: '99', constructor: 7 },
        wheelBreakthroughs: { 'ssr-one': '-4' }
    });
    assert.deepEqual(normalized, {
        schemaVersion: undefined,
        characters: ['ramona', 'ramona'],
        wheels: ['ssr-one'],
        characterBreakthroughs: { ramona: 15 },
        wheelBreakthroughs: { 'ssr-one': 0 }
    });

    const snapshot = createInventorySnapshot({
        selectedCharacters: new Set(normalized.characters),
        selectedWheels: new Set(normalized.wheels),
        characterBreakthroughs: normalized.characterBreakthroughs,
        wheelBreakthroughs: normalized.wheelBreakthroughs
    });
    assert.equal(snapshot.schemaVersion, STORAGE_SCHEMA_VERSION);
    assert.deepEqual(snapshot.characters, ['ramona']);
    assert.deepEqual(snapshot.wheels, ['ssr-one']);
    assert.equal(normalizeInventorySnapshot([]), null);
});

test('catalog reconciliation removes unavailable wheels and synchronizes linked breakthroughs', () => {
    const wheels = reconcileWheelState(
        WHEELS,
        new Set(['ssr-one', 'r-one', 'missing']),
        { 'ssr-one': 4, 'r-one': 9, orphan: 2 }
    );
    assert.deepEqual(Array.from(wheels.selectedWheels), ['ssr-one']);
    assert.deepEqual(wheels.wheelBreakthroughs, { 'ssr-one': 4 });
    assert.equal(wheels.changed, true);

    const characters = reconcileCharacterBreakthroughs(
        CHARACTERS,
        new Set(['ramona', 'ramona_timeworn']),
        { ramona: 3, ramona_timeworn: 8, orphan: 4 }
    );
    assert.deepEqual(characters.characterBreakthroughs, { ramona: 8, ramona_timeworn: 8 });
    assert.equal(characters.changed, true);
});

test('canvas scaling obeys device, pixel, dimension, and minimum-scale limits', () => {
    assert.equal(calculateShareCanvasScale(1200, 800, 2), 2);
    const limited = calculateShareCanvasScale(10000, 1000, 3, {
        maxPixels: 1000000,
        maxDimension: 5000
    });
    assert.ok(Math.abs(limited - Math.sqrt(0.1)) < 1e-12);
    assert.equal(calculateShareCanvasScale(1e9, 1e9, 3), 0.25);
});

test('storage adapter reads legacy data, writes v3, cleans legacy keys, and reports failures', () => {
    const values = new Map([
        [INVENTORY_STORAGE_KEYS.legacy[0], JSON.stringify({ characters: ['ramona'] })]
    ]);
    const backend = {
        getItem: key => values.has(key) ? values.get(key) : null,
        setItem: (key, value) => values.set(key, value),
        removeItem: key => values.delete(key)
    };
    const storage = createInventoryStorage(backend);
    const loaded = storage.readLatest();
    assert.equal(loaded.sourceKey, INVENTORY_STORAGE_KEYS.legacy[0]);
    assert.deepEqual(loaded.value, { characters: ['ramona'] });

    assert.deepEqual(storage.write({ schemaVersion: 3 }), { ok: true });
    assert.deepEqual(JSON.parse(values.get(INVENTORY_STORAGE_KEYS.current)), { schemaVersion: 3 });
    assert.deepEqual(storage.removeLegacy(), { ok: true });
    assert.ok(INVENTORY_STORAGE_KEYS.legacy.every(key => !values.has(key)));

    values.set(INVENTORY_STORAGE_KEYS.current, '{broken');
    assert.equal(storage.readLatest().reason, 'parse');
    const denied = createInventoryStorage(() => { throw new Error('denied'); });
    assert.equal(denied.readLatest().reason, 'access');
    assert.equal(denied.write({}).reason, 'write');
    assert.equal(denied.remove(INVENTORY_STORAGE_KEYS.current).reason, 'remove');
});
