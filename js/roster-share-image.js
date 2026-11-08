(function () {
    'use strict';
    // Render the same card markup and styles at a consistent desktop width.
    // Preview uses the live layout; files embed assets only when requested.
    const WIDTH = 1168;
    const assets = new Map();
    const imageAssets = new Map();
    async function render(html, { preview = false, host, onProgress = () => {}, onRenderProgress } = {}) {
        let retained = false;
        const frame = document.createElement('iframe');
        frame.setAttribute('aria-hidden', 'true');
        frame.tabIndex = -1;
        frame.style.cssText = 'position:fixed;left:-100000px;top:0;width:1280px;height:900px;border:0;pointer-events:none';
        const wrapper = preview ? document.createElement('div') : null;
        if (wrapper) { host.appendChild(wrapper); wrapper.appendChild(frame); }
        else document.body.appendChild(frame);
        try {
            const doc = frame.contentDocument;
            doc.open();
            doc.write('<!doctype html><html lang="ko"><head><meta charset="utf-8"></head><body class="roster-app classic-roster"></body></html>');
            doc.close();
            // These same-origin sheets are already parsed in the page. Reusing them
            // avoids a second network round trip for every preview stylesheet.
            const pageStyle = doc.createElement('style');
            pageStyle.textContent = [...document.styleSheets].map(sheet =>
                [...sheet.cssRules].map(rule => rule.cssText).join('\n').replace(
                    /url\(\s*(['"]?)([^)'"\s]+)\1\s*\)/g,
                    (match, quote, url) => url.startsWith('data:') || url.startsWith('#') ? match : `url("${new URL(url, sheet.href || location.href).href}")`
                )
            ).join('\n');
            doc.head.appendChild(pageStyle);
            onProgress(10);
            const style = doc.createElement('style');
            style.textContent = `html{font-size:16px}body{margin:0;padding:0;background:#1e1e22;color:#eee}
                .share-capture{width:${WIDTH}px;box-sizing:border-box;padding:24px;background:#1e1e22}
                .share-capture .inventory-summary{margin:0 0 20px;padding:0 0 16px}
                .share-capture .share-filter-summary{margin:8px 0 0;color:#aaa;font-size:12px;line-height:1.5}
                .share-capture .character-grid{margin:0}
                .share-capture .relems-character-grid,.share-capture .share-wheel-grid{display:grid;grid-template-columns:repeat(9,minmax(0,1fr));align-items:start;gap:12px}
                .share-capture .share-roster-section+.share-roster-section{margin-top:24px;padding-top:24px;border-top:1px solid #444}
                .share-capture .share-section-heading{display:flex;align-items:center;justify-content:space-between;gap:16px;margin-bottom:16px}
                .share-capture .share-section-heading h2{margin:0;font-size:18px}
                .share-capture .share-section-heading .share-filter-summary{margin:0}
                .share-capture .classic-stepper>button{visibility:hidden}
                .share-capture .character-card.is-selected{outline:0}
                .share-capture button{pointer-events:none}
                .share-capture *{animation:none!important;transition:none!important}`;
            doc.head.appendChild(style);
            const root = doc.createElement('div');
            root.className = 'share-capture'; root.innerHTML = html;
            doc.body.appendChild(root);
            const images = [...root.querySelectorAll('img')];
            const uniqueImages = new Map();
            images.forEach(img => {
                img.loading = 'eager'; img.decoding = 'async';
                const url = new URL(img.getAttribute('src'), location.href).href;
                if (img.src !== url) img.src = url;
                uniqueImages.set(url, img);
            });
            let loaded = 0;
            await Promise.all([...uniqueImages.values()].map(async img => {
                try { await img.decode(); }
                catch { throw Error('이미지를 불러오지 못했습니다. 다시 시도해 주세요.'); }
                onProgress(10 + 85 * ++loaded / uniqueImages.size);
            }));
            await doc.fonts.ready;
            onProgress(100);
            const height = Math.ceil(root.getBoundingClientRect().height);
            async function rasterize() {
                const clone = root.cloneNode(true);
                const embed = url => {
                    if (!assets.has(url)) assets.set(url, fetch(url).then(response => {
                        if (!response.ok) throw Error('이미지 자료를 불러오지 못했습니다.');
                        return response.blob();
                    }).then(blob => new Promise((resolve, reject) => {
                        const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.onerror = reject; reader.readAsDataURL(blob);
                    })).catch(error => { assets.delete(url); throw error; }));
                    return assets.get(url);
                };
                // Reuse decoded images and embed only the pixels the export can display.
                // Repeating full-size wheel art in the SVG made an all-owned export ~100 MB.
                const clonedImages = [...clone.querySelectorAll('img')];
                for (const [index, img] of clonedImages.entries()) {
                    const source = images[index];
                    const width = Math.min(source.naturalWidth, Math.max(8, Math.ceil(source.clientWidth * 2 / 8) * 8));
                    const key = `${source.src}|${width}`;
                    if (!imageAssets.has(key)) {
                        const tile = document.createElement('canvas');
                        tile.width = width;
                        tile.height = Math.max(1, Math.round(source.naturalHeight * width / source.naturalWidth));
                        const context = tile.getContext('2d');
                        context.drawImage(source, 0, 0, tile.width, tile.height);
                        imageAssets.set(key, tile.toDataURL(source.src.includes('/growth/') ? 'image/png' : 'image/webp', .92));
                    }
                    img.src = imageAssets.get(key); img.removeAttribute('srcset'); img.removeAttribute('loading');
                    if (onRenderProgress && (index % 32 === 31 || index === clonedImages.length - 1)) {
                        onRenderProgress(50 * (index + 1) / clonedImages.length);
                        await new Promise(resolve => requestAnimationFrame(resolve));
                    }
                }
                const sheets = await Promise.all([...document.querySelectorAll('link[rel="stylesheet"]')].map(async link => {
                    const response = await fetch(link.href);
                    if (!response.ok) throw Error('이미지 스타일을 불러오지 못했습니다.');
                    const css = await response.text();
                    const matches = [...css.matchAll(/url\(\s*(['"]?)([^)'"\s]+)\1\s*\)/g)];
                    const replacements = await Promise.all(matches.map(async match => {
                        const url = match[2];
                        return url.startsWith('data:') || url.startsWith('#') ? match[0] : `url("${await embed(new URL(url, link.href).href)}")`;
                    }));
                    let index = 0;
                    return css.replace(/url\(\s*(['"]?)([^)'"\s]+)\1\s*\)/g, () => replacements[index++]);
                }));
                const container = doc.createElement('div');
                onRenderProgress?.(65);
                container.setAttribute('xmlns', 'http://www.w3.org/1999/xhtml');
                container.className = 'roster-app classic-roster';
                container.style.fontFamily = frame.contentWindow.getComputedStyle(doc.body).fontFamily;
                const embeddedStyle = doc.createElement('style');
                embeddedStyle.textContent = sheets.join('\n') + '\n' + style.textContent;
                container.append(embeddedStyle, clone);
                const markup = new XMLSerializer().serializeToString(container);
                const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${height}"><foreignObject width="100%" height="100%">${markup}</foreignObject></svg>`;
                const image = new Image();
                image.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
                await image.decode();
                onRenderProgress?.(90);
                const canvas = document.createElement('canvas');
                // Bound memory usage for combined character and wheel collections.
                const scale = Math.min(2, Math.sqrt(16000000 / (WIDTH * height)), 16000 / Math.max(WIDTH, height));
                canvas.width = Math.floor(WIDTH * scale); canvas.height = Math.floor(height * scale);
                canvas.dataset.shareWidth = String(WIDTH); canvas.dataset.shareHeight = String(height);
                const ctx = canvas.getContext('2d');
                if (!ctx) throw Error('이미지를 생성할 수 없습니다.');
                ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
                onRenderProgress?.(100);
                return canvas;
            }
            if (!preview) return await rasterize();
            retained = true;
            let task;
            let observer;
            let expanded = false;
            wrapper.id = 'share-preview';
            wrapper.setAttribute('role', 'img');
            wrapper.setAttribute('aria-label', '각성체와 명륜의 보유 현황 및 성장 수치');
            wrapper.style.position = 'relative';
            frame.style.cssText = `position:absolute;left:0;top:0;width:${WIDTH}px;height:${height}px;border:0;pointer-events:none;transform-origin:0 0`;
            const resize = () => {
                const scale = expanded ? 1 : Math.min(1, wrapper.parentElement.clientWidth / WIDTH);
                wrapper.style.width = `${WIDTH * scale}px`;
                wrapper.style.height = `${height * scale}px`;
                frame.style.transform = `scale(${scale})`;
            };
            return {
                mount(host) { observer = new ResizeObserver(resize); observer.observe(host); resize(); },
                expand(value) { expanded = value; resize(); },
                canvas() { return task ||= rasterize().catch(error => { task = null; throw error; }); },
                dispose() { observer?.disconnect(); frame.remove(); }
            };
        } finally { if (!retained) { frame.remove(); wrapper?.remove(); } }
    }
    window.RosterShareImage = { render };
})();
