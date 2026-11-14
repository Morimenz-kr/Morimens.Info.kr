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
for (const relative of ['css/common.css','css/components.css','css/party_builder.css','css/character-effects.css','css/responsive.css','css/pages/info_tools.css','css/pages/relic-info.css','css/pages/covenant_simulator.css','js/party_builder.js','js/covenant-picker.js','js/covenant-parts.mjs','js/covenant-bound-material.mjs','js/relic-info.js','js/research-depth.js','js/search_utils.js','js/character-effects.js','js/character-identity.js','css/pages/dzone-info.css','js/dzone-info.js','js/dzone-season.js','js/dzone-richtext.js']) await copy(path.join(root,relative),path.join(output,relative));
const dataFiles = ['character_manifest', 'wheel_list', 'silverkey_list', 'party_builder_rules', 'db_tooltips', 'relic_catalog', 'research_depth_levels', 'covenant_list','covenant_editor','covenant_bound_material','dzone_current','dzone_season68','dzone_season69','dzone_season70','dzone_season71','dzone_season72','dzone_maps','dzone_maps_season68','dzone_maps_season69','dzone_maps_season70','dzone_maps_season71','dzone_maps_season72'];
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
const characterEffects = await json('data/character_effects.json');
const nativeDescriptions = await json('data/scarecrow_card_descriptions.json');
// Bind translated descriptions once to native skill IDs, including renamed skills.
const coreCommandSlots = ['Slot_Strike','Slot_Defend','Slot_Skill1','Slot_Skill2'];
for (const person of live.people) {
    const identity = catalog.characters.find(c => c.id === person.id);
    const effects = characterEffects[identity?.manifestId];
    const skills = effects?.skills || [];
    const commands = skills.filter(s => s.type === '명령');
    for (const card of [...person.cards, ...person.generated]) {
        const native = nativeDescriptions.cards[card.id];
        if (native) {
            if ((native.ownerId != null && native.ownerId !== person.id) || native.skillId !== card.id) throw Error('Native card owner mismatch: '+card.id);
            card.nativeDescription = native;
            card.name = native.name;
        }
        const slot = catalog.skills[card.id]?.slot;
        const candidates = [...skills, ...(effects?.derivedCards || [])].filter(s => s.name === card.name);
        card.effectRecord = candidates.length === 1 ? candidates[0]
            : slot === 'Slot_Super' ? skills.find(s => s.type === '광기 폭발')
            : slot === 'Slot_Awake' ? skills.find(s => s.type === '영지 각성')
            : coreCommandSlots.includes(slot) ? commands[coreCommandSlots.indexOf(slot)] : undefined;
        if (!card.effectRecord && !card.nativeDescription) throw Error(`Missing translated card effect: ${person.id}/${card.id} (${card.name})`);
    }
}
for(const contract of data.covenant_list){const match=catalog.suits.find(s=>s.id===contract.clientSuitId);if(match)match.name=contract.korean_name;}
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
const art = new Set(['images/growth/UI_Commpn_Image_TrinketBindCircle.png','images/growth/UI_Battle_Image_Gradient.png','images/smile_Ramona.webp', ...['chaos','aequor','caro','ultra'].map(k => `images/character_${k}.png`)]);
function collect(value) {
    if (typeof value === 'string') for (const match of value.matchAll(/images\/[A-Za-z0-9_./% -]+\.(?:png|webp|jpe?g|gif)/g)) art.add(match[0]);
    else if (Array.isArray(value)) value.forEach(collect);
    else if (value && typeof value === 'object') Object.values(value).forEach(collect);
}
Object.values(data).forEach(collect);
const covenantParts = await json('data/covenant_parts.json');
// A valid editor must ship every configured piece, rather than silently render blanks.
for (const suit of covenantParts) for (const part of suit.parts) {
    const relative = part.imagePath;
    if (!/^images\/covenant-parts\/\d+\/[iv]+\.webp$/.test(relative)) throw new Error('Invalid covenant part image path');
    await stat(path.join(root, relative));
    art.add(relative);
}
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
for (const name of ['original-ui-adapter.js','original-ui.css','typography.css','battle-workspace.css','growth-presentation.js','prefab-party-card.js','contract-picker.js','enemy-loadout.mjs','enemy-picker.js','live.css']) await copy(path.join(source, name), path.join(output, name));
await copy(path.join(source, 'fonts'), path.join(output, 'fonts'));
for(const name of ['covenant-stats.mjs','covenant-equipment.mjs']) await copy(path.join(root,'js',name),path.join(output,name));
for(const name of ['covenant-editor.mjs','covenant-stats.mjs','covenant-equipment.mjs','covenant-simulator-model.mjs','covenant-transfer.mjs','covenant-transfer-ui.mjs','covenant_simulator.js','feedback.js']) await copy(path.join(root,'js',name),path.join(output,'js',name));
for(const name of ['covenant-editor.css','pages/covenant-workspace.css']) await copy(path.join(root,'css',name),path.join(output,'css',name));
await copy(path.join(root,'config'),path.join(output,'config'));
await copy(path.join(source,'fonts'),path.join(output,'js/scarecrow/fonts'));
await copy(path.join(root,'covenant_simulator.html'),path.join(output,'covenant_simulator.html'));
await copy(path.join(root,'data/covenant_parts.json'),path.join(output,'data/covenant_parts.json'));
await copy(path.join(root,'images/covenant-ui'),path.join(output,'images/covenant-ui'));
await copy(path.join(source, 'damage-screen.html'), path.join(output, 'battle.html'));
let html = await read('party_builder.html');
html = html.replace(/<script src="config\/config.js[^>]*><\/script>[\s\S]*?<\/script>/, ['css/common.css','css/components.css','css/character-effects.css','css/party_builder.css'].map(p => `<link rel="stylesheet" href="${p}">`).join('') + '<script defer src="js/search_utils.js"></script><script defer src="js/character-effects.js"></script>');
html = html.replace(/<title>[^<]*<\/title>/, '<title>허수아비 · 카드 피해 계산</title>')
    .replace('</head>', '<link rel="stylesheet" href="original-ui.css"></head>')
    .replace('</body>', '<script src="js/dzone-season.js"></script><script src="growth-presentation.js"></script><script src="prefab-party-card.js"></script><script src="original-ui-adapter.js"></script></body>');
await writeFile(path.join(output, 'index.html'), html);
let contract = await read('js/scarecrow/contract-picker.html');
contract = contract.replace('<script type="module"', '<script src="js/covenant-picker.js"></script><script type="module"');
await writeFile(path.join(output, 'contract-picker.html'), contract);
let relic = await read('relic_info.html');
relic = relic.replace(/<script src="config\/config.js[^>]*><\/script>[\s\S]*?<\/script>/, ['css/common.css','css/components.css','css/character-effects.css','css/pages/info_tools.css','css/pages/relic-info.css','css/responsive.css'].map(p => `<link rel="stylesheet" href="${p}">`).join(''));
relic = relic.replace(/<script>\s*loadJS\('js\/character-effects.js'\);[\s\S]*?<\/script>/, '<script src="js/character-effects.js"></script><script src="js/research-depth.js"></script><script src="js/relic-info.js"></script>');
relic = relic.replace('href="index.html" class="back-link"', 'href="#" onclick="parent.postMessage({type:\'scarecrow:close\'},location.origin);return false" class="back-link"');
await writeFile(path.join(output, 'relic-picker.html'), relic);
await copy(path.join(root,'images/dzone/grades'),path.join(output,'images/dzone/grades'));
// Reuse the real D-Zone page and its renderer in optional monster-selection mode.
let enemyHtml=await read('dzone_info.html');
enemyHtml=enemyHtml.replace(/<script src="config\/config.js[^>]*><\/script>[\s\S]*?<\/script>/,['css/common.css','css/components.css','css/character-effects.css','css/pages/info_tools.css','css/pages/dzone-info.css','css/responsive.css'].map(p=>`<link rel="stylesheet" href="${p}">`).join(''));
enemyHtml=enemyHtml.replace(/<script>\s*loadJS\('js\/character-effects.js'\);[\s\S]*?<\/script>/,['js/character-effects.js','js/research-depth.js','js/dzone-season.js','js/dzone-richtext.js','js/dzone-info.js','enemy-picker.js'].map(p=>`<script src="${p}"></script>`).join(''));
enemyHtml=enemyHtml.replace('</head>',`<style>body{margin:0}.bg-image,.background-overlay{display:none}.dzone-page-shell{padding:1rem;max-width:none}.dzone-page-shell>nav,.dzone-hero,.floating-report-btn,.dzone-research-panel,.dzone-mechanic-nav,.dzone-toolbar-heading{display:none}.dzone-shell{margin:0}.monster-heading{flex-wrap:wrap}.monster-select{min-height:44px;white-space:normal;overflow-wrap:anywhere}.dzone-picker-note{padding:0 1rem;line-height:1.6;color:#e4e4ed}</style></head>`).replace('<main class="container info-page dzone-page-shell">','<p class="dzone-picker-note">적의 전투 시작 상태를 사용합니다. 구역 유물과 별도 전투 조건은 허수아비에서 설정하세요.</p><main class="container info-page dzone-page-shell">');
await writeFile(path.join(output,'enemy-picker.html'),enemyHtml);
for (const name of (await readdir(output)).filter(name => name.endsWith('.html'))) {
    const file = path.join(output,name);
    await writeFile(file,(await readFile(file,'utf8')).replace('</head>','<link rel="stylesheet" href="typography.css"></head>'));
}
await writeFile(path.join(output, '_headers'), '/*\n  Cache-Control: no-cache\n  X-Content-Type-Options: nosniff\n');
const proof = { resourceVersion: lock.resourceVersion, originDeployment: lock.originDeployment, candidateEngine, sharedRenderers: ['js/party_builder.js','js/covenant-picker.js','js/covenant-parts.mjs','js/covenant-bound-material.mjs','js/relic-info.js'], characters: data.character_manifest.length, wheels: data.wheel_list.length, unsupported };
await writeFile(path.join(output, 'build-info.json'), JSON.stringify(proof, null, 2));
console.log(JSON.stringify(proof));
