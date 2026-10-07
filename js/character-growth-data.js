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
    function quoteGrowthPlan(data, id, toLevel, {rank=0,limit=0,potency=0}={}) {
        const entry=character(data,id);validLevel(toLevel,entry.maxLevel);
        if(!Number.isInteger(potency)||potency<0||potency>entry.potencySteps.length)throw new RangeError('잠재력 단계를 확인하세요');
        const bonus = step => entry.potencySteps.slice(0,step).reduce((n,row)=>n+row.additionalMaxLevel,0);
        const maxExtension = entry.limitIncreases.at(-1).additionalMaxLevel;
        let needPotency=potency;
        while(entry.baseMaxLevel+maxExtension+bonus(needPotency)<toLevel)needPotency++;
        const needRank=Math.max(rank,Math.min(entry.ascensions.length,Math.ceil(Math.min(toLevel,entry.baseMaxLevel)/10)-1));
        const needLimit=Math.max(limit,toLevel<=entry.baseMaxLevel+bonus(needPotency)?0:entry.limitIncreases.findIndex(row=>entry.baseMaxLevel+bonus(needPotency)+row.additionalMaxLevel>=toLevel)+1);
        const potencyResources=sumResources(entry.potencySteps.slice(potency,needPotency));
        return {needRank,needLimit,needPotency,ascension:quoteAscension(data,id,rank,needRank),expansion:quoteLimitIncrease(data,id,limit,needLimit),potencyResources};
    }
    function quoteSkillUpgrades(data,id,selections) {
        const entry=character(data,id);
        return sumResources(selections.map(({slot,fromLevel,toLevel})=>{
            const skill=entry.skillUpgrades.find(row=>row.slot===slot);
            if(!skill)throw new RangeError('알 수 없는 스킬');
            validLevel(fromLevel,skill.maxLevel);validLevel(toLevel,skill.maxLevel);
            if(toLevel<fromLevel)throw new RangeError('목표 스킬 레벨은 현재 레벨 이상이어야 합니다');
            return {resources:sumResources(skill.steps.filter(row=>row.fromLevel>=fromLevel&&row.toLevel<=toLevel))};
        }));
    }
    function sortResources(resources,costs) {
        return [...costs].sort((a,b)=>resources.items[a.itemId].groupOrder-resources.items[b.itemId].groupOrder||resources.items[b.itemId].sortOrder-resources.items[a.itemId].sortOrder||a.itemId-b.itemId);
    }
    function quoteTalentUpgrades(data,id,selections) {
        const entry=character(data,id);
        return sumResources(selections.map(({type,fromLevel,toLevel})=>{
            const talent=entry.talentUpgrades.find(row=>row.type===type);
            if(!talent||![fromLevel,toLevel].every(value=>Number.isInteger(value)&&value>=0&&value<=talent.maxLevel)||toLevel<fromLevel)throw new RangeError('특성 단계를 확인하세요');
            return {resources:sumResources(talent.steps.slice(fromLevel,toLevel))};
        }));
    }
    return { statsAtLevel, quoteLevelUp, quoteAscension, quoteLimitIncrease, quoteGrowthPlan, quoteSkillUpgrades, quoteTalentUpgrades, sortResources };
});
