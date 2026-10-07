window.CharacterGrowthUI = { mount(root, id) {
    const switcher = root.querySelector('.character-effects-switch');
    if (!switcher || !id) return;
    const tab = document.createElement('button');
    tab.type = 'button'; tab.id = 'level-growth-tab';tab.dataset.effectPanel='level-growth';tab.setAttribute('role','tab');tab.setAttribute('aria-selected','false');tab.setAttribute('aria-controls','tab-level-growth');tab.textContent='능력치/육성';switcher.insertBefore(tab,switcher.children[1]);
    const panel = document.createElement('div');panel.id='tab-level-growth';panel.className='character-effect-panel';panel.dataset.effectContent='level-growth';panel.setAttribute('role','tabpanel');panel.setAttribute('aria-labelledby',tab.id);panel.textContent='육성 정보를 불러오는 중입니다.';root.append(panel);
    let started = false;
    const number = value => value.toLocaleString('ko-KR');
    async function load() {
        if (started) return;
        started = true;
        try {
            const [growth, resources] = await Promise.all(['character_growth','growth_resources'].map(async name => {
                const response = await fetch(`data/${name}.json?v=growth-20261007-6`);
                if (!response.ok) throw new Error('성장 데이터 요청 실패');
                return response.json();
            }));
            const entry = growth.characters[id];
            if (!entry) throw new Error('이 각성체의 성장 정보가 없습니다.');
            const skillChoices=(skill,side,label)=>`<fieldset class="growth-skill-choice"><legend>${label}</legend><div class="growth-step-buttons">${Array.from({length:skill.maxLevel},(_,i)=>`<label><input type="radio" class="growth-skill-${side}" name="${skill.slot}-${side}" value="${i+1}" ${i===0?'checked':''} aria-label="${skill.name} ${label} Lv.${i+1}"><span>${i+1}</span></label>`).join('')}</div></fieldset>`;
            panel.innerHTML = `<h4>레벨별 능력치</h4>
                <div class="level-growth-controls growth-levels">${[['from','현재 레벨',1],['to','목표 레벨',60]].map(([key,label,value])=>`<div class="growth-level-control"><div class="growth-level-heading"><label for="growth-${key}">${label}</label><input id="growth-${key}" type="number" min="1" max="${entry.maxLevel}" value="${value}"></div><input id="growth-${key}-slider" type="range" min="1" max="${entry.maxLevel}" value="${value}" aria-label="${label} 슬라이더"><div class="growth-range-ends" aria-hidden="true"><span>1</span><span>${entry.maxLevel}</span></div></div>`).join('')}</div>
                <p class="growth-note">장비·재능·잠재력 보너스를 제외한 기본 체력·공격·방어입니다.</p>
                <div id="growth-stats"></div>
                <h4>스킬 강화</h4>
                <button type="button" id="growth-skills-max" class="growth-action">전체 목표 Lv.6</button>
                <section class="growth-skills" aria-label="스킬별 현재·목표 레벨">${entry.skillUpgrades.map(skill=>`<div class="growth-skill-row" data-skill-slot="${skill.slot}"><div class="growth-skill-name">${skill.name}</div>${skillChoices(skill,'from','현재')}${skillChoices(skill,'to','목표')}</div>`).join('')}</section>
                <p id="growth-skills-summary" class="growth-note"></p>
                <h4>필요 재화</h4>
                <p id="growth-error" role="alert"></p><div id="growth-cost" aria-live="polite"></div>
                <p class="growth-note">현재 레벨에 필요한 최소 승급·상한 해금까지 완료한 기준입니다. 현재 경험치 0, 비용 감소 미적용이며 목표 레벨의 추가 해금과 선택한 스킬 강화 비용을 포함합니다.</p>`;
            const field = name => panel.querySelector('#growth-'+name);
            function render() {
                const from = Number(field('from').value), to = Number(field('to').value);
                try {
                    const quote = CharacterGrowthData.quoteLevelUp(growth, resources, id, from, to);
                    const a = CharacterGrowthData.statsAtLevel(growth,id,from), b = CharacterGrowthData.statsAtLevel(growth,id,to);
                    field('stats').innerHTML = `<table class="growth-table"><thead><tr><th scope="col">능력치</th><th scope="col">Lv.${from}</th><th scope="col">Lv.${to}</th><th scope="col">증가</th></tr></thead><tbody>${[['체력','physique'],['공격','attack'],['방어','defense']].map(([label,key])=>`<tr><th scope="row">${label}</th><td data-label="Lv.${from}">${number(a[key])}</td><td data-label="Lv.${to}">${number(b[key])}</td><td data-label="증가">+${number(b[key]-a[key])}</td></tr>`).join('')}</tbody></table>`;
                    const current=CharacterGrowthData.quoteGrowthPlan(growth,id,from);
                    const plan=CharacterGrowthData.quoteGrowthPlan(growth,id,to,{rank:current.needRank,limit:current.needLimit,potency:current.needPotency});
                    const {needRank,needLimit,needPotency,ascension,expansion,potencyResources}=plan;
                    const selections=[...panel.querySelectorAll('[data-skill-slot]')].map(row=>({slot:row.dataset.skillSlot,fromLevel:Number(row.querySelector('.growth-skill-from:checked').value),toLevel:Number(row.querySelector('.growth-skill-to:checked').value)}));
                    panel.querySelectorAll('[data-skill-slot]').forEach(row=>row.querySelectorAll('.growth-skill-to').forEach(input=>input.disabled=Number(input.value)<Number(row.querySelector('.growth-skill-from:checked').value)));
                    const skills=CharacterGrowthData.quoteSkillUpgrades(growth,id,selections);
                    const selectedSkills=selections.filter(row=>row.toLevel>row.fromLevel);
                    field('skills-summary').textContent=selectedSkills.length?`${selectedSkills.length}개 스킬 강화 비용을 합산합니다.`:'스킬 강화 없음 · 목표 레벨을 선택하면 비용에 합산됩니다.';
                    const rows = costs => costs.length ? `<ul class="growth-resource-list">${costs.map(cost=>`<li><span class="growth-resource-name"><img src="${resources.items[cost.itemId].icon}" alt="" width="40" height="40">${resources.items[cost.itemId].name}</span><strong>${number(cost.quantity)}</strong></li>`).join('')}</ul>` : '<p class="growth-note">추가 재화 없음</p>';
                    let remaining = quote.billableExperience;
                    const bottles = [...resources.experienceItems].sort((a,b)=>b.experience-a.experience).map(item=>{const quantity=Math.floor(remaining/item.experience);remaining-=quantity*item.experience;return {itemId:item.itemId,quantity};}).filter(item=>item.quantity);
                    const all = [...bottles,quote.currency,...ascension,...expansion,...potencyResources,...skills].filter(cost=>cost.quantity);
                    const totals = new Map();all.forEach(cost=>totals.set(cost.itemId,(totals.get(cost.itemId)||0)+cost.quantity));
                    field('error').textContent = '';
                    field('cost').innerHTML = `<p>필요 경험치 <strong>${number(quote.experience)}</strong></p><h5>전체 필요 재화</h5>${rows(CharacterGrowthData.sortResources(resources,[...totals].map(([itemId,quantity])=>({itemId,quantity}))))}<p class="growth-note">비약은 남는 경험치를 최소화한 조합 예시입니다. 보유한 다른 등급의 비약으로 대체할 수 있습니다.</p>`;
                } catch (error) {
                    field('error').textContent = error.message;
                    field('cost').innerHTML = '';
                }
            }
            panel.addEventListener('input',event=>{
                for(const key of ['from','to']){
                    if(event.target===field(key+'-slider'))field(key).value=event.target.value;
                    if(event.target===field(key)&&event.target.validity.valid)field(key+'-slider').value=event.target.value;
                }
                if([field('from'),field('from-slider'),field('to'),field('to-slider')].includes(event.target)&&field('from').validity.valid&&field('to').validity.valid){
                    if(Number(field('from').value)>Number(field('to').value)){
                        const source=event.target===field('from')||event.target===field('from-slider')?'from':'to';
                        const other=source==='from'?'to':'from';
                        field(other).value=field(source).value;field(other+'-slider').value=field(source).value;
                    }
                }
                if(event.target.matches('.growth-skill-from')){
                    const row=event.target.closest('[data-skill-slot]');
                    const target=row.querySelector('.growth-skill-to:checked');
                    if(Number(target.value)<Number(event.target.value))row.querySelector(`.growth-skill-to[value="${event.target.value}"]`).checked=true;
                }
                render();
            });
            field('skills-max').addEventListener('click',()=>{panel.querySelectorAll('.growth-skill-to[value="6"]').forEach(input=>input.checked=true);render();});
            render();
        } catch (error) {
            panel.textContent = `${error.message} `;
            const retry = document.createElement('button');retry.textContent='다시 불러오기';retry.type='button';retry.addEventListener('click',()=>{started=false;load();});panel.append(retry);
        }
    }
    tab.addEventListener('click',load);
    root.addEventListener('click',event=>{
        const target=event.target.closest('[data-effect-panel]');
        if(target)document.body.classList.toggle('growth-active',target===tab);
    });
    if (location.hash === '#growth') tab.click();
} };
