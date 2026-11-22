import { difficultyLabel } from './character-usage-model.mjs';
import { escapeUsage as esc } from './character-usage-view.mjs';
import { clearSettingsHref, findClearTeams, findClearAlternatives, normalizeClearIndex } from './dzone-clear-model.mjs?v=owned-20261121';
import { currentClearPeriod, getClearData } from './dzone-clear-source.mjs';

const $ = id => document.getElementById(id), form = $('clear-filters'), results = $('clear-results');
const entry = new URLSearchParams(location.search), number = new Intl.NumberFormat('ko-KR');
const choice = { include: new Set(), exclude: new Set() }, alternatives = new Map();
let data, chars, shown = 12, pickMode = 'include', visibleTeams = new Map(), owned = new Set(), rosterError = '';
const name = id => chars.get(id)?.name || id;
const art = id => { const c = chars.get(id); return `<img src="${esc(c.image_thumb)}" alt="" width="56" height="56" loading="lazy">`; };
const accountStore = () => window.MorimensAccountStore?.store;

function readOwned() {
    try {
        const roster = accountStore()?.read('roster');
        owned = new Set(Object.entries(roster?.characters || {}).filter(([id, row]) => row.owned === true && chars.has(id)).map(([id]) => id)); rosterError = '';
    } catch { owned = new Set(); rosterError = '보유 기록을 읽지 못했습니다. 보유 현황을 확인해주세요.'; }
    $('clear-owned-note').textContent = rosterError || `보유 ${owned.size}명`;
}
function filters() {
    return { wave: form.elements.wave.value, difficulty: form.elements.difficulty.value, include: [...choice.include], exclude: [...choice.exclude], owned: form.elements.ownedOnly.checked ? owned : null };
}
function renderPicker() {
    const focusId = document.activeElement?.dataset.pick;
    const term = $('clear-character-search').value.trim().toLocaleLowerCase('ko');
    const matches = [...chars.values()].filter(c => (c.name + c.id).toLocaleLowerCase('ko').includes(term));
    $('clear-character-grid').innerHTML = matches.length ? matches.map(c => {
        const selected = choice[pickMode].has(c.id), other = choice[pickMode === 'include' ? 'exclude' : 'include'].has(c.id);
        const disabled = pickMode === 'include' && !selected && choice.include.size >= 4;
        return `<button type="button" data-pick="${esc(c.id)}" aria-pressed="${selected}" ${disabled ? 'disabled' : ''} aria-label="${esc(c.name)} ${selected ? '선택 해제' : pickMode === 'include' ? '포함' : '제외'}">${art(c.id)}<span>${esc(c.name)}</span><small>${selected ? (pickMode === 'include' ? '포함됨' : '제외됨') : other ? (pickMode === 'include' ? '현재 제외됨' : '현재 포함됨') : owned.has(c.id) ? '보유' : ''}</small></button>`;
    }).join('') : '<p class="usage-caption">검색된 각성체가 없습니다.</p>';
    for (const button of document.querySelectorAll('[data-pick-mode]')) button.setAttribute('aria-pressed', String(button.dataset.pickMode === pickMode));
    $('clear-picker-help').textContent = pickMode === 'include' ? '포함할 각성체를 최대 네 명까지 선택하세요.' : '조합에서 제외할 각성체를 선택하세요.';
    if (focusId) $('clear-character-grid').querySelector(`[data-pick="${CSS.escape(focusId)}"]`)?.focus({ preventScroll: true });
}
function renderSelection() {
    const included = [...choice.include];
    $('clear-included').innerHTML = Array.from({ length: 4 }, (_, i) => included[i]
        ? `<button type="button" data-remove="${esc(included[i])}" data-type="include" aria-label="${esc(name(included[i]))} 포함 해제">${art(included[i])}<span>${esc(name(included[i]))}</span><small>해제</small></button>`
        : `<button type="button" data-open-picker aria-label="${i + 1}번째 각성체 선택"><span class="clear-slot-plus" aria-hidden="true">+</span><span>추가</span></button>`).join('');
    $('clear-pick-count').textContent = `${included.length} / 4`;
    $('clear-excluded').innerHTML = choice.exclude.size ? [...choice.exclude].map(id => `<button type="button" class="usage-chip" data-remove="${esc(id)}" data-type="exclude" aria-label="${esc(name(id))} 제외 해제">${esc(name(id))} ×</button>`).join('') : '<span class="usage-muted">없음</span>';
    renderPicker();
}
function teamCard(team, index, active) {
    const ownedCount = team.members.filter(id => owned.has(id)).length;
    const waves = [...new Set(team.buckets.map(b => b.wave))].sort().map(w => `${w}구역`).join(' · ');
    return `<article class="clear-team" data-team="${esc(team.key)}"><div class="clear-team-top"><span class="clear-rank">${String(index + 1).padStart(2, '0')}</span><p><strong>${number.format(team.count)}</strong>건의 클리어</p>${owned.size ? `<span class="clear-owned-badge">보유 ${ownedCount}/4</span>` : ''}</div>
        <div class="clear-members">${team.members.map(id => `<a href="links.html?category=character&amp;id=${esc(id)}&amp;period=${data.period}#usage" aria-label="${esc(name(id))} 추천 세팅">${art(id)}<span>${esc(name(id))}</span>${owned.size && !owned.has(id) ? '<small>미보유</small>' : ''}</a>`).join('')}</div>
        <div class="clear-team-meta"><span>${waves}</span><span>4인 장비 확인 ${number.format(team.gearCount)}건</span></div><a class="usage-select clear-primary" href="${esc(clearSettingsHref(team, data.period, active))}">클리어 세팅 보기</a>
        <details class="site-disclosure clear-alternatives" data-alternatives="${esc(team.key)}"><summary>한 명을 바꾼 실제 조합</summary><div data-alt-content></div></details></article>`;
}
function render(reset = true) {
    if (!data) return;
    if (reset) shown = 12;
    alternatives.clear(); const active = filters(), found = findClearTeams(data, active);
    $('clear-status').textContent = `${number.format(found.teams.length)}개 조합 · ${number.format(found.total)}건 · 클리어 건수순`;
    visibleTeams = new Map(found.teams.slice(0, shown).map(t => [t.key, t]));
    results.innerHTML = found.teams.length ? found.teams.slice(0, shown).map((t, i) => teamCard(t, i, active)).join('')
        : `<div class="usage-empty"><h3>${active.owned !== null && !owned.size ? '먼저 보유한 각성체를 등록해주세요' : '조건에 맞는 실제 조합이 없습니다'}</h3><p>${active.owned !== null ? '보유 조건을 해제하거나 보유 현황과 포함·제외 조건을 확인해주세요.' : '포함·제외할 각성체나 구역·등급 조건을 바꿔보세요.'}</p><a class="usage-select" href="inventory_checker.html">보유 현황 편집</a></div>`;
    $('clear-more').hidden = shown >= found.teams.length;
    $('clear-more').textContent = `더 보기 (${Math.min(shown, found.teams.length)} / ${number.format(found.teams.length)})`;
    if (!reset) results.children[shown - 12]?.querySelector('a')?.focus();
    if (reset) {
        const query = new URLSearchParams({ period: data.period });
        for (const key of ['wave', 'difficulty']) if (active[key]) query.set(key, active[key]);
        for (const key of ['include', 'exclude']) for (const id of active[key]) query.append(key, id);
        if (active.owned !== null) query.set('owned', '1');
        if (entry.get('accountEmulator') === '1') query.set('accountEmulator', '1');
        history.replaceState(null, '', '?' + query);
    }
}
function renderAlternatives(detail, key) {
    let state = alternatives.get(key);
    if (!state) { state = { rows: findClearAlternatives(data, visibleTeams.get(key), filters()), shown: 5 }; alternatives.set(key, state); }
    const body = detail.querySelector('[data-alt-content]');
    body.innerHTML = `<p class="usage-caption">나머지 세 명과 구역·등급이 같은 실제 기록입니다. 현재 검색 조건을 유지합니다.</p>`
        + (state.rows.length ? `<ul>${state.rows.slice(0, state.shown).map(row => {
            const bucket = [...row.buckets].sort((a, b) => b.count - a.count || a.wave - b.wave || a.difficulty.localeCompare(b.difficulty))[0];
            return `<li><div class="clear-swap">${art(row.added)}<div><span>${esc(name(row.removed))} → <strong>${esc(name(row.added))}</strong></span><small>동일 구역·등급 ${number.format(row.count)}건</small></div></div><a href="${esc(clearSettingsHref(row, data.period, bucket))}" aria-label="${esc(name(row.added))} 대체 조합 ${bucket.wave}구역 ${difficultyLabel(bucket.difficulty)} 세팅 보기">${bucket.wave}구역 ${difficultyLabel(bucket.difficulty)} 세팅 보기</a></li>`;
        }).join('')}</ul>${state.shown < state.rows.length ? `<button type="button" class="usage-select" data-alt-more="${esc(key)}">대체 조합 더 보기 (${state.shown}/${state.rows.length})</button>` : ''}` : `<p class="usage-caption">${choice.include.size === 4 ? '네 명이 모두 포함 조건으로 고정되어 있습니다. 한 명을 해제하면 대체 후보를 확인할 수 있습니다.' : '현재 조건에서 한 명만 바꾼 실제 클리어 기록이 없습니다.'}</p>`);
}

form.addEventListener('change', () => render());
form.addEventListener('submit', e => e.preventDefault());
form.addEventListener('reset', e => { e.preventDefault(); choice.include.clear(); choice.exclude.clear(); pickMode = 'include'; form.elements.wave.value = form.elements.difficulty.value = ''; form.elements.ownedOnly.checked = false; $('clear-character-search').value = ''; renderSelection(); render(); });
$('clear-character-search').addEventListener('input', renderPicker);
$('clear-selection').addEventListener('click', event => {
    const button = event.target.closest('button'); if (!button) return;
    if (button.dataset.pickMode) { pickMode = button.dataset.pickMode; renderPicker(); return; }
    if (button.hasAttribute('data-open-picker')) { $('clear-picker').open = true; $('clear-character-search').focus(); return; }
    if (button.dataset.pick) {
        const id = button.dataset.pick;
        if (choice[pickMode].has(id)) choice[pickMode].delete(id);
        else { if (pickMode === 'include' && choice.include.size >= 4) return; choice[pickMode].add(id); choice[pickMode === 'include' ? 'exclude' : 'include'].delete(id); }
    } else if (button.dataset.remove) choice[button.dataset.type].delete(button.dataset.remove);
    else return;
    renderSelection(); render();
    if (button.dataset.remove) { $('clear-picker').open = true; $('clear-character-search').focus(); }
});
results.addEventListener('toggle', event => { const detail = event.target; if (detail.matches('details[data-alternatives]') && detail.open) renderAlternatives(detail, detail.dataset.alternatives); }, true);
results.addEventListener('click', event => { const button = event.target.closest('[data-alt-more]'); if (!button) return; const key = button.dataset.altMore, detail = button.closest('details'); alternatives.get(key).shown += 5; renderAlternatives(detail, key); detail.querySelector('[data-alt-more]')?.focus(); });
$('clear-more').onclick = () => { shown += 12; render(false); };
$('clear-retry').onclick = load;
function refreshOwnership() { if (!chars) return; readOwned(); renderSelection(); render(); }
accountStore()?.subscribe(event => { if (event.kind === 'roster' || event.kind === null) refreshOwnership(); });
window.addEventListener('storage', event => { if (Object.values(window.MorimensAccountStore.KEYS).includes(event.key)) refreshOwnership(); });
window.addEventListener('focus', refreshOwnership);

async function load() {
    $('clear-retry').hidden = true; $('clear-status').textContent = '클리어 기록을 불러오는 중입니다.';
    try {
        const period = /^[1-9]\d{0,3}$/.test(entry.get('period') ?? '') ? Number(entry.get('period')) : await currentClearPeriod();
        const [payload, manifest] = await Promise.all([getClearData('teams', period), fetch('data/character_manifest.json').then(r => { if (!r.ok) throw Error('각성체 목록을 불러오지 못했습니다.'); return r.json(); })]);
        if (!payload.data) throw Error(`${period}기에 연결된 클리어 상세 집계가 없습니다.`);
        chars = new Map(manifest.sort((a, b) => a.name.localeCompare(b.name, 'ko')).map(c => [c.id, c]));
        data = normalizeClearIndex(payload.data, new Set(chars.keys()));
        if (data.period !== period) throw Error('선택한 시즌의 클리어 기록을 확인할 수 없습니다.');
        $('clear-back').href = `dzone_info.html?view=parties#season-${period}-wave-1`; $('clear-season').textContent = `${period}기`;
        $('clear-source').textContent = `${data.source} · ${data.coverage === 'sample' ? '수집된 일부 기록' : '공개 클리어 전체'} · 기준 ${new Date(data.collectedAt * 1000).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })} KST`;
        const grades = [...new Set(data.teams.flatMap(t => t.buckets.map(b => b.difficulty)))].sort();
        for (const [key, values] of [['wave', [1, 2, 3, 4, 5]], ['difficulty', grades]]) {
            const select = form.elements[key]; select.innerHTML = '<option value="">전체</option>';
            for (const value of values) select.add(new Option(key === 'wave' ? value + '구역' : difficultyLabel(value), value));
            select.value = values.map(String).includes(entry.get(key)) ? entry.get(key) : '';
        }
        choice.include = new Set(entry.getAll('include').filter(id => chars.has(id)).slice(0, 4));
        choice.exclude = new Set(entry.getAll('exclude').filter(id => chars.has(id) && !choice.include.has(id)));
        form.elements.ownedOnly.checked = entry.get('owned') === '1';
        if (entry.get('accountEmulator') === '1') $('clear-edit-roster').href += '?accountEmulator=1';
        readOwned(); renderSelection();
        for (const id of ['clear-filters', 'clear-selection', 'clear-matches', 'clear-coverage']) $(id).hidden = false;
        render();
    } catch (error) { $('clear-status').textContent = error.message; $('clear-retry').hidden = false; }
}
load();
