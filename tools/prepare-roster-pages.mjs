import fs from 'node:fs/promises';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const output = path.join(root, '.generated/roster-pages');
const files = new Set([
  'css/common.css', 'config/config.js', 'js/feedback.js', 'css/pages/inventory_checker.css', 'css/pages/roster-preview.css',
  'css/pages/roster-classic.css', 'js/character-identity.js', 'js/search_utils.js',
  'js/summon-classification.js', 'js/roster-model.js', 'js/roster-preview.js', 'js/roster-onboarding.js', 'js/roster-share-image.js', 'images/background.webp', 'images/smile_Ramona.webp',
  'data/character_manifest.json', 'data/wheel_list.json', 'data/character_growth.json', 'data/gachatype.json'
]);
function collectImages(value) {
  if (typeof value === 'string' && /^images\/[\w/(). -]+\.(?:png|webp|jpg|jpeg|svg)$/i.test(value)) files.add(value.replace('/wheel/', '/wheel_thumb/'));
  else if (Array.isArray(value)) value.forEach(collectImages);
  else if (value && typeof value === 'object') Object.values(value).forEach(collectImages);
}
for (const file of ['data/character_manifest.json', 'data/wheel_list.json']) {
  collectImages(JSON.parse(await fs.readFile(path.join(root, file), 'utf8')));
}
for (const entry of await fs.readdir(path.join(root, 'images/growth'), { withFileTypes: true })) {
  if (entry.isFile()) files.add(`images/growth/${entry.name}`);
}
await fs.mkdir(output, { recursive: true });
for (const file of files) {
  const destination = path.join(output, file);
  await fs.mkdir(path.dirname(destination), { recursive: true });
  await fs.copyFile(path.join(root, file), destination);
}
let html = await fs.readFile(path.join(root, 'inventory_checker.html'), 'utf8');
html = html.replace(/<body class="roster-app classic-roster"(?: data-roster-only)?>/, '<body class="roster-app classic-roster" data-roster-only data-feedback-endpoint="/api/feedback">')
  .replace(/<nav class="classic-back"[\s\S]*?<\/nav>/, '')
  .replace(/<button data-tab="teams">[\s\S]*?<\/button>/, '')
  .replace(/<button id="demo-button">[\s\S]*?<\/button>/, '')
  .replace(/<section id="teams-panel"[\s\S]*?<\/section>/, '')
  .replace('보유 현황 · 성장 관리 프리뷰', '각성체 · 명륜 보유 현황')
  .replace('보유 현황 프리뷰를 사용하려면', '보유 현황을 사용하려면');
await fs.writeFile(path.join(output, 'index.html'), html);
await fs.writeFile(path.join(output, '404.html'), '<!doctype html><html lang="ko"><meta charset="utf-8"><title>페이지 없음</title><p>페이지가 없습니다. <a href="/">보유 현황으로</a></p></html>');
await fs.writeFile(path.join(output, '_redirects'), '/inventory_checker.html / 302\n');
await fs.writeFile(path.join(output, '_headers'), '/*\n  X-Content-Type-Options: nosniff\n  Referrer-Policy: strict-origin-when-cross-origin\n');
const config = await fs.readFile(path.join(root, 'config/config.js'), 'utf8');
const endpoint = config.match(/FEEDBACK_ENDPOINT_URL:\s*'([^']+)'/)?.[1];
if (!endpoint || new URL(endpoint).protocol !== 'https:') throw Error('Feedback endpoint is missing or invalid');
const worker = (await fs.readFile(path.join(root, 'tools/roster-pages-worker.mjs'), 'utf8')).replace('__FEEDBACK_ENDPOINT__', endpoint);
await fs.writeFile(path.join(output, '_worker.js'), worker);
console.log(JSON.stringify({ output, files: files.size + 4 }));
