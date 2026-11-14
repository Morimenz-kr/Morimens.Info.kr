import {renderCovenantParts} from './covenant-parts.mjs';
import {covenantSlots,covenantSets,equippedCovenantParts,covenantBound,covenantAttributeTotals} from './covenant-equipment.mjs';
import {covenantCompletion,covenantMainValue,covenantSubCount,covenantSubLevel,covenantSubValue,validateCovenantParts} from './covenant-stats.mjs';
import {renderCovenantTransfer} from './covenant-transfer-ui.mjs';

// Shared equipment editor. Hosts own persistence, set picking and simulation.
export function renderCovenantEditor(parent,{owner,catalog,metadata,contracts:siteContracts,parts:siteParts=[],onChange=()=>{},onPick=()=>{},onReset=()=>{},onPartChange=()=>{},initialPart=-1,pickOnPartSelect=true,allowEmptyOptions=true,renderSubstatActions=()=>{},onPartPanel=()=>{}}) {
 const addSlider=(number,min,max)=>{
  number.min=String(min);number.max=String(max);number.step='1';
  const slider=document.createElement('input');slider.type='range';slider.min=number.min;slider.max=number.max;slider.step='1';slider.value=number.value;slider.setAttribute('aria-label',number.getAttribute('aria-label')+' 슬라이더');
  const controls=document.createElement('span');controls.className='member-slider';number.before(controls);controls.append(slider,number);
  slider.oninput=()=>{number.value=slider.value;number.dispatchEvent(new Event('input',{bubbles:true}));};
  number.addEventListener('input',()=>{slider.max=number.max;slider.value=number.value;});return slider;
 };
   let slots;try{slots=covenantSlots(catalog,owner);}catch{const error=document.createElement('p');error.textContent='비밀계약 부위 저장값을 확인하세요. 비밀계약 선택에서 다시 장착할 수 있습니다.';const reset=document.createElement('button');reset.textContent='비밀계약 다시 선택';reset.onclick=()=>onPick(null);parent.append(error,reset);return;}
   const labels={crit:'크리티컬 확률',crit_damage:'크리티컬 피해',occupation_master:'영역 숙련',death_resist:'죽음 저항',basic_damage_per:'피해 증폭',blackcoin_upgrade_per:'검은 인장 획득률',keeper_energy_eff_2:'은열쇠 충전',ulti_energy_plus_3:'광기 충전'};
   const ids=[18159,18105,18126,18142,22207,18139,18155,18151],iconIds={18159:'008',18105:'007',18126:'002',18142:'004',22207:'003',18139:'005',18155:'001',18151:'006'};
   const attrName=id=>labels[metadata.attributes[id]?.name]||'추가 속성',unit=id=>metadata.attributes[id]?.percentage?'%':'';
   const attrIcon=id=>{const image=document.createElement('img');image.src='images/keyword-icons/original/ui_battle_white_buff_'+iconIds[id]+'.png';image.alt='';image.width=24;image.height=24;return image;};
   const options=document.createElement('section'),head=document.createElement('div');head.className='member-section-head';options.dataset.covenantEditor='';options.className='covenant-editor member-section member-covenants';const covenantTitle=document.createElement('h3');covenantTitle.textContent='비밀계약';head.append(covenantTitle);options.append(head);parent.append(options);
   const changeSet=document.createElement('button');changeSet.type='button';changeSet.className='member-set-change';changeSet.textContent='전체 세트 변경';changeSet.onclick=event=>{event.preventDefault();event.stopPropagation();onPick(null);};head.append(changeSet);
   const reset=document.createElement('button');reset.type='button';reset.className='member-set-change';reset.textContent='전체 초기화';reset.setAttribute('aria-label','비밀계약 전체 초기화');reset.title='6부위 장착, 주옵션, 부옵션, 귀속을 모두 초기화합니다.';reset.disabled=!slots.some(Boolean)&&!owner.trinkets?.length&&!owner.contractBound;reset.onclick=()=>{owner.contractId=0;owner.contractSlots=Array(6).fill(0);owner.trinkets=[];owner.contractBound=false;owner.contract='미장착';onChange(owner);onReset();parent.querySelector('.member-covenants .member-set-change')?.focus({preventScroll:true});};head.append(reset);
   const sets=document.createElement('p');sets.className='member-set-summary';sets.textContent=covenantSets(catalog,owner).map(s=>catalog.suits.find(c=>c.id===s.id).name+' '+s.count+'개').join(' · ')||'장착 안 함';const summary=document.createElement('div');summary.className='member-contract-summary';summary.append(sets);options.append(summary);
   const completion=document.createElement('output');completion.setAttribute('aria-live','polite');completion.className='member-completion';summary.append(completion);
   const hex=document.createElement('div');hex.className='member-hex';const diagram=document.createElement('div');diagram.className='member-contract-diagram';const hint=document.createElement('p');const defaultHint='부위를 눌러 비밀계약을 선택한 뒤 주옵션과 부옵션을 설정하세요.';hint.textContent=defaultHint;hint.className='member-hex-hint';hint.setAttribute('role','status');diagram.append(hex,hint);
   const partGrid=document.createElement('div');partGrid.className='member-parts';partGrid.hidden=true;
   const overview=document.createElement('section');overview.className='member-contract-overview';const overviewTitle=document.createElement('h4');overviewTitle.textContent='비밀계약 능력치';const totals=document.createElement('dl');totals.className='contract-attribute-totals';const totalCells=new Map();
   for(const id of ids){const row=document.createElement('div'),name=document.createElement('dt'),value=document.createElement('dd');name.append(attrIcon(id),attrName(id));row.append(name,value);totals.append(row);totalCells.set(id,value);}
   const totalsNote=document.createElement('p');totalsNote.className='contract-totals-note';totalsNote.textContent='주옵션 · 부옵션 · 3세트 효과 합계';
   const effects=document.createElement('section');effects.className='contract-set-effects';const effectsTitle=document.createElement('h4');effectsTitle.textContent='세트 효과';effects.append(effectsTitle);
   const activeSets=covenantSets(catalog,owner);for(const set of activeSets){const record=siteContracts.find(s=>s.clientSuitId===set.id),group=document.createElement('section'),name=document.createElement('h5');name.textContent=catalog.suits.find(s=>s.id===set.id).name+' · '+set.count+'개';group.append(name);
    for(const count of [3,6]){const line=document.createElement('p'),threshold=document.createElement('span');line.className=set.count>=count?'is-active':'is-inactive';threshold.textContent=count+'세트';line.append(threshold,record?.['set_effect_'+count]||'효과 설명을 불러오지 못했습니다.');group.append(line);}effects.append(group);
   }
   if(!activeSets.length){const empty=document.createElement('p');empty.textContent='장착한 비밀계약이 없습니다.';effects.append(empty);}
   overview.append(overviewTitle,totals,totalsNote,effects);
   const detail=document.createElement('div');detail.className='member-contract-detail';detail.append(overview,partGrid);
   const contractLayout=document.createElement('div');contractLayout.className='member-covenant-body';contractLayout.append(diagram,detail);options.append(contractLayout);
   const refreshCompletion=()=>{try{completion.textContent='전체 완성도 '+covenantCompletion(equippedCovenantParts(catalog,owner))+'%';const values=covenantAttributeTotals(catalog,owner);for(const [id,cell]of totalCells)cell.textContent=Number((values[id]||0).toFixed(6))+unit(id);}catch{completion.textContent='옵션 수치를 확인하세요.';for(const cell of totalCells.values())cell.textContent='—';}};refreshCompletion();
   owner.contractBound=covenantBound(owner)&&slots.some(Boolean);
   const bindingLabel=document.createElement('label');bindingLabel.className='member-toggle member-contract-binding';bindingLabel.append('귀속');const binding=document.createElement('input');binding.type='checkbox';binding.checked=owner.contractBound;binding.disabled=!slots.some(Boolean);binding.setAttribute('aria-label','비밀계약 전체 귀속');bindingLabel.append(binding);head.insertBefore(bindingLabel,changeSet);
   const partRefresh=[];
   const optionTargets=new Map();
   const refreshOptionIcons=()=>{for(const targets of optionTargets.values())for(const entry of targets){
    const id=Number(entry.select.value);entry.caption.textContent=entry.name+(id?' · '+attrName(id):'');
    for(const [optionId,button]of entry.buttons)button.setAttribute('aria-pressed',String(id===optionId));
   }};
   let selectedPosition=-1;
   const backToOverview=()=>{const last=selectedPosition;drawHex(-1);hex.querySelector('[data-part-label="'+last+'"]')?.focus({preventScroll:true});};
   for(let position=1;position<=6;position++){
    const row=document.createElement('section'),title=document.createElement('h4');row.hidden=true;row.dataset.covenantPosition=position;row.dataset.covenantEquipped=String(!!slots[position-1]);title.tabIndex=-1;title.textContent=['Ⅰ','Ⅱ','Ⅲ','Ⅳ','Ⅴ','Ⅵ'][position-1]+' · '+(catalog.suits.find(s=>s.id===slots[position-1])?.name||'미장착');const partHead=document.createElement('div');partHead.className='member-part-head';partHead.append(title);row.append(partHead);partGrid.append(row);
    const editor=document.createElement('div');editor.className='member-part-editor';editor.append(partHead);row.append(editor);
    const back=document.createElement('button');back.type='button';back.className='member-overview-back';back.textContent='전체 보기';back.onclick=backToOverview;partHead.append(back);
    const choose=document.createElement('button');choose.type='button';choose.className='member-part-set';choose.textContent=slots[position-1]?'세트 변경':'비밀계약 선택';choose.setAttribute('aria-label',position+'번 비밀계약 선택');choose.onclick=()=>onPick(position);partHead.append(choose);
    if(!slots[position-1]){const empty=document.createElement('p');empty.className='member-part-empty';empty.textContent='비밀계약을 먼저 장착하세요.';editor.append(empty);continue;}
    const fields=document.createElement('div');fields.className='fields covenant-fields';editor.append(fields);
    const current=owner.trinkets?.find(p=>p.position===position)||{position,main:0,quality:'Orange',level:0,bound:owner.contractBound,sub:[]};current.sub??=[];
    const control=(name,choices,value)=>{const label=document.createElement('label');label.textContent=name;const n=document.createElement(choices?'select':'input');if(choices)for(const [id,text]of choices)n.add(new Option(text,String(id)));else{n.type='number';n.min='0';n.step='any';}n.value=value??'';n.setAttribute('aria-label',position+'번 '+name);label.append(n);return n;};
    const attrs=ids=>ids.map(id=>[id,attrName(id)]);
    const main=control('주옵션',[[0,'미설정'],...attrs(metadata.slots[position-1].main)],current.main),level=control('강화 레벨',null,current.level),levelSlider=addSlider(level,0,12);
    const mainSection=document.createElement('section');mainSection.className='contract-option-row is-main';const mainValue=document.createElement('output');mainValue.className='contract-option-value';const mainTop=document.createElement('div');mainTop.className='contract-option-head';const mainLabel=document.createElement('span');mainLabel.textContent='주옵션';mainTop.append(mainLabel,mainValue);main.closest('label').firstChild.remove();mainSection.append(mainTop,main.closest('label'),level.closest('label'));fields.append(mainSection);
    const readout=document.createElement('output');readout.className='contract-part-completion';editor.append(readout);
    const warning=document.createElement('p');warning.className='member-input-warning';warning.setAttribute('role','status');editor.append(warning);
    const refresh=()=>{current.bound=owner.contractBound;try{validateCovenantParts([current]);warning.textContent='';}catch(error){warning.textContent=error.message;}
     mainValue.replaceChildren();if(current.main){mainValue.append(attrIcon(current.main),Number(covenantMainValue(current).toFixed(6))+unit(current.main));mainValue.setAttribute('aria-label',attrName(current.main)+' '+Number(covenantMainValue(current).toFixed(6))+unit(current.main));}else mainValue.textContent='미설정';
     try{readout.textContent='이 부위 완성도 '+covenantCompletion([current])+'%';}catch{readout.textContent='강화 레벨을 확인하세요.';}
    };partRefresh.push(refresh);refresh();
    const sub=[];
    for(let i=0;i<covenantSubCount;i++){
     const select=control('부옵션 '+(i+1),[[0,'없음'],...attrs(metadata.slots[position-1].sub)],current.sub[i]?.id||0),n=control('부옵션 '+(i+1)+' 레벨',null,covenantSubLevel(current.sub[i])??1),slider=addSlider(n,1,8),value=document.createElement('output');value.className='contract-option-value';
     const option=document.createElement('section');option.className='contract-option-row';const top=document.createElement('div');top.className='contract-option-head';const caption=document.createElement('span');caption.textContent='부옵션 '+(i+1);top.append(caption,value);renderSubstatActions(top,{position,index:i,current});select.closest('label').firstChild.remove();n.closest('label').firstChild.textContent='레벨';option.append(top,select.closest('label'),n.closest('label'));fields.append(option);sub.push({select,n,slider,value});
    }
    const refreshSub=()=>{for(const [index,{select,n,slider,value}]of sub.entries()){const id=Number(select.value);n.disabled=slider.disabled=!id;value.replaceChildren();if(id){const old=current.sub[index],invalid=old?.id===id&&covenantSubLevel(old)==null;value.append(attrIcon(id),(invalid?old.value:covenantSubValue(id,Math.max(1,Math.min(8,Number(n.value)||1))))+unit(id));value.setAttribute('aria-label',attrName(id)+' '+value.textContent+(invalid?' · 레벨 재설정 필요':''));}else{value.textContent='없음';value.removeAttribute('aria-label');}
      for(const option of select.options)option.disabled=false;
    }};refreshSub();
    const update=event=>{const subChanged=sub.some(s=>event.target===s.select||event.target===s.n);current.main=Number(main.value);current.quality='Orange';level.max=levelSlider.max='12';current.level=Math.max(0,Math.min(Math.round(Number(level.value)||0),12));level.value=levelSlider.value=String(current.level);current.bound=owner.contractBound;
     current.sub=current.sub.length>3&&!subChanged?current.sub:sub.filter(({select})=>Number(select.value)).map(({select,n,slider})=>{const old=current.sub[sub.findIndex(s=>s.select===select)];if(old?.id===Number(select.value)&&covenantSubLevel(old)==null&&event.target!==select&&event.target!==n)return old;const lv=Math.max(1,Math.min(8,Math.round(Number(n.value)||1)));n.value=slider.value=String(lv);return{id:Number(select.value),value:covenantSubValue(Number(select.value),lv)};});
     owner.trinkets=(owner.trinkets||[]).filter(p=>p.position!==position);owner.trinkets.push(current);refreshSub();refresh();refreshCompletion();drawHex(selectedPosition);onChange(owner);
    };
    [main,level,...sub.flatMap(s=>[s.select,s.n])].forEach(n=>n.onchange=n.oninput=update);
    for(const number of [level,...sub.map(s=>s.n)]){const label=number.closest('label');if(label.firstChild.nodeType===3)label.firstChild.remove();const unit=document.createElement('span');unit.className='contract-level-unit';unit.textContent='Lv.';number.before(unit);}
    const targets=[];for(const [index,select]of [main,...sub.map(s=>s.select)].entries()){
     const label=select.closest('label');label.hidden=true;const section=label.parentElement,name=index===0?'주옵션':'부옵션 '+index;
     const icons=document.createElement('div');icons.className='contract-option-icons';icons.setAttribute('role','group');icons.setAttribute('aria-label',position+'번 '+name+' 선택');
     const buttons=new Map();for(const id of ids){const button=document.createElement('button');button.type='button';button.append(attrIcon(id));button.title=attrName(id);button.setAttribute('aria-label',attrName(id));const allowed=[...select.options].some(o=>Number(o.value)===id);button.disabled=!allowed;
      button.onclick=()=>{select.value=String(allowEmptyOptions&&Number(select.value)===id?0:id);select.dispatchEvent(new Event('input',{bubbles:true}));};icons.append(button);buttons.set(id,button);
     }
     label.after(icons);targets.push({select,buttons,name,caption:section.querySelector('.contract-option-head>span')});
    }optionTargets.set(position,targets);
   }
   const drawHex=(index,focus=false)=>{selectedPosition=index;onPartChange(index);options.dataset.partEditing=index>=0?'true':'false';overview.hidden=index>=0;partGrid.hidden=index<0;for(const row of partGrid.children)row.hidden=Number(row.dataset.covenantPosition)!==index+1;onPartPanel(index>=0?partGrid.children[index]:null,index);
    const parts=slots.map((id,i)=>{const suit=catalog.suits.find(s=>s.id===id),record=siteContracts.find(s=>s.clientSuitId===id);return{suitId:id,setIcon:id?'images/covenant-set/'+id+'.png':null,name:suit?.name||'미장착',image:siteParts.find(s=>s.suitId===id)?.parts[i]?.imagePath||record?.image_path,pieceArt:!!siteParts.find(s=>s.suitId===id)?.parts[i],empty:!id,bound:!!id&&owner.contractBound,caption:id?(owner.contractBound?'귀속':'장착'):'비어 있음'};});
    renderCovenantParts(hex,{hex:true,labelsInside:true,selected:index,parts,onSelect:index=>{if(pickOnPartSelect)onPick(index+1);else drawHex(index,true)}});
    hint.textContent=defaultHint;hint.hidden=index>=0;refreshOptionIcons();
    if(focus&&index>=0){const row=partGrid.querySelector('[data-covenant-position="'+(index+1)+'"]');row.querySelector('h4').focus({preventScroll:true});row.scrollIntoView({block:'nearest'});}
   };
   binding.onchange=()=>{owner.contractBound=binding.checked;for(const part of owner.trinkets||[])part.bound=owner.contractBound;for(const refresh of partRefresh)refresh();refreshCompletion();drawHex(selectedPosition);onChange(owner);};
   const transferCatalog={...catalog,suits:catalog.suits.filter(s=>siteContracts.some(c=>c.clientSuitId===s.id))};
   renderCovenantTransfer(options,{owner,catalog:transferCatalog,metadata,onImport:equipment=>{
    Object.assign(owner,equipment);
    owner.contractId=equipment.contractSlots.find(Boolean)||0;
    owner.contract=catalog.suits.find(s=>s.id===owner.contractId)?.name||'미장착';
    onChange(owner);onReset();
    parent.querySelector('[data-covenant-import]')?.focus({preventScroll:true});
   }});
   drawHex(initialPart);
   return {editPart:position=>drawHex(position-1,true),showOverview:()=>drawHex(-1)};
}
