import {encodeCovenantShareCode,decodeCovenantShareCode,decodeCovenantSetting,covenantTransferLimit} from './covenant-transfer.mjs';
import {openCovenantSharePreview} from './covenant-share-preview.mjs';
let serial=0;
export function renderCovenantTransfer(parent,{owner,getOwner=()=>owner,catalog,metadata,contracts=[],parts=[],onImport,onSharedCode}){
 const focusHost=parent.classList.contains('covenant-editor')?parent.parentElement:parent;
 const make=(tag,text)=>{const el=document.createElement(tag);if(text!=null)el.textContent=text;return el;};
 const button=(text,action)=>{const el=make('button',text);el.type='button';el.onclick=action;return el;};
 let feedbackRevision=0;
 const menu=make('dialog');menu.className='covenant-transfer-dialog covenant-code-dialog';
 const title=make('h3','공유·백업');title.id='covenant-code-title-'+(++serial);menu.setAttribute('aria-labelledby',title.id);
 const ownLabel=make('label','내 공유 코드'),own=make('textarea');own.readOnly=true;own.rows=3;own.setAttribute('aria-label','내 공유 코드');own.spellcheck=false;ownLabel.append(own);
 const status=make('p');status.className='covenant-transfer-status';status.setAttribute('role','status');
 const copy=button('공유 코드 복사',async()=>{if(!own.value)return;const requestRevision=++feedbackRevision;status.textContent='';copy.after(status);const current=()=>menu.isConnected&&menu.open&&requestRevision===feedbackRevision;try{await navigator.clipboard.writeText(own.value);if(current())status.textContent='공유 코드를 복사했습니다.';}catch{if(current()){own.focus();own.select();status.textContent='코드를 선택했습니다. 직접 복사하세요.';}}});
 const receivedLabel=make('label','받은 공유 코드'),received=make('textarea');received.rows=3;received.placeholder='MR1-…';received.spellcheck=false;received.maxLength=covenantTransferLimit;received.setAttribute('aria-label','받은 공유 코드');receivedLabel.append(received);received.addEventListener('input',()=>feedbackRevision++);received.addEventListener('focus',()=>feedbackRevision++);
 const entry=button('공유·백업',()=>{feedbackRevision++;status.textContent='';receivedLabel.after(status);received.value='';try{own.value=encodeCovenantShareCode(getOwner(),catalog,metadata);copy.disabled=false;}catch(e){own.value='';copy.disabled=true;status.textContent=e.message;}menu.showModal();received.focus();});entry.className='covenant-sharing';entry.dataset.covenantImport='';
 const check=button('세팅 확인',()=>{
  feedbackRevision++;receivedLabel.after(status);
  try{
   const legacy=received.value.trim().startsWith('{');const equipment=legacy?decodeCovenantSetting(received.value,catalog,metadata):decodeCovenantShareCode(received.value,catalog,metadata);
   menu.close();
   if(!legacy&&onSharedCode)onSharedCode(equipment);
   else openCovenantSharePreview({equipment,catalog,metadata,contracts,parts,destinations:[{mode:'current',label:'이 세팅 가져오기'}],onImport:(_,value)=>onImport(value),onClose:()=>{focusHost.querySelector('[data-covenant-import]')?.focus({preventScroll:true});}});
  }catch(e){status.textContent=e.message;received.focus();}
 });
 const actions=make('div');actions.className='covenant-transfer-actions';actions.append(check,button('닫기',()=>menu.close()));
 menu.append(title,ownLabel,copy,receivedLabel,status,actions);parent.append(entry,menu);
 menu.addEventListener('keydown',e=>{if(e.key==='Escape')e.stopPropagation();});menu.addEventListener('close',()=>{if(entry.isConnected)entry.focus({preventScroll:true});});
 return entry;
}
