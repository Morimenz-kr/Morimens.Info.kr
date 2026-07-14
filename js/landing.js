document.addEventListener('DOMContentLoaded', () => {
    'use strict';

    const modal = document.getElementById('patch-modal');
    const openButton = document.getElementById('open-patch-modal');
    const listContent = document.getElementById('patch-list-content');

    if (!modal || !openButton || !listContent) return;

    window.SiteDialog?.setup(modal, {
        initialFocus: '#close-patch-modal'
    });

    openButton.addEventListener('click', () => {
        window.SiteDialog?.open(modal, openButton);
    });

    function createStatus(message, className = 'status-message') {
        const paragraph = document.createElement('p');
        paragraph.className = className;
        paragraph.textContent = message;
        return paragraph;
    }

    function renderPatchNotes(items) {
        listContent.replaceChildren();

        if (!Array.isArray(items) || items.length === 0) {
            listContent.append(createStatus('등록된 업데이트 내역이 없습니다.', 'empty-state'));
            return;
        }

        items.forEach((item) => {
            const article = document.createElement('article');
            article.className = 'patch-item';

            const heading = document.createElement('div');
            heading.className = 'patch-item-heading';

            const version = document.createElement('strong');
            version.className = 'patch-ver';
            version.textContent = String(item?.version || '버전 정보 없음');

            const date = document.createElement('time');
            date.className = 'patch-date';
            date.textContent = String(item?.date || '날짜 정보 없음');
            if (/^\d{4}-\d{2}-\d{2}$/.test(item?.date || '')) {
                date.dateTime = item.date;
            }

            heading.append(version, date);
            article.append(heading);

            const changes = Array.isArray(item?.changes) ? item.changes : [];
            if (changes.length > 0) {
                const list = document.createElement('ul');
                list.className = 'patch-desc';
                changes.forEach((change) => {
                    const listItem = document.createElement('li');
                    listItem.textContent = String(change);
                    list.append(listItem);
                });
                article.append(list);
            }

            listContent.append(article);
        });

        openButton.textContent = `업데이트 내역 ${String(items[0]?.version || '')}`.trim();
    }

    function renderLoadError() {
        const wrapper = document.createElement('div');
        wrapper.className = 'error-state';

        const message = document.createElement('p');
        message.textContent = '업데이트 내역을 불러오지 못했습니다.';

        const retry = document.createElement('button');
        retry.type = 'button';
        retry.className = 'footer-link';
        retry.textContent = '다시 시도';
        retry.addEventListener('click', loadPatchNotes);

        wrapper.append(message, retry);
        listContent.replaceChildren(wrapper);
    }

    async function loadPatchNotes() {
        listContent.replaceChildren(createStatus('업데이트 내역을 불러오는 중입니다.'));
        try {
            const response = await fetch('data/patch_notes.json', { cache: 'no-cache' });
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            renderPatchNotes(await response.json());
        } catch (error) {
            console.error('업데이트 내역 로드 실패:', error);
            renderLoadError();
        }
    }

    loadPatchNotes();
});
