export function tentacleCapacity(properties){
 const pools=['permanent_max_tentacle_count','battle_max_tentacle_count','bout_max_tentacle_count'].map(key=>properties[key]);
 // Missing zero-valued pools must not add another default five to a real battle limit.
 return pools.some(value=>value!=null)?pools.reduce((sum,value)=>sum+Number(value||0),0):5;
}
