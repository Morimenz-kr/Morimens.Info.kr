import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import {
    STORAGE_VERSION,
    addTotals,
    createDefaultPart,
    createEmptyTotals,
    createStateSnapshot,
    createTargetPresetSnapshot,
    getPartCompletion,
    getRerollCost,
    getTotalCompletion,
    isStateSnapshot,
    matchesGoals,
    normalizePartSnapshot,
    normalizePresetList,
    normalizeTargetParts,
    normalizeTargetPreset,
    rerollSubstats,
    simulateUntilTargets
} from '../js/covenant-simulator/domain.js';
import {
    STORAGE_KEYS,
    createJsonStorage
} from '../js/covenant-simulator/storage.js';
import { createRetryableInitializer } from '../js/covenant-simulator/bootstrap.js';

function defaultParts() {
    return Array.from({ length: 6 }, (_, index) => createDefaultPart(index));
}

function sequenceRandom(values) {
    let index = 0;
    return () => values[index++ % values.length];
}

test('retryable initialization recovers once, reports state, and deduplicates concurrent attempts', async () => {
    const events = [];
    let attempts = 0;
    let releaseSecondAttempt;
    const secondAttempt = new Promise(resolve => { releaseSecondAttempt = resolve; });
    const initializer = createRetryableInitializer({
        async load() {
            attempts += 1;
            if (attempts === 1) throw new Error('temporary outage');
            await secondAttempt;
            return ['April'];
        },
        onLoading: context => events.push(`loading:${context.fromRetry === true}`),
        onReady: value => events.push(`ready:${value[0]}`),
        onError: error => events.push(`error:${error.message}`)
    });

    const failed = await initializer.run();
    assert.equal(failed.ok, false);
    assert.equal(initializer.isRunning, false);

    const retry = initializer.run({ fromRetry: true });
    const duplicate = initializer.run({ fromRetry: true });
    assert.equal(retry, duplicate, 'one retry must own the in-flight load');
    assert.equal(initializer.isRunning, true);
    releaseSecondAttempt();

    const recovered = await retry;
    assert.deepEqual(recovered, { ok: true, value: ['April'] });
    assert.equal(attempts, 2);
    assert.equal(initializer.isRunning, false);
    assert.deepEqual(events, [
        'loading:false',
        'error:temporary outage',
        'loading:true',
        'ready:April'
    ]);
});

test('covenant browser entry wires busy, retry, control restoration, and focus recovery', async () => {
    const [controller, page] = await Promise.all([
        readFile(new URL('../js/covenant_simulator.js', import.meta.url), 'utf8'),
        readFile(new URL('../covenant_simulator.html', import.meta.url), 'utf8')
    ]);

    assert.match(page, /class="covenant-shell"[^>]*aria-busy="true"/);
    assert.match(page, /id="contract-grid"[^>]*aria-busy="true"/);
    assert.match(controller, /onLoading:\s*renderInitializationLoading/);
    assert.match(controller, /if \(context\.fromRetry\) status\.tabIndex = -1/);
    assert.match(controller, /requestAnimationFrame\(\(\) => status\.focus\(\{ preventScroll: true \}\)\)/);
    assert.match(controller, /setSimulatorControlsEnabled\(true\);\s*renderAll\(\);\s*setInitializationBusy\(false\)/);
    assert.match(controller, /retry\.addEventListener\('click',[\s\S]*fromRetry:\s*true/);
    assert.match(controller, /requestAnimationFrame\(\(\) => retry\.focus\(\{ preventScroll: true \}\)\)/);
    assert.match(controller, /buttons\.find\(button => button\.dataset\.contract === state\.selectedContract\?\.english_name\)/);
    assert.match(controller, /\(selected \|\| buttons\[0\]\)\?\.focus\(\{ preventScroll: true \}\)/);
});

test('v1 state snapshots retain their storage contract and isolate nested values', () => {
    const state = {
        selectedContract: { english_name: 'April' },
        selectedPart: 4,
        mode: 'target',
        hasUnsavedPresetChanges: true,
        targetParts: [1, 4],
        parts: defaultParts(),
        targetSimParts: defaultParts()
    };
    const snapshot = createStateSnapshot(state, {
        manualLockCostMode: 'quill',
        targetLockCostMode: 'quill'
    });

    assert.equal(snapshot.version, STORAGE_VERSION);
    assert.equal(snapshot.selectedContract, 'April');
    assert.equal(snapshot.manualLockCostMode, 'quill');
    assert.equal(snapshot.targetLockCostMode, 'quill');
    assert.ok(isStateSnapshot(snapshot));

    snapshot.parts[0].substats[0].level = 8;
    assert.equal(state.parts[0].substats[0].level, 1, 'snapshot must not retain nested state references');

    const legacySnapshot = { ...snapshot };
    delete legacySnapshot.targetSimParts;
    assert.ok(isStateSnapshot(legacySnapshot), 'existing v1 snapshots without targetSimParts remain compatible');
});

test('part and target normalization reject invalid identifiers, levels, and scopes', () => {
    const normalized = normalizePartSnapshot({
        mainOption: 'not-an-option',
        mainLevel: 99,
        substats: [{ option: 'not-an-option', level: 99, locked: 1 }],
        goals: [{ option: 'damageAmp', level: -4, enabled: 'yes' }]
    }, 0);

    assert.equal(normalized.mainOption, 'critRate');
    assert.equal(normalized.mainLevel, 12);
    assert.deepEqual(normalized.substats[0], { option: 'critRate', level: 8, locked: true });
    assert.deepEqual(normalized.goals[0], { option: 'damageAmp', level: 1, enabled: true });
    assert.deepEqual(normalizeTargetParts([5, '1', 1, -1, 8, 'bad']), [1, 5]);
    assert.deepEqual(normalizeTargetParts([]), [0, 1, 2, 3, 4, 5]);
});

test('preset normalization enforces limits, uniqueness, and v1 schema validity', () => {
    const parts = defaultParts();
    const state = {
        selectedContract: { english_name: 'April' },
        selectedPart: 0,
        mode: 'manual',
        hasUnsavedPresetChanges: false,
        targetParts: [0, 1, 2, 3, 4, 5],
        parts,
        targetSimParts: defaultParts()
    };
    const snapshot = createStateSnapshot(state);
    const candidates = [
        { id: 'same', name: '  first  ', snapshot },
        { id: 'same', name: 'duplicate', snapshot },
        { id: 'invalid', name: '', snapshot },
        null
    ];

    assert.deepEqual(normalizePresetList(candidates, false).map(({ id, name }) => ({ id, name })), [
        { id: 'same', name: 'first' }
    ]);

    const targetSnapshot = createTargetPresetSnapshot(state, 'quill');
    const target = normalizeTargetPreset({
        ...targetSnapshot,
        targetParts: [5, 5, 2],
        targets: targetSnapshot.targets.map((part, index) => index === 2
            ? { ...part, mainOption: 'invalid', goals: [{ option: 'deathResist', level: 8, enabled: true }] }
            : part)
    }, defaultParts());
    assert.deepEqual(target.targetParts, [2, 5]);
    assert.equal(target.targetLockCostMode, 'quill');
    assert.equal(target.targetSimParts[2].mainOption, 'critRate');
    assert.deepEqual(target.targetSimParts[2].goals[0], { option: 'deathResist', level: 8, enabled: true });
});

test('cost and completion calculations cover every lock-cost branch without mutation', () => {
    assert.deepEqual(getRerollCost(0, 'fragment'), { gold: 7500, seals: 3, fragments: 0, quills: 0 });
    assert.deepEqual(getRerollCost(1, 'fragment'), { gold: 7500, seals: 3, fragments: 20, quills: 0 });
    assert.deepEqual(getRerollCost(1, 'quill'), { gold: 7500, seals: 3, fragments: 0, quills: 1 });
    assert.deepEqual(getRerollCost(2, 'fragment'), { gold: 7500, seals: 3, fragments: 0, quills: 10 });

    const initial = createEmptyTotals();
    const accumulated = addTotals(initial, getRerollCost(1, 'fragment'), 3);
    assert.deepEqual(initial, createEmptyTotals(), 'totals calculation must not mutate its input');
    assert.deepEqual(accumulated, { rerolls: 0, gold: 22500, seals: 9, fragments: 60, quills: 0 });

    const parts = defaultParts();
    assert.equal(getPartCompletion(parts[0]), 4.1);
    assert.equal(getTotalCompletion(parts), 24.6);
});

test('manual rerolls preserve locked slots and accept a deterministic random source', () => {
    const substats = [
        { option: 'critRate', level: 8, locked: true },
        { option: 'critDamage', level: 3, locked: false },
        { option: 'domainMastery', level: 2, locked: false }
    ];
    const rerolled = rerollSubstats(substats, sequenceRandom([0, 0, 0.999, 0.999]));

    assert.deepEqual(rerolled[0], substats[0]);
    assert.notEqual(rerolled[0], substats[0], 'locked substats are copied instead of shared');
    assert.deepEqual(rerolled[1], { option: 'critRate', level: 1, locked: false });
    assert.deepEqual(rerolled[2], { option: 'deathResist', level: 8, locked: false });
});

test('target simulation reaches goals deterministically and returns isolated result data', () => {
    const targetSimParts = defaultParts();
    const goals = [{ option: 'critRate', level: 4 }];
    const result = simulateUntilTargets({
        targetSimParts,
        targetsByPart: [{ partIndex: 0, goals }],
        contractName: '새벽 밖의 희망',
        scopeLabel: 'Ⅰ',
        lockStrategy: 'two',
        lockCostMode: 'fragment',
        random: () => 0
    });

    assert.equal(result.attempts, 1);
    assert.deepEqual(result.cost, { rerolls: 0, gold: 7500, seals: 3, fragments: 0, quills: 0 });
    assert.ok(matchesGoals(result.partResults[0].finalSubstats, goals));
    assert.ok(result.partResults[0].finalSubstats.every(substat => substat.locked === false));
    result.partResults[0].finalSubstats[0].level = 8;
    assert.equal(targetSimParts[0].substats[0].level, 1);
});

test('JSON storage adapter distinguishes missing, malformed, denied, and successful storage', () => {
    const values = new Map();
    const backend = {
        getItem: key => values.has(key) ? values.get(key) : null,
        setItem: (key, value) => values.set(key, value),
        removeItem: key => values.delete(key)
    };
    const storage = createJsonStorage(backend);

    assert.deepEqual(storage.read(STORAGE_KEYS.state), { ok: true, found: false, value: undefined });
    assert.deepEqual(storage.write(STORAGE_KEYS.state, { version: 1 }), { ok: true });
    assert.deepEqual(storage.read(STORAGE_KEYS.state), {
        ok: true,
        found: true,
        value: { version: 1 }
    });

    values.set(STORAGE_KEYS.state, '{broken');
    assert.equal(storage.read(STORAGE_KEYS.state).reason, 'parse');
    assert.deepEqual(storage.remove(STORAGE_KEYS.state), { ok: true });

    const denied = createJsonStorage(() => {
        throw new Error('denied');
    });
    assert.equal(denied.read(STORAGE_KEYS.state).reason, 'access');
    assert.equal(denied.write(STORAGE_KEYS.state, {}).reason, 'write');
    assert.equal(denied.remove(STORAGE_KEYS.state).reason, 'remove');
});
