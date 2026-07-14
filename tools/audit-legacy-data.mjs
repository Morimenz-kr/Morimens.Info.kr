import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const DATA_DIR = path.join(ROOT, 'data');
const SELF = path.resolve(import.meta.filename);
const SOURCE_EXTENSIONS = new Set(['.html', '.js', '.mjs', '.css']);
const EXCLUDED_DIRS = new Set(['.git', 'node_modules', '.agents', '.codex']);
const EXCLUDED_FILES = new Set([
  'repomix-output.xml',
  'audit-detail-data-migration.mjs'
]);

function toPosix(relativePath) {
  return relativePath.replace(/\\/g, '/');
}

function rel(filePath) {
  return toPosix(path.relative(ROOT, filePath));
}

function listFiles(dir, predicate = () => true) {
  if (!fs.existsSync(dir)) return [];
  const result = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      result.push(...listFiles(fullPath, predicate));
    } else if (predicate(fullPath)) {
      result.push(fullPath);
    }
  }
  return result;
}

function listSourceFiles(dir) {
  const result = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (EXCLUDED_DIRS.has(entry.name)) continue;

    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      result.push(...listSourceFiles(fullPath));
      continue;
    }

    if (EXCLUDED_FILES.has(entry.name)) continue;
    if (path.resolve(fullPath) === SELF) continue;
    if (SOURCE_EXTENSIONS.has(path.extname(entry.name).toLowerCase())) result.push(fullPath);
  }
  return result;
}

function findReferences(sourceFiles, candidate) {
  const relativePath = rel(candidate);
  const basename = path.basename(candidate);
  const needles = new Set([
    relativePath,
    relativePath.replace(/\//g, '\\'),
    basename
  ]);

  const references = [];
  for (const file of sourceFiles) {
    const text = fs.readFileSync(file, 'utf8');
    for (const needle of needles) {
      if (text.includes(needle)) {
        references.push({ file: rel(file), needle });
        break;
      }
    }
  }
  return references;
}

function findDynamicAwakenerReferences(sourceFiles) {
  const references = [];
  const patterns = [
    'data/awakener/',
    'data\\awakener\\',
    'awakener/${',
    'awakener/${charId}',
    'awakener/`'
  ];

  for (const file of sourceFiles) {
    const text = fs.readFileSync(file, 'utf8');
    if (patterns.some((pattern) => text.includes(pattern))) references.push(rel(file));
  }
  return references;
}

function printReferenceList(references) {
  if (references.length === 0) {
    console.log('    refs: none');
    return;
  }
  for (const reference of references) {
    console.log(`    refs: ${reference.file} (${reference.needle})`);
  }
}

function main() {
  const dbFiles = listFiles(DATA_DIR, (filePath) => path.basename(filePath).startsWith('db_') && path.extname(filePath) === '.json');
  const awakenerFiles = listFiles(path.join(DATA_DIR, 'awakener'), (filePath) => path.extname(filePath) === '.json');
  const sourceFiles = listSourceFiles(ROOT);
  const dynamicAwakenerReferences = findDynamicAwakenerReferences(sourceFiles);

  console.log('Legacy data audit');
  console.log(`Source files scanned: ${sourceFiles.length}`);
  console.log('');

  console.log('data/db_*.json');
  if (dbFiles.length === 0) {
    console.log('  none');
  }
  for (const file of dbFiles) {
    const references = findReferences(sourceFiles, file);
    const status = references.length > 0 ? 'referenced' : 'no-static-reference';
    console.log(`  - ${rel(file)}: ${status}`);
    printReferenceList(references);
  }

  console.log('');
  console.log('data/awakener/*.json');
  if (awakenerFiles.length === 0) {
    console.log('  none');
  }
  if (dynamicAwakenerReferences.length > 0) {
    console.log(`  dynamic directory refs: ${dynamicAwakenerReferences.join(', ')}`);
  }
  for (const file of awakenerFiles) {
    const references = findReferences(sourceFiles, file);
    const status = references.length > 0 || dynamicAwakenerReferences.length > 0
      ? 'possibly-referenced'
      : 'no-static-reference';
    console.log(`  - ${rel(file)}: ${status}`);
    printReferenceList(references);
  }

  console.log('');
  console.log('Recommendation: do not delete referenced legacy data until detail.js is migrated to the normalized character data flow.');
}

main();
