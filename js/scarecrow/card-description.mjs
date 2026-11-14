// Read display arguments from the same original command object as the calculation.
export const cardDescriptionLua=String.raw`
local f=assert(io.open('/combat.lua','rb'));local source=f:read('*a');f:close()
local injection=[[
if input.uiMetadata then
 local card=input.damage and e:GetObj(input.damage.cardUid)
 if card and card.InitCmdServer then
  card:InitCmdServer()
  local cmd=card.cmdServer
  local args,shown=cmd:GetSkillArgs()
  local text=cmd:GetSkillConfigTQText('BattleDesc') or cmd:GetSkillConfigTQText('Desc')
  local actor=e:GetObj(cmd.castRoleUid)
  if actor and actor.CanUseSuperUtlSkill and actor:CanUseSuperUtlSkill() then text=cmd:GetSkillConfigTQText('OverLimitUtlSkillDesc') or text end
  local values={};local index=0
  for token in (text or ''):gmatch('%b[]') do index=index+1;values[token:sub(2,-2)]=shown.curValues[index] end
  value.cardDescription={skillId=card.tid,textKey=text and text:match('^([^|]+)'),args=args,values=values}
 end
]]
local n;source,n=source:gsub('if input.uiMetadata then',function()return injection end,1)
assert(n==1,'Card description snapshot hook changed')
scarecrow_damage_combat_source=source
`;

const choose=(value,stage)=>typeof value==='string'?value:Object.entries(value||{}).filter(([key])=>Number(key)<=stage).sort((a,b)=>Number(b[0])-Number(a[0]))[0]?.[1];
export function nativeCardDescription(card,stage,metadata){
 const source=card.nativeDescription;
 if(!source)return null;
 const template=source.texts[metadata?.textKey]||choose(source.battle,stage)||choose(source.description,stage);
 if(!template)return null;
 let text=template.replace(/\[([^\[\]]+)\]/g,(all,token)=>{
  const arg=token.match(/(?:^|:)Arg(\d+)$/);
  const args=metadata?.args;
  const v=metadata?.values?.[token]??(arg&&(Array.isArray(args)?args[Number(arg[1])-1]:args?.[arg[1]]));
  return typeof v==='number'&&Number.isFinite(v)?String(v):all;
 });
 for(let previous;previous!==text;){previous=text;text=text.replace(/<[^<>:]+:([^<>]*)>/g,'$1');}
 // Never substitute a fabricated value before the native snapshot is available.
 return /\[(?:\w+:)?Arg\d+\]/.test(text)?null:text;
}
