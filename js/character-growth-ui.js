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
                const response = await fetch(`data/${name}.json?v=growth-20261007-14`);
                if (!response.ok) throw new Error('성장 데이터 요청 실패');
                return response.json();
            }));
            const entry = growth.characters[id];
            if (!entry) throw new Error('이 각성체의 성장 정보가 없습니다.');
            const choices=(item,side,label,min=1)=>`<label class="growth-compact-choice"><span class="growth-choice-heading"><span class="growth-choice-label">${label}</span><output>${min}</output></span><input type="range" class="growth-${side}" min="${min}" max="${item.maxLevel}" step="1" value="${min}" aria-label="${item.name} ${label}"></label>`;
            const types={Slot_Strike:'타격',Slot_Defend:'방어',Slot_Skill1:'스킬',Slot_Skill2:'스킬',Slot_Awake:'영지각성',Slot_Super:'광기 폭발'};
            panel.innerHTML = `<section class="growth-section"><h4>경험치</h4>
                <div class="level-growth-controls growth-levels">${[['from','현재 레벨',1],['to','목표 레벨',60]].map(([key,label,value])=>`<div class="growth-level-control"><div class="growth-level-heading"><label for="growth-${key}">${label}</label><input id="growth-${key}" type="number" min="1" max="${entry.maxLevel}" value="${value}"></div><input id="growth-${key}-slider" type="range" min="1" max="${entry.maxLevel}" value="${value}" aria-label="${label} 슬라이더"><div class="growth-range-ends" aria-hidden="true"><span>1</span><span>${entry.maxLevel}</span></div></div>`).join('')}</div>
                <div class="growth-unlocks">${[['potency','돌파',entry.potencySteps.length]].map(([kind,name,maxLevel])=>`<div class="growth-unlock-row" data-unlock="${kind}"><h5>${name}</h5><div class="growth-talent-row">${choices({name,maxLevel},kind+'-from','현재',0)}${choices({name,maxLevel},kind+'-to','목표',0)}</div></div>`).join('')}</div><div id="growth-stats"></div><div id="growth-attributes"></div></section>
                <section class="growth-section"><div class="growth-section-heading"><h4>스킬</h4><button type="button" id="growth-skills-max" class="growth-action">전체 목표 Lv.6</button></div>
                <div class="growth-skills">${entry.skillUpgrades.map(skill=>`<div class="growth-skill-row" data-skill-slot="${skill.slot}"><div class="growth-skill-name">${types[skill.slot]===skill.name?'':`<span class="growth-skill-type">${types[skill.slot]}</span>`}${skill.name}</div><div class="growth-skill-transition"><span>현재 <output data-from>1</output></span><span aria-hidden="true">→</span><span class="growth-target-value">목표 <output data-to>1</output></span></div>${choices(skill,'skill-from','현재')}${choices(skill,'skill-to','목표')}</div>`).join('')}</div></section>
                ${entry.talentUpgrades.map(talent=>`<section class="growth-section"><h4>${talent.name}</h4><div class="growth-talent-row" data-talent-type="${talent.type}">${choices(talent,'talent-from','현재',0)}${choices(talent,'talent-to','목표',0)}</div></section>`).join('')}
                <section class="growth-section growth-total"><h4>전체 필요 재화</h4><p id="growth-error" role="alert"></p><div id="growth-cost" aria-live="polite"></div></section>`;
            const field = name => panel.querySelector('#growth-'+name);
            function render() {
                const currentMinimum=CharacterGrowthData.quoteGrowthPlan(growth,id,Number(field('from').value));
                const targetMinimum=CharacterGrowthData.quoteGrowthPlan(growth,id,Number(field('to').value));
                for(const [kind,key] of [['potency','needPotency']]){
                    const a=panel.querySelector(`.growth-${kind}-from`),b=panel.querySelector(`.growth-${kind}-to`);
                    a.value=a.dataset.manual?Math.max(Number(a.value),currentMinimum[key]):currentMinimum[key];
                    b.value=b.dataset.manual?Math.max(Number(b.value),targetMinimum[key],Number(a.value)):Math.max(targetMinimum[key],Number(a.value));
                }
                panel.querySelectorAll('.growth-compact-choice').forEach(label=>label.querySelector('output').value=label.querySelector('input').value);
                panel.querySelectorAll('[data-skill-slot]').forEach(row=>{row.querySelector('[data-from]').value=row.querySelector('.growth-skill-from').value;row.querySelector('[data-to]').value=row.querySelector('.growth-skill-to').value;});
                const from = Number(field('from').value), to = Number(field('to').value);
                try {
                    const quote = CharacterGrowthData.quoteLevelUp(growth, resources, id, from, to);
                    const a = CharacterGrowthData.statsAtLevel(growth,id,from), b = CharacterGrowthData.statsAtLevel(growth,id,to);
                    field('stats').innerHTML = `<table class="growth-table"><thead><tr><th scope="col">능력치</th><th scope="col">Lv.${from}</th><th scope="col">Lv.${to}</th><th scope="col">증가</th></tr></thead><tbody>${[['체력','physique'],['공격','attack'],['방어','defense']].map(([label,key])=>`<tr><th scope="row">${label}</th><td data-label="Lv.${from}">${number(a[key])}</td><td data-label="Lv.${to}">${number(b[key])}</td><td data-label="증가">+${number(b[key]-a[key])}</td></tr>`).join('')}</tbody></table>`;
                    const rankFrom=currentMinimum.needRank,rankTo=targetMinimum.needRank;
                    const potencyFrom=Number(panel.querySelector('.growth-potency-from').value),potencyTo=Number(panel.querySelector('.growth-potency-to').value);
                    const current=CharacterGrowthData.quoteGrowthPlan(growth,id,from,{rank:rankFrom,potency:potencyFrom});
                    const plan=CharacterGrowthData.quoteGrowthPlan(growth,id,to,{rank:rankTo,limit:current.needLimit,potency:potencyTo});
                    const ascension=CharacterGrowthData.quoteAscension(growth,id,rankFrom,rankTo),expansion=plan.expansion;
                    const potencyResources=entry.potencySteps.slice(potencyFrom,potencyTo).flatMap(row=>row.resources);
                    const attrsFrom=CharacterGrowthData.growthAttributes(growth,id,rankFrom,potencyFrom),attrsTo=CharacterGrowthData.growthAttributes(growth,id,rankTo,potencyTo);
                    field('attributes').innerHTML=`<table class="growth-table"><thead><tr><th scope="col">성장 능력치</th><th scope="col">현재</th><th scope="col">목표</th><th scope="col">증가</th></tr></thead><tbody>${[['영역 숙련','occupation_master',''],['은열쇠 충전 등급','keeper_energy_eff_2',''],['크리티컬 확률','crit','%'],['크리티컬 피해','crit_damage','%']].map(([label,key,unit])=>`<tr><th scope="row">${label}</th><td data-label="현재">${number(attrsFrom[key])}${unit}</td><td data-label="목표">${number(attrsTo[key])}${unit}</td><td data-label="증가">+${number(Math.round((attrsTo[key]-attrsFrom[key])*1e6)/1e6)}${unit}</td></tr>`).join('')}</tbody></table>`;
                    const selections=[...panel.querySelectorAll('[data-skill-slot]')].map(row=>({slot:row.dataset.skillSlot,fromLevel:Number(row.querySelector('.growth-skill-from').value),toLevel:Number(row.querySelector('.growth-skill-to').value)}));
                    const skills=CharacterGrowthData.quoteSkillUpgrades(growth,id,selections);
                    const talentSelections=[...panel.querySelectorAll('[data-talent-type]')].map(row=>({type:Number(row.dataset.talentType),fromLevel:Number(row.querySelector('.growth-talent-from').value),toLevel:Number(row.querySelector('.growth-talent-to').value)}));
                    const talents=CharacterGrowthData.quoteTalentUpgrades(growth,id,talentSelections);
                    const rows = costs => costs.length ? `<ul class="growth-resource-list">${costs.map(cost=>`<li><span class="growth-resource-name"><img src="${resources.items[cost.itemId].icon}" alt="" width="40" height="40">${resources.items[cost.itemId].name}</span><strong>${number(cost.quantity)}</strong></li>`).join('')}</ul>` : '<p class="growth-note">추가 재화 없음</p>';
                    let remaining = quote.billableExperience;
                    const bottles = [...resources.experienceItems].sort((a,b)=>b.experience-a.experience).map(item=>{const quantity=Math.floor(remaining/item.experience);remaining-=quantity*item.experience;return {itemId:item.itemId,quantity};}).filter(item=>item.quantity);
                    const all = [...bottles,quote.currency,...ascension,...expansion,...potencyResources,...skills,...talents].filter(cost=>cost.quantity);
                    const totals = new Map();all.forEach(cost=>totals.set(cost.itemId,(totals.get(cost.itemId)||0)+cost.quantity));
                    field('error').textContent = '';
                    field('cost').innerHTML = rows(CharacterGrowthData.sortResources(resources,[...totals].map(([itemId,quantity])=>({itemId,quantity}))));
                } catch (error) {
                    field('error').textContent = error.message;
                    field('cost').innerHTML = '';
                }
            }
            panel.addEventListener('input',event=>{
                if(event.target.matches('.growth-potency-from,.growth-potency-to'))event.target.dataset.manual='true';
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
                if(event.target.matches('.growth-skill-from,.growth-skill-to,.growth-talent-from,.growth-talent-to')){
                    const kind=event.target.classList.contains('growth-skill-from')||event.target.classList.contains('growth-skill-to')?'skill':'talent';
                    const row=event.target.closest('[data-skill-slot],[data-talent-type]');
                    const current=row.querySelector(`.growth-${kind}-from`),target=row.querySelector(`.growth-${kind}-to`);
                    if(Number(current.value)>Number(target.value)){
                        if(event.target===current)target.value=current.value;else current.value=target.value;
                    }
                }
                render();
            });
            field('skills-max').addEventListener('click',()=>{panel.querySelectorAll('.growth-skill-to').forEach(input=>input.value='6');render();});
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
