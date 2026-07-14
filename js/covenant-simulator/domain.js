export const STORAGE_VERSION = 1;
export const MAX_PRESETS = 30;
export const MAX_PRESET_NAME_LENGTH = 80;

export const ROMANS = Object.freeze(['Ⅰ', 'Ⅱ', 'Ⅲ', 'Ⅳ', 'Ⅴ', 'Ⅵ']);
export const TARGET_PART_ORDER = Object.freeze([3, 0, 4, 1, 5, 2]);

export const OPTIONS = Object.freeze([
    { id: 'critRate', name: '크리티컬 확률', step: 0.2, unit: '%' },
    { id: 'critDamage', name: '크리티컬 피해', step: 0.3, unit: '%' },
    { id: 'domainMastery', name: '영역 숙련', step: 0.5, unit: '' },
    { id: 'damageAmp', name: '피해 증폭', step: 0.2, unit: '%' },
    { id: 'madnessRegen', name: '광기 회복', step: 0.1, unit: '' },
    { id: 'silverCharge', name: '은열쇠 충전', step: 0.3, unit: '' },
    { id: 'blackSealDrop', name: '검은 인장 드롭율', step: 0.15, unit: '%' },
    { id: 'deathResist', name: '죽음 저항', step: 0.7, unit: '%' }
].map(Object.freeze));

export const MAIN_OPTIONS = Object.freeze([
    ['critRate', 'critDamage', 'madnessRegen', 'silverCharge'],
    ['critRate', 'critDamage', 'domainMastery', 'blackSealDrop'],
    ['critRate', 'critDamage', 'damageAmp', 'deathResist'],
    ['domainMastery', 'madnessRegen', 'silverCharge', 'blackSealDrop'],
    ['damageAmp', 'madnessRegen', 'silverCharge', 'deathResist'],
    ['domainMastery', 'damageAmp', 'blackSealDrop', 'deathResist']
].map(Object.freeze));

export const MAIN_COMPLETION = Object.freeze([3, 3.4, 3.7, 4.1, 4.5, 4.9, 5.3, 5.6, 6, 6.4, 6.8, 7.2, 7.5]);
export const SUB_COMPLETION = Object.freeze({
    3: 1.1, 4: 1.5, 5: 1.9, 6: 2.3, 7: 2.6, 8: 3, 9: 3.4, 10: 3.8, 11: 4.1,
    12: 4.5, 13: 4.9, 14: 5.3, 15: 5.7, 16: 6, 17: 6.4, 18: 6.8, 19: 7.2,
    20: 7.6, 21: 7.9, 22: 8.3, 23: 8.7, 24: 9.1
});
export const OPTION_BY_ID = Object.freeze(Object.fromEntries(OPTIONS.map(option => [option.id, option])));

export function isPlainObject(value) {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
}

export function normalizeStoredText(value, maxLength) {
    return typeof value === 'string' ? value.trim().slice(0, maxLength) : '';
}

export function clampIndex(value, min, max, fallback) {
    const number = Number(value);
    if (!Number.isInteger(number)) return fallback;
    return Math.min(max, Math.max(min, number));
}

export function createDefaultPart(index) {
    const mainOptions = MAIN_OPTIONS[index] || MAIN_OPTIONS[0];
    return {
        mainOption: mainOptions[0],
        mainLevel: 0,
        substats: [
            { option: 'critRate', level: 1, locked: false },
            { option: 'critDamage', level: 1, locked: false },
            { option: 'domainMastery', level: 1, locked: false }
        ],
        goals: [
            { option: 'critRate', level: 4, enabled: true },
            { option: 'critDamage', level: 4, enabled: false },
            { option: 'damageAmp', level: 4, enabled: false }
        ],
        lastTouched: false
    };
}

export function normalizeSubstat(substat, fallback) {
    if (!isPlainObject(substat)) return { ...fallback };
    return {
        option: OPTION_BY_ID[substat.option] ? substat.option : fallback.option,
        level: clampIndex(substat.level, 1, 8, fallback.level),
        locked: Boolean(substat.locked)
    };
}

export function normalizeGoal(goal, fallback) {
    if (!isPlainObject(goal)) return { ...fallback };
    return {
        option: OPTION_BY_ID[goal.option] ? goal.option : fallback.option,
        level: clampIndex(goal.level, 1, 8, fallback.level),
        enabled: typeof goal.enabled === 'boolean' ? goal.enabled : fallback.enabled
    };
}

export function normalizePartSnapshot(part, index) {
    const base = createDefaultPart(index);
    if (!isPlainObject(part)) return base;
    const substats = Array.from(
        { length: 3 },
        (_, substatIndex) => normalizeSubstat(part.substats?.[substatIndex], base.substats[substatIndex])
    );
    const goals = Array.from(
        { length: 3 },
        (_, goalIndex) => normalizeGoal(part.goals?.[goalIndex], base.goals[goalIndex])
    );
    return {
        mainOption: MAIN_OPTIONS[index].includes(part.mainOption) ? part.mainOption : base.mainOption,
        mainLevel: clampIndex(part.mainLevel, 0, MAIN_COMPLETION.length - 1, base.mainLevel),
        substats,
        goals,
        lastTouched: Boolean(part.lastTouched)
    };
}

export function normalizeTargetParts(targetParts) {
    const source = Array.isArray(targetParts) ? targetParts : [0, 1, 2, 3, 4, 5];
    const unique = Array.from(new Set(source
        .map(value => Number(value))
        .filter(value => Number.isInteger(value) && value >= 0 && value <= 5)));
    return unique.length ? unique.sort((a, b) => a - b) : [0, 1, 2, 3, 4, 5];
}

export function isStateSnapshot(snapshot) {
    return isPlainObject(snapshot)
        && snapshot.version === STORAGE_VERSION
        && typeof snapshot.selectedContract === 'string'
        && Array.isArray(snapshot.parts)
        && snapshot.parts.length === 6
        && (snapshot.targetSimParts === undefined
            || (Array.isArray(snapshot.targetSimParts) && snapshot.targetSimParts.length === 6));
}

export function isTargetPresetSnapshot(snapshot) {
    return isPlainObject(snapshot)
        && snapshot.version === STORAGE_VERSION
        && Array.isArray(snapshot.targets)
        && snapshot.targets.length === 6;
}

export function normalizeStoredPreset(candidate, isTargetPreset) {
    if (!isPlainObject(candidate)) return null;
    const id = normalizeStoredText(candidate.id, 120);
    const name = normalizeStoredText(candidate.name, MAX_PRESET_NAME_LENGTH);
    const snapshotIsValid = isTargetPreset
        ? isTargetPresetSnapshot(candidate.snapshot)
        : isStateSnapshot(candidate.snapshot);
    if (!id || !name || !snapshotIsValid) return null;
    return {
        id,
        name,
        createdAt: normalizeStoredText(candidate.createdAt, 40),
        updatedAt: normalizeStoredText(candidate.updatedAt, 40),
        snapshot: candidate.snapshot
    };
}

export function normalizePresetList(stored, isTargetPreset) {
    if (!Array.isArray(stored)) return [];
    const seenIds = new Set();
    return stored.slice(0, MAX_PRESETS).reduce((presets, candidate) => {
        const preset = normalizeStoredPreset(candidate, isTargetPreset);
        if (!preset || seenIds.has(preset.id)) return presets;
        seenIds.add(preset.id);
        presets.push(preset);
        return presets;
    }, []);
}

function snapshotPart(part) {
    return {
        mainOption: part.mainOption,
        mainLevel: part.mainLevel,
        substats: cloneSubstats(part.substats),
        goals: part.goals.map(goal => ({ ...goal })),
        lastTouched: Boolean(part.lastTouched)
    };
}

export function createStateSnapshot(state, controls = {}) {
    return {
        version: STORAGE_VERSION,
        selectedContract: state.selectedContract?.english_name || '',
        selectedPart: state.selectedPart,
        mode: state.mode,
        manualLockCostMode: controls.manualLockCostMode === 'quill' ? 'quill' : 'fragment',
        targetLockCostMode: controls.targetLockCostMode === 'quill' ? 'quill' : 'fragment',
        hasUnsavedPresetChanges: Boolean(state.hasUnsavedPresetChanges),
        targetParts: [...state.targetParts],
        parts: state.parts.map(snapshotPart),
        targetSimParts: state.targetSimParts.map(snapshotPart)
    };
}

export function createTargetPresetSnapshot(state, targetLockCostMode) {
    return {
        version: STORAGE_VERSION,
        targetParts: [...state.targetParts],
        targetLockCostMode: targetLockCostMode === 'quill' ? 'quill' : 'fragment',
        targets: state.targetSimParts.map(part => ({
            mainOption: part.mainOption,
            goals: part.goals.map(goal => ({ ...goal }))
        }))
    };
}

export function normalizeTargetPreset(snapshot, currentParts) {
    if (!isTargetPresetSnapshot(snapshot)) return null;
    return {
        targetParts: normalizeTargetParts(snapshot.targetParts),
        targetLockCostMode: snapshot.targetLockCostMode === 'quill' ? 'quill' : 'fragment',
        targetSimParts: currentParts.map((part, index) => {
            const target = snapshot.targets[index];
            if (!isPlainObject(target)) return part;
            return {
                ...part,
                mainOption: MAIN_OPTIONS[index].includes(target.mainOption) ? target.mainOption : part.mainOption,
                goals: Array.from(
                    { length: 3 },
                    (_, goalIndex) => normalizeGoal(target.goals?.[goalIndex], part.goals[goalIndex])
                ),
                lastTouched: false
            };
        })
    };
}

export function cloneSubstats(substats) {
    return substats.map(substat => ({ ...substat }));
}

export function createEmptyTotals() {
    return { rerolls: 0, gold: 0, seals: 0, fragments: 0, quills: 0 };
}

export function addTotals(target, source, multiplier = 1) {
    return {
        rerolls: (target.rerolls || 0) + (source.rerolls || 0) * multiplier,
        gold: (target.gold || 0) + (source.gold || 0) * multiplier,
        seals: (target.seals || 0) + (source.seals || 0) * multiplier,
        fragments: (target.fragments || 0) + (source.fragments || 0) * multiplier,
        quills: (target.quills || 0) + (source.quills || 0) * multiplier
    };
}

export function getRerollCost(lockedCount, lockCostMode) {
    const cost = { gold: 7500, seals: 3, fragments: 0, quills: 0 };
    if (lockedCount === 1) {
        if (lockCostMode === 'quill') cost.quills = 1;
        else cost.fragments = 20;
    }
    if (lockedCount >= 2) cost.quills = 10;
    return cost;
}

export function getPartCompletion(part, substats = part.substats) {
    const totalLevel = substats.reduce((sum, substat) => sum + substat.level, 0);
    return MAIN_COMPLETION[part.mainLevel] + SUB_COMPLETION[totalLevel];
}

export function getTotalCompletion(parts) {
    return parts.reduce((sum, part) => sum + getPartCompletion(part), 0);
}

export function countLocked(substats) {
    return substats.filter(substat => substat.locked).length;
}

export function randomInt(min, max, random = Math.random) {
    return Math.floor(random() * (max - min + 1)) + min;
}

export function randomOptionId(random = Math.random) {
    return OPTIONS[randomInt(0, OPTIONS.length - 1, random)].id;
}

export function rerollSubstats(substats, random = Math.random) {
    return substats.map(substat => {
        if (substat.locked) return { ...substat };
        return { option: randomOptionId(random), level: randomInt(1, 8, random), locked: false };
    });
}

export function getStrategyLockedIndexes(substats, goals, strategy) {
    if (strategy === 'none') return [];
    const matches = [];
    const usedGoals = new Set();
    substats.forEach((substat, substatIndex) => {
        const goalIndex = goals.findIndex((goal, candidateIndex) => {
            return !usedGoals.has(candidateIndex)
                && substat.option === goal.option
                && substat.level >= goal.level;
        });
        if (goalIndex !== -1) {
            usedGoals.add(goalIndex);
            matches.push(substatIndex);
        }
    });
    return matches.slice(0, strategy === 'one' ? 1 : 2);
}

export function matchesGoals(substats, goals) {
    const used = new Set();
    return goals.every(goal => {
        const foundIndex = substats.findIndex((substat, index) => {
            return !used.has(index) && substat.option === goal.option && substat.level >= goal.level;
        });
        if (foundIndex === -1) return false;
        used.add(foundIndex);
        return true;
    });
}

export function getMissingGoals(substats, goals, lockedIndexes) {
    const matchedGoals = new Set();
    lockedIndexes.forEach(substatIndex => {
        const substat = substats[substatIndex];
        const goalIndex = goals.findIndex((goal, index) => {
            return !matchedGoals.has(index) && substat.option === goal.option && substat.level >= goal.level;
        });
        if (goalIndex !== -1) matchedGoals.add(goalIndex);
    });
    return goals.filter((_, index) => !matchedGoals.has(index));
}

export function getGoalHitProbability(goal) {
    return (9 - goal.level) / 64;
}

export function getAnyGoalHitProbability(goals, slotCount) {
    if (!goals.length || slotCount <= 0) return 1;
    const uniqueGoals = new Map(goals.map(goal => [`${goal.option}:${goal.level}`, goal]));
    const slotChance = Array.from(uniqueGoals.values())
        .reduce((sum, goal) => sum + getGoalHitProbability(goal), 0);
    return Math.max(0.000001, Math.min(1, 1 - Math.pow(1 - slotChance, slotCount)));
}

export function pickWeightedGoal(goals, random = Math.random) {
    if (!goals.length) return null;
    const totalWeight = goals.reduce((sum, goal) => sum + getGoalHitProbability(goal), 0);
    let cursor = random() * totalWeight;
    for (const goal of goals) {
        cursor -= getGoalHitProbability(goal);
        if (cursor <= 0) return goal;
    }
    return goals[goals.length - 1];
}

export function sampleGeometric(successChance, random = Math.random) {
    if (successChance >= 1) return 1;
    const chance = Math.max(0.000001, Math.min(0.999999, successChance));
    return Math.max(1, Math.ceil(Math.log(1 - random()) / Math.log(1 - chance)));
}

export function createSubstatForGoal(goal, random = Math.random) {
    return {
        option: goal.option,
        level: randomInt(goal.level, 8, random),
        locked: false
    };
}

export function forceCompleteGoals(current, goals, random = Math.random) {
    const next = current.map(substat => ({ ...substat, locked: false }));
    const usedSlots = new Set();
    goals.slice(0, 3).forEach(goal => {
        let slot = next.findIndex((substat, index) => {
            return !usedSlots.has(index) && substat.option === goal.option && substat.level >= goal.level;
        });
        if (slot === -1) {
            slot = [0, 1, 2].find(index => !usedSlots.has(index));
            if (slot !== undefined) next[slot] = createSubstatForGoal(goal, random);
        }
        if (slot !== -1 && slot !== undefined) usedSlots.add(slot);
    });
    return next;
}

export function advanceTowardGoals(current, goals, config, random = Math.random) {
    const locked = getStrategyLockedIndexes(current, goals, config.lockStrategy);
    const unlocked = [0, 1, 2].filter(index => !locked.includes(index));
    const missingGoals = getMissingGoals(current, goals, locked);
    const targetGoal = pickWeightedGoal(missingGoals, random);
    const chance = getAnyGoalHitProbability(missingGoals, unlocked.length);
    const attempts = sampleGeometric(chance, random);
    const next = current.map((substat, index) => {
        if (locked.includes(index)) return { ...substat, locked: true };
        return { option: randomOptionId(random), level: randomInt(1, 8, random), locked: false };
    });
    if (targetGoal && unlocked.length) {
        const targetSlot = unlocked[randomInt(0, unlocked.length - 1, random)];
        next[targetSlot] = createSubstatForGoal(targetGoal, random);
    }
    return {
        attempts,
        cost: getRerollCost(locked.length, config.lockCostMode),
        substats: next.map(substat => ({ ...substat, locked: false }))
    };
}

export function simulateUntilTargets({
    targetSimParts,
    targetsByPart,
    contractName,
    scopeLabel,
    lockStrategy,
    lockCostMode,
    random = Math.random
}) {
    let totalCost = createEmptyTotals();
    const partResults = [];
    let attempts = 0;
    for (const targetPart of targetsByPart) {
        let current = cloneSubstats(targetSimParts[targetPart.partIndex].substats);
        let safetySteps = 0;
        while (!matchesGoals(current, targetPart.goals)) {
            if (safetySteps >= 8) {
                current = forceCompleteGoals(current, targetPart.goals, random);
                break;
            }
            const step = advanceTowardGoals(current, targetPart.goals, { lockStrategy, lockCostMode }, random);
            current = step.substats;
            totalCost = addTotals(totalCost, step.cost, step.attempts);
            attempts += step.attempts;
            safetySteps += 1;
        }
        partResults.push({
            partIndex: targetPart.partIndex,
            goals: targetPart.goals.map(goal => ({ ...goal })),
            finalSubstats: current.map(substat => ({ ...substat, locked: false }))
        });
    }
    return {
        type: 'target',
        contract: contractName,
        scope: scopeLabel,
        attempts,
        cost: totalCost,
        partResults
    };
}
