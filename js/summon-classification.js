(function (root, factory) {
    const api = factory();
    if (typeof module === 'object' && module.exports) module.exports = api;
    else root.SummonClassification = api;
})(typeof window === 'undefined' ? globalThis : window, function () {
    // Preserve the original release group, including after additions to the standard pool.
    function create(groups) {
        const standard = new Set(groups.standard || []);
        const limited = new Set([...(groups.limited || []), ...(groups.forgotten || []), ...(groups.celestial || [])]);
        function characterAvailability(item) {
            if (standard.has(item.id)) return 'standard';
            if (limited.has(item.id)) return 'limited';
            return '';
        }
        function character(id) {
            if (standard.has(id)) return '상시 SSR';
            if (limited.has(id)) return '한정 SSR';
            return '';
        }
        function characterGrade(item) {
            return String(item.grade).toLowerCase() === 'ssr' ? character(item.id) : String(item.grade).toUpperCase();
        }
        function wheelGrade(item) {
            if (String(item.grade).toUpperCase() !== 'SSR') return String(item.grade).toUpperCase();
            // Dedicated wheels follow the original owner's release group; generic wheels are non-limited.
            return (item.owner_character_ids || []).some(id => character(id) === '한정 SSR') ? '한정 SSR' : '상시 SSR';
        }
        return { characterGrade, wheelGrade, characterAvailability };
    }
    return { create };
});
