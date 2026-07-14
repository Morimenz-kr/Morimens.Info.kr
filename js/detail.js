(function () {
    'use strict';

    const rawId = new URLSearchParams(window.location.search).get('id') || '';
    const characterId = /^[A-Za-z0-9_-]{1,64}$/.test(rawId) ? rawId : '';
    const target = new URL(characterId ? 'links.html' : 'list.html', window.location.href);

    if (characterId) {
        target.searchParams.set('category', 'character');
        target.searchParams.set('id', characterId);
    }

    const link = document.getElementById('canonical-character-link');
    if (link) link.href = target.href;

    const status = document.getElementById('redirect-status');
    if (status) {
        status.textContent = characterId
            ? '통합 각성체 정보 페이지로 이동 중입니다.'
            : '각성체 목록으로 이동 중입니다.';
    }

    window.location.replace(target.href);
})();
