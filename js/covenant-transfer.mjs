import {covenantBound, covenantSlots} from './covenant-equipment.mjs';
import {covenantSubLevel,covenantSubValue} from './covenant-stats.mjs';

const SCHEMA = 'morimens.covenant-setting';
export const covenantTransferLimit = 32768;

// Only equipment crosses hosts. Account, party, simulation history and goals stay local.
export function normalizeCovenantSetting(value, catalog, metadata) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw Error('비밀계약 세팅 형식을 확인하세요.');
    if (!Array.isArray(value.contractSlots) || value.contractSlots.length !== 6) throw Error('비밀계약 6부위의 장착 정보를 확인하세요.');
    const publishedIds = catalog.setIds ? new Set(Object.values(catalog.setIds)) : null;
    const contractSlots = covenantSlots(catalog, value);
    if (publishedIds && contractSlots.some(id => id && !publishedIds.has(id))) throw Error('현재 공개된 비밀계약만 가져올 수 있습니다.');
    if (typeof value.contractBound !== 'boolean') throw Error('비밀계약 귀속 정보를 확인하세요.');
    const contractBound = covenantBound(value);
    if (!Array.isArray(value.trinkets) || value.trinkets.length > 6) throw Error('비밀계약 부위는 최대 6개입니다.');
    const positions = new Set();
    const trinkets = value.trinkets.map(piece => {
        if (!piece || !Number.isInteger(piece.position) || piece.position < 1 || piece.position > 6 || positions.has(piece.position)) {
            throw Error('중복되거나 잘못된 비밀계약 부위가 있습니다.');
        }
        positions.add(piece.position);
        const slot = metadata.slots[piece.position - 1];
        if (!Number.isSafeInteger(piece.main) || piece.main !== 0 && !slot.main.includes(piece.main)) throw Error(`${piece.position}번 부위의 주옵션을 확인하세요.`);
        if (piece.quality !== 'Orange') throw Error('현재 공용 편집기는 황금 비밀계약 세팅만 옮길 수 있습니다.');
        if (!Number.isInteger(piece.level) || piece.level < 0 || piece.level > 12) throw Error('강화 레벨은 0~12로 설정하세요.');
        if (!Array.isArray(piece.sub) || piece.sub.length > 3) throw Error('부옵션은 최대 3개입니다.');
        const subSlots = new Set();
        const sub = piece.sub.map((option, index) => {
            if (!option || !Number.isSafeInteger(option.id) || !metadata.attributes[option.id] || !Number.isFinite(option.value) || covenantSubLevel(option) === null) {
                throw Error('부옵션 종류와 Lv.1~8 수치를 확인하세요.');
            }
            const slot = option.slot ?? index;
            if (!Number.isInteger(slot) || slot < 0 || slot > 2 || subSlots.has(slot)) throw Error('부옵션의 입력 위치가 중복되거나 잘못되었습니다.');
            subSlots.add(slot);
            return {id: option.id, value: option.value, slot};
        }).sort((a,b) => a.slot-b.slot).map((option,index) => ({id:option.id,value:option.value,...(option.slot!==index?{slot:option.slot}:{})}));
        return {position: piece.position, main: piece.main, quality: 'Orange', level: piece.level, bound: contractBound, sub};
    }).sort((a, b) => a.position - b.position);
    const completeParts=Array.from({length:6},(_,index)=>trinkets.find(p=>p.position===index+1)||{position:index+1,main:0,quality:'Orange',level:0,bound:contractBound,sub:[]});
    return {contractSlots, contractBound, trinkets:completeParts};
}

export function encodeCovenantSetting(owner, catalog, metadata) {
    const equipment = normalizeCovenantSetting({...owner, contractSlots: covenantSlots(catalog, owner), contractBound: covenantBound(owner), trinkets: owner.trinkets || []}, catalog, metadata);
    return JSON.stringify({schema: SCHEMA, version: 1, equipment});
}

export function decodeCovenantSetting(text, catalog, metadata) {
    if (typeof text !== 'string' || !text.trim() || text.length > covenantTransferLimit) throw Error('복사한 비밀계약 세팅을 붙여넣으세요. 세팅은 32KB 이하여야 합니다.');
    let value;
    try { value = JSON.parse(text); } catch { throw Error('비밀계약 세팅을 끝까지 복사했는지 확인하세요.'); }
    if (value?.schema !== SCHEMA || value.version !== 1) throw Error('지원하지 않는 비밀계약 세팅 형식입니다.');
    return normalizeCovenantSetting(value.equipment, catalog, metadata);
}


export const covenantShareLimit=8192;
export function createCovenantShareLink(owner,catalog,metadata,baseUrl){
    const setting=JSON.parse(encodeCovenantSetting(owner,catalog,metadata)).equipment;
    const compact=[1,setting.contractSlots,setting.contractBound,setting.trinkets.map(p=>[p.position,p.main,p.level,p.sub.map(s=>s.slot==null?[s.id,s.value]:[s.id,s.value,s.slot])])];
    const payload=btoa(JSON.stringify(compact)).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
    const url=new URL('covenant_simulator.html',baseUrl);
    if(!['http:','https:'].includes(url.protocol))throw Error('공유 링크의 주소를 확인하세요.');
    url.hash=new URLSearchParams({covenant:payload}).toString();
    return url.href;
}

export function decodeCovenantShareLink(link,catalog,metadata){
    try{
        if(typeof link!=='string'||link.length>covenantShareLimit)throw Error();
        const url=new URL(link,'https://morimens.invalid/');
        if(!['http:','https:'].includes(url.protocol))throw Error();
        const params=new URLSearchParams(url.hash.slice(1)),values=params.getAll('covenant');
        if(values.length!==1||!values[0]||!/^[A-Za-z0-9_-]+$/.test(values[0]))throw Error();
        const text=atob(values[0].replace(/-/g,'+').replace(/_/g,'/'));
        const value=JSON.parse(text);
        if(!Array.isArray(value)||value.length!==4||value[0]!==1||!Array.isArray(value[3])||value[3].length>6)throw Error();
        const trinkets=value[3].map(p=>{
            if(!Array.isArray(p)||p.length!==4||!Array.isArray(p[3]))throw Error();
            return{position:p[0],main:p[1],level:p[2],quality:'Orange',sub:p[3].map(s=>{
                if(!Array.isArray(s)||s.length<2||s.length>3)throw Error();
                return{id:s[0],value:s[1],...(s.length===3?{slot:s[2]}:{})};
            })};
        });
        return normalizeCovenantSetting({contractSlots:value[1],contractBound:value[2],trinkets},catalog,metadata);
    }catch{throw Error('공유 링크가 올바르지 않거나 현재 지원하지 않는 세팅입니다.');}
}


const SHARE_ALPHABET='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const SHARE_ATTRIBUTES=[0,18159,18105,18126,18142,22207,18139,18155,18151];
function checksum(bytes){let crc=0xffffffff;for(const byte of bytes){crc^=byte;for(let bit=0;bit<8;bit++)crc=(crc>>>1)^((crc&1)?0xedb88320:0);}return(crc^0xffffffff)>>>0;}
export function encodeCovenantShareCode(owner,catalog,metadata){
 const value=JSON.parse(encodeCovenantSetting(owner,catalog,metadata)).equipment,bits=[];
 const put=(n,count)=>{if(!Number.isInteger(n)||n<0||n>=2**count)throw Error('공유 코드로 저장할 수 없는 장비입니다.');for(let b=count-1;b>=0;b--)bits.push(Math.floor(n/2**b)%2);};
 put(Number(value.contractBound),1);
 for(let i=0;i<6;i++){
  const p=value.trinkets[i];put(value.contractSlots[i],16);put(SHARE_ATTRIBUTES.indexOf(p.main),4);put(p.level,4);
  for(let slot=0;slot<3;slot++){const sub=p.sub.find((s,n)=>(s.slot??n)===slot);put(sub?SHARE_ATTRIBUTES.indexOf(sub.id):0,4);put(sub?covenantSubLevel(sub)-1:0,3);}
 }
 const data=new Uint8Array(38);for(let i=0;i<bits.length;i++)data[i>>3]|=bits[i]<<(7-i%8);
 const crc=checksum(data.subarray(0,34));for(let i=0;i<4;i++)data[34+i]=(crc>>>(24-i*8))&255;
 let text='';for(let i=0;i<data.length*8;i+=5){let n=0;for(let b=0;b<5;b++){const j=i+b;n=n*2+(j<data.length*8?((data[j>>3]>>>(7-j%8))&1):0);}text+=SHARE_ALPHABET[n];}
 return'MR1-'+text.match(/.{1,8}/g).join('-');
}
export function decodeCovenantShareCode(code,catalog,metadata){
 try{
  if(typeof code!=='string'||code.length>256)throw Error();const text=code.replace(/[\s-]/g,'').toUpperCase();
  if(!text.startsWith('MR1')||text.length!==64)throw Error();const bits=[];
  for(const ch of text.slice(3)){const n=SHARE_ALPHABET.indexOf(ch);if(n<0)throw Error();for(let b=4;b>=0;b--)bits.push((n>>>b)&1);}
  if(bits.slice(304).some(Boolean))throw Error();const data=new Uint8Array(38);for(let i=0;i<304;i++)data[i>>3]|=bits[i]<<(7-i%8);
  const stored=((data[34]<<24)|(data[35]<<16)|(data[36]<<8)|data[37])>>>0;if(checksum(data.subarray(0,34))!==stored)throw Error();
  let pos=0;const take=count=>{let n=0;while(count--)n=n*2+bits[pos++];return n;};const bound=!!take(1),slots=[],trinkets=[];
  for(let i=0;i<6;i++){slots.push(take(16));const main=SHARE_ATTRIBUTES[take(4)],level=take(4),sub=[];if(main==null)throw Error();for(let slot=0;slot<3;slot++){const kind=take(4),lv=take(3);if(!kind){if(lv)throw Error();continue;}const id=SHARE_ATTRIBUTES[kind];if(!id)throw Error();const value=covenantSubValue(id,lv+1);sub.push({id,value,...(slot!==sub.length?{slot}:{})});}trinkets.push({position:i+1,main,level,quality:'Orange',sub});}
  if(bits.slice(pos,272).some(Boolean))throw Error();return normalizeCovenantSetting({contractSlots:slots,contractBound:bound,trinkets},catalog,metadata);
 }catch{throw Error('공유 코드가 올바르지 않습니다. 코드를 끝까지 입력했는지 확인하세요.');}
}
