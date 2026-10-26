import { readFile, writeFile, cp, mkdir, rm, readdir, stat, lstat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { gzipSync } from 'node:zlib';
import { build } from 'esbuild';

const root = fileURLToPath(new URL('../', import.meta.url));
const runtime = path.join(root, 'scarecrow/runtime');
const source = path.join(root, 'js/scarecrow');
const output = path.join(root, '.generated/scarecrow/site');
const read = p => readFile(path.join(root, p), 'utf8');
const json = async p => JSON.parse(await read(p));
const copy = async (from, to) => { await mkdir(path.dirname(to), { recursive: true }); await cp(from, to, { recursive: true }); };
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const lock = await json('scarecrow/runtime-manifest.json');
// Runtime data is a frozen, previously published release, never an arbitrary dump.
for (const [relative, expected] of Object.entries(lock.files)) {
    const full = path.resolve(runtime, relative);
    if (!full.startsWith(runtime + path.sep) || hash(await readFile(full)) !== expected) throw new Error(`Runtime integrity mismatch: ${relative}`);
}
if (!output.startsWith(path.join(root, '.generated') + path.sep)) throw new Error('Unsafe output path');
try { if ((await lstat(output)).isSymbolicLink()) throw new Error('Output cannot be a symlink'); } catch (e) { if (e.code !== 'ENOENT') throw e; }
await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });
await cp(runtime, output, { recursive: true });
let candidateEngine = null;
if (process.env.SCARECROW_ENGINE_PACK) {
    const pack = await readFile(process.env.SCARECROW_ENGINE_PACK);
    if (pack.subarray(0,8).toString() !== 'SCROW001') throw new Error('Invalid candidate engine');
    const meta = JSON.parse(pack.subarray(12,12+pack.readUInt32LE(8)).toString());
    if (meta.client.resourceVersion !== lock.resourceVersion || meta.client.buildVersion !== lock.buildVersion) throw new Error('Engine/data version mismatch');
    await writeFile(path.join(output,'engine.scpack.gz'),gzipSync(pack,{level:9}));
    candidateEngine = hash(pack);
}

// These are the site's actual shared renderers. Do not freeze copied pickers.
for (const relative of ['css/common.css','css/components.css','css/party_builder.css','css/character-effects.css','css/responsive.css','css/pages/info_tools.css','css/pages/relic-info.css','css/pages/covenant_simulator.css','js/party_builder.js','js/covenant-picker.js','js/relic-info.js','js/research-depth.js','js/search_utils.js','js/character-effects.js','js/character-identity.js']) await copy(path.join(root,relative),path.join(output,relative));
const dataFiles = ['character_manifest', 'wheel_list', 'silverkey_list', 'party_builder_rules', 'db_tooltips', 'relic_catalog', 'research_depth_levels', 'covenant_list'];
const data = {};
for (const name of dataFiles) { data[name] = await json(`data/${name}.json`); }
const wheelMap = await json('scarecrow/runtime/site-equipment-map.json');
const keyMap = await json('scarecrow/runtime/site-key-map.json');
const contractMap = await json('scarecrow/runtime/site-contract-map.json');
for(const contract of data.covenant_list) {
 contract.clientSuitId = contractMap[contract.english_name];
 if(!contract.clientSuitId) throw new Error('Missing stable contract ID: '+contract.english_name);
}
for (const w of data.wheel_list) w.clientItemId = wheelMap[w.english_name] ?? null;
for (const k of data.silverkey_list) Object.assign(k, keyMap[k.english_name] || {});
const catalog = await json('scarecrow/runtime/catalog.json');
const live = await json('scarecrow/runtime/live-data.json');
const unsupported = { characters: [], wheels: [], keys: [] };
for (const c of data.character_manifest) {
    const match = catalog.characters.find(v => v.manifestId === c.id);
    if (!match) unsupported.characters.push(c.id);
    else {
        match.name = c.name;
        const person = live.people.find(p => p.id === match.id);
        if (person) person.name = c.name;
    }
}
for (const w of data.wheel_list) {
    const match = catalog.weapons.find(v => v.id === w.clientItemId);
    if (!match) unsupported.wheels.push(w.english_name);
    else { match.name = w.korean_name; match.effect = w.description; }
}
for (const k of data.silverkey_list) {
    const match = catalog.keepers.find(v => v.id === k.clientItemId);
    if (!match) unsupported.keys.push(k.english_name);
    else match.name = k.korean_name;
}
for (const name of dataFiles) await writeFile(path.join(output, `data/${name}.json`), JSON.stringify(data[name]));
await writeFile(path.join(output, 'catalog.json'), JSON.stringify(catalog));
await writeFile(path.join(output, 'live-data.json'), JSON.stringify(live));

// Copy current catalog art by its real path. Calculations remain locked to the manifest client version.
const art = new Set(['images/smile_Ramona.webp', ...['chaos','aequor','caro','ultra'].map(k => `images/character_${k}.png`)]);
function collect(value) {
    if (typeof value === 'string') for (const match of value.matchAll(/images\/[A-Za-z0-9_./% -]+\.(?:png|webp|jpe?g|gif)/g)) art.add(match[0]);
    else if (Array.isArray(value)) value.forEach(collect);
    else if (value && typeof value === 'object') Object.values(value).forEach(collect);
}
Object.values(data).forEach(collect);
for (const relative of art) {
    const full = path.resolve(root, relative);
    if (!full.startsWith(path.join(root, 'images') + path.sep)) throw new Error('Invalid art path');
    try { await copy(full, path.join(output, relative)); } catch (e) { if (e.code !== 'ENOENT') throw e; }
}

const ignoreNode = { name: 'node-runtime-fallbacks', setup(b) {
    b.onResolve({ filter: /^(?:fs|path|crypto|child_process|module|url)$/ }, args => ({ path: args.path, namespace: 'empty-node' }));
    b.onLoad({ filter: /.*/, namespace: 'empty-node' }, () => ({ contents: 'export default {};', loader: 'js' }));
} };
for (const [entry, name] of [['damage-screen.mjs','live-app.js'], ['worker.mjs','worker.js']]) {
    await build({ entryPoints: [path.join(source, entry)], outfile: path.join(output, name), bundle: true, format: 'esm', platform: 'browser', target: 'es2022', plugins: [ignoreNode], logLevel: 'warning' });
}
for (const name of ['original-ui-adapter.js','original-ui.css','growth-presentation.js','prefab-party-card.js','contract-picker.js','live.css']) await copy(path.join(source, name), path.join(output, name));
await copy(path.join(source, 'damage-screen.html'), path.join(output, 'battle.html'));
let html = await read('party_builder.html');
html = html.replace(/<script src="config\/config.js[^>]*><\/script>[\s\S]*?<\/script>/, ['css/common.css','css/components.css','css/character-effects.css','css/party_builder.css'].map(p => `<link rel="stylesheet" href="${p}">`).join('') + '<script defer src="js/search_utils.js"></script><script defer src="js/character-effects.js"></script>');
html = html.replace(/<title>[^<]*<\/title>/, '<title>허수아비 · 카드 피해 계산</title>')
    .replace('</head>', '<link rel="stylesheet" href="original-ui.css"></head>')
    .replace('</body>', '<script src="growth-presentation.js"></script><script src="prefab-party-card.js"></script><script src="original-ui-adapter.js"></script></body>');
await writeFile(path.join(output, 'index.html'), html);
let contract = await read('js/scarecrow/contract-picker.html');
contract = contract.replace('<script type="module"', '<script src="js/covenant-picker.js"></script><script type="module"');
await writeFile(path.join(output, 'contract-picker.html'), contract);
let relic = await read('relic_info.html');
relic = relic.replace(/<script src="config\/config.js[^>]*><\/script>[\s\S]*?<\/script>/, ['css/common.css','css/components.css','css/character-effects.css','css/pages/info_tools.css','css/pages/relic-info.css','css/responsive.css'].map(p => `<link rel="stylesheet" href="${p}">`).join(''));
relic = relic.replace(/<script>\s*loadJS\('js\/character-effects.js'\);[\s\S]*?<\/script>/, '<script src="js/character-effects.js"></script><script src="js/research-depth.js"></script><script src="js/relic-info.js"></script>');
relic = relic.replace('href="index.html" class="back-link"', 'href="#" onclick="parent.postMessage({type:\'scarecrow:close\'},location.origin);return false" class="back-link"');
await writeFile(path.join(output, 'relic-picker.html'), relic);
await writeFile(path.join(output, '_headers'), '/*\n  Cache-Control: no-cache\n  X-Content-Type-Options: nosniff\n');
const proof = { resourceVersion: lock.resourceVersion, originDeployment: lock.originDeployment, candidateEngine, sharedRenderers: ['js/party_builder.js','js/covenant-picker.js','js/relic-info.js'], characters: data.character_manifest.length, wheels: data.wheel_list.length, unsupported };
await writeFile(path.join(output, 'build-info.json'), JSON.stringify(proof, null, 2));
console.log(JSON.stringify(proof));
