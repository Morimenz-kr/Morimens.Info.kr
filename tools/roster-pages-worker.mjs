// The roster Pages origin forwards to the existing feedback service server-side.
// Other routes continue to use Pages' static asset handling.
export default {
    async fetch(request, env) {
        const url = new URL(request.url);
        if (url.pathname !== '/api/feedback') return env.ASSETS.fetch(request);
        const json = (message, status) => Response.json({message}, {status});
        if (request.method !== 'POST') return json('POST 요청이 필요합니다.', 405);
        if (request.headers.get('Origin') && request.headers.get('Origin') !== url.origin) return json('허용되지 않은 요청입니다.', 403);
        if (!request.headers.get('Content-Type')?.includes('application/json')) return json('JSON 형식이 필요합니다.', 415);
        const reader = request.body?.getReader();
        if (!reader) return json('제보 내용을 입력해 주세요.', 400);
        let text = '', bytes = 0;
        const decoder = new TextDecoder();
        while (true) {
            const {done, value} = await reader.read();
            if (done) break;
            bytes += value.byteLength;
            if (bytes > 32768) { await reader.cancel(); return json('제보 내용이 너무 깁니다.', 413); }
            text += decoder.decode(value, {stream:true});
        }
        text += decoder.decode();
        try {
            const payload = JSON.parse(text);
            if (!payload || typeof payload !== 'object' || Array.isArray(payload) || typeof payload.message !== 'string' || !payload.message.trim()) return json('제보 내용을 입력해 주세요.', 400);
        } catch { return json('JSON 형식을 확인해 주세요.', 400); }
        try {
            const response = await fetch('__FEEDBACK_ENDPOINT__', {
                method:'POST',
                headers:{'Content-Type':'application/json', Origin:'https://morimenz-kr.github.io'},
                body:text
            });
            return new Response(response.body, {status:response.status, headers:{'Content-Type':response.headers.get('Content-Type') || 'application/json', 'Cache-Control':'no-store'}});
        } catch { return json('접수 서버에 연결하지 못했습니다.', 502); }
    }
};
