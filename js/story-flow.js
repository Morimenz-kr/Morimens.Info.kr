(function (root, factory) {
    const api = factory();
    if (typeof module === 'object' && module.exports) module.exports = api;
    else root.StoryFlow = api;
})(typeof window === 'undefined' ? globalThis : window, function () {
    'use strict';
    function unit(ids) {
        for (let n = 1; n <= ids.length; n++) {
            if (ids.length % n === 0 && ids.every((id, i) => id === ids[i % n])) return ids.slice(0, n);
        }
        return [];
    }
    // A finite repeat count is different from an unbounded loop.
    function blocks(ids) {
        const choices = Array(ids.length + 1), costs = Array(ids.length + 1).fill(Infinity);
        costs[ids.length] = 0;
        for (let start = ids.length - 1; start >= 0; start--) {
            choices[start] = {ids: [ids[start]], count: 1};
            costs[start] = 1 + costs[start + 1];
            for (let n = 1; n <= (ids.length - start) / 2; n++) {
                let count = 1;
                while (start + (count + 1) * n <= ids.length && ids.slice(start, start + n).every((id, i) => id === ids[start + count * n + i])) {
                    count++;
                    const cost = n + 0.5 + costs[start + count * n];
                    if (cost < costs[start]) {
                        choices[start] = {ids: ids.slice(start, start + n), count};
                        costs[start] = cost;
                    }
                }
            }
        }
        const result = [];
        for (let start = 0; start < ids.length;) {
            const choice = choices[start];
            result.push(choice);
            start += choice.ids.length * choice.count;
        }
        return result;
    }
    function initialAndLoop(opening, cycle) {
        if (!cycle.length) return {initial: [...opening], loop: []};
        const period = unit(cycle).length;
        const at = index => index < opening.length ? opening[index] : cycle[(index - opening.length) % cycle.length];
        const candidate = Array.from({length: period}, (_, i) => at(i));
        // Checking the prefix plus two complete cycles covers the joining boundary.
        const joins = Array.from({length: opening.length + cycle.length * 2}, (_, i) => i).every(i => at(i) === candidate[i % period]);
        return joins ? {initial: [], loop: candidate} : {initial: [...opening], loop: unit(cycle)};
    }
    function build(monster) {
        const patterns = monster.patterns || [];
        const opening = patterns.find(p => p.id === 'opening')?.skillIds || [];
        const cycle = patterns.find(p => p.id === 'cycle-1')?.skillIds || [];
        const endIds = new Set((monster.skills || []).filter(s => s.actionEnd === 'death').map(s => s.id));
        const canRevive = (monster.storyTransitions || []).some(t => t.rebirth);
        const sections = [];
        function append(ids, meta = {}) {
            const stop = canRevive ? -1 : ids.findIndex(id => endIds.has(id));
            if (stop >= 0) {
                sections.push({...meta, label: /^1~\d+턴$/.test(meta.label || '') ? '1~' + (stop + 1) + '턴' : meta.label, ids: ids.slice(0, stop + 1), loop: false, end: 'death'});
                return true;
            }
            if (ids.length) sections.push({...meta, ids: [...ids]});
            return false;
        }
        if (monster.turnOverrides?.length) {
            const first = monster.turnOverrides[0].firstTurn;
            const at = i => i < opening.length ? opening[i] : cycle.length ? cycle[(i - opening.length) % cycle.length] : undefined;
            const ids = Array.from({length: first - 1}, (_, i) => at(i)).filter(id => id !== undefined);
            if (append(ids, {label: `1~${first - 1}턴`, finite: true})) return sections;
            for (const [i, override] of monster.turnOverrides.entries()) {
                const next = monster.turnOverrides[i + 1];
                if (append([override.skillId], {label: `${override.firstTurn}턴${override.persistent ? '부터' : ''}`, loop: override.persistent, turns: next ? next.firstTurn - override.firstTurn : 1})) break;
            }
            return sections;
        }
        const first = initialAndLoop(opening, cycle);
        if (append(first.initial, {label: '처음에', finite: true})) return sections;
        if (append(first.loop, {label: first.initial.length ? '이후 반복' : '처음부터 반복', loop: true, cycle: 1})) return sections;
        for (const pattern of patterns.filter(p => /^cycle-/.test(p.id) && p.id !== 'cycle-1')) {
            const cycleIndex = Number(pattern.id.split('-')[1]);
            const transition = (monster.storyTransitions || []).find(t => t.cycleIndex === cycleIndex);
            if (transition?.entrySkillId) append([transition.entrySkillId], {label: '전환 직후', transition, cycle: cycleIndex});
            const resumed = transition?.entryReplacesFirst ? [...pattern.skillIds.slice(1), pattern.skillIds[0]] : pattern.skillIds;
            append(unit(resumed), {label: '전환 후 반복', loop: true, cycle: cycleIndex, transition: transition?.entrySkillId ? undefined : transition});
        }
        return sections;
    }
    return {unit, blocks, initialAndLoop, build};
});
