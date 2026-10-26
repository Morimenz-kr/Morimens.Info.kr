export function levelStage(character,level){
 if(!Number.isInteger(level)||level<1||level>90)throw new Error('레벨은 1~90 범위의 정수로 입력하세요.');
 const rows=character.levelStages;
 if(!rows?.length)throw new Error('이 캐릭터의 성장 데이터가 없습니다.');
 return (rows.find(row=>row.maxLevel>=level)||rows.at(-1)).stage;
}
