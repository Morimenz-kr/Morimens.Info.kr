// UI/BlendWithColorMask, fragment program: the three ANDed RGB-mask tests
// and alpha blend below follow the client's compiled material program.
const imageCache=new Map(),boundCache=new Map();
const image=src=>{
 if(!imageCache.has(src))imageCache.set(src,new Promise((resolve,reject)=>{
  const img=new Image();img.onload=()=>resolve(img);img.onerror=()=>reject(Error('비밀계약 이미지를 불러오지 못했습니다.'));img.src=src;
 }));
 return imageCache.get(src);
};
let settings;
const configuration=()=>settings??=fetch('data/covenant_bound_material.json').then(r=>{if(!r.ok)throw Error('귀속 재질을 불러오지 못했습니다.');return r.json();});
export function isBoundMaterialPixel(rgb,config){
 const source=rgb.map(v=>v+.001),target=config.maskColor.map(v=>v+.001);
 const dot=source.reduce((sum,v,i)=>sum+v*target[i],0)/(Math.hypot(...source)*Math.hypot(...target));
 return 1-dot<=config.maskTolerance&&Math.hypot(...rgb.map((v,i)=>v-config.maskColor[i]))<=config.maskDistance&&Math.max(...rgb)>=config.maskMinBrightness;
}
async function boundArt(src){
 const [base,config]=await Promise.all([image(src),configuration()]),extra=await image(config.texture);
 const canvas=document.createElement('canvas');canvas.width=base.naturalWidth;canvas.height=base.naturalHeight;
 const context=canvas.getContext('2d',{willReadFrequently:true});context.drawImage(base,0,0);
 const pixels=context.getImageData(0,0,canvas.width,canvas.height);
 context.clearRect(0,0,canvas.width,canvas.height);
 // Unity sprites are trimmed out of 256px textures. Sample the extra material
 // at that original UV rectangle, rather than stretching its entire texture.
 const uv=config.partUV?.[src]||[0,0,1,1];
 context.drawImage(extra,uv[0]*extra.naturalWidth,uv[1]*extra.naturalHeight,uv[2]*extra.naturalWidth,uv[3]*extra.naturalHeight,0,0,canvas.width,canvas.height);
 const blend=context.getImageData(0,0,canvas.width,canvas.height).data;
 for(let i=0;i<pixels.data.length;i+=4){
  if(!pixels.data[i+3]||!isBoundMaterialPixel([pixels.data[i]/255,pixels.data[i+1]/255,pixels.data[i+2]/255],config))continue;
  const alpha=blend[i+3]/255;
  for(let channel=0;channel<3;channel++)pixels.data[i+channel]+=alpha*(blend[i+channel]-pixels.data[i+channel]);
 }
 context.putImageData(pixels,0,0);return canvas.toDataURL('image/png');
}
export function applyCovenantBoundMaterial(element,src){
 if(!boundCache.has(src))boundCache.set(src,boundArt(src));
 boundCache.get(src).then(url=>{if(element.isConnected)element.src=url;}).catch(()=>{
  // Preserve the real base icon on failure; no invented border or marker.
  element.dataset.materialError='true';element.title='귀속 테두리를 불러오지 못했습니다.';
 });
}
