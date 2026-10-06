(function (root, factory) {
    const api = factory();
    if (typeof module === 'object' && module.exports) module.exports = api;
    else root.CharacterGrowthData = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
    'use strict';
    function character(data, id) {
        const value = data.characters[id];
        if (!value) throw new RangeError('알 수 없는 캐릭터');
        return value;
    }
    function validLevel(value, max) {
        if (!Number.isInteger(value) || value < 1 || value > max) throw new RangeError('레벨 범위를 확인하세요');
    }
    function statsAtLevel(data, id, level) {
        const entry = character(data, id);
        validLevel(level, entry.maxLevel);
        return { ...entry.levels[level - 1] };
    }
    // Account discounts, equipment and unlock conditions belong to the consuming UI.
    // This quote starts with zero accumulated experience at the current level.
    function quoteLevelUp(data, resources, id, fromLevel, toLevel) {
        const entry = character(data, id);
        validLevel(fromLevel, entry.maxLevel);
        validLevel(toLevel, entry.maxLevel);
        if (toLevel < fromLevel) throw new RangeError('목표 레벨은 현재 레벨 이상이어야 합니다');
        const curve = resources.experienceCurves[entry.experienceCurve];
        const experience = curve.slice(fromLevel - 1, toLevel - 1).reduce((sum, row) => sum + row.experience, 0);
        const policy = resources.levelUpPolicy;
        const billableExperience = Math.ceil(experience / policy.experienceUnit) * policy.experienceUnit;
        const currency = Math.floor(billableExperience * policy.currencyPerExperience);
        const smallestBottle = resources.experienceItems.find(item => item.experience === policy.experienceUnit);
        return {
            fromLevel, toLevel, experience, billableExperience,
            currency: { itemId: policy.currencyItemId, quantity: currency },
            smallestBottleEquivalent: { itemId: smallestBottle.itemId, quantity: billableExperience / policy.experienceUnit },
            // Other bottle combinations are possible; this is an equivalent, not a prescribed recipe.
            accountDiscountIncluded: false,
            ascensionCostsIncluded: false,
            limitIncreaseCostsIncluded: false,
            potencyCostsIncluded: false
        };
    }
    function sumResources(steps) {
        const quantities = new Map();
        for (const step of steps) for (const cost of step.resources) quantities.set(cost.itemId, (quantities.get(cost.itemId) || 0) + cost.quantity);
        return [...quantities].sort(([a], [b]) => a - b).map(([itemId, quantity]) => ({ itemId, quantity }));
    }
    function quoteAscension(data, id, fromRank, toRank) {
        const entry = character(data, id);
        const max = entry.ascensions.at(-1).toRank;
        if (![fromRank, toRank].every(rank => Number.isInteger(rank) && rank >= 0 && rank <= max) || fromRank > toRank) throw new RangeError('승급 단계를 확인하세요');
        return sumResources(entry.ascensions.filter(step => step.fromRank >= fromRank && step.toRank <= toRank));
    }
    function quoteLimitIncrease(data, id, fromStep, toStep) {
        const entry = character(data, id);
        if (![fromStep, toStep].every(step => Number.isInteger(step) && step >= 0 && step <= entry.limitIncreases.length) || fromStep > toStep) throw new RangeError('상한 확장 단계를 확인하세요');
        return sumResources(entry.limitIncreases.slice(fromStep, toStep));
    }
    return { statsAtLevel, quoteLevelUp, quoteAscension, quoteLimitIncrease };
});
