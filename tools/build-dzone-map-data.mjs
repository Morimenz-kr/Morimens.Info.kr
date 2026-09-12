import fs from 'node:fs/promises';
import path from 'node:path';

function argument(name, fallback) {
  const index = process.argv.indexOf(name);
  return index >= 0 && process.argv[index + 1] ? path.resolve(process.argv[index + 1]) : fallback;
}

const repoRoot = path.resolve(import.meta.dirname, '..');
const configDir = argument('--config-dir');
const seasonPath = argument('--season', path.join(repoRoot, 'data', 'dzone_current.json'));
const outputPath = argument('--out', path.join(repoRoot, 'data', 'dzone_maps.json'));
if (!configDir) throw new Error('--config-dir 값이 필요합니다.');

async function config(name) {
  const document = JSON.parse(await fs.readFile(path.join(configDir, `${name}.json`), 'utf8'));
  return document.data;
}

const [maps, mapNodes, season] = await Promise.all([
  config('Config.Map'),
  config('Config.MapNode'),
  fs.readFile(seasonPath, 'utf8').then(JSON.parse)
]);

const NODE_PRESENTATION = Object.freeze({
  1: { kind: 'combat', label: '전투', icon: 'combat' },
  2: { kind: 'combat', label: '엘리트', icon: 'elite' },
  3: { kind: 'combat', label: '최종전', icon: 'boss' },
  4: { kind: 'reward', label: '빛바랜 유골', icon: 'bones' },
  6: { kind: 'event', label: '이벤트', icon: 'event' },
  9: { kind: 'reward', label: '검은 인장', icon: 'black-seal' },
  11: { kind: 'obstacle', label: '녹슨 문', icon: 'locked-door' },
  12: { kind: 'mechanism', label: '녹슨 열쇠', icon: 'rusted-key' },
  13: { kind: 'obstacle', label: '환상', icon: 'illusion' },
  14: { kind: 'passage', label: '터널', icon: 'tunnel' },
  15: { kind: 'start', label: '시작', icon: null },
  19: { kind: 'passage', label: '비밀 통로', icon: 'passage' },
  24: { kind: 'utility', label: '조명등', icon: 'lamp' },
  27: { kind: 'terrain', label: '불안정한 바닥', icon: null, texture: 'unstable-floor' },
  34: { kind: 'terrain', label: '독가스 바닥', icon: null, texture: 'poison-floor' },
  40: { kind: 'reward', label: '재의 유적', icon: 'ash-ruins' }
});

function presentation(node) {
  const base = NODE_PRESENTATION[node.Type] || { kind: 'normal', label: '일반 노드', icon: null };
  if (node.ID === 11527) return { ...base, label: '비밀 통로 입구', icon: 'passage-in' };
  if (node.ID === 12863) return { ...base, label: '비밀 통로 출구', icon: 'passage-out' };
  return base;
}

// Map 84969 omits this traversable cell from Config.Map even though it is
// rendered as a plain node in-game. The adjacent cells and captured 5-wave
// route place it between the unstable floor and the rusted key.
const MAP_NODE_SUPPLEMENTS = Object.freeze({
  84969: [
    { row: 5, column: 9, nodeId: null, kind: 'normal', label: '일반 노드', icon: null }
  ]
});

const result = {
  period: season.period,
  generatedAt: new Date().toISOString(),
  waves: season.waves.map(wave => {
    const map = maps[wave.mapId];
    if (!map) throw new Error(`${wave.wave}파 Map ${wave.mapId} 누락`);
    const encounterIds = new Set(wave.encounters.map(encounter => encounter.battleId));
    const nodes = [];
    for (const [rowKey, row] of Object.entries(map.data_list || {})) {
      for (const [axis, value] of Object.entries(row)) {
        if (!/Xaxis\d+$/.test(axis)) continue;
        const nodeIds = Object.entries(value || {})
          .filter(([layer, id]) => /^\d+$/.test(layer) && Number.isInteger(id) && id !== 11666)
          .sort(([left], [right]) => Number(left) - Number(right))
          .map(([, id]) => id);
        if (!nodeIds.length) continue;
        // Some cells replace their initial node later. The last numeric layer is
        // the actionable state (for example, 3파 시작점 위에 열리는 최종전).
        const nodeId = nodeIds.at(-1);
        const node = mapNodes[nodeId];
        if (!node) throw new Error(`MapNode ${nodeId} 누락`);
        const view = presentation(node);
        const battleId = view.kind === 'combat' ? Number(node.Effect?.['1']) : null;
        nodes.push({
          row: Number(rowKey),
          column: Number(axis.match(/\d+$/)[0]),
          nodeId: node.ID,
          ...view,
          ...(battleId && encounterIds.has(battleId) ? { battleId } : {})
        });
      }
    }
    nodes.push(...(MAP_NODE_SUPPLEMENTS[wave.mapId] || []));
    nodes.sort((left, right) => left.row - right.row || left.column - right.column);
    return { wave: wave.wave, mapId: wave.mapId, nodes };
  })
};

await fs.mkdir(path.dirname(outputPath), { recursive: true });
await fs.writeFile(outputPath, `${JSON.stringify(result, null, 2)}\n`);
console.log(`융재금구 지도 데이터 생성: ${outputPath}`);
