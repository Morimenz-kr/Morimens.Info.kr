(function (root, factory) {
    const api = factory();
    if (typeof module === 'object' && module.exports) module.exports = api;
    if (root) root.GachaPlanner = api;
})(typeof window !== 'undefined' ? window : globalThis, function () {
    const EPSILON = 1e-12;
    const MORIMENS_LIMITED_RULES = Object.freeze({
        topRarityRate: 0.0302,
        featuredRate: 1 / 3,
        hardPity: 30,
        featuredGuaranteeAfterLosses: 2
    });

    function assertFiniteNumber(value, name) {
        if (!Number.isFinite(value)) throw new TypeError(`${name} must be a finite number.`);
    }

    function assertProbability(value, name) {
        assertFiniteNumber(value, name);
        if (value < 0 || value > 1) throw new RangeError(`${name} must be between 0 and 1.`);
    }

    function assertNonNegativeInteger(value, name) {
        if (!Number.isInteger(value) || value < 0) {
            throw new RangeError(`${name} must be a non-negative integer.`);
        }
    }

    function normalizeRules(input) {
        if (!input || typeof input !== 'object') throw new TypeError('rules are required.');

        const rules = {
            topRarityRate: input.topRarityRate,
            featuredRate: input.featuredRate,
            hardPity: input.hardPity,
            softPityStart: input.softPityStart ?? null,
            softPityRateIncrease: input.softPityRateIncrease ?? 0,
            featuredGuaranteeAfterLosses: input.featuredGuaranteeAfterLosses
                ?? (input.guaranteeFeaturedAfterLoss === true ? 1 : null)
        };

        assertProbability(rules.topRarityRate, 'topRarityRate');
        assertProbability(rules.featuredRate, 'featuredRate');
        if (!Number.isInteger(rules.hardPity) || rules.hardPity < 1) {
            throw new RangeError('hardPity must be a positive integer.');
        }
        assertProbability(rules.softPityRateIncrease, 'softPityRateIncrease');

        if (rules.softPityStart !== null) {
            if (!Number.isInteger(rules.softPityStart)
                || rules.softPityStart < 1
                || rules.softPityStart > rules.hardPity) {
                throw new RangeError('softPityStart must be between 1 and hardPity.');
            }
        }

        if (rules.featuredGuaranteeAfterLosses !== null
            && (!Number.isInteger(rules.featuredGuaranteeAfterLosses)
                || rules.featuredGuaranteeAfterLosses < 1)) {
            throw new RangeError('featuredGuaranteeAfterLosses must be a positive integer or null.');
        }

        return rules;
    }

    function normalizeState(input, rules) {
        const state = {
            pity: input?.pity ?? 0,
            featuredLosses: input?.featuredLosses
                ?? (input?.guaranteed && rules.featuredGuaranteeAfterLosses !== null
                    ? rules.featuredGuaranteeAfterLosses
                    : 0),
            copies: input?.copies ?? 0,
            allPreviousTargetsMet: input?.allPreviousTargetsMet !== false
        };

        assertNonNegativeInteger(state.pity, 'pity');
        assertNonNegativeInteger(state.featuredLosses, 'featuredLosses');
        assertNonNegativeInteger(state.copies, 'copies');
        if (state.pity >= rules.hardPity) {
            throw new RangeError('pity must be lower than hardPity.');
        }
        if (rules.featuredGuaranteeAfterLosses === null) {
            state.featuredLosses = 0;
        } else {
            state.featuredLosses = Math.min(
                rules.featuredGuaranteeAfterLosses,
                state.featuredLosses
            );
        }
        return state;
    }

    function getTopRarityRate(rulesInput, pity) {
        const rules = normalizeRules(rulesInput);
        assertNonNegativeInteger(pity, 'pity');
        if (pity >= rules.hardPity) throw new RangeError('pity must be lower than hardPity.');

        return getTopRarityRateNormalized(rules, pity);
    }

    function getTopRarityRateNormalized(rules, pity) {
        const nextPull = pity + 1;
        if (nextPull >= rules.hardPity) return 1;
        if (rules.softPityStart === null || nextPull < rules.softPityStart) {
            return rules.topRarityRate;
        }

        const softPitySteps = nextPull - rules.softPityStart + 1;
        return Math.min(1, rules.topRarityRate + (softPitySteps * rules.softPityRateIncrease));
    }

    function stateKey(state) {
        return `${state.pity}|${state.featuredLosses}|${state.copies}|${state.allPreviousTargetsMet ? 1 : 0}`;
    }

    function parseStateKey(key) {
        const [pity, featuredLosses, copies, allPreviousTargetsMet] = key.split('|').map(Number);
        return {
            pity,
            featuredLosses,
            copies,
            allPreviousTargetsMet: allPreviousTargetsMet === 1
        };
    }

    function addProbability(distribution, state, probability) {
        if (probability <= 0) return;
        const key = stateKey(state);
        distribution.set(key, (distribution.get(key) || 0) + probability);
    }

    function advanceDistribution(distribution, rules, targetCopies) {
        const next = new Map();

        for (const [key, stateProbability] of distribution) {
            const state = parseStateKey(key);
            const topRarityRate = getTopRarityRateNormalized(rules, state.pity);
            const featuredRate = rules.featuredGuaranteeAfterLosses !== null
                && state.featuredLosses >= rules.featuredGuaranteeAfterLosses
                ? 1
                : rules.featuredRate;
            const featuredProbability = topRarityRate * featuredRate;
            const offBannerProbability = topRarityRate * (1 - featuredRate);
            const missProbability = 1 - topRarityRate;

            addProbability(next, {
                ...state,
                pity: 0,
                featuredLosses: 0,
                copies: Math.min(targetCopies, state.copies + 1)
            }, stateProbability * featuredProbability);

            addProbability(next, {
                ...state,
                pity: 0,
                featuredLosses: rules.featuredGuaranteeAfterLosses === null
                    ? 0
                    : Math.min(
                        rules.featuredGuaranteeAfterLosses,
                        state.featuredLosses + 1
                    )
            }, stateProbability * offBannerProbability);

            addProbability(next, {
                ...state,
                pity: Math.min(rules.hardPity - 1, state.pity + 1)
            }, stateProbability * missProbability);
        }

        return next;
    }

    function makeInitialDistribution(state) {
        return new Map([[stateKey(state), 1]]);
    }

    function summarizeDistribution(distribution, targetCopies) {
        const probabilityByCopies = Array.from({ length: targetCopies + 1 }, () => 0);
        let successProbability = 0;
        let expectedCopiesCapped = 0;
        let totalProbability = 0;

        for (const [key, probability] of distribution) {
            const state = parseStateKey(key);
            const copies = Math.min(targetCopies, state.copies);
            totalProbability += probability;
            probabilityByCopies[copies] += probability;
            expectedCopiesCapped += copies * probability;
            if (copies >= targetCopies) successProbability += probability;
        }

        if (totalProbability <= 0) {
            throw new RangeError('state distribution must contain positive probability mass.');
        }

        successProbability /= totalProbability;
        expectedCopiesCapped /= totalProbability;
        for (let copies = 0; copies < probabilityByCopies.length; copies += 1) {
            probabilityByCopies[copies] /= totalProbability;
        }

        return {
            successProbability,
            failureProbability: 1 - successProbability,
            expectedCopiesCapped,
            probabilityByCopies
        };
    }

    function simulateBanner(options) {
        const rules = normalizeRules(options?.rules);
        const pulls = options?.pulls ?? 0;
        const targetCopies = options?.targetCopies ?? 1;
        assertNonNegativeInteger(pulls, 'pulls');
        if (!Number.isInteger(targetCopies) || targetCopies < 1) {
            throw new RangeError('targetCopies must be a positive integer.');
        }

        const initialState = normalizeState(options?.initialState, rules);
        initialState.copies = Math.min(targetCopies, initialState.copies);
        let distribution = makeInitialDistribution(initialState);

        for (let pull = 0; pull < pulls; pull += 1) {
            distribution = advanceDistribution(distribution, rules, targetCopies);
        }

        return {
            pulls,
            targetCopies,
            ...summarizeDistribution(distribution, targetCopies),
            finalStateDistribution: [...distribution].map(([key, probability]) => ({
                ...parseStateKey(key),
                probability
            }))
        };
    }

    function findPullsForProbability(options) {
        const rules = normalizeRules(options?.rules);
        const targetCopies = options?.targetCopies ?? 1;
        const desiredProbability = options?.desiredProbability ?? 0.9;
        assertProbability(desiredProbability, 'desiredProbability');
        if (!Number.isInteger(targetCopies) || targetCopies < 1) {
            throw new RangeError('targetCopies must be a positive integer.');
        }

        const initialState = normalizeState(options?.initialState, rules);
        initialState.copies = Math.min(targetCopies, initialState.copies);
        const remainingCopies = Math.max(0, targetCopies - initialState.copies);
        const featuredCycles = rules.featuredGuaranteeAfterLosses === null
            ? 4
            : rules.featuredGuaranteeAfterLosses + 1;
        const defaultMaxPulls = rules.hardPity * Math.max(1, remainingCopies) * featuredCycles;
        const maxPulls = options?.maxPulls ?? defaultMaxPulls;
        assertNonNegativeInteger(maxPulls, 'maxPulls');

        let distribution = makeInitialDistribution(initialState);
        for (let pulls = 0; pulls <= maxPulls; pulls += 1) {
            const summary = summarizeDistribution(distribution, targetCopies);
            if (summary.successProbability + EPSILON >= desiredProbability) {
                return { pulls, ...summary };
            }
            distribution = advanceDistribution(distribution, rules, targetCopies);
        }

        return null;
    }

    function calculateExpectedPullsToTarget(options) {
        const rules = normalizeRules(options?.rules);
        const targetCopies = options?.targetCopies ?? 1;
        if (!Number.isInteger(targetCopies) || targetCopies < 1) {
            throw new RangeError('targetCopies must be a positive integer.');
        }
        if (rules.featuredGuaranteeAfterLosses === null) {
            throw new RangeError(
                'featuredGuaranteeAfterLosses is required for an exact finite expectation.'
            );
        }

        const initialState = normalizeState(options?.initialState, rules);
        initialState.copies = Math.min(targetCopies, initialState.copies);
        const remainingCopies = Math.max(0, targetCopies - initialState.copies);
        const firstCopyCycles = remainingCopies === 0
            ? 0
            : rules.featuredGuaranteeAfterLosses - initialState.featuredLosses + 1;
        const laterCopyCycles = Math.max(0, remainingCopies - 1)
            * (rules.featuredGuaranteeAfterLosses + 1);
        const maxPulls = remainingCopies === 0
            ? 0
            : (rules.hardPity - initialState.pity)
                + (rules.hardPity * (firstCopyCycles + laterCopyCycles - 1));

        let distribution = makeInitialDistribution(initialState);
        let expectedPulls = 0;
        for (let pulls = 0; pulls < maxPulls; pulls += 1) {
            const summary = summarizeDistribution(distribution, targetCopies);
            expectedPulls += 1 - summary.successProbability;
            distribution = advanceDistribution(distribution, rules, targetCopies);
        }

        const finalSummary = summarizeDistribution(distribution, targetCopies);
        return {
            expectedPulls,
            maxPulls,
            guaranteedSuccessProbability: finalSummary.successProbability
        };
    }

    function calculatePullBudget(options = {}) {
        const tickets = options.tickets ?? 0;
        const currency = options.currency ?? 0;
        const currencyPerPull = options.currencyPerPull;
        assertNonNegativeInteger(tickets, 'tickets');
        assertNonNegativeInteger(currency, 'currency');
        if (!Number.isInteger(currencyPerPull) || currencyPerPull < 1) {
            throw new RangeError('currencyPerPull must be a positive integer.');
        }

        const currencyPulls = Math.floor(currency / currencyPerPull);
        return {
            totalPulls: tickets + currencyPulls,
            ticketPulls: tickets,
            currencyPulls,
            remainingCurrency: currency % currencyPerPull
        };
    }

    function simulatePlan(options) {
        const defaultRules = normalizeRules(options?.rules);
        const stages = options?.stages;
        if (!Array.isArray(stages) || stages.length === 0) {
            throw new TypeError('stages must be a non-empty array.');
        }

        let distribution = makeInitialDistribution(normalizeState(options?.initialState, defaultRules));
        let previousRules = defaultRules;
        const results = [];

        stages.forEach((stage, index) => {
            const rules = stage.rules ? normalizeRules(stage.rules) : defaultRules;
            const pulls = stage.pulls ?? 0;
            const targetCopies = stage.targetCopies ?? 1;
            const currentCopies = stage.currentCopies ?? 0;
            assertNonNegativeInteger(pulls, `stages[${index}].pulls`);
            assertNonNegativeInteger(currentCopies, `stages[${index}].currentCopies`);
            if (!Number.isInteger(targetCopies) || targetCopies < 1) {
                throw new RangeError(`stages[${index}].targetCopies must be a positive integer.`);
            }

            const resetPity = Boolean(stage.resetPity) || rules.hardPity !== previousRules.hardPity;
            const stageStart = new Map();
            for (const [key, probability] of distribution) {
                const carry = parseStateKey(key);
                addProbability(stageStart, {
                    pity: resetPity ? 0 : carry.pity,
                    featuredLosses: resetPity ? 0 : carry.featuredLosses,
                    copies: Math.min(targetCopies, currentCopies),
                    allPreviousTargetsMet: carry.allPreviousTargetsMet
                }, probability);
            }

            distribution = stageStart;
            for (let pull = 0; pull < pulls; pull += 1) {
                distribution = advanceDistribution(distribution, rules, targetCopies);
            }

            const summary = summarizeDistribution(distribution, targetCopies);
            let allTargetsProbability = 0;
            const carryDistribution = new Map();
            for (const [key, probability] of distribution) {
                const state = parseStateKey(key);
                const stageSucceeded = state.copies >= targetCopies;
                const allTargetsMet = state.allPreviousTargetsMet && stageSucceeded;
                if (allTargetsMet) allTargetsProbability += probability;
                addProbability(carryDistribution, {
                    pity: state.pity,
                    featuredLosses: state.featuredLosses,
                    copies: 0,
                    allPreviousTargetsMet: allTargetsMet
                }, probability);
            }

            results.push({
                id: stage.id ?? `stage-${index + 1}`,
                pulls,
                targetCopies,
                successProbability: summary.successProbability,
                allTargetsProbability
            });
            distribution = carryDistribution;
            previousRules = rules;
        });

        const finalAllTargetsProbability = [...distribution].reduce((total, [key, probability]) => (
            parseStateKey(key).allPreviousTargetsMet ? total + probability : total
        ), 0);

        return {
            stages: results,
            allTargetsProbability: finalAllTargetsProbability,
            finalCarryDistribution: [...distribution].map(([key, probability]) => ({
                ...parseStateKey(key),
                probability
            }))
        };
    }

    return {
        MORIMENS_LIMITED_RULES,
        normalizeRules,
        getTopRarityRate,
        simulateBanner,
        findPullsForProbability,
        calculateExpectedPullsToTarget,
        calculatePullBudget,
        simulatePlan
    };
});
