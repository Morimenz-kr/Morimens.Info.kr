import { readPlan, builderTeam, settingsHref, conflicts } from './usage-plan.mjs';
import { memberDetails, escapeUsage as esc } from './character-usage-view.mjs';

export async function connectUsagePlan(adapter) {
    const { database: db } = adapter;
    const plan = readPlan();
    const requested = Number(new URLSearchParams(location.search).get('usagePlan'));
    if (plan && requested === plan.period) {
        try {
            const entries = Object.values(plan.zones);
            for (const saved of entries) {
                if (conflicts(saved.row, plan, plan.period).length) throw new Error('구역 사이에 중복된 각성체·명륜이 있습니다.');
                for (const m of saved.row.members) {
                    if (!db.chars.some(c => c.id === m.characterId)) throw new Error(`각성체 정보 없음: ${m.characterId}`);
                    for (const w of m.wheels) if (!db.wheels.some(wheel => wheel.english_name === w.id)) throw new Error(`명륜 정보 없음: ${w.id}`);
                    for (const p of m.covenant.parts) if (!db.covenants.some(c => c.english_name === p.setId)) throw new Error(`비밀계약 정보 없음: ${p.setId}`);
                }
            }
            let pageIndex = adapter.pages.findIndex(p => p.usagePeriod === plan.period);
            const apply = () => {
                if (pageIndex < 0) {
                    if (adapter.pages.length >= adapter.maxPages) { adapter.alert('페이지가 5개여서 가져오지 못했습니다. 페이지 하나를 비운 뒤 다시 시도해주세요.'); return; }
                    adapter.pages.push(adapter.emptyPage(`${plan.period}기 융재`));
                    pageIndex = adapter.pages.length - 1;
                }
                const page = adapter.pages[pageIndex];
                page.usagePeriod = plan.period;
                // Only replace explicitly imported zone slots. Other pages stay intact.
                for (const saved of entries) {
                    const old = page.teams[saved.row.wave - 1], incoming = builderTeam(saved);
                    if (old.chars[0] === incoming.chars[0]) incoming.key = old.key;
                    page.teams[saved.row.wave - 1] = incoming;
                }
                page.teams.forEach((team, index) => { if (team.usageSource && !plan.zones[team.usageSource.row.wave]) page.teams[index] = adapter.emptyPage('').teams[index]; });
                adapter.select(pageIndex, entries[0]?.row.wave - 1 || 0);
                adapter.save(); adapter.render();
                const url = new URL(location.href); url.searchParams.delete('usagePlan'); history.replaceState(null, '', url);
            };
            if (pageIndex >= 0) {
                const page = adapter.pages[pageIndex];
                const changed = entries.some(saved => {
                    const old = page.teams[saved.row.wave - 1];
                    return old.chars.some(Boolean) && JSON.stringify([old.chars, old.wheels]) !== JSON.stringify([saved.row.members.map(m => m.characterId), saved.row.members.map(m => m.wheels.map(w => w.id))]);
                });
                if (changed) adapter.confirm('담은 파티 가져오기', '편성기에서 바꾼 각성체·명륜이 있습니다. 담은 파티의 세팅으로 교체할까요?', apply);
                else apply();
            } else apply();
        } catch (e) { adapter.alert(`파티를 가져오지 못했습니다. ${e.message}`); }
    }
    const root = document.createElement('section');
    root.id = 'usage-plan-source'; root.className = 'character-usage';
    document.getElementById('team-slots').parentElement.append(root);
    const name = id => db.chars.find(c => c.id === id)?.name || id;
    const covName = id => db.covenants.find(c => c.english_name === id)?.korean_name || id;
    const equipment = (id, kind) => {
        const item = (kind === 'wheel' ? db.wheels : db.covenants).find(c => c.english_name === id);
        return `<a class="usage-equipment" href="links.html?category=${kind === 'wheel' ? 'myeongryun' : 'covenant'}&amp;id=${encodeURIComponent(id)}">${item ? `<img src="${esc(item.image_path)}" alt="" loading="lazy">` : ''}<span>${esc(item?.korean_name || id)}</span></a>`;
    };
    adapter.setSourceRenderer(() => {
        const team = adapter.currentTeam();
        const source = team.usageSource;
        if (!source) { root.innerHTML = ''; return; }
        const changed = JSON.stringify([team.chars, team.wheels]) !== JSON.stringify([source.row.members.map(m => m.characterId), source.row.members.map(m => m.wheels.map(w => w.id))]);
        root.innerHTML = `<details class="site-disclosure usage-options"><summary>가져온 클리어 세팅 · ${source.row.wave}구역</summary>${changed ? '<p class="usage-conflict">편성기의 각성체·명륜이 원본과 다릅니다. 아래 비밀계약·옵션은 가져올 당시의 기록입니다.</p>' : ''}<p class="usage-caption">비밀계약·옵션은 이 기록에 보관됩니다. 은열쇠는 수집하지 않았으므로 별도로 선택해주세요.</p><div class="usage-record-members">${source.row.members.map(m => memberDetails(m, { name, covName, equipment, open: false })).join('')}</div><a class="usage-select" href="${esc(settingsHref(source.row, adapter.currentPage().usagePeriod))}">다른 클리어 세팅 찾기</a></details>`;
    });
}
