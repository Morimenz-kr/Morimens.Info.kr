/* Canvas export from a reviewed build model, not arbitrary HTML or remote images. */
(function (root, factory) {
    const api = factory();
    if (typeof module === 'object' && module.exports) module.exports = api;
    else root.RecordBuildShare = api;
})(typeof globalThis === 'object' ? globalThis : this, function () {
    'use strict';
    function model(party, { hideIdentity = true, identity = {} } = {}) {
        if (party?.kind !== 'historical-game-build' || !Array.isArray(party.members) || party.members.length < 1 || party.members.length > 4) throw Error('잘못된 빌드 데이터입니다.');
        return { title: party.provenance?.source==='synthetic-demo'?'Morimens · 데모 파티 빌드':'Morimens · 파티 빌드', keeperLevel: party.keeperLevel ?? null,
            identity: hideIdentity ? null : { name: String(identity.name ?? '').slice(0, 100), uid: String(identity.uid ?? '').slice(0, 18) },
            members: party.members.map(member => ({ name: member.name ?? String(member.tid), image: member.image ?? null,
                lines: [`Lv.${member.level ?? '?'} · 계령 ${member.potencyLevel ?? '?'}`,
                    '카드 ' + member.cards.map(card => card.level ?? '?').join(' / '),
                    ...member.wheels.map((wheel, index) => `명륜 ${index + 1}: ${wheel.item?.name ?? '없음'} · 돌파 ${wheel.item?.enhanceLevel ?? '?'}`),
                    ...member.covenants.filter(Boolean).map((item, index) => `계약 ${index + 1}: ${item.name ?? item.tid} · Lv.${item.level ?? '?'}`)] })) };
    }
    function wrappedLines(ctx, text, maxWidth) {
        const lines = []; let line = '';
        for (const char of String(text)) {
            if (line && ctx.measureText(line + char).width > maxWidth) { lines.push(line); line = char; } else line += char;
        }
        lines.push(line); return lines;
    }
    function drawPortrait(ctx, image, left, top, width, height, custom = {}) {
        const zoom = Math.min(3, Math.max(1, Number(custom.zoom) || 1)), scale = Math.max(width / image.width, height / image.height) * zoom;
        const w = image.width * scale, h = image.height * scale;
        const x = Math.min(1, Math.max(-1, Number(custom.x) || 0)), y = Math.min(1, Math.max(-1, Number(custom.y) || 0));
        ctx.save(); ctx.beginPath(); ctx.rect(left, top, width, height); ctx.clip();
        ctx.drawImage(image, left + (width-w)/2 + x*(w-width)/2, top + (height-h)/2 + y*(h-height)/2, w, h); ctx.restore();
    }
    async function render(party, options = {}) {
        const build = model(party, options), canvas = document.createElement('canvas'), width = 1080, padding = 40;
        const ctx = canvas.getContext('2d'); if (!ctx) throw Error('이미지 저장을 지원하지 않는 브라우저입니다.');
        ctx.font = '24px Pretendard, sans-serif';
        const measured = build.members.map(member => member.lines.flatMap(line => wrappedLines(ctx, line, 740)));
        canvas.width = width; canvas.height = 150 + measured.reduce((height, lines) => height + Math.max(280, 72 + lines.length * 34), 0);
        if (canvas.height > 8192) throw Error('이미지 내용이 너무 큽니다.');
        ctx.fillStyle = '#1a1a1a'; ctx.fillRect(0, 0, width, canvas.height);
        ctx.fillStyle = '#ffc107'; ctx.font = 'bold 36px Pretendard, sans-serif'; ctx.fillText(build.title, padding, 62);
        ctx.fillStyle = '#ecf0f1'; ctx.font = '24px Pretendard, sans-serif';
        ctx.fillText(`계정 Lv.${build.keeperLevel ?? '?'}${build.identity ? ` · ${build.identity.name} ${build.identity.uid}` : ' · 이름/UID 숨김'}`, padding, 108);
        let y = 145;
        for (const [index, member] of build.members.entries()) {
            const height = Math.max(280, 72 + measured[index].length * 34);
            ctx.fillStyle = '#2a2a2a'; ctx.fillRect(padding, y, width - padding * 2, height - 12);
            const custom = options.portraits?.[index], src = custom?.src ?? member.image;
            if (src) {
                try {
                    const url = new URL(src, location.href);
                    if (url.origin !== location.origin && url.protocol !== 'blob:') throw Error('외부 이미지 금지');
                    const image = await new Promise((resolve, reject) => { const img = new Image(), timeout = setTimeout(() => reject(Error('image-timeout')), 10000);
                        img.onload = () => { clearTimeout(timeout); resolve(img); }; img.onerror = () => { clearTimeout(timeout); reject(Error('image-unavailable')); }; img.src = url.href; });
                    drawPortrait(ctx, image, 58, y + 12, 200, 240, custom);
                } catch { ctx.fillStyle = '#aaa'; ctx.fillText('이미지 없음', 60, y + 90); }
            }
            ctx.fillStyle = '#ffc107'; ctx.font = 'bold 28px Pretendard, sans-serif'; ctx.fillText(member.name, 280, y + 38);
            ctx.fillStyle = '#ecf0f1'; ctx.font = '24px Pretendard, sans-serif';
            measured[index].forEach((line, row) => ctx.fillText(line, 280, y + 78 + row * 34)); y += height;
        }
        const blob = await new Promise((resolve, reject) => {
            const timer = setTimeout(() => reject(Error('이미지 저장 시간이 초과되었습니다.')), 20000);
            canvas.toBlob(value => { clearTimeout(timer); value ? resolve(value) : reject(Error('이미지를 생성하지 못했습니다.')); }, 'image/png');
        });
        return { blob, width: canvas.width, height: canvas.height };
    }
    function download(blob, filename) {
        const url = URL.createObjectURL(blob), link = document.createElement('a'); link.href = url; link.download = filename;
        document.body.append(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
    }
    return { model, wrappedLines, drawPortrait, render, download };
});
