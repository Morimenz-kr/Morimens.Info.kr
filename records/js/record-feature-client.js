/* UI-independent API facade. No Steam/protocol/authentication data belongs here. */
(function (root, factory) {
    const api = factory();
    if (typeof module === 'object' && module.exports) module.exports = api;
    else root.RecordFeatureClient = api;
})(typeof globalThis === 'object' ? globalThis : this, function () {
    'use strict';
    const ERROR_TEXT = {
        'game_running': '조회용 PC에서 게임이 실행 중입니다. 운영자가 게임을 종료하고 Steam을 켜 둔 뒤 다시 조회할 수 있습니다.',
        'private': '플레이어가 공개하지 않은 기록입니다.',
        'record_unavailable': '공유 기록을 조회할 수 없습니다.',
        'data-not-collected': '이 범위의 데이터는 아직 수집되지 않았습니다.',
        'rate-limited': '조회가 잠시 제한되었습니다. 잠시 후 다시 시도해 주세요.',
        'busy': '다른 게임 조회가 진행 중입니다.',
        'version': '게임 버전이 변경되어 조회 도구 갱신이 필요합니다.',
        'query-service-not-configured': '공개 조회 서버가 아직 연결되지 않았습니다.',
        'query-service-unavailable': '게임 조회 서버에 연결할 수 없습니다.'
    };
    const identifier = value => {
        const text = String(value);
        if (!/^[1-9][0-9]{0,17}$/.test(text) || !Number.isSafeInteger(Number(text))) throw Error('Invalid ID');
        return text;
    };
    const replay = value => {
        if (typeof value !== 'string' || !/^[a-f\d]{8}(?:-[a-f\d]{4}){3}-[a-f\d]{12}(?:#E#[a-z])?$/i.test(value)) throw Error('Invalid replay');
        return encodeURIComponent(value);
    };
    function create({ baseUrl = '', fetch: fetcher = globalThis.fetch } = {}) {
        if (typeof fetcher !== 'function') throw Error('Fetch unavailable');
        if (baseUrl && !/^https?:\/\/[^/?#]+(?:\/[^?#]*)?$/.test(baseUrl)) throw Error('Invalid API base');
        const base = baseUrl.replace(/\/$/, '');
        async function get(path, parameters = {}, { signal, pendingSince = Date.now() } = {}) {
            const query = new URLSearchParams();
            for (const [key, value] of Object.entries(parameters)) if (value !== undefined && value !== null) query.set(key,
                ['growth', 'ownedPotency', 'stateLayers', 'actorLayers', 'playerLayers'].includes(key) && typeof value === 'object' ? JSON.stringify(value) : String(value));
            const url = base + path + (query.size ? '?' + query.toString() : '');
            let response;
            try { response = await fetcher(url, { method: 'GET', credentials: 'omit', cache: 'no-store', signal, headers: { Accept: 'application/json' } }); }
            catch (error) { if (error.name === 'AbortError') throw error; throw Object.assign(Error('조회 서비스에 연결할 수 없습니다.'), { code: 'service-unavailable' }); }
            let body;
            try { body = await response.json(); }
            catch { throw Object.assign(Error('조회 서비스의 응답 형식이 올바르지 않습니다.'), { code: 'invalid-response' }); }
            if (!body || typeof body !== 'object' || Array.isArray(body)) throw Object.assign(Error('조회 서비스의 응답 형식이 올바르지 않습니다.'), { code: 'invalid-response' });
            if(response.status===202&&body.pending===true){if(body.source!=='game-server'||!Number.isInteger(body.retryAfter)||body.retryAfter<5||body.retryAfter>30)throw Error('잘못된 조회 대기 응답입니다.');const remaining=310000-(Date.now()-pendingSince);if(remaining<=0)throw Error('게임 조회 시간이 초과되었습니다. 잠시 후 다시 시도해 주세요.');await new Promise((resolve,reject)=>{const finish=()=>{signal?.removeEventListener('abort',abort);resolve();},timer=setTimeout(finish,Math.min(remaining,body.retryAfter*1000)),abort=()=>{clearTimeout(timer);signal?.removeEventListener('abort',abort);reject(new DOMException('Aborted','AbortError'));};if(signal?.aborted)abort();else signal?.addEventListener('abort',abort,{once:true});});return get(path,parameters,{signal,pendingSince});}
            if (!response.ok || body.error || body.ok === false) {
                const code = Object.hasOwn(ERROR_TEXT, body.error) ? body.error : 'query-failed';
                throw Object.assign(Error(ERROR_TEXT[code] ?? '기록 조회에 실패했습니다.'), { code, status: response.status });
            }
            return body;
        }
        return {
            health: options => get('/api/health', {}, options),
            profile: (uid, options) => get('/api/profile/' + identifier(uid), {}, options),
            showcase: (uid, tid, options) => get(`/api/profile/${identifier(uid)}/awakener/${identifier(tid)}`, {}, options),
            history: (uid, page = 1, options) => get(`/api/profile/${identifier(uid)}/history`, { page }, options),
            challenges: (uid, options) => get(`/api/profile/${identifier(uid)}/challenges`, {}, options),
            latestDzone: (uid, options) => get(`/api/profile/${identifier(uid)}/latest-dzone`, {}, options),
            matches: (uid, page = 1, options) => get(`/api/profile/${identifier(uid)}/matches`, { page }, options),
            stageClears: (tid, page = 1, options) => get(`/api/dzone/stage/${identifier(tid)}/clears`, { page }, options),
            review: (code, options) => get('/api/replay/' + replay(code), {}, options),
            analysis: (code, params, options) => get(`/api/replay/${replay(code)}/analysis`, params, options),
            party: (code, options) => get(`/api/replay/${replay(code)}/party`, {}, options),
            partyCode: (code, options) => get(`/api/replay/${replay(code)}/party-code`, {}, options),
            simulation: (code, options) => get(`/api/replay/${replay(code)}/simulation`, {}, options),
            build: (code, tid, options) => get(`/api/replay/${replay(code)}/build`, { awakener: identifier(tid) }, options),
            originalBuild: (code, tid, context = {}, options) => get(`/api/replay/${replay(code)}/original-build`, { ...context, awakener: identifier(tid) }, options),
            leaderboard: (params, options) => get('/api/leaderboard', params, options),
            seasons: (mode, options) => get('/api/seasons', { mode }, options),
            clears: (filters, options) => get('/api/clears', filters, options),
            meta: (filters, options) => get('/api/meta', filters, options),
            events: (params, options) => get('/api/events', params, options),
            eventTimeRules: (params, options) => get('/api/events/time-rules', params, options),
            event: (eventId, options) => { const value = String(eventId); if (!/^(?:summon-)?[1-9][0-9]{0,8}$/.test(value)) throw Error('Invalid event'); return get('/api/events/' + value, {}, options); },
            relics: (params, options) => get('/api/library/relics-full', params, options),
            relic: (tid, context, options) => get('/api/library/relics/' + identifier(tid), context, options),
            battleSource: (kind, tid, options) => { if (!['Skill', 'State'].includes(kind)) throw Error('Invalid source kind'); return get(`/api/library/sources/${kind}/${identifier(tid)}`, {}, options); },
            stages: (params, options) => get('/api/library/stages', params, options),
            profileCosmetics: (params, options) => get('/api/library/profile-cosmetics', params, options)
        };
    }
    return { create };
});
