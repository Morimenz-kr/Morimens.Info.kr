import {ScarecrowEngine} from './engine.mjs';
let engine;
let queue=Promise.resolve();
self.onmessage=({data})=>{queue=queue.then(async()=>{
 try{
  if(data.kind==='initialize'){
   const response=await fetch('engine.scpack.gz');if(!response.ok)throw new Error('엔진 패키지를 불러오지 못했습니다.');
   const bytes=await new Response(response.body.pipeThrough(new DecompressionStream('gzip'))).arrayBuffer();
   engine=new ScarecrowEngine(new URL('glue.wasm',self.location.href).href);
   const client=await engine.initialize(bytes);self.postMessage({id:data.id,result:client});
  }else self.postMessage({id:data.id,result:await (data.kind==='combatSession'?engine.runCombatSession(data.input):engine.run(data.kind,data.input))});
 }catch(error){self.postMessage({id:data.id,error:String(error.message||error).slice(0,3000)});}
});};
