(function () {
    'use strict';

    const SHEET_URL = 'https://docs.google.com/spreadsheets/d/1gRDzdVHGfCC4qjt5aZYKuU9FWEfWdqREztNGeiczmRk/edit?gid=653016488#gid=653016488';
    const FALLBACK_IMAGE = 'images/smile_Ramona.webp';
    const DEFAULT_CURRENT_PICKUPS = [
        { id: 'saya', name: '사야', start_date: '2026-05-30', end_date: '2026-08-24', kind: 'release' },
        { id: 'lotan_cetarchon', name: '침식 · 로탄', start_date: '2026-07-27', end_date: '2026-08-24', kind: 'release' },
        { id: 'horla', name: '오를라', start_date: '2026-08-10', end_date: '2026-09-07', kind: 'rerun' },
        { id: 'doresain', name: '도어세인', start_date: '2026-08-10', end_date: '2026-09-07', kind: 'rerun' },
        { id: 'mouchette', name: '무셰트', start_date: '2026-08-10', end_date: '2026-09-07', kind: 'rerun' },
        { id: 'caraboo', name: '카라부', start_date: '2026-08-24', end_date: '2026-09-21', kind: 'rerun' }
    ];
    const DEFAULT_NEXT_PICKUPS = [
        { id: 'kathigu-ra', name: '카티구라', start_date: '2026-09-07', start_time: '10:00', end_date: '2026-10-05', end_time: '10:00', timezone: 'Asia/Seoul', kind: 'rerun' },
        { id: 'dafoodil', name: '다포딜', start_date: '2026-09-07', start_time: '10:00', end_date: '2026-10-05', end_time: '10:00', timezone: 'Asia/Seoul', kind: 'rerun' },
        { id: 'Murphy_Fauxborn', name: '탄망 · 머피', start_date: '2026-09-07', start_time: '10:00', end_date: '2026-10-05', end_time: '10:00', timezone: 'Asia/Seoul', kind: 'rerun' }
    ];

    const currentBox = document.getElementById('current-schedules');
    const currentRerunBox = document.getElementById('current-reruns');
    const nextBox = document.getElementById('next-schedules');
    const gapBox = document.getElementById('rerun-gap-list');
    const historyBox = document.getElementById('rerun-history');
    if (!currentBox || !currentRerunBox || !nextBox || !gapBox || !historyBox) return;

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
        [currentBox, currentRerunBox, nextBox, gapBox, historyBox].forEach(element => {
            element.setAttribute('aria-busy', String(busy));
        });
    }

    function parseLocalDate(dateKey) {
        const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(dateKey || ''));
        if (!match) return null;
        return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
    }

    function daysSince(fromDateKey, today = new Date()) {
        const from = parseLocalDate(fromDateKey);
        if (!from) return null;
        const to = new Date(today.getFullYear(), today.getMonth(), today.getDate());
        const totalDays = Math.floor((to - from) / 86400000);
        return totalDays >= 0 ? totalDays : null;
    }

    function localDateKey(date = new Date()) {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }

    function dateTimeKey(date = new Date(), timeZone = 'Asia/Seoul') {
        const parts = new Intl.DateTimeFormat('en-CA', {
            timeZone,
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            hourCycle: 'h23'
        }).formatToParts(date);
        const values = Object.fromEntries(parts.map(part => [part.type, part.value]));
        return `${values.year}-${values.month}-${values.day}T${values.hour}:${values.minute}`;
    }

    function scheduleBoundary(item, boundary) {
        const date = item?.[`${boundary}_date`];
        if (!date) return '';
        const time = item?.[`${boundary}_time`] || '00:00';
        return `${date}T${time}`;
    }

    function normalizeScheduleBuckets(current, next, now = new Date()) {
        const schedules = [...current, ...next];
        const uniqueSchedules = [...new Map(schedules
            .filter(item => item?.id && item?.start_date && item?.end_date)
            .map(item => [`${item.id}:${item.start_date}:${item.end_date}`, item])).values()];
        const nowKey = dateTimeKey(now);
        const active = uniqueSchedules.filter(item => {
            const start = scheduleBoundary(item, 'start');
            const end = scheduleBoundary(item, 'end');
            return start <= nowKey && nowKey < end;
        });
        const upcoming = uniqueSchedules
            .filter(item => scheduleBoundary(item, 'start') > nowKey)
            .sort((a, b) => scheduleBoundary(a, 'start').localeCompare(scheduleBoundary(b, 'start')));
        const nextStart = upcoming[0] ? scheduleBoundary(upcoming[0], 'start') : '';

        return {
            current: active,
            next: nextStart ? upcoming.filter(item => scheduleBoundary(item, 'start') === nextStart) : []
        };
    }

    function formatSchedulePeriod(item) {
        if (!item?.start_date || !item?.end_date) return '기간 정보는 추후 업데이트됩니다.';
        return `${item.start_date} ~ ${item.end_date}`;
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

    function renderPickupCards(items, characterMap, targetBox, emptyMessage, emptyOptions = { source: true }) {
        if (!items.length) {
            targetBox.replaceChildren(createEmptyState(emptyMessage, emptyOptions));
            return;
        }

        const fragment = document.createDocumentFragment();
        items.forEach(item => {
            const character = getCharacter(item?.id, item, characterMap);
            const card = createElement('article', 'character-rerun-card');
            const content = createElement('div');
            const name = createElement('h3', '', character.name);
            const meta = createElement('p', '', formatSchedulePeriod(item));
            content.append(name, meta);
            card.append(makePortrait(character), content);
            fragment.append(card);
        });
        targetBox.replaceChildren(fragment);
    }

    function collectLastAppearances(history, verifiedPeriods) {
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
        result.forEach((entry, id) => {
            const period = verifiedPeriods?.[id];
            const lastMonth = entry.rerun || entry.release;
            if (period?.start_date?.slice(0, 7) === lastMonth && period?.end_date) {
                entry.period = period;
            }
        });
        return result;
    }

    function renderGapRanking(history, current, characterMap, verifiedPeriods) {
        const currentIds = new Set(current.map(item => item?.id).filter(Boolean));
        const today = new Date();
        const todayKey = localDateKey(today);
        const rows = [...collectLastAppearances(history, verifiedPeriods)]
            .filter(([id]) => !currentIds.has(id))
            .map(([id, entry]) => {
                const elapsedDays = entry.period?.end_date <= todayKey
                    ? daysSince(entry.period.end_date, today)
                    : null;
                return {
                    id,
                    entry,
                    elapsedDays,
                    neverRerun: !entry.rerun,
                    sortDays: elapsedDays ?? -1
                };
            })
            .filter(row => row.entry.period && row.elapsedDays !== null)
            .sort((a, b) => b.sortDays - a.sortDays || String(a.entry.name).localeCompare(String(b.entry.name), 'ko'));

        if (!rows.length) {
            gapBox.replaceChildren(createEmptyState('공백 정보를 표시할 수 없습니다.', { source: true }));
            return;
        }

        const fragment = document.createDocumentFragment();
        let displayedRank = 0;
        let previousGap = null;
        rows.forEach((row, index) => {
            const gapKey = `day:${row.elapsedDays}`;
            if (gapKey !== previousGap) displayedRank = index + 1;
            previousGap = gapKey;
            const character = getCharacter(row.id, row.entry, characterMap);
            const article = createElement('article', 'rerun-gap-card');
            const rank = createElement('span', 'gap-rank', String(displayedRank));
            rank.setAttribute('aria-label', `${displayedRank}위`);
            const details = createElement('div', 'gap-details');
            const appearanceLabel = row.neverRerun ? '출시' : '마지막 복각';
            details.append(
                createElement('h3', '', character.name),
                createElement(
                    'p',
                    '',
                    `${appearanceLabel} ${row.entry.period.start_date} ~ ${row.entry.period.end_date}`
                )
            );
            const period = createElement('div', 'gap-period');
            period.append(createElement('strong', '', `${row.elapsedDays}일 전`));
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
            const configuredCurrent = Array.isArray(data?.current_pickups)
                ? data.current_pickups
                : (Array.isArray(data?.current_reruns) ? data.current_reruns : DEFAULT_CURRENT_PICKUPS);
            const configuredNext = Array.isArray(data?.next_pickups)
                ? data.next_pickups
                : (Array.isArray(data?.next_reruns) ? data.next_reruns : DEFAULT_NEXT_PICKUPS);
            const { current, next } = normalizeScheduleBuckets(configuredCurrent, configuredNext);
            const currentReleases = current.filter(item => item?.kind === 'release');
            const currentReruns = current.filter(item => item?.kind !== 'release');
            const history = Array.isArray(data?.history) ? data.history : [];
            const verifiedPeriods = data?.verified_periods && typeof data.verified_periods === 'object'
                ? data.verified_periods
                : {};

            renderPickupCards(currentReleases, characterMap, currentBox, '현재 픽업 데이터가 없습니다.');
            renderPickupCards(currentReruns, characterMap, currentRerunBox, '현재 복각 데이터가 없습니다.');
            renderPickupCards(next, characterMap, nextBox, '다음 픽업 데이터가 없습니다.', { source: false });
            renderGapRanking(history, current, characterMap, verifiedPeriods);
            renderHistory(history, characterMap);
        } catch (error) {
            console.error('픽업·복각 일정 로드 실패:', error);
            currentBox.replaceChildren(createEmptyState('픽업 정보를 표시할 수 없습니다.', { retry: true, source: true }));
            currentRerunBox.replaceChildren();
            nextBox.replaceChildren();
            gapBox.replaceChildren();
            historyBox.replaceChildren();
        } finally {
            setBusy(false);
        }
    }

    initialize();
})();
