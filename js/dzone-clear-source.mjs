const local = ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname);
const endpoint = () => (CONFIG.CHARACTER_USAGE_ENDPOINT_URL || CONFIG.DZONE_USAGE_ENDPOINT_URL).replace(/\/$/, '');
const init = () => ({ signal: AbortSignal.timeout(25000) });

export async function currentClearPeriod() {
    const response = await fetch('data/dzone_current.json', init());
    if (!response.ok) throw new Error('시즌 정보를 불러오지 못했습니다.');
    const { period } = await response.json();
    if (!Number.isSafeInteger(period) || period <= 0) throw new Error('시즌 정보를 확인할 수 없습니다.');
    return period;
}

export async function getClearData(resource, period, characterId) {
    const suffix = resource === 'character' ? 'characters/' + encodeURIComponent(characterId) + '.json' : 'teams.json';
    if (local) {
        const localPeriod = period || await currentClearPeriod();
        const response = await fetch(`data/dzone-meta/${localPeriod}/${suffix}`, init());
        if (response.ok) return response.json();
        if (response.status !== 404) throw new Error('로컬 클리어 자료를 불러오지 못했습니다.');
    }
    const suffixApi = resource === 'character'
        ? '/api/dzone/character/' + encodeURIComponent(characterId) + '/usage'
        : '/api/dzone/clears';
    const query = period ? '?' + new URLSearchParams({ period }) : '';
    const response = await fetch(endpoint() + suffixApi + query, init());
    if (response.status === 404) {
        const payload = await response.json().catch(() => null);
        return { data: null, periods: Array.isArray(payload?.periods) ? payload.periods : [] };
    }
    if (!response.ok) throw new Error('클리어 기록을 불러오지 못했습니다. 잠시 후 다시 시도해주세요.');
    const payload = await response.json();
    if (!payload.data) throw new Error('상세 통계 서버가 아직 연결되지 않았습니다.');
    return payload;
}
