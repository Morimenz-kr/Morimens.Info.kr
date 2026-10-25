import { readPlan, putPlan, removePlan, conflicts, gearKnown, recordKey, settingsHref } from './usage-plan.mjs';
import { memberDetails } from './character-usage-view.mjs';
import { normalizeUsage, selectRows, distribution, teamKey, wheelKey, covenantKey, targetMember, sampleCount, optionStats, difficultyLabel, enlightenmentLabel } from './character-usage-model.mjs';
import { usageExtraWheels } from './character-usage-equipment.mjs';

const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const percent = value => `${(value * 100).toLocaleString('ko-KR', { maximumFractionDigits: 1 })}%`;
const n = value => value.toLocaleString('ko-KR', { maximumFractionDigits: 2 });
const roman = ['Ⅰ', 'Ⅱ', 'Ⅲ', 'Ⅳ', 'Ⅴ', 'Ⅵ'];
const difficultyName = difficultyLabel;

export async function mountCharacterUsage(root, { character, manifest, wheels, covenants }) {
    root.className = 'character-usage';
    const chars = Object.fromEntries(manifest.map(c => [c.id, c]));
    const wheelMap = Object.fromEntries([...wheels, ...usageExtraWheels].map(w => [w.english_name, w]));
    const covMap = Object.fromEntries(covenants.map(c => [c.english_name, c]));
    let data = null, periods = [], mode = new URLSearchParams(location.search).get('usageDemo') === '1', error = '', pending = false, requestId = 0;
    const entry = new URLSearchParams(location.search);
    let filters = Object.fromEntries(['wave', 'difficulty', 'team'].filter(k => entry.get(k)).map(k => [k, entry.get(k)]));
    let tab = entry.get('usageView') === 'records' ? 'records' : 'overview', openRow = -1, period = entry.get('period') || '', shown = 20;
    let publicOnly = true, excludeUsed = false, maxPotential = '', plan = readPlan(), notice = '', replaceWave = null;
    let requestedRecord = entry.get('record'), planOpen = false;
    try {
        const preferences = JSON.parse(localStorage.getItem('morimens_usage_record_filters_v1'));
        if (typeof preferences?.publicOnly === 'boolean') publicOnly = preferences.publicOnly;
        if (typeof preferences?.excludeUsed === 'boolean') excludeUsed = preferences.excludeUsed;
        if (['', '0', '1', '2', '3'].includes(preferences?.maxPotential)) maxPotential = preferences.maxPotential;
    } catch { /* Invalid old filters use the defaults. */ }
    let advancedOpen = false, coverageOpen = false, optionsOpen = false;
    const target = row => targetMember(row, character.id);
    const memberName = id => chars[id]?.name || `미등록 각성체 (${id})`;
    const wheelName = id => wheelMap[id]?.korean_name || `미등록 명륜 (${id})`;
    const covName = id => covMap[id]?.korean_name || `미등록 비밀계약 (${id})`;
    const characterArt = id => `<span class="usage-member">${chars[id] ? `<img src="${esc(chars[id].image_thumb)}" alt="" width="48" height="48" loading="lazy">` : ''}<span>${esc(memberName(id))}</span></span>`;
    const detailButton = (id, type) => {
        const item = type === 'wheel' ? wheelMap[id] : covMap[id];
        const name = type === 'wheel' ? wheelName(id) : covName(id);
        return `<button type="button" class="usage-equipment" data-equipment="${esc(id)}" data-kind="${type}" ${item ? '' : 'disabled'}>${item ? `<img src="${esc(item.image_path)}" alt="" loading="lazy">` : ''}<span>${esc(name)}</span><span class="usage-muted">상세</span></button>`;
    };
    const covLabel = key => key.split('|').map(part => { const [id, count] = part.split(':'); return `${covName(id)} ${count}세트`; }).join(' + ');
    const groupList = (groups, type, denominator, limit = shown, compact = false) => groups.length ? groups.slice(0, limit).map(g => {
        const selected = filters[type] === g.key;
        const names = type === 'team' ? g.rows[0].members.map(m => characterArt(m.characterId)).join('') : type === 'wheels' ? (g.key === '__unequipped__' ? '<p>명륜 미장착</p>' : g.key.split('|').map(id => detailButton(id, 'wheel')).join('')) : `<p>${esc(covLabel(g.key))}</p><div class="usage-equipment-pair">${g.key.split('|').map(p => detailButton(p.split(':')[0], 'covenant')).join('')}</div>`;
        const waves = [...new Set(g.rows.map(r => r.wave))].sort();
        return `<article class="usage-card ${compact ? 'usage-card-compact' : ''} ${selected ? 'is-selected' : ''}"><div class="${type === 'team' ? 'usage-members' : 'usage-equipment-pair'}">${names}</div><div class="usage-frequency"><strong>${percent(g.rate)}</strong><span>${n(g.count)} / ${n(denominator)}건</span></div><div class="usage-bar" aria-hidden="true"><span style="width:${g.rate * 100}%"></span></div>${type === 'team' && !compact ? `<p class="usage-muted">출전: ${waves.map(w => `${w}구역 ${n(sampleCount(g.rows.filter(r => r.wave === w)))}건`).join(' · ')}</p>` : ''}<button type="button" class="usage-select" id="usage-select-${type}-${esc(encodeURIComponent(g.key))}" data-select="${type}" data-value="${esc(g.key)}" aria-pressed="${selected}">${selected ? '선택 해제' : type === 'team' ? '이 파티만 보기' : '이 조합만 보기'}</button>${type === 'team' ? `<button type="button" class="usage-select" data-party-settings="${esc(g.key)}">세팅 보기</button>` : ''}</article>`;
    }).join('') + (compact ? '' : moreButton(groups.length)) : '<p class="usage-empty">해당하는 기록이 없습니다.</p>';
    const moreButton = count => count > shown ? `<button type="button" class="usage-select" id="usage-more-${tab}" data-more>더 보기 (${n(Math.min(shown, count))} / ${n(count)}개 구성)</button>` : '';
    const optionGrid = (option, compact = false) => option.total ? `<div class="usage-option-grid ${compact ? 'usage-option-compact' : ''}">${option.slots.map(s => `<section><h5>${roman[s.slot - 1]} 부위</h5>${[['main', '주옵'], ['subs', '부옵']].map(([key, label]) => `<h6>${label}</h6>${s[key].slice(0, compact ? (key === 'main' ? 1 : 2) : undefined).map(v => `<p>${esc(v.label)} <strong>${percent(v.rate)}</strong>${compact ? '' : `<br><span class="usage-muted">${n(v.count)} / ${n(option.total)}건 · ${n(v.min)}–${n(v.max)}${esc(v.unit)} · 평균 ${n(v.mean)}${esc(v.unit)}</span>`}</p>`).join('') || '<p>없음</p>'}`).join('')}</section>`).join('')}</div>` : '<p class="usage-empty">완성도 90% 이상인 비밀계약이 없습니다.</p>';
    const conflictText = row => conflicts(row, plan, data.period).map(c => `${c.wave}구역 · ${c.kind === 'character' ? memberName(c.id) : wheelName(c.id)}`).join(' / ');
    function record(row, index) {
        const clash = conflictText(row), complete = gearKnown(row);
        const summary = row.members.map(m => `${esc(memberName(m.characterId))} ${enlightenmentLabel(m.enlightenment)}${m.borrowed ? ' · 지원' : ''}`).join(' / ');
        const saved = plan?.period === data.period && plan.zones[row.wave]?.row;
        return `<article class="usage-record"><div class="usage-members">${row.members.map(m => characterArt(m.characterId)).join('')}</div><p>제${row.wave}금지구역 · ${difficultyName(row.difficulty)} · 같은 세팅 ${n(row.count)}건</p><p class="usage-caption">${summary}<br>장비 공개 ${row.members.filter(m => m.wheels !== null && m.covenant !== null).length}/${row.members.length}명 · 계약 완성도 ${row.members.map(m => m.covenant?.completion == null ? '미수집' : n(m.covenant.completion) + '%').join(' / ')}<br>명륜 돌파 미수집</p>${clash ? `<p class="usage-conflict">다른 구역과 중복: ${esc(clash)}</p>` : ''}<div class="usage-record-actions"><button class="usage-select" id="usage-record-${index}" type="button" data-record="${index}" aria-expanded="${openRow === index}">${openRow === index ? '접기' : '파티 장비·옵션 보기'}</button><button type="button" class="usage-select" id="usage-save-${index}" data-save-record="${index}" ${!complete || clash ? 'disabled' : ''}>${saved && recordKey(saved) === recordKey(row) ? row.wave + '구역에 담음' : replaceWave === recordKey(row) ? row.wave + '구역 교체 확인' : row.wave + '구역에 담기'}</button>${replaceWave === recordKey(row) ? '<button type="button" class="usage-select" data-cancel-replace>취소</button>' : ''}</div>${openRow === index ? `<div class="usage-record-members">${row.members.map(m => memberDetails(m, { name: memberName, covName, equipment: detailButton, open: m.characterId === character.id })).join('')}</div>` : ''}</article>`;
    }
    function recordsFor(rows) {
        return rows.filter(r => (!publicOnly || gearKnown(r)) && (!excludeUsed || !conflicts(r, plan, data.period).length) && (!maxPotential || r.members.every(m => m.enlightenment !== null && m.enlightenment <= Number(maxPotential))))
            .sort((a, b) => Number(gearKnown(b)) - Number(gearKnown(a)) || b.count - a.count);
    }
    function planPanel() {
        if (!plan || !Object.keys(plan.zones).length) return '';
        return `<details class="site-disclosure usage-options" id="usage-plan" ${planOpen ? 'open' : ''}><summary id="usage-plan-summary">담은 파티 · ${plan.period}기 · ${Object.keys(plan.zones).length}/5구역</summary>${Object.entries(plan.zones).map(([wave, saved]) => `<section class="usage-plan-zone"><h4>${wave}구역 · ${difficultyName(saved.row.difficulty)}</h4><p>${saved.row.members.map(m => esc(memberName(m.characterId))).join(' · ')}</p><a class="usage-select" href="${esc(settingsHref(saved.row, plan.period))}">세팅 보기</a> <button type="button" class="usage-select" id="usage-remove-zone-${wave}" data-remove-zone="${wave}">빼기</button></section>`).join('')}<a class="usage-select" href="party_builder.html?usagePlan=${plan.period}">편성기에서 보기</a></details>`;
    }
    function render() {
        const focus = root.contains(document.activeElement) ? document.activeElement.id : '';
        const rows = data ? selectRows(data, filters) : [], total = sampleCount(rows), allCount = data ? sampleCount(data.rows) : 0;
        const records = data ? recordsFor(rows) : [];
        const option = data && (tab === 'overview' || (tab === 'covenants' && optionsOpen)) ? optionStats(rows, character.id) : { total: 0, slots: [] };
        const select = (id, title, values, current) => `<label for="usage-${id}">${title}<select id="usage-${id}" data-filter="${id}"><option value="">${id === 'period' ? '최신' : '전체'}</option>${values.map(([v, label]) => `<option value="${esc(v)}" ${String(current) === String(v) ? 'selected' : ''}>${esc(label)}</option>`).join('')}</select></label>`;
        const active = Object.entries(filters).filter(([, v]) => v).map(([key, value]) => `<button type="button" class="usage-chip" id="usage-remove-${key}" data-remove="${key}">${esc(key === 'team' ? '선택한 파티' : key === 'wheels' ? '선택한 명륜 조합' : key === 'covenant' ? covLabel(value) : key === 'wave' ? `${value}구역` : key === 'difficulty' ? difficultyName(value) : key === 'enlightenment' ? enlightenmentLabel(Number(value)) : '지원 제외')} ×</button>`).join('');
        const keyForTab = { teams: 'team', wheels: 'wheels', covenants: 'covenant' }[tab];
        const groupingRows = data ? selectRows(data, { ...filters, ...(keyForTab ? { [keyForTab]: '' } : {}) }) : [];
        root.innerHTML = `<header class="usage-header"><div><p class="usage-eyebrow">융재금구</p><h3>${esc(character.name)} 사용 현황</h3><p class="usage-muted">클리어 기록 기준 명륜·비밀계약·파티 사용률</p></div>${data ? `<a class="usage-select" href="dzone_info.html?view=parties#season-${data.period}-wave-${encodeURIComponent(filters.wave || 1)}-alert-${encodeURIComponent(filters.difficulty || 4)}">구역별 파티 보기</a>` : ''}<button type="button" id="usage-refresh" class="usage-select" ${pending ? 'disabled' : ''}>새로고침</button></header>
            ${mode ? '<div class="usage-demo-notice" role="note"><strong>예시 화면 · 실제 통계가 아닙니다</strong><p>팀·장비·옵션과 모든 수치는 기능 검토용 가상 데이터입니다.</p><button type="button" id="usage-live" class="usage-select">실제 데이터 화면으로</button></div>' : ''}
            <div class="usage-filters">${select('wave', '금지구역', [1, 2, 3, 4, 5].map(w => [w, `${w}구역`]), filters.wave)}${select('difficulty', '난이도', [...new Set(data?.rows.map(r => r.difficulty) || [])].sort().map(d => [d, difficultyName(d)]), filters.difficulty)}</div>
            <details class="site-disclosure usage-disclosure" id="usage-advanced" ${advancedOpen ? 'open' : ''}><summary id="usage-advanced-summary">필터 더 보기${filters.enlightenment || filters.noBorrowed ? ' · 적용 중' : ''}</summary><div class="usage-filters">${select('period', '시즌', periods.map(p => [p, `${p}기`]), period)}${select('enlightenment', `${character.name} 잠재력`, [...new Set(data?.rows.map(r => target(r).enlightenment).filter(x => x !== null) || [])].sort((a, b) => a - b).map(v => [v, enlightenmentLabel(v)]), filters.enlightenment)}<label class="usage-checkbox"><input id="usage-noBorrowed" type="checkbox" data-filter="noBorrowed" ${filters.noBorrowed ? 'checked' : ''}>지원 제외</label></div></details>
            <div class="usage-context" role="status">${pending ? '사용 기록을 불러오는 중…' : data ? `${data.period}기 · 클리어 ${n(total)}건 · 기준 ${new Date(data.collectedAt * 1000).toLocaleString('ko-KR')}` : esc(error || '아직 수집된 사용 기록이 없습니다.')}</div>
            ${data ? `<details class="site-disclosure usage-disclosure" id="usage-coverage" ${coverageOpen ? 'open' : ''}><summary id="usage-coverage-summary">집계 정보</summary><p class="usage-caption">수집 ${n(allCount)}건 · ${data.coverage === 'sample' ? '일부 기록' : '공개 클리어 전체'}<br>명륜 확인 ${n(sampleCount(rows.filter(r => target(r).wheels !== null)))} / ${n(total)}건 · 비밀계약 확인 ${n(sampleCount(rows.filter(r => target(r).covenant !== null)))} / ${n(total)}건<br>출처: ${esc(data.source)}<br>같은 유저의 여러 클리어가 포함될 수 있습니다.</p></details>` : ''}
            ${planPanel()}${notice ? `<p class="usage-context" role="status">${esc(notice)}</p>` : ''}
            ${active ? `<div class="usage-chips">${active}<button type="button" class="usage-chip" id="usage-reset" data-reset>필터 초기화</button></div>` : ''}
            ${!data && !pending ? '<div class="usage-empty"><h4>아직 수집된 사용 기록이 없습니다</h4><p>데이터가 들어오면 팀·명륜·비밀계약과 옵션 분포가 표시됩니다.</p><button type="button" id="usage-demo" class="usage-select">가상 데이터로 기능 살펴보기</button></div>' : ''}
            ${data ? `${tab !== 'overview' ? `<nav class="usage-tabs" aria-label="사용 현황 보기">${[['overview', '요약'], ['teams', '파티 조합'], ['wheels', '명륜 조합'], ['covenants', '비밀계약'], ['records', '클리어 세팅']].map(([id, label]) => `<button id="usage-tab-${id}" type="button" data-usage-tab="${id}" aria-pressed="${tab === id}">${label}</button>`).join('')}</nav>` : ''}<div class="usage-panel" aria-label="${esc(tab)}">
            ${tab === 'overview' ? `${[['wheels', '명륜 조합', 'wheels', r => wheelKey(target(r))], ['covenants', '비밀계약 조합', 'covenant', r => covenantKey(target(r))], ['teams', '파티 조합', 'team', teamKey]].map(([view, title, key, keyFn]) => {
                const baseRows = selectRows(data, { ...filters, [key]: '' });
                return `${view === 'teams' ? `<section class="usage-overview-options"><div class="usage-section-heading"><h4>주옵·부옵</h4><button type="button" id="usage-open-options" class="usage-select" data-open-options>옵션 전체 보기</button></div><p class="usage-caption">완성도 90% 이상 ${n(option.total)}건 / 클리어 ${n(total)}건 · 주옵 1위 · 부옵 1~2위</p>${optionGrid(option, true)}<p class="usage-caption">완성도 90% 이상인 비밀계약만 집계합니다. 위에서 조합을 선택하면 옵션도 함께 바뀝니다.</p></section>` : ''}<section class="usage-overview-section"><div class="usage-section-heading"><h4>${title} <span class="usage-muted">상위 3개</span></h4><button type="button" id="usage-open-${view}" class="usage-select" data-usage-tab="${view}">전체 보기</button></div><div class="usage-cards">${groupList(distribution(baseRows, keyFn), key, sampleCount(baseRows), 3, true)}</div></section>`;
            }).join('')}<button type="button" id="usage-open-records" class="usage-select" data-usage-tab="records">클리어 세팅 보기</button>` : ''}
            ${tab === 'teams' ? `<p class="usage-caption">클리어 횟수 기준입니다. 같은 유저의 기록도 여러 번 포함됩니다.</p><div class="usage-cards">${groupList(distribution(groupingRows, teamKey), 'team', sampleCount(groupingRows))}</div>` : ''}
            ${tab === 'wheels' ? `<p class="usage-caption">명륜 확인 ${n(sampleCount(groupingRows.filter(r => target(r).wheels)))} / ${n(sampleCount(groupingRows))}건 · 명륜 강화 단계는 ‘클리어 세팅’에서 볼 수 있습니다.</p><div class="usage-cards">${groupList(distribution(groupingRows, r => wheelKey(target(r))), 'wheels', sampleCount(groupingRows))}</div>` : ''}
            ${tab === 'covenants' ? `<p class="usage-caption">세트 사용률은 전체 클리어 기준이며, 주옵·부옵은 완성도 90% 이상만 집계합니다.</p><div class="usage-cards">${groupList(distribution(groupingRows, r => covenantKey(target(r))), 'covenant', sampleCount(groupingRows))}</div><details class="site-disclosure usage-options" id="usage-options" ${optionsOpen ? 'open' : ''}><summary id="usage-options-summary">주옵·부옵 전체 보기 (완성도 90% 이상)</summary>${optionsOpen ? `<h4>주옵·부옵</h4><p>완성도 90% 이상 ${n(option.total)}건 / 클리어 ${n(total)}건</p>${optionGrid(option)}<p class="usage-caption">부옵은 한 부위에 여러 개 붙으므로 사용률 합계가 100%를 넘을 수 있습니다. 같은 부옵이 중복되면 수치를 합산합니다. 각 부위의 원래 옵션은 ‘클리어 세팅’에서 볼 수 있습니다.</p><button type="button" class="usage-select" data-usage-tab="records">클리어 세팅 보기</button>` : ''}</details>` : ''}
            ${tab === 'records' ? `<p class="usage-caption">같은 클리어에서 사용한 네 명의 세팅입니다. 계약 완성도 90% 미만도 포함합니다.</p><div class="usage-filters"><label class="usage-checkbox"><input id="usage-public-only" type="checkbox" data-record-filter="publicOnly" ${publicOnly ? 'checked' : ''}>네 명 장비 공개</label><label class="usage-checkbox"><input id="usage-exclude-used" type="checkbox" data-record-filter="excludeUsed" ${excludeUsed ? 'checked' : ''}>다른 구역에 담은 각성체·명륜 제외</label><label>파티 잠재력<select id="usage-max-potential" data-record-filter="maxPotential"><option value="">전체</option>${[0,1,2,3].map(v => `<option value="${v}" ${maxPotential === String(v) ? 'selected' : ''}>${v === 0 ? '명함' : v + '돌'} 이하</option>`).join('')}</select></label></div><p class="usage-caption">조건에 맞는 기록 ${n(sampleCount(records))}건 · ${n(records.length)}개 세팅. 잠재력 4단계 이상 또는 미수집 기록은 ‘3돌 이하’에 포함하지 않습니다. 명륜 돌파는 비교할 수 없습니다.</p>${records.length ? records.slice(0, shown).map(record).join('') + moreButton(records.length) : '<p class="usage-empty">해당하는 세팅이 없습니다. 파티 또는 필터를 바꿔 다른 기록을 확인해주세요.</p>'}` : ''}</div>` : ''}`;
        root.querySelectorAll('button:not([id])').forEach((el, i) => { el.id = `usage-action-${i}`; });
        if (focus) (root.querySelector(`#${CSS.escape(focus)}`) || root.querySelector(`#usage-tab-${tab}`) || root.querySelector('#usage-plan-summary') || root.querySelector('#usage-refresh'))?.focus({ preventScroll: true });
    }
    async function load() {
        const serial = ++requestId; pending = true; error = ''; render();
        try {
            let payload;
            if (mode) {
                const { buildUsageDemo } = await import('./character-usage-demo.mjs');
                payload = { data: buildUsageDemo(character.id, manifest, wheels, covenants, Number(period) || 71), periods: [71, 70] };
            } else {
                const base = (CONFIG.CHARACTER_USAGE_ENDPOINT_URL || CONFIG.DZONE_USAGE_ENDPOINT_URL).replace(/\/$/, '');
                for (let attempt = 0; attempt < 3; attempt++) {
                    try {
                        const response = await fetch(`${base}/api/dzone/character/${encodeURIComponent(character.id)}/usage${period ? `?period=${period}` : ''}`, { cache: 'no-store', signal: AbortSignal.timeout(60000) });
                        if (response.status === 404) { payload = { data: null, periods: [] }; break; }
                        if (!response.ok) { const failure = new Error('Usage request failed'); failure.status = response.status; throw failure; }
                        payload = await response.json();
                        break;
                    } catch (failure) {
                        if (serial !== requestId) return;
                        if (attempt === 2 || (failure.status && failure.status < 500)) throw new Error('사용 기록을 불러오지 못했습니다. 잠시 후 새로고침해주세요.', { cause: failure });
                        await new Promise(resolve => setTimeout(resolve, 750 * (attempt + 1)));
                    }
                }
            }
            if (serial !== requestId) return;
            data = payload.data ? normalizeUsage(payload.data) : null;
            if (data && data.characterId !== character.id) throw new Error('다른 각성체의 응답이어서 표시하지 않았습니다.');
            periods = payload.periods || []; period = data?.period || period;
            if (data && tab === 'records' && !requestedRecord) openRow = recordsFor(selectRows(data, filters)).length ? 0 : -1;
            if (data && requestedRecord) {
                const selected = selectRows(data, filters);
                const original = selected.find(r => recordKey(r) === requestedRecord);
                if (original && !recordsFor(selected).includes(original)) {
                    publicOnly = true; excludeUsed = false; maxPotential = '';
                    notice = '원본 세팅을 보기 위해 이 화면의 잠재력·중복 제외 필터를 해제했습니다.';
                }
                const records = recordsFor(selected); const index = records.findIndex(r => recordKey(r) === requestedRecord);
                if (index >= 0) { shown = Math.max(20, index + 1); openRow = index; }
                else notice = '선택했던 기록이 현재 필터에 없습니다. 필터를 바꿔 확인해주세요.';
                requestedRecord = null;
            }
        } catch (e) { if (serial !== requestId) return; data = null; error = e.message; }
        finally { if (serial === requestId) { pending = false; render(); } }
    }
    root.addEventListener('toggle', event => {
        if (!event.target.isConnected) return;
        if (event.target.id === 'usage-plan') planOpen = event.target.open;
        if (event.target.id === 'usage-advanced') advancedOpen = event.target.open;
        if (event.target.id === 'usage-coverage') coverageOpen = event.target.open;
        if (event.target.id === 'usage-options' && optionsOpen !== event.target.open) { optionsOpen = event.target.open; render(); }
    }, true);
    root.addEventListener('change', event => {
        if (event.target.dataset.recordFilter) { const key = event.target.dataset.recordFilter; const value = event.target.type === 'checkbox' ? event.target.checked : event.target.value; if (key === 'publicOnly') publicOnly = value; if (key === 'excludeUsed') excludeUsed = value; if (key === 'maxPotential') maxPotential = value; try { localStorage.setItem('morimens_usage_record_filters_v1', JSON.stringify({ publicOnly, excludeUsed, maxPotential })); } catch { /* Filters remain usable without persistence. */ } shown = 20; openRow = -1; replaceWave = null; render(); return; }
        const key = event.target.dataset.filter; if (!key) return; shown = 20; replaceWave = null;
        if (key === 'period') { period = event.target.value; data = null; filters = {}; openRow = -1; load(); }
        else { filters[key] = event.target.type === 'checkbox' ? event.target.checked : event.target.value; openRow = -1; render(); }
    });
    root.addEventListener('click', event => {
        const el = event.target.closest('button'); if (!el || !root.contains(el)) return;
        if (el.dataset.equipment) { const item = el.dataset.kind === 'wheel' ? wheelMap[el.dataset.equipment] : covMap[el.dataset.equipment]; window.openDictionaryDialog(item, el.dataset.kind === 'wheel' ? 'myeongryun' : 'covenant', el); }
        else if (el.dataset.partySettings) { filters.team = el.dataset.partySettings; tab = 'records'; shown = 20; publicOnly = true; const matches = recordsFor(selectRows(data, filters)); openRow = matches.length ? 0 : -1; render(); root.querySelector('#usage-record-0')?.focus(); }
        else if (el.hasAttribute('data-save-record')) {
            plan = readPlan();
            const rows = recordsFor(selectRows(data, filters)), index = Number(el.dataset.saveRecord), row = rows[index];
            if (!row) return;
            if (plan?.zones[row.wave] && recordKey(plan.zones[row.wave].row) !== recordKey(row) && replaceWave !== recordKey(row)) { replaceWave = recordKey(row); notice = row.wave + '구역의 기존 파티를 바꿀까요?'; render(); return; }
            try { plan = putPlan(row, data.period, data.collectedAt); planOpen = true; notice = row.wave + '구역에 담았습니다. 편성기에서도 확인할 수 있습니다.'; } catch (e) { notice = e.message; }
            replaceWave = null; render();
        }
        else if (el.hasAttribute('data-cancel-replace')) { replaceWave = null; notice = ''; render(); }
        else if (el.dataset.removeZone) { removePlan(el.dataset.removeZone); plan = readPlan(); notice = ''; render(); }
        else if (el.hasAttribute('data-more')) { shown += 20; render(); }
        else if (el.hasAttribute('data-open-options')) { tab = 'covenants'; optionsOpen = true; shown = 20; openRow = -1; render(); const summary = root.querySelector('#usage-options-summary'); summary?.focus(); summary?.scrollIntoView({ block: 'start' }); }
        else if (el.dataset.usageTab) { tab = el.dataset.usageTab; shown = 20; openRow = -1; render(); }
        else if (el.dataset.select) { const k = el.dataset.select; shown = 20; filters[k] = filters[k] === el.dataset.value ? '' : el.dataset.value; openRow = -1; render(); }
        else if (el.dataset.remove) { delete filters[el.dataset.remove]; shown = 20; render(); }
        else if (el.hasAttribute('data-reset')) { filters = {}; shown = 20; openRow = -1; replaceWave = null; render(); }
        else if (el.hasAttribute('data-record')) { const i = Number(el.dataset.record); openRow = openRow === i ? -1 : i; render(); }
        else if (el.id === 'usage-demo' || el.id === 'usage-live') { mode = el.id === 'usage-demo'; data = null; period = ''; filters = {}; const url = new URL(location.href); if (mode) url.searchParams.set('usageDemo', '1'); else url.searchParams.delete('usageDemo'); history.replaceState(null, '', url); load(); }
        else if (el.id === 'usage-refresh') load();
    });
    window.addEventListener('storage', event => { if (event.key === 'morimens_dzone_plan_v1') { plan = readPlan(); replaceWave = null; render(); } });
    await load();
}
