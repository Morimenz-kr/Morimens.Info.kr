import {
    createSafeImageUrl,
    resolveSafeHttpUrl
} from './domain.js?v=v1.4.0-site-quality-20260713-r4';

function createElement(document, tagName, className, text) {
    const element = document.createElement(tagName);
    if (className) element.className = className;
    if (text !== undefined && text !== null) element.textContent = String(text);
    return element;
}

export function createExternalLinkRenderer(options = {}) {
    const { document, baseUrl = document?.baseURI, fallbackImage = '' } = options;
    if (!document) throw new TypeError('External link renderer requires a document.');

    const resolvedFallbackImage = resolveSafeHttpUrl(fallbackImage, baseUrl);

    function setSafeImage(image, source, fallback = resolvedFallbackImage) {
        const safeFallback = resolveSafeHttpUrl(fallback, baseUrl, resolvedFallbackImage);
        const safeSource = resolveSafeHttpUrl(source, baseUrl, safeFallback);
        if (safeSource !== safeFallback) {
            image.addEventListener('error', () => {
                image.src = safeFallback;
            }, { once: true });
        }
        image.src = safeSource;
    }

    function createInvalidCard(label) {
        const card = createElement(document, 'div', 'notion-bookmark invalid-link-card');
        card.setAttribute('role', 'status');
        const content = createElement(document, 'div', 'bookmark-content');
        content.append(
            createElement(document, 'div', 'bookmark-title', label || '열 수 없는 링크'),
            createElement(document, 'div', 'bookmark-desc', '안전하지 않거나 올바르지 않은 주소라 링크를 비활성화했습니다.')
        );
        card.append(content);
        return card;
    }

    function createCard(data = {}) {
        const safeUrl = resolveSafeHttpUrl(data.url, baseUrl);
        if (!safeUrl) return createInvalidCard(data.title || String(data.url || '열 수 없는 링크'));
        const domain = new URL(safeUrl).hostname || '링크';
        const link = createElement(document, 'a', 'notion-bookmark notion-bookmark-full');
        link.href = safeUrl;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';

        const content = createElement(document, 'div', 'bookmark-content');
        const copy = createElement(document, 'div', 'bookmark-copy');
        copy.append(
            createElement(document, 'div', 'bookmark-title', data.title || safeUrl),
            createElement(document, 'div', 'bookmark-desc', data.description || '설명이 없습니다.')
        );

        const urlLine = createElement(document, 'div', 'bookmark-url');
        const favicon = createElement(document, 'img', 'bookmark-favicon');
        favicon.alt = '';
        favicon.width = 16;
        favicon.height = 16;
        favicon.loading = 'lazy';
        setSafeImage(favicon, `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=32`);
        urlLine.append(favicon, document.createTextNode(data.publisher || domain));
        content.append(copy, urlLine);

        const imageWrap = createElement(document, 'div', 'bookmark-image');
        const thumbnail = createElement(document, 'img');
        thumbnail.alt = '';
        thumbnail.width = 180;
        thumbnail.height = 120;
        thumbnail.loading = 'lazy';
        setSafeImage(thumbnail, createSafeImageUrl(data.image, { baseUrl, fallback: resolvedFallbackImage }));
        imageWrap.append(thumbnail);
        link.append(content, imageWrap);
        return link;
    }

    function append(data, container) {
        if (!data || typeof data !== 'object') {
            container.append(createInvalidCard('올바르지 않은 링크 정보'));
            return;
        }
        container.append(createCard({
            url: data.url,
            title: data.title || '제목 없음',
            description: data.desc || '',
            publisher: data.publisher,
            image: data.image
        }));
    }

    return Object.freeze({ append, createCard, createInvalidCard, setSafeImage });
}
