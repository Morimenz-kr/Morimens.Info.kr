import { existsSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CONFIG_SOURCE = readFileSync(path.join(ROOT, 'config', 'config.js'), 'utf8');
const CONFIG_VERSION = CONFIG_SOURCE.match(/VERSION:\s*['"]([^'"]+)/)?.[1] || '';
const errors = [];
const warnings = [];

function relative(file) {
    return path.relative(ROOT, file).replaceAll(path.sep, '/');
}

function add(target, code, message, file = '') {
    target.push({ code, message, file: file ? relative(file) : '' });
}

function walk(directory, predicate = () => true) {
    const result = [];
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
        if (['.git', 'dist', 'node_modules'].includes(entry.name)) continue;
        const absolute = path.join(directory, entry.name);
        if (entry.isDirectory()) result.push(...walk(absolute, predicate));
        else if (entry.isFile() && predicate(absolute)) result.push(absolute);
    }
    return result;
}

function read(file) {
    return readFileSync(file, 'utf8');
}

function escapeRegExp(value) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function resolveLocalReference(sourceFile, reference) {
    const clean = reference.split('#')[0].split('?')[0].trim();
    if (!clean || clean.startsWith('#') || clean.startsWith('//')) return null;
    if (/^(?:https?:|mailto:|tel:|data:)/i.test(clean)) return null;
    if (/^javascript:/i.test(clean)) return { unsafe: true, path: clean };
    const decoded = decodeURIComponent(clean);
    return {
        unsafe: false,
        path: path.resolve(path.dirname(sourceFile), decoded)
    };
}

function auditHtml(file) {
    const source = read(file);
    const mainCount = (source.match(/<main\b/gi) || []).length;
    const h1Count = (source.match(/<h1\b/gi) || []).length;

    if (!/<html\b[^>]*\blang=["']ko["']/i.test(source)) {
        add(errors, 'html.lang', 'html 요소에 lang="ko"가 필요합니다.', file);
    }
    if (mainCount !== 1) {
        add(errors, 'html.main', `main 랜드마크는 정확히 하나여야 합니다: ${mainCount}개`, file);
    }
    if (h1Count !== 1) {
        add(errors, 'html.h1', `페이지 제목 h1은 정확히 하나여야 합니다: ${h1Count}개`, file);
    }
    if (!/<title>\s*[^<]+\s*<\/title>/i.test(source)) {
        add(errors, 'html.title', '비어 있지 않은 title 요소가 필요합니다.', file);
    }
    if (!/<meta\b[^>]*charset=["']?utf-8/i.test(source.slice(0, 1024))) {
        add(errors, 'html.charset', '문서 첫 1KB 안에 UTF-8 charset 선언이 필요합니다.', file);
    }
    if (!/class=["'][^"']*skip-link/i.test(source)) {
        add(errors, 'html.skip_link', '본문 건너뛰기 링크가 없습니다.', file);
    }

    const ids = [...source.matchAll(/\bid=["']([^"']+)["']/gi)].map((match) => match[1]);
    const idSet = new Set(ids);
    const seenIds = new Set();
    for (const id of ids) {
        if (seenIds.has(id)) add(errors, 'html.id_duplicate', `중복 id: ${id}`, file);
        seenIds.add(id);
    }

    for (const match of source.matchAll(/\baria-(controls|labelledby|describedby)=["']([^"']+)["']/gi)) {
        for (const referencedId of match[2].trim().split(/\s+/)) {
            if (referencedId && !idSet.has(referencedId)) {
                add(errors, 'html.aria_reference', `aria-${match[1]} 대상이 없습니다: #${referencedId}`, file);
            }
        }
    }

    const skipTarget = source.match(/<a\b[^>]*class=["'][^"']*skip-link[^"']*["'][^>]*href=["']#([^"']+)["']/i)
        || source.match(/<a\b[^>]*href=["']#([^"']+)["'][^>]*class=["'][^"']*skip-link/i);
    if (skipTarget && !new RegExp(`\\bid=["']${escapeRegExp(skipTarget[1])}["']`, 'i').test(source)) {
        add(errors, 'html.skip_target', `본문 건너뛰기 대상이 없습니다: #${skipTarget[1]}`, file);
    }

    const viewport = source.match(/<meta\b[^>]*name=["']viewport["'][^>]*>/i)?.[0] || '';
    if (!viewport) add(errors, 'html.viewport', 'viewport 메타 태그가 없습니다.', file);
    if (/user-scalable\s*=\s*no|maximum-scale\s*=\s*1(?:\.0)?/i.test(viewport)) {
        add(errors, 'html.viewport_zoom', '사용자 확대를 차단하면 안 됩니다.', file);
    }
    if (/\son(?:click|change|input|submit|error|load|keydown|keyup|keypress)\s*=/i.test(source)) {
        add(errors, 'html.inline_handler', '인라인 이벤트 핸들러를 제거하세요.', file);
    }
    if (/\sstyle\s*=/i.test(source)) {
        add(warnings, 'html.inline_style', '인라인 style이 남아 있습니다.', file);
    }

    for (const match of source.matchAll(/<button\b[^>]*>/gi)) {
        if (!/\btype=["'](?:button|submit|reset)["']/i.test(match[0])) {
            add(errors, 'html.button_type', `button에 명시적 type이 없습니다: ${match[0].slice(0, 100)}`, file);
        }
    }

    const labelledIds = new Set(
        [...source.matchAll(/<label\b[^>]*\bfor=["']([^"']+)["'][^>]*>/gi)].map((match) => match[1])
    );
    for (const match of source.matchAll(/<(input|select|textarea)\b[^>]*>/gi)) {
        const tag = match[0];
        if (/^<input\b[^>]*\btype=["']hidden["']/i.test(tag)) continue;
        const id = tag.match(/\bid=["']([^"']+)["']/i)?.[1] || '';
        const hasAriaName = /\baria-(?:label|labelledby)=["'][^"']+["']/i.test(tag);
        const labelOpen = source.lastIndexOf('<label', match.index);
        const labelClose = source.lastIndexOf('</label>', match.index);
        const hasWrappingLabel = labelOpen > labelClose;
        if (!hasAriaName && !hasWrappingLabel && (!id || !labelledIds.has(id))) {
            add(errors, 'html.control_name', `폼 컨트롤에 연결된 레이블이 없습니다: ${tag.slice(0, 120)}`, file);
        }
    }

    for (const match of source.matchAll(/<button\b([^>]*)>([\s\S]*?)<\/button>/gi)) {
        const attributes = match[1];
        const content = match[2];
        const visibleText = content.replace(/<[^>]+>/g, '').replace(/&(?:[a-z]+|#\d+);/gi, ' ').trim();
        const hasAccessibleImage = /<img\b[^>]*\balt=["'][^"']+["']/i.test(content);
        const hasAriaName = /\baria-(?:label|labelledby)=["'][^"']+["']/i.test(attributes);
        if (!visibleText && !hasAccessibleImage && !hasAriaName) {
            add(errors, 'html.button_name', '아이콘 버튼에는 접근 가능한 이름이 필요합니다.', file);
        }
    }

    for (const match of source.matchAll(/<img\b[^>]*>/gi)) {
        if (!/\balt=["'][^"']*["']/i.test(match[0])) {
            add(errors, 'html.img_alt', `img에 alt 속성이 없습니다: ${match[0].slice(0, 100)}`, file);
        }
        const staticSource = match[0].match(/\bsrc=["']([^"']+)["']/i)?.[1] || '';
        if (staticSource && (!/\bwidth=["']?\d+/i.test(match[0]) || !/\bheight=["']?\d+/i.test(match[0]))) {
            add(warnings, 'html.img_dimensions', `img에 고유 크기(width/height)가 없습니다: ${match[0].slice(0, 100)}`, file);
        }
    }

    for (const match of source.matchAll(/<a\b[^>]*\btarget=["']_blank["'][^>]*>/gi)) {
        const rel = match[0].match(/\brel=["']([^"']*)["']/i)?.[1] || '';
        if (!/\bnoopener\b/i.test(rel) || !/\bnoreferrer\b/i.test(rel)) {
            add(errors, 'html.blank_rel', 'target="_blank" 링크에는 rel="noopener noreferrer"가 필요합니다.', file);
        }
    }

    if (/\bCONFIG\.VERSION\s*=/i.test(source)) {
        add(errors, 'html.config_mutation', '페이지에서 전역 CONFIG.VERSION을 덮어쓰면 안 됩니다.', file);
    }
    if (/\bload(?:CSS|JS)\s*\(/i.test(source)) {
        add(errors, 'html.dynamic_asset_loader', 'CSS와 JavaScript는 버전이 명시된 정적 태그로 로드하세요.', file);
    }

    for (const match of source.matchAll(/<script\b[^>]*\bsrc=["']([^"']+)["'][^>]*>/gi)) {
        const tag = match[0];
        const reference = match[1];
        if (/^(?:config|js)\//i.test(reference) && !/\bdefer\b/i.test(tag)) {
            add(errors, 'html.script_defer', `로컬 스크립트에는 defer가 필요합니다: ${reference}`, file);
        }
    }

    const attributePattern = /\b(?:src|href)=["']([^"']+)["']/gi;
    for (const match of source.matchAll(attributePattern)) {
        const reference = match[1];
        const resolved = resolveLocalReference(file, reference);
        if (!resolved) continue;
        if (resolved.unsafe) {
            add(errors, 'html.unsafe_url', `안전하지 않은 URL: ${match[1]}`, file);
        } else if (!existsSync(resolved.path)) {
            add(errors, 'html.missing_asset', `참조 파일이 없습니다: ${reference}`, file);
        }

        if (/^(?:config|css|js)\//i.test(reference)) {
            const url = new URL(reference, 'https://local.invalid/');
            if (!CONFIG_VERSION || url.searchParams.get('v') !== CONFIG_VERSION) {
                add(errors, 'html.asset_version', `자산 버전이 CONFIG와 다릅니다: ${reference}`, file);
            }
        }
    }
}

function auditCss(file) {
    const source = read(file);
    for (const match of source.matchAll(/url\(\s*["']?([^"')]+)["']?\s*\)/gi)) {
        const resolved = resolveLocalReference(file, match[1]);
        if (resolved && !resolved.unsafe && !existsSync(resolved.path)) {
            add(errors, 'css.missing_asset', `참조 파일이 없습니다: ${match[1]}`, file);
        }
    }
}

function auditJavaScript(file) {
    const source = read(file);
    const result = spawnSync(process.execPath, ['--check', file], {
        cwd: ROOT,
        encoding: 'utf8'
    });
    if (result.status !== 0) {
        add(errors, 'js.syntax', (result.stderr || result.stdout).trim(), file);
    }

    const specifiers = new Set();
    const patterns = [
        /\b(?:import|export)\s+[^;]*?\sfrom\s*["']([^"']+)["']/g,
        /\bimport\s*["']([^"']+)["']/g,
        /\bimport\s*\(\s*["']([^"']+)["']/g
    ];
    for (const pattern of patterns) {
        for (const match of source.matchAll(pattern)) specifiers.add(match[1]);
    }
    for (const specifier of specifiers) {
        if (!specifier.startsWith('.') && !specifier.startsWith('/')) continue;
        const resolved = resolveLocalReference(file, specifier);
        if (resolved && !resolved.unsafe && !existsSync(resolved.path)) {
            add(errors, 'js.missing_import', `모듈 참조 파일이 없습니다: ${specifier}`, file);
        }
        if (file.startsWith(path.join(ROOT, 'js') + path.sep)) {
            const url = new URL(specifier, 'https://local.invalid/');
            if (!CONFIG_VERSION || url.searchParams.get('v') !== CONFIG_VERSION) {
                add(errors, 'js.import_version', `브라우저 모듈 버전이 CONFIG와 다릅니다: ${specifier}`, file);
            }
        }
    }
}

function parseJson(file) {
    try {
        return JSON.parse(read(file));
    } catch (error) {
        add(errors, 'json.parse', error.message, file);
        return null;
    }
}

function auditData() {
    const dataDirectory = path.join(ROOT, 'data');
    const jsonFiles = walk(dataDirectory, (file) => file.endsWith('.json'));
    const parsed = new Map(jsonFiles.map((file) => [file, parseJson(file)]));

    const manifestFile = path.join(dataDirectory, 'character_manifest.json');
    const manifest = parsed.get(manifestFile);
    if (Array.isArray(manifest)) {
        const ids = new Set();
        for (const character of manifest) {
            const id = String(character?.id || '').trim();
            if (!id) add(errors, 'manifest.id_empty', '빈 캐릭터 ID가 있습니다.', manifestFile);
            else if (ids.has(id)) add(errors, 'manifest.id_duplicate', `중복 캐릭터 ID: ${id}`, manifestFile);
            ids.add(id);

            const imagePath = path.join(ROOT, String(character?.image_thumb || ''));
            if (!existsSync(imagePath)) {
                add(errors, 'manifest.image_missing', `이미지 없음: ${character?.image_thumb}`, manifestFile);
            } else if (path.extname(imagePath).toLowerCase() !== '.webp') {
                add(errors, 'manifest.image_format', `썸네일은 WebP여야 합니다: ${character?.image_thumb}`, manifestFile);
            }
        }
    }

    const unsafeProtocols = /^(?:javascript|data|file|vbscript):/i;
    for (const [file, value] of parsed) {
        function inspect(node, keyPath = '') {
            if (Array.isArray(node)) {
                node.forEach((item, index) => inspect(item, `${keyPath}[${index}]`));
                return;
            }
            if (!node || typeof node !== 'object') return;
            for (const [key, child] of Object.entries(node)) {
                const nextPath = keyPath ? `${keyPath}.${key}` : key;
                if (/url$/i.test(key) && typeof child === 'string' && unsafeProtocols.test(child.trim())) {
                    add(errors, 'data.unsafe_url', `${nextPath}: ${child}`, file);
                }
                inspect(child, nextPath);
            }
        }
        inspect(value);
    }

    const patchNotes = parsed.get(path.join(dataDirectory, 'patch_notes.json'));
    const latestVersion = Array.isArray(patchNotes) ? String(patchNotes[0]?.version || '') : '';
    if (!CONFIG_VERSION || !latestVersion || !CONFIG_VERSION.startsWith(latestVersion)) {
        add(errors, 'version.drift', `CONFIG ${CONFIG_VERSION || '(없음)'} / 패치 노트 ${latestVersion || '(없음)'}`);
    }
}

function auditRepositoryAssets() {
    const imageDirectory = path.join(ROOT, 'images');
    for (const file of walk(imageDirectory)) {
        const extension = path.extname(file).toLowerCase();
        const isSocialPreview = path.resolve(file) === path.join(imageDirectory, 'background.png');
        if (extension === '.png' && !isSocialPreview) {
            add(errors, 'asset.runtime_png', '런타임 이미지는 WebP를 사용하세요.', file);
        }
        if (['.jpg', '.jpeg', '.zip', '.psd', '.ai', '.map'].includes(extension)) {
            add(errors, 'asset.source_artifact', 'images/에는 런타임 WebP와 소셜 미리보기 PNG만 둘 수 있습니다.', file);
        }
    }
}

const htmlFiles = readdirSync(ROOT, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith('.html'))
    .map((entry) => path.join(ROOT, entry.name));
const cssFiles = walk(path.join(ROOT, 'css'), (file) => file.endsWith('.css'));
const jsFiles = [
    ...walk(path.join(ROOT, 'js'), (file) => file.endsWith('.js') || file.endsWith('.mjs')),
    ...walk(path.join(ROOT, 'config'), (file) => file.endsWith('.js') || file.endsWith('.mjs')),
    ...walk(path.join(ROOT, 'workers'), (file) => file.endsWith('.js') || file.endsWith('.mjs')),
    ...walk(path.join(ROOT, 'tools'), (file) => file.endsWith('.js') || file.endsWith('.mjs'))
];

htmlFiles.forEach(auditHtml);
cssFiles.forEach(auditCss);
jsFiles.forEach(auditJavaScript);
auditData();
auditRepositoryAssets();

for (const issue of errors) {
    console.error(`[ERROR] ${issue.code}${issue.file ? ` (${issue.file})` : ''}: ${issue.message}`);
}
for (const issue of warnings) {
    console.warn(`[WARN] ${issue.code}${issue.file ? ` (${issue.file})` : ''}: ${issue.message}`);
}

console.log(`Site audit: ${errors.length} error(s), ${warnings.length} warning(s).`);
process.exitCode = errors.length > 0 ? 1 : 0;
