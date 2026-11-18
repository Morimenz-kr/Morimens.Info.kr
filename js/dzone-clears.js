import { difficultyLabel } from './character-usage-model.mjs';
import { escapeUsage as esc } from './character-usage-view.mjs';
import { clearSettingsHref, findClearTeams, normalizeClearIndex } from './dzone-clear-model.mjs';
import { currentClearPeriod, getClearData } from './dzone-clear-source.mjs';

const byId = id => document.getElementById(id);
const form = byId('clear-filters');
const status = byId('clear-status');
const results = byId('clear-results');
const retry = byId('clear-retry');
const more = byId('clear-more');
const entry = new URLSearchParams(location.search);
const number = new Intl.NumberFormat('ko-KR');
const choice = { include: new Set(), exclude: new Set() };
const selectedNodes = { include: byId('clear-included'), exclude: byId('clear-excluded') };
let data, chars, shown;

function updateChoices() {
    for (const type of ['include', 'exclude']) {
        const select = form.elements[type];
        const limit = type === 'include' && choice.include.size >= 4;
        select.innerHTML = '<option value="">각성체 선택</option>' + [...chars.values()].map(c =>
            `<option value="${esc(c.id)}" ${choice.include.has(c.id) || choice.exclude.has(c.id) ? 'disabled' : ''}>${esc(c.name)}</option>`).join('');
        select.disabled = limit;
        selectedNodes[type].innerHTML = [...choice[type]].map(id =>
            `<button type="button" class="usage-chip" data-remove="${esc(id)}" data-type="${type}" aria-label="${esc(chars.get(id).name)} ${type === 'include' ? '포함' : '제외'} 해제">${esc(chars.get(id).name)} ×</button>`).join('');
    }
}

function filters() {
    return { wave: form.elements.wave.value, difficulty: form.elements.difficulty.value, include: [...choice.include], exclude: [...choice.exclude] };
}

function render(reset = true) {
    if (reset) shown = 24;
    const active = filters();
    const found = findClearTeams(data, active);
    status.textContent = `${data.period}기 · ${number.format(found.total)}건 · ${number.format(found.teams.length)}개 조합 · ${data.source} · 기준 ${new Date(data.collectedAt * 1000).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })} KST`;
    results.innerHTML = found.teams.length ? found.teams.slice(0, shown).map(team => {
        const members = team.members.map(id => {
            const c = chars.get(id);
            return `<a class="usage-member" href="links.html?category=character&amp;id=${esc(c.id)}&amp;period=${data.period}#usage" aria-label="${esc(c.name)} 추천 세팅"><img src="${esc(c.image_thumb)}" alt="" width="48" height="48" loading="lazy"><span>${esc(c.name)}</span></a>`;
        }).join('');
        const waveCounts = new Map();
        for (const bucket of team.buckets) waveCounts.set(bucket.wave, (waveCounts.get(bucket.wave) || 0) + bucket.count);
        const waves = [...waveCounts].sort(([a], [b]) => a - b).map(([wave, count]) => `${wave}구역 ${number.format(count)}건`).join(' · ');
        const label = team.members.map(id => chars.get(id).name).join(', ');
        return `<article class="usage-card">
            <div class="usage-members">${members}</div>
            <div class="usage-frequency"><strong>${number.format(team.count)}건</strong><span>4인 장비 확인 ${number.format(team.gearCount)}건</span></div>
            <p class="usage-muted">${waves}</p>
            <a class="usage-select" href="${esc(clearSettingsHref(team, data.period, active))}" aria-label="${esc(label)} 클리어 세팅 보기">클리어 세팅 보기</a>
        </article>`;
    }).join('') : '<p class="usage-empty">조건에 맞는 조합이 없습니다. 각성체나 구역·등급 조건을 바꿔보세요.</p>';
    more.hidden = shown >= found.teams.length;
    if (!reset) results.children[shown - 24]?.querySelector('.usage-select')?.focus();
    if (reset) {
        const query = new URLSearchParams({ period: data.period });
        for (const key of ['wave', 'difficulty']) if (active[key]) query.set(key, active[key]);
        for (const key of ['include', 'exclude']) for (const id of active[key]) query.append(key, id);
        history.replaceState(null, '', '?' + query);
    }
}

form.addEventListener('change', ({ target }) => {
    const type = target.name;
    if ((type === 'include' || type === 'exclude') && chars.has(target.value)
        && !choice.include.has(target.value) && !choice.exclude.has(target.value)) {
        choice[type].add(target.value);
        updateChoices();
        if (target.disabled) selectedNodes.include.lastElementChild?.focus();
    }
    render();
});
form.addEventListener('click', event => {
    const chip = event.target.closest('button[data-remove]');
    if (!chip) return;
    const type = chip.dataset.type;
    choice[type].delete(chip.dataset.remove);
    updateChoices();
    form.elements[type].focus();
    render();
});
form.addEventListener('reset', event => {
    event.preventDefault();
    for (const type of ['include', 'exclude']) choice[type].clear();
    form.elements.wave.value = form.elements.difficulty.value = '';
    updateChoices();
    render();
});
form.addEventListener('submit', event => event.preventDefault());
more.addEventListener('click', () => { shown += 24; render(false); });
retry.addEventListener('click', load);

async function load() {
    retry.hidden = true;
    status.textContent = '클리어 기록을 불러오는 중입니다.';
    try {
        const period = /^[1-9]\d{0,3}$/.test(entry.get('period') ?? '') ? Number(entry.get('period')) : await currentClearPeriod();
        byId('clear-back').href = `dzone_info.html?view=parties#season-${period}-wave-1`;
        const [payload, manifest] = await Promise.all([
            getClearData('teams', period),
            fetch('data/character_manifest.json').then(response => {
                if (!response.ok) throw new Error('각성체 목록을 불러오지 못했습니다.');
                return response.json();
            })
        ]);
        if (!payload.data) {
            status.textContent = `${period}기에 연결된 클리어 상세 집계가 없습니다.`;
            retry.hidden = false;
            return;
        }
        chars = new Map(manifest.sort((a, b) => a.name.localeCompare(b.name, 'ko')).map(c => [c.id, c]));
        data = normalizeClearIndex(payload.data, new Set(chars.keys()));
        if (data.period !== period) throw new Error('선택한 시즌의 클리어 기록을 확인할 수 없습니다.');
        const grades = [...new Set(data.teams.flatMap(t => t.buckets.map(b => b.difficulty)))].sort();
        for (const [name, values] of [['wave', [1, 2, 3, 4, 5]], ['difficulty', grades]]) {
            const select = form.elements[name];
            select.innerHTML = '<option value="">전체</option>';
            for (const value of values) select.add(new Option(name === 'wave' ? value + '구역' : difficultyLabel(value), value));
            select.value = values.map(String).includes(entry.get(name)) ? entry.get(name) : '';
        }
        for (const type of ['include', 'exclude']) {
            const ids = [...new Set(entry.getAll(type).filter(id => chars.has(id) && (type === 'include' || !choice.include.has(id))))];
            choice[type] = new Set(type === 'include' ? ids.slice(0, 4) : ids);
        }
        updateChoices();
        form.hidden = false;
        byId('clear-matches').hidden = false;
        render();
    } catch (error) {
        status.textContent = error.message;
        retry.hidden = false;
    }
}

load();
