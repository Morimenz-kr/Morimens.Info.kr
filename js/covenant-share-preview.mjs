import {renderCovenantParts} from './covenant-parts.mjs';
import {covenantMainValue,covenantSubLevel} from './covenant-stats.mjs';
const ROMANS=['Ⅰ','Ⅱ','Ⅲ','Ⅳ','Ⅴ','Ⅵ'];
const LABELS={crit:'크리티컬 확률',crit_damage:'크리티컬 피해',occupation_master:'영역 숙련',basic_damage_per:'피해 증폭',ulti_energy_plus_3:'광기 충전',keeper_energy_eff_2:'은열쇠 충전',blackcoin_upgrade_per:'검은 인장 획득률',death_resist:'죽음 저항'};
const ICONS={18159:'008',18105:'007',18126:'002',18142:'004',22207:'003',18139:'005',18155:'001',18151:'006'};
function node(tag,text,className){const el=document.createElement(tag);if(text!=null)el.textContent=text;if(className)el.className=className;return el;}
export function openCovenantSharePreview({equipment,error,catalog,metadata,contracts,parts,onSave,onImport,onClose,destinations=[{mode:'manual',label:'전사에 가져오기'},{mode:'target',label:'목표에 가져오기'}]}){
 const dialog=node('dialog',null,'covenant-share-preview-dialog covenant-page');dialog.setAttribute('aria-labelledby','covenant-share-preview-title');
 const head=node('div',null,'covenant-share-heading'),title=node('h2','공유된 비밀계약');title.id='covenant-share-preview-title';
 const close=node('button','닫기');close.type='button';head.append(title,close);dialog.append(head);
 const status=node('p',null,'covenant-share-status');status.setAttribute('role','status');
 if(!equipment){status.textContent=error||'공유 링크를 확인하세요.';dialog.append(status);}
 else{
  const body=node('div',null,'covenant-share-body'),art=node('div',null,'simulator-contract-visual covenant-share-art'),hex=node('div',null,'member-hex');art.setAttribute('aria-hidden','true');art.append(hex);
  renderCovenantParts(hex,{hex:true,labelsInside:true,selected:-1,parts:equipment.contractSlots.map((id,index)=>{
   const record=contracts.find(c=>c.clientSuitId===id),image=parts.find(p=>p.suitId===id)?.parts[index]?.imagePath;
   return{suitId:id,name:record?.korean_name||'미장착',image:image||record?.image_path,pieceArt:!!image,empty:!id,bound:!!id&&equipment.contractBound,caption:''};
  }),onSelect:()=>{}});for(const button of art.querySelectorAll('button'))button.disabled=true;
  const cards=node('div',null,'covenant-share-parts');
  const attribute=(id,value,level)=>{const line=node('p',null,'covenant-share-stat');if(id&&ICONS[id]){const img=node('img');img.src='images/keyword-icons/original/ui_battle_white_buff_'+ICONS[id]+'.png';img.alt='';img.width=24;img.height=24;line.append(img);}
   line.append(node('span',id?LABELS[metadata.attributes[id]?.name]||'옵션':'미설정'));
   if(id)line.append(node('strong',Number(value.toFixed(6))+(metadata.attributes[id]?.percentage?'%':'')));
   if(level!=null)line.append(node('span','Lv '+level,'covenant-share-level'));return line;};
  for(let i=0;i<6;i++){
   const id=equipment.contractSlots[i],piece=equipment.trinkets.find(p=>p.position===i+1),card=node('section',null,'covenant-share-part');
   card.append(node('h3',(contracts.find(c=>c.clientSuitId===id)?.korean_name||'미장착')+' '+ROMANS[i]));
   if(id&&piece){card.append(attribute(piece.main,piece.main?covenantMainValue(piece):0,piece.level));for(let slot=0;slot<3;slot++){const sub=piece.sub.find((s,n)=>(s.slot??n)===slot);card.append(sub?attribute(sub.id,sub.value,covenantSubLevel(sub)):node('p','없음','covenant-share-stat'));}}
   cards.append(card);
  }
  body.append(art,cards);dialog.append(node('p',equipment.contractBound?'귀속':'미귀속','covenant-share-binding'),body);
  const actions=node('div',null,'covenant-share-actions');
  const apply=callback=>{try{if(callback()!==false)dialog.close();}catch(e){status.textContent=e.message||'세팅을 가져오지 못했습니다.';}};
  if(onSave){const name=node('input');name.type='text';name.placeholder='프리셋 이름';name.setAttribute('aria-label','저장할 프리셋 이름');name.maxLength=120;const save=node('button','프리셋에 저장');save.type='button';save.onclick=()=>apply(()=>onSave(name.value.trim(),equipment));actions.append(name,save);}
  for(const destination of destinations){const button=node('button',destination.label);button.type='button';button.onclick=()=>apply(()=>onImport(destination.mode,equipment));actions.append(button);}
  dialog.append(actions,status);
 }
 close.onclick=()=>dialog.close();dialog.addEventListener('close',()=>{onClose?.();document.dispatchEvent(new Event('covenant-share-preview-closed'));dialog.remove();},{once:true});
 dialog.addEventListener('keydown',e=>{if(e.key==='Escape')e.stopPropagation();});document.body.append(dialog);dialog.showModal();close.focus();return dialog;
}
