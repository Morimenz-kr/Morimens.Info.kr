import { escapeUsage as esc } from './character-usage-view.mjs';

const roman = ['Ⅰ','Ⅱ','Ⅲ','Ⅳ','Ⅴ','Ⅵ'];
const number = value => Number(value || 0).toLocaleString('ko-KR');
const percent = value => `${(Math.max(0,Math.min(1,Number(value)||0))*100).toLocaleString('ko-KR',{maximumFractionDigits:1})}%`;
const optionKey = option => `${option.id}:${option.unit || ''}`;
// Same attribute IDs and original assets as covenant-editor.mjs / covenant_simulator.js.
const iconIds = {18159:'008',18105:'007',18126:'002',18142:'004',22207:'003',18139:'005',18155:'001',18151:'006'};
const statIcon = option => iconIds[option.id] ? `<img class="usage-stat-option-icon" src="images/keyword-icons/original/ui_battle_white_buff_${iconIds[option.id]}.png" width="24" height="24" alt="">` : '';
const leaders = list => { const peak=Math.max(0,...list.map(option=>option.rate)); return list.filter(option=>peak>0 && option.rate===peak); };

/** Contract-conditioned distributions. A row is an adoption rate, never an individual roll. */
export function renderStatisticalSettings({groups=[],selectedKeys=[],compare=false,wheelMap={},covMap={},wheelName=id=>id,covName=id=>id}) {
    if (!groups.length) return '<section class="usage-stat-empty"><p>조건에 맞는 비밀계약 기록이 없습니다.</p></section>';
    const first = groups.find(g=>g.key===selectedKeys[0]) || groups[0];
    const second = groups.find(g=>g.key===selectedKeys[1] && g!==first) || groups.find(g=>g!==first);
    const selected = compare && second ? [first,second] : [first], comparing=selected.length===2;
    const contractName = group => group.sets.map(set=>`${covName(set.id)} ${set.count}세트`).join(' + ');
    const shortName = group => group.sets.map(set=>covName(set.id)).join(' + ');
    const imageButton = (id,kind,caption=true) => {
        const item = kind==='wheel' ? wheelMap[id] : covMap[id], name=kind==='wheel' ? wheelName(id) : covName(id);
        const art=item?`<img src="${esc(item.image_path)}" alt="" width="${kind==='covenant'?500:128}" height="${kind==='covenant'?400:192}">`:'';
        return `<button type="button" class="usage-stat-art" data-equipment="${esc(id)}" data-kind="${kind}" aria-label="${esc(name)} 상세" ${item?'':'disabled'}>${item?`<span class="usage-stat-art-frame">${kind==='covenant'?`<span class="usage-stat-covenant-surface">${art}</span>`:art}</span>`:'<span class="usage-stat-missing-art">이미지 없음</span>'}${caption?`<span>${esc(name)}</span>`:''}</button>`;
    };
    const wheelArt = group => `<div class="usage-stat-wheel-pair">${group.wheels.length ? group.wheels.map(id=>imageButton(id,'wheel')).join('') : `<p class="usage-stat-unavailable">${group.wheelPairs?.[0]?.key==='__unequipped__'?'명륜 미장착':'명륜 미확인'}</p>`}</div>`;
    const contractArt = group => `<div class="usage-stat-contract-art">${group.sets.map(set=>`<div>${imageButton(set.id,'covenant')}${comparing || group.sets.length>1?`<small>${set.count}세트</small>`:''}</div>`).join('')}</div>`;
    const selector = (group,column) => `<label for="usage-stat-contract-${column}"><span>${comparing?(column?'비교 계약':'기준 계약'):'전체 계약 선택'}</span><select name="usageContract${column}" id="usage-stat-contract-${column}" data-stat-setting-column="${column}">${groups.map(g=>`<option value="${esc(g.key)}" ${g===group?'selected':''} ${comparing && g===selected[1-column]?'disabled':''}>${esc(contractName(g))} · ${percent(g.rate)}</option>`).join('')}</select></label>`;
    const compareButton = second ? `<button type="button" id="usage-stat-compare" class="usage-stat-text-button" data-stat-compare aria-pressed="${comparing}" aria-controls="usage-stat-distributions">${comparing?'비교 닫기':'계약 비교'}</button>` : '';
    const presets = !comparing ? `<div class="usage-stat-presets" role="group" aria-label="많이 사용하는 비밀계약">${groups.slice(0,3).map(g=>`<button type="button" data-stat-preset="${esc(g.key)}" aria-pressed="${g===first}"><strong>${esc(shortName(g))}</strong><span>${g.sets.map(set=>`${set.count}세트`).join(' + ')} <b>${percent(g.rate)}</b></span></button>`).join('')}</div>` : '';
    const otherControl = `<details class="usage-stat-other-contracts"><summary>전체 계약</summary>${selector(first,0)}</details>`;
    const sameWheels = comparing && first.wheelPairs[0]?.key && first.wheelPairs[0]?.key===second.wheelPairs[0]?.key;
    const compareContracts = selected.map(g=>`<section data-stat-group="${esc(g.key)}" aria-label="${esc(contractName(g))}">${contractArt(g)}</section>`).join('');
    const equipment = comparing
        ? `<div class="usage-stat-equipment usage-stat-comparison-equipment"><header class="usage-stat-equipment-heading"><h4>계약 비교</h4>${compareButton}</header><div class="usage-stat-compare-controls">${selected.map(selector).join('')}</div>${sameWheels?`<div class="usage-stat-comparison-contracts">${compareContracts}</div><section class="usage-stat-shared-wheels"><h5>공통 명륜</h5>${wheelArt(first)}</section>`:`<div class="usage-stat-distinct-art">${selected.map(g=>`<section data-stat-group="${esc(g.key)}" aria-label="${esc(contractName(g))}"><div class="usage-stat-artwork">${wheelArt(g)}${contractArt(g)}</div></section>`).join('')}</div>`}</div>`
        : `<section class="usage-stat-equipment" data-stat-group="${esc(first.key)}"><header class="usage-stat-equipment-heading"><h4 id="usage-stat-current" tabindex="-1">${esc(contractName(first))}${groups.indexOf(first)>2?` <small>${percent(first.rate)}</small>`:''}</h4><div class="usage-stat-equipment-actions">${otherControl}${compareButton}</div></header><div class="usage-stat-artwork">${wheelArt(first)}${contractArt(first)}</div></section>`;
    const totals=selected.map(g=>g.options.total);
    const entries = lists => {
        const maps=lists.map(list=>new Map(list.map(option=>[optionKey(option),option]))), union=new Map();
        lists.flat().forEach(option=>union.set(optionKey(option),option));
        const peaks=lists.map(list=>Math.max(0,...list.map(option=>option.rate)));
        const ordered=[...union].sort(([a],[b])=>Math.max(...maps.map(map=>map.get(b)?.rate||0))-Math.max(...maps.map(map=>map.get(a)?.rate||0))||a.localeCompare(b));
        return {maps,peaks,ordered};
    };
    const rateCells = (key,maps,peaks,tag='span') => maps.map((map,column)=>`<${tag}><span ${comparing?`aria-label="${esc(contractName(selected[column]))} ${totals[column]?percent(map.get(key)?.rate||0):'자료 없음'}"`: ''} class="usage-stat-rate${peaks[column]>0 && (map.get(key)?.rate||0)===peaks[column]?' is-leading':''}">${totals[column]?percent(map.get(key)?.rate||0):'<span title="집계 자료 없음">-</span>'}</span></${tag}>`).join('');
    const tableHeader = (slotColumn=false) => `<colgroup>${slotColumn?'<col class="usage-stat-slot-column">':''}<col>${selected.map(()=>'<col class="usage-stat-value-column">').join('')}</colgroup><thead><tr>${slotColumn?'<th scope="col" class="usage-stat-slot-heading">부위</th>':''}<th scope="col">옵션</th>${selected.map(g=>`<th scope="col" class="usage-stat-contract-heading">${esc(g.sets.length===1?shortName(g):contractName(g))}</th>`).join('')}</tr></thead>`;
    const rates = lists => {
        const {maps,peaks,ordered}=entries(lists);
        if(!ordered.length) return '<p class="usage-stat-no-options">집계할 옵션이 없습니다.</p>';
        if(comparing) return `<table class="usage-stat-comparison-table">${tableHeader()}<tbody>${ordered.map(([key,option])=>`<tr data-stat-option="${esc(key)}"><th scope="row"><span class="usage-stat-option-name">${statIcon(option)}<span>${esc(option.label)}</span></span></th>${rateCells(key,maps,peaks,'td')}</tr>`).join('')}</tbody></table>`;
        return `<ul class="usage-stat-rates">${ordered.map(([key,option])=>`<li data-stat-option="${esc(key)}"><span class="usage-stat-option-name">${statIcon(option)}<span>${esc(option.label)}</span></span>${rateCells(key,maps,peaks)}</li>`).join('')}</ul>`;
    };
    const slotRows = kind => {
        if(comparing) return `<table class="usage-stat-comparison-table usage-stat-slot-table">${tableHeader(true)}${roman.map((label,index)=>{
            const lists=selected.map(g=>g.options.slots.find(s=>s.slot===index+1)?.[kind]||[]),{maps,peaks,ordered}=entries(lists);
            return `<tbody aria-label="${label} 부위" data-stat-slot="${index+1}">${ordered.length?ordered.map(([key,option],i)=>`<tr data-stat-option="${esc(key)}">${i===0?`<th scope="rowgroup" rowspan="${ordered.length}" class="usage-stat-slot-heading">${label}</th>`:''}<th scope="row"><span class="usage-stat-option-name">${statIcon(option)}<span>${esc(option.label)}</span></span></th>${rateCells(key,maps,peaks,'td')}</tr>`).join(''):`<tr><th scope="row">${label}</th><td colspan="3">집계할 옵션이 없습니다.</td></tr>`}</tbody>`;
        }).join('')}</table>`;
        return `<ol class="usage-stat-main-rows">${roman.map((label,index)=>`<li class="usage-stat-main-row" data-stat-slot="${index+1}"><h6>${label}</h6>${rates([first.options.slots.find(s=>s.slot===index+1)?.[kind]||[]])}</li>`).join('')}</ol>`;
    };
    const hasOptions=totals.some(n=>n>0);
    const criteria=selected.map(g=>`${shortName(g)} ${number(g.options.total)}건`).join(' · ');
    const basis=`<p class="usage-stat-basis">계약: 확인된 ${number(first.knownCount)}건 기준 · 옵션: 완성도 90% 이상 ${esc(criteria)}<br>부옵은 6부위 중 한 번 이상 채용한 비율입니다.</p>`;
    const leading = list => {const top=leaders(list);return `${rates([top.slice(0,1)])}${top.length>1?`<small class="usage-stat-joint">공동 1순위 · 외 ${top.length-1}종</small>`:''}`;};
    const slotSubs=`<details class="usage-stat-slot-details"><summary>부위별 부옵션</summary>${slotRows('subs')}</details>`;
    const full=`<div class="usage-stat-overview usage-stat-full"><section class="usage-stat-section usage-stat-mainstats"><h5>주옵션</h5>${slotRows('main')}</section><section class="usage-stat-section usage-stat-substats"><h5>부옵션</h5>${rates(selected.map(g=>g.options.subs))}</section></div>${slotSubs}${basis}`;
    const optionSection = (kind,title,preview,content) => `<section class="usage-stat-section"><details class="usage-stat-option-disclosure" id="usage-stat-${kind}-options"><summary><h5><span>${title}</span><span class="usage-stat-disclosure-action"><span class="usage-stat-action-closed">전체 순위</span><span class="usage-stat-action-open">요약</span><span class="usage-stat-chevron" aria-hidden="true">⌄</span></span></h5></summary><div class="usage-stat-${kind}stats">${content}</div></details><div class="usage-stat-option-preview">${preview}</div></section>`;
    const mainPreview=`<ol class="usage-stat-leading-slots">${roman.map((label,index)=>`<li data-leading-slot="${index+1}"><span class="usage-stat-leading-slot">${label}</span><div>${leading(first.options.slots.find(slot=>slot.slot===index+1)?.main||[])}</div></li>`).join('')}</ol>`;
    const subShown=first.options.subs.slice(0,3),subCutoff=subShown.at(-1),subTies=subCutoff?first.options.subs.slice(3).filter(option=>option.rate===subCutoff.rate).length:0;
    const subPreview=`<div class="usage-stat-leading-sub"><div>${rates([subShown])}${subTies?`<small class="usage-stat-joint">동률 후보 ${subTies}종 더 있음</small>`:''}</div></div>`;
    const summary=`<div class="usage-stat-overview usage-stat-summary">${optionSection('main','주옵션',mainPreview,slotRows('main'))}${optionSection('sub','부옵션',subPreview,`${rates([first.options.subs])}${slotSubs}`)}</div><div class="usage-stat-details-basis">${basis}</div>`;
    return `<section class="usage-stat-settings ${comparing?'is-comparing':''}" aria-label="비밀계약별 세팅 통계">${presets}${equipment}<div id="usage-stat-distributions" class="usage-stat-distributions">${hasOptions?comparing?full:summary:`<p class="usage-stat-empty">완성도 90% 이상 기록이 없어 옵션 채용률을 집계할 수 없습니다.</p>`}</div></section>`;
}
