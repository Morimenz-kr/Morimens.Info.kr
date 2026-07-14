(function () {
    'use strict';

    const SHEET_URL = 'https://docs.google.com/spreadsheets/d/1gRDzdVHGfCC4qjt5aZYKuU9FWEfWdqREztNGeiczmRk/edit?gid=653016488#gid=653016488';
    const FALLBACK_IMAGE = 'images/smile_Ramona.webp';
    const DEFAULT_CURRENT_RERUNS = [
        { id: 'helot_catena', name: '혈쇄 · 히로', start_date: '2026-07-13', end_date: '2026-08-10' },
        { id: 'coporsant', name: '코퍼산트', start_date: '2026-07-13', end_date: '2026-08-10' },
        { id: 'pollux', name: '폴룩스', start_date: '2026-07-13', end_date: '2026-08-10' }
    ];

    const currentBox = document.getElementById('current-schedules');
    const gapBox = document.getElementById('rerun-gap-list');
    const historyBox = document.getElementById('rerun-history');
    if (!currentBox || !gapBox || !historyBox) return;

    function createElement(tag, className, text) {
        const element = document.createElement(tag);
        if (className) element.className = className;
        if (text !== undefined) element.textContent = text;
        return element;
    }

    function createSourceLink() {
        const link = createElement('a', '', '원본 출시·복각표 열기 ↗');
        link.href = SHEET_URL;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        return link;
    }

    function createEmptyState(message, { retry = false, source = false } = {}) {
        const wrapper = createElement('div', 'info-empty');
        wrapper.append(createElement('strong', '', message));
        if (retry) {
            const button = createElement('button', 'info-retry', '다시 시도');
            button.type = 'button';
            button.addEventListener('click', initialize, { once: true });
            wrapper.append(button);
        }
        if (source) wrapper.append(createSourceLink());
        return wrapper;
    }

    function setBusy(busy) {
        [currentBox, gapBox, historyBox].forEach(element => {
            element.setAttribute('aria-busy', String(busy));
        });
    }

    function monthDifference(month) {
        const match = /^(\d{4})-(\d{1,2})$/.exec(String(month || ''));
        if (!match) return 0;
        const year = Number(match[1]);
        const monthNumber = Number(match[2]);
        const now = new Date();
        return Math.max(0, (now.getFullYear() - year) * 12 + (now.getMonth() + 1 - monthNumber));
    }

    function getCharacter(id, entry, characterMap) {
        return characterMap.get(id) || {
            id,
            name: String(entry?.name || '이름 미상'),
            image_thumb: FALLBACK_IMAGE
        };
    }

    function makePortrait(character, className = 'rerun-portrait') {
        const image = document.createElement('img');
        image.className = className;
        image.src = character?.image_thumb || FALLBACK_IMAGE;
        image.alt = `${String(character?.name || '캐릭터')} 썸네일`;
        image.width = 72;
        image.height = 72;
        image.loading = 'lazy';
        image.addEventListener('error', () => {
            if (!image.src.endsWith('/images/smile_Ramona.webp')) image.src = FALLBACK_IMAGE;
        }, { once: true });
        return image;
    }

    function renderCurrent(items, characterMap) {
        if (!items.length) {
            currentBox.replaceChildren(createEmptyState('현재 복각 정보를 준비 중입니다.', { source: true }));
            return;
        }

        const fragment = document.createDocumentFragment();
        items.forEach(item => {
            const character = getCharacter(item?.id, item, characterMap);
            const card = createElement('article', 'character-rerun-card');
            const content = createElement('div');
            const name = createElement('h3', '', character.name);
            const hasDates = item?.start_date && item?.end_date;
            const meta = createElement(
                'p',
                '',
                hasDates ? `${item.start_date} ~ ${item.end_date}` : '기간 정보는 추후 업데이트됩니다.'
            );
            content.append(name, meta);
            card.append(makePortrait(character), content);
            fragment.append(card);
        });
        currentBox.replaceChildren(fragment);
    }

    function collectLastAppearances(history) {
        const result = new Map();
        history.forEach(group => {
            const month = String(group?.month || '');
            const characters = Array.isArray(group?.characters) ? group.characters : [];
            characters.forEach(entry => {
                if (!entry?.id) return;
                const previous = result.get(entry.id) || { release: null, rerun: null, name: entry.name };
                previous.name = entry.name || previous.name;
                if (Number(entry.appearance) === 1) previous.release = month;
                if (Number(entry.appearance) > 1) previous.rerun = month;
                result.set(entry.id, previous);
            });
        });
        return result;
    }

    function renderGapRanking(history, current, characterMap) {
        const currentIds = new Set(current.map(item => item?.id).filter(Boolean));
        const rows = [...collectLastAppearances(history)]
            .filter(([id]) => !currentIds.has(id))
            .map(([id, entry]) => {
                const lastMonth = entry.rerun || entry.release;
                return {
                    id,
                    entry,
                    lastMonth,
                    months: monthDifference(lastMonth),
                    neverRerun: !entry.rerun
                };
            })
            .filter(row => row.lastMonth)
            .sort((a, b) => b.months - a.months || String(a.entry.name).localeCompare(String(b.entry.name), 'ko'));

        if (!rows.length) {
            gapBox.replaceChildren(createEmptyState('공백 정보를 표시할 수 없습니다.', { source: true }));
            return;
        }

        const fragment = document.createDocumentFragment();
        let displayedRank = 0;
        let previousMonth = null;
        rows.forEach((row, index) => {
            if (row.lastMonth !== previousMonth) displayedRank = index + 1;
            previousMonth = row.lastMonth;
            const character = getCharacter(row.id, row.entry, characterMap);
            const article = createElement('article', 'rerun-gap-card');
            const rank = createElement('span', 'gap-rank', String(displayedRank));
            rank.setAttribute('aria-label', `${displayedRank}위`);
            const details = createElement('div', 'gap-details');
            details.append(
                createElement('h3', '', character.name),
                createElement('p', '', row.neverRerun ? `출시 ${row.lastMonth}` : `마지막 복각 ${row.lastMonth}`)
            );
            const period = createElement('div', 'gap-period');
            period.append(createElement('strong', '', `${row.months}개월 전`));
            article.append(rank, makePortrait(character), details, period);
            fragment.append(article);
        });
        gapBox.replaceChildren(fragment);
    }

    function renderHistory(history, characterMap) {
        if (!history.length) {
            historyBox.replaceChildren(createEmptyState('등록된 배너 기록이 없습니다.', { source: true }));
            return;
        }

        const fragment = document.createDocumentFragment();
        [...history].reverse().forEach(group => {
            const article = createElement('article', 'history-row');
            article.append(createElement('h3', '', String(group?.month || '').replace('-', '. ')));
            const characters = createElement('div', 'history-characters');
            const entries = Array.isArray(group?.characters) ? group.characters : [];
            entries.forEach(entry => {
                const character = getCharacter(entry?.id, entry, characterMap);
                const portrait = makePortrait(character, 'rerun-portrait history-portrait');
                portrait.title = `${character.name} · ${Number(entry?.appearance) > 1 ? `${Number(entry.appearance) - 1}차 복각` : '출시'}`;
                characters.append(portrait);
            });
            article.append(characters);
            fragment.append(article);
        });
        historyBox.replaceChildren(fragment);
    }

    async function initialize() {
        setBusy(true);
        try {
            const [scheduleResponse, manifestResponse] = await Promise.all([
                fetch('data/rerun_schedule.json', { cache: 'no-cache' }),
                fetch('data/character_manifest.json', { cache: 'no-cache' })
            ]);
            if (!scheduleResponse.ok || !manifestResponse.ok) {
                throw new Error(`복각 데이터 로드 실패 (${scheduleResponse.status}/${manifestResponse.status})`);
            }

            const [data, manifest] = await Promise.all([scheduleResponse.json(), manifestResponse.json()]);
            const manifestItems = Array.isArray(manifest) ? manifest : [];
            const characterMap = new Map(manifestItems.filter(item => item?.id).map(item => [item.id, item]));
            const current = Array.isArray(data?.current_reruns) ? data.current_reruns : DEFAULT_CURRENT_RERUNS;
            const history = Array.isArray(data?.history) ? data.history : [];

            renderCurrent(current, characterMap);
            renderGapRanking(history, current, characterMap);
            renderHistory(history, characterMap);
        } catch (error) {
            console.error('복각 일정 로드 실패:', error);
            currentBox.replaceChildren(createEmptyState('복각 정보를 표시할 수 없습니다.', { retry: true, source: true }));
            gapBox.replaceChildren();
            historyBox.replaceChildren();
        } finally {
            setBusy(false);
        }
    }

    initialize();
})();
