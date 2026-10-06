window.CharacterGrowthUI = { mount(root, id) {
    const switcher = root.querySelector('.character-effects-switch');
    if (!switcher || !id) return;
    const tab = document.createElement('button');
    tab.type = 'button'; tab.id = 'level-growth-tab';tab.dataset.effectPanel='level-growth';tab.setAttribute('role','tab');tab.setAttribute('aria-selected','false');tab.setAttribute('aria-controls','tab-level-growth');tab.textContent='능력치/육성';switcher.insertBefore(tab,switcher.children[1]);
    const panel = document.createElement('div');panel.id='tab-level-growth';panel.className='character-effect-panel';panel.dataset.effectContent='level-growth';panel.setAttribute('role','tabpanel');panel.setAttribute('aria-labelledby',tab.id);panel.textContent='육성 정보를 불러오는 중입니다.';root.append(panel);
    let started = false;
    const number = value => value.toLocaleString('ko-KR');
    const options = (count, selected, label) => Array.from({length:count+1},(_,i)=>`<option value="${i}" ${i===selected?'selected':''}>${label(i)}</option>`).join('');
    async function load() {
        if (started) return;
        started = true;
        try {
            const [growth, resources] = await Promise.all(['character_growth','growth_resources'].map(async name => {
                const response = await fetch(`data/${name}.json?v=growth-20261006`);
                if (!response.ok) throw new Error('성장 데이터 요청 실패');
                return response.json();
            }));
            const entry = growth.characters[id];
            if (!entry) throw new Error('이 각성체의 성장 정보가 없습니다.');
            panel.innerHTML = `<h4>레벨별 능력치</h4>
                <div class="level-growth-controls"><label>현재 레벨<input id="growth-from" type="number" min="1" max="${entry.maxLevel}" value="1"></label><label>목표 레벨<input id="growth-to" type="number" min="1" max="${entry.maxLevel}" value="60"></label></div>
                <p class="growth-note">장비·재능·잠재력 보너스를 제외한 기본 체력·공격·방어입니다.</p>
                <div id="growth-stats"></div>
                <h4>필요 재화</h4>
                <details class="growth-settings"><summary>현재 승급·상한 설정</summary><div class="level-growth-controls">
                <label>현재 승급<select id="growth-rank">${options(entry.ascensions.length,0,i=>`${i}단계 · 상한 ${i===0?10:entry.ascensions[i-1].toMaxLevel}`)}</select></label>
                <label>현재 상한 확장<select id="growth-limit">${options(entry.limitIncreases.length,0,i=>i===0?'미확장':`${i}단계 · +${entry.limitIncreases[i-1].additionalMaxLevel}레벨`)}</select></label>
                <label>잠재력 상한 해금<select id="growth-potency">${options(entry.potencyLimits.length,0,i=>i===0?'미해금':`+${entry.potencyLimits.slice(0,i).reduce((n,r)=>n+r.additionalMaxLevel,0)}레벨`)}</select></label>
                </div></details>
                <p id="growth-error" role="alert"></p><div id="growth-cost" aria-live="polite"></div>
                <p class="growth-note">현재 경험치 0, 비용 감소 미적용 기준입니다. 잠재력 해금·스킬 강화 비용은 포함하지 않습니다.</p>`;
            const field = name => panel.querySelector('#growth-'+name);
            function render() {
                const from = Number(field('from').value), to = Number(field('to').value);
                try {
                    const quote = CharacterGrowthData.quoteLevelUp(growth, resources, id, from, to);
                    const a = CharacterGrowthData.statsAtLevel(growth,id,from), b = CharacterGrowthData.statsAtLevel(growth,id,to);
                    field('stats').innerHTML = `<table class="growth-table"><thead><tr><th scope="col">능력치</th><th scope="col">Lv.${from}</th><th scope="col">Lv.${to}</th><th scope="col">증가</th></tr></thead><tbody>${[['체력','physique'],['공격','attack'],['방어','defense']].map(([label,key])=>`<tr><th scope="row">${label}</th><td data-label="Lv.${from}">${number(a[key])}</td><td data-label="Lv.${to}">${number(b[key])}</td><td data-label="증가">+${number(b[key]-a[key])}</td></tr>`).join('')}</tbody></table>`;
                    const rank = Number(field('rank').value), limit = Number(field('limit').value), potency = Number(field('potency').value);
                    const bonus = entry.potencyLimits.slice(0,potency).reduce((n,r)=>n+r.additionalMaxLevel,0);
                    const currentMax = (rank===0?10:entry.ascensions[rank-1].toMaxLevel) + (rank===entry.ascensions.length ? bonus + (limit===0?0:entry.limitIncreases[limit-1].additionalMaxLevel) : 0);
                    if (from > currentMax) throw new Error(`현재 레벨 ${from}에 맞는 승급·상한 설정을 선택하세요. 현재 설정의 상한은 ${currentMax}입니다.`);
                    const availableMax = entry.baseMaxLevel + bonus + entry.limitIncreases.at(-1).additionalMaxLevel;
                    if (to > availableMax) throw new Error(`Lv.${to}에는 잠재력 상한 해금이 필요합니다. 현재 설정의 최대 레벨은 ${availableMax}입니다.`);
                    const needRank = Math.max(rank, Math.min(entry.ascensions.length,Math.ceil(Math.min(to,60)/10)-1));
                    const needLimit = Math.max(limit,Math.ceil(Math.max(0,to-60-bonus)/2));
                    const ascension = CharacterGrowthData.quoteAscension(growth,id,rank,needRank);
                    const expansion = CharacterGrowthData.quoteLimitIncrease(growth,id,limit,needLimit);
                    const rows = costs => costs.length ? `<ul class="growth-resource-list">${costs.map(cost=>`<li><span>${resources.items[cost.itemId].name}</span><strong>${number(cost.quantity)}</strong></li>`).join('')}</ul>` : '<p class="growth-note">추가 재화 없음</p>';
                    let remaining = quote.billableExperience;
                    const bottles = [...resources.experienceItems].sort((a,b)=>b.experience-a.experience).map(item=>{const quantity=Math.floor(remaining/item.experience);remaining-=quantity*item.experience;return {itemId:item.itemId,quantity};}).filter(item=>item.quantity);
                    const all = [...bottles,quote.currency,...ascension,...expansion].filter(cost=>cost.quantity);
                    const totals = new Map();all.forEach(cost=>totals.set(cost.itemId,(totals.get(cost.itemId)||0)+cost.quantity));
                    field('error').textContent = '';
                    field('cost').innerHTML = `<p>필요 경험치 <strong>${number(quote.experience)}</strong></p><h5>전체 필요 재화</h5>${rows([...totals].map(([itemId,quantity])=>({itemId,quantity})))}<p class="growth-note">비약은 남는 경험치를 최소화한 조합 예시입니다. 보유한 다른 등급의 비약으로 대체할 수 있습니다.</p><details><summary>비용 상세</summary><h5>레벨업</h5>${rows([...bottles,quote.currency].filter(cost=>cost.quantity))}<h5>승급 ${rank} → ${needRank}단계</h5>${rows(ascension)}<h5>상한 확장 ${limit} → ${needLimit}단계</h5>${rows(expansion)}</details>`;
                } catch (error) {
                    field('error').textContent = error.message;
                    panel.querySelector('.growth-settings').open = true;
                    field('cost').innerHTML = '';
                }
            }
            panel.addEventListener('input',event=>{
                if(event.target===field('from')) {
                    const level = Number(field('from').value);
                    if(Number.isInteger(level) && level>=1 && level<=entry.maxLevel){
                        field('rank').value=String(Math.min(entry.ascensions.length,Math.ceil(Math.min(level,60)/10)-1));
                        const bonus=entry.potencyLimits.slice(0,Number(field('potency').value)).reduce((n,r)=>n+r.additionalMaxLevel,0);
                        field('limit').value=String(Math.min(entry.limitIncreases.length,Math.ceil(Math.max(0,level-60-bonus)/2)));
                    }
                }
                render();
            });
            render();
        } catch (error) {
            panel.textContent = `${error.message} `;
            const retry = document.createElement('button');retry.textContent='다시 불러오기';retry.type='button';retry.addEventListener('click',()=>{started=false;load();});panel.append(retry);
        }
    }
    tab.addEventListener('click',load);
    if (location.hash === '#growth') tab.click();
} };
