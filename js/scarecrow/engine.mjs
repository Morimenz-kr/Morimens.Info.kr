import { LuaFactory } from 'wasmoon';

const utf8=new TextEncoder();
export function luaLiteral(value){
  if(value===null)return 'nil';
  if(typeof value==='boolean')return String(value);
  if(typeof value==='number'){
    if(!Number.isFinite(value)||(Number.isInteger(value)&&!Number.isSafeInteger(value)))throw new Error('정확하게 표현할 수 없는 입력 숫자');
    const s=String(value);return /[.eE]/.test(s)?s:s+'.0';
  }
  if(typeof value==='string')return '"'+[...utf8.encode(value)].map(n=>'\\'+String(n).padStart(3,'0')).join('')+'"';
  if(Array.isArray(value))return '{'+value.map(luaLiteral).join(',')+'}';
  if(value&&typeof value==='object')return '{'+Object.entries(value).map(([k,v])=>'['+luaLiteral(k)+']='+luaLiteral(v)).join(',')+'}';
  throw new Error('지원하지 않는 입력');
}
export class ScarecrowEngine {
  constructor(wasmUri){this.factory=new LuaFactory(wasmUri,{_: '/scarecrow',LANG:'C.UTF-8'});this.ready=false;}
  async initialize(bytes){
    const data=new Uint8Array(bytes),view=new DataView(data.buffer,data.byteOffset,data.byteLength);
    if(new TextDecoder().decode(data.subarray(0,8))!=='SCROW001')throw new Error('잘못된 엔진 패키지');
    const length=view.getUint32(8,true),offset=12+length;
    this.manifest=JSON.parse(new TextDecoder().decode(data.subarray(12,offset)));
    for(const file of this.manifest.files){
      if(!Number.isSafeInteger(file.offset)||!Number.isSafeInteger(file.length)||file.offset<0||file.length<0||offset+file.offset+file.length>data.length)throw new Error('손상된 엔진 파일 범위');
      const digest=await crypto.subtle.digest('SHA-256',data.subarray(offset+file.offset,offset+file.offset+file.length));
      const hash=[...new Uint8Array(digest)].map(v=>v.toString(16).padStart(2,'0')).join('');
      if(hash!==file.sha256)throw new Error('엔진 무결성 검사 실패: '+file.path);
    }
    const wasm=await this.factory.getLuaModule();
    for(const file of this.manifest.files)this.factory.mountFileSync(wasm,file.path,data.subarray(offset+file.offset,offset+file.offset+file.length));
    const digest=await crypto.subtle.digest('SHA-256',data);
    this.identity={packageSha256:[...new Uint8Array(digest)].map(v=>v.toString(16).padStart(2,'0')).join(''),runtime:'Lua 5.4 WebAssembly',randomProfile:'original client Rand'};
    this.ready=true;return {...this.manifest.client,engineIdentity:this.identity};
  }
  closeCombatSession(){this.session?.lua.global.close();this.session=null;}
  async runCombatSession(input){
    if(!this.ready)throw new Error('엔진을 먼저 불러와야 합니다.');
    const {actions=[],...base}=input,baseKey=JSON.stringify(base),actionKeys=actions.map(a=>JSON.stringify(a));
    let session=this.session;
    const reusable=session&&session.baseKey===baseKey&&session.actions.length<=actions.length&&session.actions.every((a,i)=>a===actionKeys[i])&&!session.rejected;
    if(!reusable){
      this.closeCombatSession();
      const lua=await this.factory.createEngine({injectObjects:false,functionTimeout:30000});
      session={lua,baseKey,actions:[],rejected:false};this.session=session;
      try{
        await lua.doFile('/host.lua');await lua.doFile('/build-host.lua');
        await lua.doString('scarecrow_input='+luaLiteral({...base,actions:[]})+';local result=assert(loadfile("/combat.lua"))();assert(#scarecrow_errors==0,table.concat(scarecrow_errors,"\\n"));scarecrow_result_json=scarecrow_json(result)');
      }catch(error){this.closeCombatSession();throw error;}
    }
    try{
      const extra=actions.slice(session.actions.length);
      if(extra.length)await session.lua.doString('local result=scarecrow_combat_continue('+luaLiteral(extra)+');assert(#scarecrow_errors==0,table.concat(scarecrow_errors,"\\n"));scarecrow_result_json=scarecrow_json(result)');
      const result=JSON.parse(session.lua.global.get('scarecrow_result_json'));
      session.actions=actionKeys;session.rejected=Array.isArray(result.steps)&&result.steps.some(s=>!s.accepted);
      return result;
    }catch(error){this.closeCombatSession();throw error;}
  }
  async run(kind,input){
    if(!this.ready)throw new Error('엔진을 먼저 불러와야 합니다.');
    const paths={calculator:'/damage-calculator.lua',team:'/team.lua',combat:'/combat.lua',passives:'/passive-audit.lua',passiveLifecycle:'/passive-audit.lua',passiveEvents:'/passive-audit.lua',scenario:'/scenario.lua',states:'/state-cases.lua',damage:'/milestone1.lua',build:'/build.lua',helpers:'/helper-cases.lua',gear:'/gear-cases.lua',cards:'/cards.lua',rng:'/rng.lua',catalog:'/catalog.lua'};
    if(!paths[kind])throw new Error('지원하지 않는 실행 종류');
    const lua=await this.factory.createEngine({injectObjects:false,functionTimeout:30000});
    try{
      await lua.doFile('/host.lua');
      if(['calculator','combat','passives','passiveLifecycle','passiveEvents'].includes(kind)||(kind==='scenario'&&input.initializePassives)||(kind==='states'&&input.some(c=>c.initializePassives)))await lua.doFile('/build-host.lua');
      await lua.doString('scarecrow_input='+luaLiteral(input)+';scarecrow_state_cases=scarecrow_input;scarecrow_cases=scarecrow_input');
      if(kind==='passiveLifecycle')await lua.doFile('/passive-lifecycle.lua');
      if(kind==='passiveEvents')await lua.doFile('/passive-events.lua');
      await lua.doString('local result=assert(loadfile('+luaLiteral(paths[kind])+'))();assert(#scarecrow_errors==0,table.concat(scarecrow_errors,"\\n"));scarecrow_result_json=scarecrow_json(result)');
      return JSON.parse(lua.global.get('scarecrow_result_json'));
    }finally{lua.global.close();}
  }
}
