/* Outbound-only host relay. Steam credentials never leave the query PC. */
const response=(value,status=200)=>new Response(JSON.stringify(value),{status,headers:{'Content-Type':'application/json','Cache-Control':'no-store'}});
const failures=new Set(['not-found','invalid-input','busy','rate-limited','data-not-collected','game_running','version','private','record_unavailable','steam_unavailable','unknown-record-chapter','query-timeout']);
const pathKey=async value=>'path:'+Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value)))).map(byte=>byte.toString(16).padStart(2,'0')).join('');
export function publicResult(status,body){
 if(!Number.isInteger(status)||status<200||status>599||!body||typeof body!=='object'||Array.isArray(body))throw Error('invalid-response');
 if(status>=400||body.error||body.ok===false)return{status:status===400?400:status===404?404:503,body:{error:failures.has(body.error)?body.error:'query-failed',data:null}};
 if(!['game-server','client-config','client-export'].includes(body.source)||!body.data||typeof body.data!=='object')throw Error('invalid-response');
 return{status:200,body:Object.fromEntries(['ok','source','data','fetchedAt','cached','globalCoverage','coverage'].filter(key=>Object.hasOwn(body,key)).map(key=>[key,body[key]]))};
}
export function relayAuthorized(request,token){
 const supplied=request.headers.get('X-Morimens-Relay');if(typeof token!=='string'||token.length<32||token.length>256||typeof supplied!=='string'||supplied.length!==token.length||request.headers.has('Origin'))return false;
 let difference=0;for(let i=0;i<token.length;i++)difference|=token.charCodeAt(i)^supplied.charCodeAt(i);return difference===0;
}
export const relayStub=env=>env.RECORD_PULL_RELAY.get(env.RECORD_PULL_RELAY.idFromName('current-pc'));
export async function hostRequest(request,env){
 if(!env.RECORD_PULL_RELAY||!relayAuthorized(request,env.RECORD_QUERY_TOKEN))return response({error:'relay-authentication-required'},401);
 const url=new URL(request.url);if(url.pathname==='/__relay/next'&&request.method==='GET'&&[...url.searchParams].every(([k,v])=>k==='ready'&&['0','1'].includes(v)))return relayStub(env).fetch('https://relay/next?ready='+url.searchParams.get('ready'));
 if(url.pathname!=='/__relay/result'||request.method!=='POST'||url.search)return response({error:'not-found'},404);
 try{if(Number(request.headers.get('Content-Length'))>13*1024*1024)throw Error();const reader=request.body?.getReader();if(!reader)throw Error();let bytes=0,chunks=[];for(;;){const value=await reader.read();if(value.done)break;bytes+=value.value.length;if(bytes>13*1024*1024){await reader.cancel();throw Error();}chunks.push(value.value);}const all=new Uint8Array(bytes);let offset=0;for(const chunk of chunks){all.set(chunk,offset);offset+=chunk.length;}const payload=JSON.parse(new TextDecoder().decode(all));if(!/^[a-f0-9-]{36}$/.test(payload.id))throw Error();const result=publicResult(payload.status,payload.body);return relayStub(env).fetch('https://relay/result',{method:'POST',body:JSON.stringify({id:payload.id,...result})});}catch{return response({error:'invalid-response'},400);}
}
export class RecordPullRelay{
 constructor(state){this.storage=state.storage;}
 async prune(now){const jobs=await this.storage.list({prefix:'job:'});for(const[key,job]of jobs)if(job.expiresAt<now){await this.storage.delete(key);const indexKey=await pathKey(job.path);if(await this.storage.get(indexKey)===job.id)await this.storage.delete(indexKey);for(let i=0;i<(job.chunks??0);i++)await this.storage.delete(`chunk:${job.id}:${i}`);}}
 async fetch(request){const url=new URL(typeof request==='string'?request:request.url),now=Date.now();await this.prune(now);
  if(url.pathname==='/health'){const last=await this.storage.get('hostPulse');return response({hostConnected:Number.isFinite(last)&&now-last<30000});}
  if(url.pathname==='/next'){const previous=await this.storage.get('hostPulse');await this.storage.put('hostPulse',now);if(url.searchParams.get('ready')!=='1')return response({job:null});const job=await this.storage.transaction(async storage=>{const jobs=await storage.list({prefix:'job:'});const next=[...jobs.values()].filter(job=>job.phase==='queued'||job.phase==='leased'&&(!Number.isFinite(previous)||now-previous>=30000)).sort((a,b)=>a.createdAt-b.createdAt)[0];if(!next)return null;next.phase='leased';await storage.put('job:'+next.id,next);return{id:next.id,path:next.path};});return response({job});}
  if(url.pathname==='/result'&&request.method==='POST'){const input=await request.json(),job=await this.storage.get('job:'+input.id);if(job?.phase==='done')return response({accepted:true,duplicate:true});if(!job||job.phase!=='leased')return response({error:'expired-job'},409);const result=publicResult(input.status,input.body),text=JSON.stringify(result.body);if(new TextEncoder().encode(text).length>12*1024*1024)return response({error:'response-too-large'},413);let chunks=0;for(let start=0;start<text.length;start+=16000)await this.storage.put(`chunk:${job.id}:${chunks++}`,text.slice(start,start+16000));await this.storage.put('job:'+job.id,{...job,phase:'done',status:result.status,chunks,expiresAt:now+(result.status===200?60000:3000)});return response({accepted:true});}
  if(url.pathname!=='/request'||request.method!=='POST')return response({error:'not-found'},404);
  const input=await request.json();if(typeof input.path!=='string'||!input.path.startsWith('/api/')||input.path.length>4096)return response({error:'invalid-input',data:null},400);
  const key=await pathKey(input.path);const job=await this.storage.transaction(async storage=>{const id=await storage.get(key),existing=id&&await storage.get('job:'+id),last=await storage.get('hostPulse');if(existing&&existing.expiresAt>=now&&existing.phase==='done')return existing;if(!Number.isFinite(last)||now-last>=30000)return{error:'query-service-unavailable'};if(existing&&existing.expiresAt>=now)return existing;const jobs=await storage.list({prefix:'job:'});if([...jobs.values()].filter(job=>job.phase!=='done').length>=20)return{error:'busy'};const value={id:crypto.randomUUID(),path:input.path,phase:'queued',createdAt:now,expiresAt:now+320000};await storage.put('job:'+value.id,value);await storage.put(key,value.id);return value;});
  if(job.error)return response({error:job.error,data:null},503);
  if(job.phase==='done'){let text='';for(let i=0;i<job.chunks;i++){const chunk=await this.storage.get(`chunk:${job.id}:${i}`);if(typeof chunk!=='string')return response({error:'query-service-unavailable',data:null},503);text+=chunk;}return new Response(text,{status:job.status,headers:{'Content-Type':'application/json','Cache-Control':'no-store'}});}
  return response({source:'game-server',pending:true,retryAfter:20,data:null},202);
 }
}
