(function () {
    const SHEET_URL = 'https://docs.google.com/spreadsheets/d/1gRDzdVHGfCC4qjt5aZYKuU9FWEfWdqREztNGeiczmRk/edit?gid=653016488#gid=653016488';
    const currentBox = document.getElementById('current-schedules');
    const upcomingBox = document.getElementById('upcoming-schedules');
    const historyBox = document.getElementById('rerun-history');
    const updated = document.getElementById('schedule-updated');

    function dateOnly(value) {
        return new Date(`${value}T00:00:00+09:00`);
    }

    function renderEmpty(container, message) {
        container.innerHTML = `<div class="info-empty"><strong>${message}</strong><span>전체 이력과 최신 정보는 원본 복각표에서 확인할 수 있습니다.</span><a href="${SHEET_URL}" target="_blank" rel="noopener noreferrer">원본 복각표 열기 ↗</a></div>`;
    }

    function renderCard(item) {
        const article = document.createElement('article');
        article.className = 'schedule-card';
        const title = document.createElement('h3');
        title.textContent = item.character;
        const period = document.createElement('p');
        period.className = 'schedule-period';
        period.textContent = `${item.start_date} ~ ${item.end_date}`;
        article.append(title, period);
        if (item.note) {
            const note = document.createElement('p');
            note.textContent = item.note;
            article.appendChild(note);
        }
        if (item.url) {
            const link = document.createElement('a');
            link.href = item.url;
            link.target = '_blank';
            link.rel = 'noopener noreferrer';
            link.textContent = '관련 정보 열기 ↗';
            article.appendChild(link);
        }
        return article;
    }

    function renderHistory(history) {
        if (!history.length) {
            historyBox.innerHTML = '<div class="info-empty"><strong>등록된 배너 기록이 없습니다.</strong></div>';
            return;
        }
        [...history].reverse().forEach(group => {
            const article = document.createElement('article');
            article.className = 'history-row';
            const month = document.createElement('h3');
            month.textContent = group.month.replace('-', '. ');
            const characters = document.createElement('div');
            characters.className = 'history-characters';
            (group.characters || []).forEach(character => {
                const badge = document.createElement('span');
                badge.className = `history-badge ${character.appearance === 1 ? 'release' : 'rerun'}`;
                badge.textContent = `${character.name} · ${character.appearance === 1 ? '출시' : `${character.appearance - 1}차 복각`}`;
                characters.appendChild(badge);
            });
            article.append(month, characters);
            historyBox.appendChild(article);
        });
    }

    async function initialize() {
        try {
            const response = await fetch(`data/rerun_schedule.json?t=${Date.now()}`);
            if (!response.ok) throw new Error('일정 데이터 로드 실패');
            const data = await response.json();
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const schedules = Array.isArray(data.schedules) ? data.schedules : [];
            const history = Array.isArray(data.history) ? data.history : [];
            const current = schedules.filter(item => dateOnly(item.start_date) <= today && dateOnly(item.end_date) >= today);
            const upcoming = schedules.filter(item => dateOnly(item.start_date) > today);

            updated.textContent = data.updated_at ? `마지막 업데이트: ${data.updated_at}` : '';
            current.forEach(item => currentBox.appendChild(renderCard(item)));
            upcoming.forEach(item => upcomingBox.appendChild(renderCard(item)));
            if (!current.length) renderEmpty(currentBox, '현재 등록된 복각 일정이 없습니다.');
            if (!upcoming.length) renderEmpty(upcomingBox, '등록된 예정 일정이 없습니다.');
            renderHistory(history);
        } catch (error) {
            console.error(error);
            updated.textContent = '일정 데이터를 불러오지 못했습니다.';
            renderEmpty(currentBox, '현재 일정을 표시할 수 없습니다.');
            renderEmpty(upcomingBox, '예정 일정을 표시할 수 없습니다.');
            renderHistory([]);
        }
    }

    initialize();
})();
