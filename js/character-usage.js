import { getClearData } from './dzone-clear-source.mjs';
import { readPlan, putPlan, removePlan, conflicts, gearKnown, recordKey, settingsHref } from './usage-plan.mjs';
import { memberDetails, statText } from './character-usage-view.mjs';
import { normalizeUsage, selectRows, distribution, teamKey, wheelKey, covenantKey, targetMember, sampleCount, optionStats, difficultyLabel, enlightenmentLabel } from './character-usage-model.mjs?v=owned-20261121';
import { usageExtraWheels } from './character-usage-equipment.mjs';
import { indexUsageTeams, findClearTeams, findClearAlternatives } from './dzone-clear-model.mjs?v=owned-20261121';
import { mountAccountPanel } from './account-ui.mjs?v=owned-20261121';
import { recommendBuilds } from './usage-recommendations.mjs?v=first-20261121';

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
    let ownedOnly = false, owned = new Set(), ownershipError = '', ownerFingerprint = '';
    const store = window.MorimensAccountStore.store;
    const account = document.createElement('details'); account.className = 'site-disclosure usage-account';
    account.innerHTML = '<summary>계정과 보유 기록</summary><section aria-label="계정과 동기화"></section>';
    root.after(account); void mountAccountPanel(account.querySelector('section'));
    function refreshOwned() {
        try { owned = new Set(Object.entries(store.read('roster')?.characters || {}).filter(([id, row]) => row.owned === true && chars[id]).map(([id]) => id)); ownershipError = ''; }
        catch { owned = new Set(); ownershipError = '보유 기록을 읽지 못했습니다. 보유 현황을 확인해주세요.'; }
        const fingerprint = store.uid + [...owned].sort().join('|') + ownershipError, changed = ownerFingerprint !== fingerprint;
        ownerFingerprint = fingerprint;
        if (data && changed) { openRow = -1; replaceWave = null; render(); }
    }
    const selectFor = (selection = filters) => selectRows(data, { ...selection, owned: ownedOnly ? owned : null });
    let data = null, periods = [], mode = new URLSearchParams(location.search).get('usageDemo') === '1', error = '', pending = false, requestId = 0;
    const entry = new URLSearchParams(location.search);
    ownedOnly = entry.get('owned') === '1';
    let filters = Object.fromEntries(['wave', 'difficulty', 'team'].filter(k => entry.get(k)).map(k => [k, entry.get(k)]));
    let tab = entry.get('usageView') === 'records' ? 'records' : 'overview', openRow = -1, period = entry.get('period') || '', shown = 20;
    let publicOnly = true, excludeUsed = false, maxPotential = '', plan = readPlan(), notice = '', replaceWave = null;
    let requestedRecord = entry.get('record'), focusedRecord = null, planOpen = false;
    try {
        const preferences = JSON.parse(localStorage.getItem('morimens_usage_record_filters_v1'));
        if (typeof preferences?.publicOnly === 'boolean') publicOnly = preferences.publicOnly;
        if (typeof preferences?.excludeUsed === 'boolean') excludeUsed = preferences.excludeUsed;
        if (['', '0', '1', '2', '3'].includes(preferences?.maxPotential)) maxPotential = preferences.maxPotential;
    } catch { /* Invalid old filters use the defaults. */ }
    if (entry.get('recordScope') === 'all' && tab === 'records' && !requestedRecord) {
        publicOnly = false; excludeUsed = false; maxPotential = '';
    }
    let advancedOpen = false, coverageOpen = false, optionsOpen = false, exampleOptionsOpen = false;
    let statisticsOpen = tab === 'records' || !!requestedRecord, chosenBuild = '', buildChosenByUser = false, myTeamsShown = 2;
    let recordPreview = null, previewReturnFocus = '', previewScrollY = 0;
    const clearSearchHref = () => {
        const query = new URLSearchParams({ period: data.period, include: character.id });
        if (filters.wave) query.set('wave', filters.wave);
        if (filters.difficulty) query.set('difficulty', filters.difficulty);
        if (ownedOnly) query.set('owned', '1');
        if (entry.get('accountEmulator') === '1') query.set('accountEmulator', '1');
        return 'dzone_clears.html?' + query;
    };
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
        return `<article class="usage-card ${compact ? 'usage-card-compact' : ''} ${selected ? 'is-selected' : ''}"><div class="${type === 'team' ? 'usage-members' : 'usage-equipment-pair'}">${names}</div><div class="usage-frequency"><strong>${percent(g.rate)}</strong><span>${n(g.count)} / ${n(denominator)}건</span></div><div class="usage-bar" aria-hidden="true"><span style="width:${g.rate * 100}%"></span></div>${type === 'team' && !compact ? `<p class="usage-muted">출전: ${waves.map(w => `${w}구역 ${n(sampleCount(g.rows.filter(r => r.wave === w)))}건`).join(' · ')}</p>` : ''}<button type="button" class="usage-select" id="usage-select-${type}-${esc(encodeURIComponent(g.key))}" data-select="${type}" data-value="${esc(g.key)}" aria-pressed="${selected}">${selected ? '선택 해제' : type === 'team' ? '이 파티만 보기' : '이 조합만 보기'}</button>${type === 'team' ? `<button type="button" class="usage-select" data-party-settings="${esc(g.key)}">세팅 보기</button><details class="site-disclosure usage-team-alternatives" data-usage-alternatives="${esc(g.key)}"><summary>한 명을 바꾼 실제 조합</summary><div data-usage-alt-body></div></details>` : ''}</article>`;
    }).join('') + (compact ? '' : moreButton(groups.length)) : '<p class="usage-empty">해당하는 기록이 없습니다.</p>';
    const moreButton = count => count > shown ? `<button type="button" class="usage-select" id="usage-more-${tab}" data-more>더 보기 (${n(Math.min(shown, count))} / ${n(count)}개 구성)</button>` : '';
    const optionGrid = (option, compact = false) => option.total ? `<div class="usage-option-grid ${compact ? 'usage-option-compact' : ''}">${option.slots.map(s => `<section><h5>${roman[s.slot - 1]} 부위</h5>${[['main', '주옵'], ['subs', '부옵']].map(([key, label]) => `<h6>${label}</h6>${s[key].slice(0, compact ? (key === 'main' ? 1 : 2) : undefined).map(v => `<p>${esc(v.label)} <strong>${percent(v.rate)}</strong>${compact ? '' : `<br><span class="usage-muted">${n(v.count)} / ${n(option.total)}건 · ${n(v.min)}–${n(v.max)}${esc(v.unit)} · 평균 ${n(v.mean)}${esc(v.unit)}</span>`}</p>`).join('') || '<p>없음</p>'}`).join('')}</section>`).join('')}</div>` : '<p class="usage-empty">완성도 90% 이상인 비밀계약이 없습니다.</p>';
    function frequentBuilds(rows, total) {
        const builds = distribution(rows, row => {
            const member = target(row), wheel = wheelKey(member), contract = covenantKey(member);
            return wheel && contract ? JSON.stringify([wheel, contract]) : '';
        }).slice(0, 3);
        return `<section class="usage-overview-section">
            <h4>실전 세팅</h4>
            <p class="usage-caption">선택한 조건의 실제 클리어 ${n(total)}건을 기준으로 자주 쓰인 세팅입니다.</p>
            ${builds.length ? `<ul class="usage-build-list">${builds.map((build, index) => {
                const [wheel, contract] = JSON.parse(build.key);
                const wheelNames = wheel === '__unequipped__' ? '명륜 미장착' : wheel.split('|').map(wheelName).join(' + ');
                const images = wheel === '__unequipped__' ? '' : wheel.split('|').map(id => wheelMap[id] ? `<img src="${esc(wheelMap[id].image_path)}" alt="" width="32" height="48" loading="lazy">` : '').join('');
                return `<li class="usage-card"><div class="usage-build-art">${images}</div><div class="usage-build-copy"><strong>${esc(wheelNames)}</strong><span class="usage-muted">${esc(covLabel(contract))}</span><span class="usage-muted">${n(build.count)}건 · ${percent(build.rate)}</span></div>
                    <button type="button" class="usage-select" id="usage-build-${index}" data-build="${esc(build.key)}">실전 기록</button></li>`;
            }).join('')}</ul>` : '<p class="usage-muted">명륜과 비밀계약이 함께 확인된 기록이 없습니다.</p>'}
        </section>`;
    }
    function recommendations(rows) {
        const builds = recommendBuilds(rows, character.id, owned);
        const selected = (buildChosenByUser && builds.find(build => build.key === chosenBuild)) || builds[0];
        chosenBuild = selected?.key || '';
        const edit = `inventory_checker.html${entry.get('accountEmulator') === '1' ? '?accountEmulator=1' : ''}`;
        const choices = builds.length > 1 ? `<div class="usage-build-choices" role="group" aria-label="추천 세팅 선택">${builds.map((build, i) => {
            const [wheel, contract] = JSON.parse(build.key);
            const items = [...(wheel === '__unequipped__' ? [] : wheel.split('|').map(id => wheelMap[id])), ...contract.split('|').map(part => covMap[part.split(':')[0]])].filter(Boolean);
            const label = `${wheel === '__unequipped__' ? '명륜 미장착' : wheel.split('|').map(wheelName).join(' + ')} · ${covLabel(contract)}`;
            return `<button id="usage-choice-${i}" type="button" data-choose-build="${esc(build.key)}" aria-pressed="${build === selected}" aria-label="세팅 ${i + 1}: ${esc(label)}" title="${esc(label)}"><span class="usage-choice-label">세팅 ${i + 1}</span><span class="usage-choice-art" aria-hidden="true">${items.map(item => `<img src="${esc(item.image_path)}" alt="" width="24" height="32" loading="lazy">`).join('')}</span></button>`;
        }).join('')}</div>` : '';
        let setting = '<p class="usage-empty">명륜과 비밀계약이 함께 확인된 세팅이 없습니다.</p>';
        if (selected) {
            const [wheels, contract] = JSON.parse(selected.key);
            setting = `${choices}<article class="usage-featured-build" data-selected-build="${esc(selected.key)}"><div class="usage-featured-equipment"><div><span class="usage-label">명륜</span><div class="usage-equipment-pair">${wheels === '__unequipped__' ? '<p>명륜 미장착 기록</p>' : wheels.split('|').map(id => detailButton(id, 'wheel')).join('')}</div></div><div><span class="usage-label">비밀계약</span><div class="usage-equipment-pair">${contract.split('|').map(part => { const [id, count] = part.split(':'); return `<div class="usage-featured-contract">${detailButton(id, 'covenant')}<small>${count}세트</small></div>`; }).join('')}</div></div></div>
                <div class="usage-build-tools"><button type="button" id="usage-example-toggle" class="usage-select" data-toggle-example aria-expanded="${exampleOptionsOpen}" aria-controls="usage-example-options">주옵·부옵 ${exampleOptionsOpen ? '접기' : '보기'}</button><button type="button" id="usage-recommended-record" class="usage-select" data-build="${esc(selected.key)}" data-build-record="${recordKey(selected.example)}">실제 세팅 보기 <span aria-hidden="true">↗</span></button></div>
                <div class="usage-example-options" id="usage-example-options" ${exampleOptionsOpen ? '' : 'hidden'}><p class="usage-caption">${selected.example.wave}구역 ${difficultyName(selected.example.difficulty)}의 한 클리어에서 가져온 실제 옵션입니다.</p><div class="usage-example-main">${selected.member.covenant.parts.map(part => `<section><h5>${roman[part.slot - 1]}</h5><p data-example-main>${statText(part.main)}</p><p class="usage-muted">부옵: ${part.subs.map(statText).join(' · ') || '없음'}</p></section>`).join('')}</div></div></article>`;
        }
        const parties = selected?.ownedTeams || [];
        const teams = parties.length ? parties.slice(0, myTeamsShown).map(group => `<article class="usage-card usage-card-compact usage-owned-team" data-owned-team="${esc(group.key)}"><div class="usage-members">${group.rows[0].members.map(member => characterArt(member.characterId)).join('')}</div><div class="usage-party-footer"><p class="usage-owned-stages"><span>클리어 구역</span> ${[...new Set(group.rows.map(row => row.wave))].sort().map(wave => `<button type="button" class="usage-zone" id="usage-owned-zone-${esc(encodeURIComponent(group.key))}-${wave}" data-owned-wave="${wave}" data-owned-party="${esc(group.key)}" data-owned-build="${esc(selected.key)}" aria-label="${wave}구역의 이 파티 클리어 세팅 보기">${wave}</button>`).join('')}</p><button type="button" class="usage-select" data-owned-party="${esc(group.key)}" data-owned-build="${esc(selected.key)}" aria-label="이 파티의 세팅 보기">세팅 보기 <span aria-hidden="true">↗</span></button></div><details class="site-disclosure usage-team-alternatives" data-usage-alternatives="${esc(group.key)}" data-owned-build="${esc(selected.key)}"><summary>한 명을 바꾼 실제 조합</summary><div data-usage-alt-body></div></details></article>`).join('')
            : `<div class="usage-my-empty"><p>${ownershipError ? esc(ownershipError) : !owned.size ? '보유 현황을 등록하면 함께 쓸 수 있는 파티를 보여드립니다.' : !owned.has(character.id) ? `${esc(character.name)}의 보유 여부를 먼저 확인해주세요.` : '현재 세팅과 조건에서 내 보유로 구성할 수 있는 실제 클리어 파티가 없습니다.'}</p><a class="usage-select" href="${edit}">보유 현황 편집</a></div>`;
        return `<div class="usage-first-layout"><section class="usage-recommendations" aria-labelledby="usage-recommend-title"><div class="usage-section-heading"><h4 id="usage-recommend-title">추천 세팅</h4></div>${setting}</section><section class="usage-my-parties" aria-labelledby="usage-my-title"><div class="usage-section-heading"><h4 id="usage-my-title">내 보유로 가능한 파티${parties.length ? ` <span class="usage-party-count">${n(parties.length)}</span>` : ''}</h4>${owned.size ? `<a href="${edit}">보유 편집</a>` : ''}</div><p class="usage-my-source">${store.uid ? '계정' : '이 브라우저'} · 보유 ${owned.size}명${parties.length ? ' · 선택한 세팅의 클리어 기록' : ''}</p><div class="usage-cards">${teams}</div>${parties.length > myTeamsShown ? `<button type="button" id="usage-more-owned" data-more-owned class="usage-select">내 파티 더 보기 (${Math.min(myTeamsShown, parties.length)}/${parties.length})</button>` : ''}</section></div>`;
    }
    const conflictText = row => conflicts(row, plan, data.period).map(c => `${c.wave}구역 · ${c.kind === 'character' ? memberName(c.id) : wheelName(c.id)}`).join(' / ');
    function showAlternatives(detail, limit = 5) {
        const selection = { ...filters, team: '' };
        const ownBuild = detail.dataset.ownedBuild;
        if (ownBuild) [selection.wheels, selection.covenant] = JSON.parse(ownBuild);
        const index = indexUsageTeams(ownBuild ? selectRows(data, { ...selection, owned }) : selectFor(selection));
        const base = findClearTeams(index).teams.find(t => t.key === detail.dataset.usageAlternatives);
        const alternatives = base ? findClearAlternatives(index, base, { include: [character.id] }) : [];
        const body = detail.querySelector('[data-usage-alt-body]');
        body.innerHTML = `<p class="usage-caption">${esc(character.name)}와 다른 두 명을 유지하고, 같은 구역·등급에서 확인된 기록입니다.</p>`
            + (alternatives.length ? `<ul>${alternatives.slice(0, limit).map((team, index) => {
                const bucket = [...team.buckets].sort((a, b) => b.count - a.count || a.wave - b.wave)[0];
                return `<li><div>${chars[team.added] ? `<img src="${esc(chars[team.added].image_thumb)}" alt="" width="40" height="40" loading="lazy">` : ''}<div><p>${esc(memberName(team.removed))} → <strong>${esc(memberName(team.added))}</strong></p>${ownBuild ? '' : `<p class="usage-muted">동일 구역·등급 ${n(team.count)}건</p>`}</div></div><button type="button" class="usage-select" id="usage-alt-${esc(encodeURIComponent(detail.dataset.usageAlternatives))}-${index}-${ownBuild ? 'owned' : 'stat'}" data-usage-alternative="${esc(JSON.stringify([team.key, bucket.wave, bucket.difficulty]))}" ${ownBuild ? `data-owned-build="${esc(ownBuild)}"` : ''}>${bucket.wave}구역 ${difficultyName(bucket.difficulty)} 세팅 보기</button></li>`;
            }).join('')}</ul>${alternatives.length > limit ? `<button type="button" class="usage-select" data-usage-alt-more="${limit + 5}">대체 조합 더 보기 (${limit}/${alternatives.length})</button>` : ''}` : '<p class="usage-caption">현재 조건에 맞는 대체 클리어 기록이 없습니다. 보유·세팅·구역 조건을 바꿔보세요.</p>');
    }
    function record(row, index, preview = false) {
        const clash = conflictText(row), complete = gearKnown(row);
        const summary = row.members.map(m => `${esc(memberName(m.characterId))} ${enlightenmentLabel(m.enlightenment)}${m.borrowed ? ' · 지원' : ''}`).join(' / ');
        const saved = plan?.period === data.period && plan.zones[row.wave]?.row;
        return `<article class="usage-record"><div class="usage-members">${row.members.map(m => characterArt(m.characterId)).join('')}</div><p>제${row.wave}금지구역 · ${difficultyName(row.difficulty)} · 같은 세팅 ${n(row.count)}건</p><p class="usage-caption">${summary}<br>장비 공개 ${row.members.filter(m => m.wheels !== null && m.covenant !== null).length}/${row.members.length}명 · 계약 완성도 ${row.members.map(m => m.covenant?.completion == null ? '미수집' : n(m.covenant.completion) + '%').join(' / ')}<br>명륜 돌파 미수집</p>${clash ? `<p class="usage-conflict">다른 구역과 중복: ${esc(clash)}</p>` : ''}<div class="usage-record-actions">${preview ? '' : `<button class="usage-select" id="usage-record-${index}" type="button" data-record="${index}" aria-expanded="${openRow === index}">${openRow === index ? '접기' : '파티 장비·옵션 보기'}</button>`}<button type="button" class="usage-select" id="usage-${preview ? 'preview-' : ''}save-${index}" data-save-record="${index}" ${!complete || clash ? 'disabled' : ''}>${saved && recordKey(saved) === recordKey(row) ? row.wave + '구역에 담음' : replaceWave === recordKey(row) ? row.wave + '구역 교체 확인' : row.wave + '구역에 담기'}</button>${replaceWave === recordKey(row) ? '<button type="button" class="usage-select" data-cancel-replace>취소</button>' : ''}</div>${preview || openRow === index ? `<div class="usage-record-members">${row.members.map(m => memberDetails(m, { name: memberName, covName, equipment: detailButton, open: m.characterId === character.id })).join('')}</div>` : ''}</article>`;
    }
    function openPreview(rows, trigger, key) {
        if (!rows.length) return;
        const sorted = [...rows].sort((a, b) => Number(gearKnown(b)) - Number(gearKnown(a)) || b.count - a.count);
        recordPreview = { rows: sorted, index: Math.max(0, sorted.findIndex(row => recordKey(row) === key)) };
        previewReturnFocus = trigger.id; previewScrollY = window.scrollY;
        replaceWave = null; notice = '';
        render();
    }
    function closePreview() {
        recordPreview = null; replaceWave = null;
        render();
        root.querySelector(`#${CSS.escape(previewReturnFocus)}`)?.focus({ preventScroll: true });
        window.scrollTo({ top: previewScrollY, behavior: 'instant' });
    }
    function previewDialog() {
        if (!recordPreview) return '';
        const { rows, index } = recordPreview;
        return `<dialog id="usage-record-dialog" class="usage-record-dialog" aria-labelledby="usage-preview-title"><header class="usage-preview-header"><div><h4 id="usage-preview-title">실제 클리어 세팅</h4><p>${index + 1} / ${rows.length}개 기록 · ${data.period}기</p></div><button type="button" id="usage-preview-close" class="usage-select" data-close-preview autofocus>닫기</button></header><div class="usage-preview-body">${notice ? `<p class="usage-context" role="status">${esc(notice)}</p>` : ''}${record(rows[index], index, true)}</div><footer class="usage-preview-nav"><button type="button" class="usage-select" id="usage-preview-prev" data-preview-step="-1" ${index ? '' : 'disabled'}>이전 기록</button><button type="button" class="usage-select" id="usage-preview-next" data-preview-step="1" ${index < rows.length - 1 ? '' : 'disabled'}>다음 기록</button></footer></dialog>`;
    }
    function recordsFor(rows) {
        const records = rows.filter(r => (!publicOnly || gearKnown(r)) && (!excludeUsed || !conflicts(r, plan, data.period).length) && (!maxPotential || r.members.every(m => m.enlightenment !== null && m.enlightenment <= Number(maxPotential))))
            .sort((a, b) => Number(gearKnown(b)) - Number(gearKnown(a)) || b.count - a.count);
        const index = focusedRecord ? records.findIndex(row => recordKey(row) === focusedRecord) : -1;
        if (index > 0) records.unshift(records.splice(index, 1)[0]);
        return records;
    }
    function planPanel() {
        if (!plan || !Object.keys(plan.zones).length) return '';
        return `<details class="site-disclosure usage-options" id="usage-plan" ${planOpen ? 'open' : ''}><summary id="usage-plan-summary">담은 파티 · ${plan.period}기 · ${Object.keys(plan.zones).length}/5구역</summary>${Object.entries(plan.zones).map(([wave, saved]) => `<section class="usage-plan-zone"><h4>${wave}구역 · ${difficultyName(saved.row.difficulty)}</h4><p>${saved.row.members.map(m => esc(memberName(m.characterId))).join(' · ')}</p><a class="usage-select" href="${esc(settingsHref(saved.row, plan.period))}">세팅 보기</a> <button type="button" class="usage-select" id="usage-remove-zone-${wave}" data-remove-zone="${wave}">빼기</button></section>`).join('')}<a class="usage-select" href="party_builder.html?usagePlan=${plan.period}">편성기에서 보기</a></details>`;
    }
    function render() {
        const focus = root.contains(document.activeElement) ? document.activeElement.id : '';
        const expandedAlternatives = [...root.querySelectorAll('[data-usage-alternatives][open]')].map(el => ({ key: el.dataset.usageAlternatives, build: el.dataset.ownedBuild, limit: Math.max(5, el.querySelectorAll('li').length) }));
        const rows = data ? selectFor() : [], total = sampleCount(rows), allCount = data ? sampleCount(data.rows) : 0;
        const records = data && tab === 'records' ? recordsFor(rows) : [];
        const option = data && (tab === 'overview' || (tab === 'covenants' && optionsOpen)) ? optionStats(rows, character.id) : { total: 0, slots: [] };
        const select = (id, title, values, current) => `<label for="usage-${id}">${title}<select id="usage-${id}" data-filter="${id}"><option value="">${id === 'period' ? '최신' : '전체'}</option>${values.map(([v, label]) => `<option value="${esc(v)}" ${String(current) === String(v) ? 'selected' : ''}>${esc(label)}</option>`).join('')}</select></label>`;
        const active = Object.entries(filters).filter(([, v]) => v).map(([key, value]) => `<button type="button" class="usage-chip" id="usage-remove-${key}" data-remove="${key}">${esc(key === 'team' ? '선택한 파티' : key === 'wheels' ? '선택한 명륜 조합' : key === 'covenant' ? covLabel(value) : key === 'wave' ? `${value}구역` : key === 'difficulty' ? difficultyName(value) : key === 'enlightenment' ? enlightenmentLabel(Number(value)) : '지원 제외')} ×</button>`).join('');
        const keyForTab = { teams: 'team', wheels: 'wheels', covenants: 'covenant' }[tab];
        const groupingRows = data ? selectFor({ ...filters, ...(keyForTab ? { [keyForTab]: '' } : {}) }) : [];
        const statistics = `<div class="usage-stat-heading"><h4>통계와 클리어 기록</h4><div class="usage-header-actions">${data ? `<a class="usage-select" href="${esc(clearSearchHref())}">조합 검색 화면</a>` : ''}<button type="button" id="usage-refresh" class="usage-select" ${pending ? 'disabled' : ''}>새로고침</button></div></div>
            ${mode ? '<div class="usage-demo-notice" role="note"><strong>예시 화면 · 실제 통계가 아닙니다</strong><p>팀·장비·옵션과 모든 수치는 기능 검토용 가상 데이터입니다.</p><button type="button" id="usage-live" class="usage-select">실제 데이터 화면으로</button></div>' : ''}
            <div class="usage-filters">${select('wave', '금지구역', [1, 2, 3, 4, 5].map(w => [w, `${w}구역`]), filters.wave)}${select('difficulty', '난이도', [...new Set(data?.rows.map(r => r.difficulty) || [])].sort().map(d => [d, difficultyName(d)]), filters.difficulty)}</div>
            <details class="site-disclosure usage-disclosure" id="usage-advanced" ${advancedOpen ? 'open' : ''}><summary id="usage-advanced-summary">필터 더 보기${filters.enlightenment || filters.noBorrowed ? ' · 적용 중' : ''}</summary><div class="usage-filters">${select('period', '시즌', periods.map(p => [p, `${p}기`]), period)}${select('enlightenment', `${character.name} 잠재력`, [...new Set(data?.rows.map(r => target(r).enlightenment).filter(x => x !== null) || [])].sort((a, b) => a - b).map(v => [v, enlightenmentLabel(v)]), filters.enlightenment)}<label class="usage-checkbox"><input id="usage-noBorrowed" type="checkbox" data-filter="noBorrowed" ${filters.noBorrowed ? 'checked' : ''}>지원 제외</label></div></details>
            <div class="usage-context" role="status">${pending ? '사용 기록을 불러오는 중…' : data ? `${data.period}기 · 클리어 ${n(total)}건 · 기준 ${new Date(data.collectedAt * 1000).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })}` : esc(error || '아직 수집된 사용 기록이 없습니다.')}</div>
            ${data ? `<section class="usage-owned" aria-label="보유 기준 조합 탐색"><label><input id="usage-owned-only" type="checkbox" ${ownedOnly ? 'checked' : ''}>보유한 각성체로만 보기</label><span class="usage-muted">${store.uid ? '계정' : '이 브라우저'} · 보유 ${owned.size}명</span><a href="inventory_checker.html${entry.get('accountEmulator') === '1' ? '?accountEmulator=1' : ''}">보유 현황 편집</a>${ownershipError || ownedOnly && !owned.size ? `<p class="usage-caption">${esc(ownershipError || '보유 기록이 없습니다. 각성체를 등록하거나 보유 조건을 해제해주세요.')}</p>` : ''}</section>` : ''}
            ${data ? `<details class="site-disclosure usage-disclosure" id="usage-coverage" ${coverageOpen ? 'open' : ''}><summary id="usage-coverage-summary">집계 정보</summary><p class="usage-caption">수집 ${n(allCount)}건 · ${data.coverage === 'sample' ? '일부 기록' : '공개 클리어 전체'}<br>명륜 확인 ${n(sampleCount(rows.filter(r => target(r).wheels !== null)))} / ${n(total)}건 · 비밀계약 확인 ${n(sampleCount(rows.filter(r => target(r).covenant !== null)))} / ${n(total)}건<br>출처: ${esc(data.source)}<br>같은 유저의 여러 클리어가 포함될 수 있습니다.</p></details>` : ''}
            ${active ? `<div class="usage-chips">${active}<button type="button" class="usage-chip" id="usage-reset" data-reset>필터 초기화</button></div>` : ''}
            ${!data && !pending && !error ? '<div class="usage-empty"><button type="button" id="usage-demo" class="usage-select">가상 데이터로 기능 살펴보기</button></div>' : ''}
            ${data ? `<nav class="usage-tabs" aria-label="사용 현황 보기">${[['overview', '요약'], ['teams', '파티 조합'], ['wheels', '명륜 조합'], ['covenants', '비밀계약'], ['records', '클리어 세팅']].map(([id, label]) => `<button id="usage-tab-${id}" type="button" data-usage-tab="${id}" aria-pressed="${tab === id}">${label}</button>`).join('')}</nav><div class="usage-panel" aria-label="${esc(tab)}">
            ${tab === 'overview' ? `${frequentBuilds(rows, total)}<div class="usage-stat-links"><button type="button" id="usage-open-wheels" data-usage-tab="wheels" class="usage-select">명륜별 통계</button><button type="button" id="usage-open-covenants" data-usage-tab="covenants" class="usage-select">비밀계약별 통계</button></div>${[['teams', '파티 조합', 'team', teamKey]].map(([view, title, key, keyFn]) => {
                const baseRows = selectFor({ ...filters, [key]: '' });
                return `${view === 'teams' ? `<section class="usage-overview-options"><div class="usage-section-heading"><h4>주옵·부옵</h4><button type="button" id="usage-open-options" class="usage-select" data-open-options>옵션 전체 보기</button></div><p class="usage-caption">완성도 90% 이상 ${n(option.total)}건 / 클리어 ${n(total)}건 · 주옵 1위 · 부옵 1~2위</p>${optionGrid(option, true)}<p class="usage-caption">완성도 90% 이상인 비밀계약만 집계합니다. 위에서 조합을 선택하면 옵션도 함께 바뀝니다.</p></section>` : ''}<section class="usage-overview-section"><div class="usage-section-heading"><h4>${title} <span class="usage-muted">상위 3개</span></h4><button type="button" id="usage-open-${view}" class="usage-select" data-usage-tab="${view}">전체 보기</button></div><div class="usage-cards">${groupList(distribution(baseRows, keyFn), key, sampleCount(baseRows), 3, true)}</div></section>`;
            }).join('')}<button type="button" id="usage-open-records" class="usage-select" data-usage-tab="records">클리어 세팅 보기</button>` : ''}
            ${tab === 'teams' ? `<p class="usage-caption">클리어 횟수 기준입니다. 같은 유저의 기록도 여러 번 포함됩니다.</p><div class="usage-cards">${groupList(distribution(groupingRows, teamKey), 'team', sampleCount(groupingRows))}</div>` : ''}
            ${tab === 'wheels' ? `<p class="usage-caption">명륜 확인 ${n(sampleCount(groupingRows.filter(r => target(r).wheels)))} / ${n(sampleCount(groupingRows))}건 · 명륜 강화 단계는 ‘클리어 세팅’에서 볼 수 있습니다.</p><div class="usage-cards">${groupList(distribution(groupingRows, r => wheelKey(target(r))), 'wheels', sampleCount(groupingRows))}</div>` : ''}
            ${tab === 'covenants' ? `<p class="usage-caption">세트 사용률은 전체 클리어 기준이며, 주옵·부옵은 완성도 90% 이상만 집계합니다.</p><div class="usage-cards">${groupList(distribution(groupingRows, r => covenantKey(target(r))), 'covenant', sampleCount(groupingRows))}</div><details class="site-disclosure usage-options" id="usage-options" ${optionsOpen ? 'open' : ''}><summary id="usage-options-summary">주옵·부옵 전체 보기 (완성도 90% 이상)</summary>${optionsOpen ? `<h4>주옵·부옵</h4><p>완성도 90% 이상 ${n(option.total)}건 / 클리어 ${n(total)}건</p>${optionGrid(option)}<p class="usage-caption">부옵은 한 부위에 여러 개 붙으므로 사용률 합계가 100%를 넘을 수 있습니다. 같은 부옵이 중복되면 수치를 합산합니다. 각 부위의 원래 옵션은 ‘클리어 세팅’에서 볼 수 있습니다.</p><button type="button" class="usage-select" data-usage-tab="records">클리어 세팅 보기</button>` : ''}</details>` : ''}
            ${tab === 'records' ? `<p class="usage-caption">같은 클리어에서 사용한 네 명의 세팅입니다. 계약 완성도 90% 미만도 포함합니다.</p><div class="usage-filters"><label class="usage-checkbox"><input id="usage-public-only" type="checkbox" data-record-filter="publicOnly" ${publicOnly ? 'checked' : ''}>네 명 장비 공개</label><label class="usage-checkbox"><input id="usage-exclude-used" type="checkbox" data-record-filter="excludeUsed" ${excludeUsed ? 'checked' : ''}>다른 구역에 담은 각성체·명륜 제외</label><label>파티 잠재력<select id="usage-max-potential" data-record-filter="maxPotential"><option value="">전체</option>${[0,1,2,3].map(v => `<option value="${v}" ${maxPotential === String(v) ? 'selected' : ''}>${v === 0 ? '명함' : v + '돌'} 이하</option>`).join('')}</select></label></div><p class="usage-caption">조건에 맞는 기록 ${n(sampleCount(records))}건 · ${n(records.length)}개 세팅. 잠재력 4단계 이상 또는 미수집 기록은 ‘3돌 이하’에 포함하지 않습니다. 명륜 돌파는 비교할 수 없습니다.</p>${records.length ? records.slice(0, shown).map((row, index) => record(row, index)).join('') + moreButton(records.length) : '<p class="usage-empty">해당하는 세팅이 없습니다. 파티 또는 필터를 바꿔 다른 기록을 확인해주세요.</p>'}` : ''}</div>` : ''}`;
        const recommendationRows = data ? selectFor({ ...filters, team: '', wheels: '', covenant: '' }) : [];
        const conditions = [filters.wave && `${filters.wave}구역`, filters.difficulty && difficultyName(filters.difficulty), filters.enlightenment && enlightenmentLabel(Number(filters.enlightenment)), filters.noBorrowed && '지원 제외'].filter(Boolean).join(' · ');
        root.innerHTML = `<header class="usage-header usage-first-header"><p class="usage-eyebrow">융재금구${data ? ` ${data.period}기` : ''}</p><span class="usage-muted">실제 클리어에 사용된 명륜·비밀계약</span></header>${mode ? '<p class="usage-demo-notice">예시 화면 · 실제 통계가 아닙니다</p>' : ''}
            ${data ? `${conditions ? `<div class="usage-applied-context"><span>${esc(conditions)}</span><button type="button" class="usage-select" data-open-statistics>조건 변경</button></div>` : ''}${recommendations(recommendationRows)}${planPanel()}${notice ? `<p class="usage-context" role="status">${esc(notice)}</p>` : ''}<details class="site-disclosure usage-statistics" id="usage-statistics" ${statisticsOpen ? 'open' : ''}><summary id="usage-statistics-summary">통계·필터·클리어 기록 자세히 보기</summary><div class="usage-statistics-body">${statistics}</div></details>` : `<p class="usage-context" role="status">${pending ? '추천 세팅을 불러오는 중입니다…' : esc(error || '아직 수집된 사용 기록이 없습니다.')}</p>${!pending ? '<button type="button" class="usage-select" id="usage-refresh">다시 불러오기</button>' : ''}${!pending && !error ? '<button type="button" id="usage-demo" class="usage-select">가상 데이터로 기능 살펴보기</button>' : ''}`}`;
        for (const previous of expandedAlternatives) {
            const detail = [...root.querySelectorAll('[data-usage-alternatives]')].find(el => el.dataset.usageAlternatives === previous.key && el.dataset.ownedBuild === previous.build);
            if (detail) { detail.open = true; showAlternatives(detail, previous.limit); }
        }
        root.insertAdjacentHTML('beforeend', previewDialog());
        root.querySelectorAll('button:not([id])').forEach((el, i) => { el.id = `usage-action-${i}`; });
        const dialog = root.querySelector('#usage-record-dialog');
        if (dialog) dialog.showModal();
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
                payload = await getClearData('character', period, character.id);
            }
            if (serial !== requestId) return;
            data = payload.data ? normalizeUsage(payload.data) : null;
            if (data && (data.characterId !== character.id || (period && Number(period) !== data.period))) {
                throw new Error('선택한 각성체 또는 시즌의 기록을 확인할 수 없습니다.');
            }
            periods = payload.periods || []; period = data?.period || period;
            if (data && tab === 'records' && !requestedRecord) openRow = recordsFor(selectFor()).length ? 0 : -1;
            if (data && requestedRecord) {
                const selected = selectFor();
                const original = selected.find(r => recordKey(r) === requestedRecord);
                if (original && !recordsFor(selected).includes(original)) {
                    publicOnly = true; excludeUsed = false; maxPotential = '';
                    notice = '원본 세팅을 보기 위해 이 화면의 잠재력·중복 제외 필터를 해제했습니다.';
                }
                focusedRecord = requestedRecord;
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
        if (event.target.id === 'usage-statistics') statisticsOpen = event.target.open;
        if (event.target.dataset.usageAlternatives && event.target.open && !event.target.querySelector('[data-usage-alt-body]').childElementCount) showAlternatives(event.target);
        if (event.target.id === 'usage-plan') planOpen = event.target.open;
        if (event.target.id === 'usage-advanced') advancedOpen = event.target.open;
        if (event.target.id === 'usage-coverage') coverageOpen = event.target.open;
        if (event.target.id === 'usage-options' && optionsOpen !== event.target.open) { optionsOpen = event.target.open; render(); }
    }, true);
    root.addEventListener('cancel', event => {
        if (event.target.id === 'usage-record-dialog') { event.preventDefault(); closePreview(); }
    }, true);
    root.addEventListener('change', event => {
        if (event.target.id === 'usage-owned-only') { ownedOnly = event.target.checked; shown = 20; openRow = -1; replaceWave = null; render(); return; }
        if (event.target.dataset.recordFilter) { const key = event.target.dataset.recordFilter; const value = event.target.type === 'checkbox' ? event.target.checked : event.target.value; if (key === 'publicOnly') publicOnly = value; if (key === 'excludeUsed') excludeUsed = value; if (key === 'maxPotential') maxPotential = value; try { localStorage.setItem('morimens_usage_record_filters_v1', JSON.stringify({ publicOnly, excludeUsed, maxPotential })); } catch { /* Filters remain usable without persistence. */ } shown = 20; openRow = -1; replaceWave = null; render(); return; }
        const key = event.target.dataset.filter; if (!key) return; shown = 20; replaceWave = null;
        if (key === 'period') { period = event.target.value; data = null; filters = {}; openRow = -1; load(); }
        else { filters[key] = event.target.type === 'checkbox' ? event.target.checked : event.target.value; openRow = -1; render(); }
    });
    root.addEventListener('click', event => {
        const el = event.target.closest('button'); if (!el || !root.contains(el)) return;
        if (el.hasAttribute('data-close-preview')) closePreview();
        else if (el.dataset.previewStep) { recordPreview.index += Number(el.dataset.previewStep); replaceWave = null; notice = ''; render(); }
        else if (el.hasAttribute('data-toggle-example')) { exampleOptionsOpen = !exampleOptionsOpen; render(); }
        else if (el.dataset.chooseBuild) { chosenBuild = el.dataset.chooseBuild; buildChosenByUser = true; myTeamsShown = 2; render(); }
        else if (el.hasAttribute('data-more-owned')) { const previous = myTeamsShown; myTeamsShown += 2; render(); root.querySelectorAll('.usage-party-footer > [data-owned-party]')[previous]?.focus(); }
        else if (el.hasAttribute('data-open-statistics')) { statisticsOpen = true; render(); root.querySelector('#usage-wave')?.focus(); }
        else if (el.dataset.ownedParty) { const [wheels, covenant] = JSON.parse(el.dataset.ownedBuild); openPreview(selectRows(data, { ...filters, wheels, covenant, team: el.dataset.ownedParty, owned, ...(el.dataset.ownedWave ? { wave: el.dataset.ownedWave } : {}) }), el); }
        else if (el.dataset.usageAltMore) { const detail = el.closest('details'); showAlternatives(detail, Number(el.dataset.usageAltMore)); (detail.querySelector('[data-usage-alt-more]') || detail.querySelector('summary')).focus(); }
        else if (el.dataset.usageAlternative) { const [team, wave, difficulty] = JSON.parse(el.dataset.usageAlternative); const selection = { ...filters, team, wave: String(wave), difficulty }; if (el.dataset.ownedBuild) { [selection.wheels, selection.covenant] = JSON.parse(el.dataset.ownedBuild); selection.owned = owned; } else selection.owned = ownedOnly ? owned : null; openPreview(selectRows(data, selection), el); }
        else if (el.dataset.equipment) { const item = el.dataset.kind === 'wheel' ? wheelMap[el.dataset.equipment] : covMap[el.dataset.equipment]; window.openDictionaryDialog(item, el.dataset.kind === 'wheel' ? 'myeongryun' : 'covenant', el); }
        else if (el.dataset.build) {
            const [wheels, covenant] = JSON.parse(el.dataset.build);
            openPreview(selectFor({ ...filters, wheels, covenant, ...(el.dataset.buildRecord ? { team: '' } : {}) }), el, el.dataset.buildRecord);
        }
        else if (el.dataset.partySettings) { filters.team = el.dataset.partySettings; tab = 'records'; statisticsOpen = true; shown = 20; publicOnly = true; const matches = recordsFor(selectFor()); openRow = matches.length ? 0 : -1; render(); root.querySelector('#usage-record-0')?.focus(); }
        else if (el.hasAttribute('data-save-record')) {
            plan = readPlan();
            const rows = recordPreview?.rows || recordsFor(selectFor()), index = Number(el.dataset.saveRecord), row = rows[index];
            if (!row) return;
            if (plan?.zones[row.wave] && recordKey(plan.zones[row.wave].row) !== recordKey(row) && replaceWave !== recordKey(row)) { replaceWave = recordKey(row); notice = row.wave + '구역의 기존 파티를 바꿀까요?'; render(); return; }
            try { plan = putPlan(row, data.period, data.collectedAt); planOpen = true; notice = row.wave + '구역에 담았습니다. 편성기에서도 확인할 수 있습니다.'; } catch (e) { notice = e.message; }
            replaceWave = null; render();
        }
        else if (el.hasAttribute('data-cancel-replace')) { replaceWave = null; notice = ''; render(); }
        else if (el.dataset.removeZone) { removePlan(el.dataset.removeZone); plan = readPlan(); notice = ''; render(); }
        else if (el.hasAttribute('data-more')) { shown += 20; render(); }
        else if (el.hasAttribute('data-open-options')) { tab = 'covenants'; optionsOpen = true; shown = 20; openRow = -1; render(); const summary = root.querySelector('#usage-options-summary'); summary?.focus(); summary?.scrollIntoView({ block: 'start' }); }
        else if (el.dataset.usageTab) { tab = el.dataset.usageTab; statisticsOpen = true; shown = 20; openRow = -1; render(); }
        else if (el.dataset.select) { const k = el.dataset.select; shown = 20; filters[k] = filters[k] === el.dataset.value ? '' : el.dataset.value; openRow = -1; render(); }
        else if (el.dataset.remove) { delete filters[el.dataset.remove]; shown = 20; render(); }
        else if (el.hasAttribute('data-reset')) { filters = {}; shown = 20; openRow = -1; replaceWave = null; render(); }
        else if (el.hasAttribute('data-record')) { const i = Number(el.dataset.record); openRow = openRow === i ? -1 : i; render(); }
        else if (el.id === 'usage-demo' || el.id === 'usage-live') { mode = el.id === 'usage-demo'; data = null; period = ''; filters = {}; const url = new URL(location.href); if (mode) url.searchParams.set('usageDemo', '1'); else url.searchParams.delete('usageDemo'); history.replaceState(null, '', url); load(); }
        else if (el.id === 'usage-refresh') load();
    });
    window.addEventListener('storage', event => { if (event.key === 'morimens_dzone_plan_v1') { plan = readPlan(); replaceWave = null; render(); } });
    store.subscribe(event => { if (event.kind === 'roster' || event.kind === null) refreshOwned(); });
    window.addEventListener('storage', event => { if (Object.values(window.MorimensAccountStore.KEYS).includes(event.key)) refreshOwned(); });
    window.addEventListener('focus', refreshOwned);
    refreshOwned();
    await load();
}
