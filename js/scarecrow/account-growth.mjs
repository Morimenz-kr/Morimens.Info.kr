// Account research curves exported from original configuration.
export function accountResearch(levels,accountLevel,config){
 if(levels.length!==4||levels.some(l=>!Number.isInteger(l)||l<1||l>90))throw new Error('각성체 네 명의 레벨을 확인하세요.');
 if(!Number.isInteger(accountLevel)||!config.rows[String(accountLevel)])throw new Error('수호자 레벨을 확인하세요.');
 const teamLevel=Math.ceil(levels.reduce((a,b)=>a+b,0)/4);
 const effectiveLevel=accountLevel<=teamLevel?Math.ceil((teamLevel+accountLevel)/2):accountLevel;
 const row=config.rows[String(effectiveLevel)];if(!row)throw new Error('금기 학식 등급의 원본 데이터가 없습니다.');
 return {accountLevel,teamLevel,effectiveLevel,...row,biologicalResearchDepth:Math.floor(row.hpMultiplier*100)};
}
export function researchTeamHp(builds,accountLevel,config,rule=null){
 const research=accountResearch(builds.map(b=>b.level),accountLevel,config);
 const physique=builds.reduce((total,b)=>{
  const value=b.properties.physique;
  if(!Number.isFinite(value)||value<0)throw new Error('파티 체질을 확인하세요.');
  return total+value;
 },0);
 const baseHp=Math.ceil(physique*research.hpMultiplier);
 // Exploration converts the fractional growth value before the battle display rounds it.
 const deathResistance=builds.reduce((sum,b)=>sum+(b.finalPropertyOverrides?.death_resist??b.attributes?.death_resist??b.properties.death_resist??0),0);
 if(!Number.isFinite(deathResistance)||deathResistance<0)throw new Error('죽음 저항을 확인하세요.');
 const converted=rule?Math.min(deathResistance*rule.conversionRate,rule.convertedResistanceCap):0;
 const bonusPercent=rule?Math.min(converted/rule.convertedResistanceCap*rule.hpBonusPercentCap,rule.hpBonusPercentCap):0;
 const hpBonus=Math.ceil(baseHp*bonusPercent/100);
 const remaining=Number((deathResistance-converted).toFixed(10));
 return {hp:baseHp+hpBonus,baseHp,hpBonus,physique,research,deathResistance,remainingDeathResistance:remaining,displayDeathResistance:Math.ceil(remaining),bonusPercent,sourceState:rule?.sourceState};
}
