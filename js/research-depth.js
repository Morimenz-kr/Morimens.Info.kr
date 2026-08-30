(() => {
    const STORAGE_KEY = 'morimens-forbidden-knowledge-level';
    let levels = [];

    function clampLevel(value) {
        const maximum = levels.at(-1)?.level || 100;
        return Math.min(maximum, Math.max(1, Math.round(Number(value) || 1)));
    }

    async function load() {
        if (levels.length) return levels;
        const response = await fetch(`data/research_depth_levels.json?t=${Date.now()}`);
        if (!response.ok) throw new Error(`연구 깊이 데이터 HTTP ${response.status}`);
        levels = (await response.json()).levels || [];
        return levels;
    }

    function selectedLevel() {
        return clampLevel(localStorage.getItem(STORAGE_KEY) || 81);
    }

    function selectLevel(value) {
        const level = clampLevel(value);
        localStorage.setItem(STORAGE_KEY, String(level));
        return level;
    }

    function depthAt(value) {
        const level = clampLevel(value);
        const row = levels.find(item => item.level === level) || levels[0];
        return row ? { ...row } : null;
    }

    function evaluate(expression, depth, variables = {}) {
        if (!depth) return null;
        let source = String(expression ?? '')
            .replaceAll('InsightResearchDepth', String(depth.spirit))
            .replaceAll('PlayerGrowth', String(depth.material))
            .replaceAll('GetAccountStageGrow()', String(depth.material))
            .replaceAll('SpiritResearchDepthMultiplier', String(depth.spiritRate / 100))
            .replaceAll('math.ceil', 'Math.ceil')
            .replaceAll('math.floor', 'Math.floor');
        Object.entries(variables).forEach(([token, value]) => {
            source = source.replaceAll(token, String(value));
        });
        if (!/^(?:[0-9+\-*/().\s]|Math\.(?:ceil|floor))+$/.test(source)) return null;
        try {
            const result = Function(`"use strict"; return (${source});`)();
            return Number.isFinite(result) ? result : null;
        } catch {
            return null;
        }
    }

    function formatDepth(depth) {
        const number = new Intl.NumberFormat('ko-KR', { maximumFractionDigits: 2 });
        return `생체 ${number.format(depth.biological)} · 물상 ${number.format(depth.material)} · 영식 ${number.format(depth.spirit)}`;
    }

    window.ResearchDepth = { load, selectedLevel, selectLevel, depthAt, evaluate, formatDepth };
})();
