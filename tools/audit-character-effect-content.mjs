import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const effectsPath = path.join(rootDir, 'data', 'character_effects.json');
const manifestPath = path.join(rootDir, 'data', 'character_manifest.json');
const tooltipsPath = path.join(rootDir, 'data', 'db_tooltips.json');

const effectsByCharacter = JSON.parse(fs.readFileSync(effectsPath, 'utf8'));
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
const tooltips = JSON.parse(fs.readFileSync(tooltipsPath, 'utf8'));
const characterNames = new Map(manifest.map(character => [character.id, character.name]));
const nonTooltipBracketTerms = new Set(['성신편']);
const confirmedSupplementalLevelTables = new Set([
    'ogier:헌신의 결의'
]);
const confirmedDetachedChoiceDetails = new Set([
    'tawil:여섯 개의 날개가 만개하다'
]);

const findings = [];
const bracketTerms = new Map();
const tooltipOccurrences = new Map(Object.keys(tooltips).map(keyword => [keyword, 0]));

function addFinding(severity, code, context, detail) {
    findings.push({ severity, code, ...context, detail });
}

function effectItems(character) {
    const items = [];
    const visit = (value, section, trail = []) => {
        if (Array.isArray(value)) {
            value.forEach((item, index) => visit(item, section, [...trail, index]));
            return;
        }
        if (!value || typeof value !== 'object') return;

        if (typeof value.effect === 'string') {
            items.push({ item: value, section, trail });
        }
        if (Array.isArray(value.variants)) {
            value.variants.forEach((variant, index) => visit(variant, section, [...trail, 'variants', index]));
        }
    };

    for (const section of ['skills', 'derivedCards', 'enlighten', 'traits']) {
        visit(character[section] || [], section);
    }
    if (character.dimensionalImage?.effect) {
        visit(character.dimensionalImage, 'dimensionalImage');
    }
    return items;
}

function hasUnresolvedPlaceholder(text) {
    return /(?:\*n|(?<![가-힣A-Za-z])n)(?:%|점)?|(?<![가-힣A-Za-z*])[lm](?:%|점)?|\bl\s*\/\s*m\s*\/\s*n\b/i.test(text);
}

function isChoiceEffect(text) {
    return text.split(/[.\n]/).some(sentence => {
        if (!/(?:또는|중)\s*[^.\n]{0,100}(?:선택|택한다)/.test(sentence)) return false;

        const selectsTargetOrCard = /(?:카드|각성체|적|아군|유물|은열쇠)[^.]*(?:선택|택한다)/.test(sentence);
        const namesExplicitOptions = /'[^']+'[^.]*?(?:또는|중)[^.]*?(?:선택|택한다)/.test(sentence);
        return !selectsTargetOrCard || namesExplicitOptions;
    });
}

function levelKeys(levels) {
    return [...new Set((levels || []).flatMap(level => Object.keys(level).filter(key => key !== 'level')))];
}

function inspectItem(characterId, entry) {
    const { item, section, trail } = entry;
    const text = item.effect;
    const context = {
        characterId,
        characterName: characterNames.get(characterId) || characterId,
        section,
        name: item.name || '(이름 없음)',
        trail: trail.join('.')
    };
    const keys = levelKeys(item.levels);
    const itemKey = `${characterId}:${item.name || ''}`;

    if (hasUnresolvedPlaceholder(text) && !item.levels?.length) {
        addFinding('error', 'placeholder-without-levels', context, '치환 문자가 있지만 레벨 데이터가 없습니다.');
    }

    if (
        item.levels?.length &&
        keys.length &&
        !hasUnresolvedPlaceholder(text) &&
        !confirmedSupplementalLevelTables.has(itemKey)
    ) {
        addFinding(
            'warning',
            'level-values-not-referenced',
            context,
            `본문에 치환 문자가 없지만 레벨 수치 필드가 있습니다: ${keys.join(', ')}`
        );
    }

    const hasInlineChoiceList = /(?:^|\n)-\s+[^:\n]+:\s+/.test(text);
    if (
        isChoiceEffect(text) &&
        !item.variants?.length &&
        !hasInlineChoiceList &&
        !confirmedDetachedChoiceDetails.has(itemKey)
    ) {
        addFinding('warning', 'choice-without-variants', context, '선택형 효과이지만 variants 구조가 없습니다.');
    }

    for (const match of text.matchAll(/\[([^\]]+)\]/g)) {
        const keyword = match[1].trim();
        if (!bracketTerms.has(keyword)) bracketTerms.set(keyword, []);
        bracketTerms.get(keyword).push(context);
    }

    for (const keyword of Object.keys(tooltips)) {
        if (text.includes(keyword)) {
            tooltipOccurrences.set(keyword, tooltipOccurrences.get(keyword) + 1);
        }
    }
}

for (const [characterId, character] of Object.entries(effectsByCharacter)) {
    if (!characterNames.has(characterId)) {
        addFinding('error', 'unknown-character-id', {
            characterId,
            characterName: characterId,
            section: 'root',
            name: '(캐릭터)',
            trail: ''
        }, 'character_manifest.json에 없는 캐릭터 ID입니다.');
    }
    effectItems(character).forEach(entry => inspectItem(characterId, entry));
}

for (const character of manifest) {
    if (!effectsByCharacter[character.id]) {
        addFinding('error', 'missing-character-effects', {
            characterId: character.id,
            characterName: character.name,
            section: 'root',
            name: '(캐릭터)',
            trail: ''
        }, 'character_effects.json에 캐릭터 데이터가 없습니다.');
    }
}

for (const [keyword, contexts] of bracketTerms) {
    if (!tooltips[keyword] && !nonTooltipBracketTerms.has(keyword)) {
        addFinding('info', 'unknown-bracket-term', contexts[0], `툴팁 사전에 없는 대괄호 표기입니다: ${keyword}`);
    }
}

const severityOrder = new Map([['error', 0], ['warning', 1], ['info', 2]]);
findings.sort((left, right) => (
    severityOrder.get(left.severity) - severityOrder.get(right.severity) ||
    left.characterName.localeCompare(right.characterName, 'ko') ||
    left.name.localeCompare(right.name, 'ko')
));

const summary = {
    manifestCharacters: manifest.length,
    effectCharacters: Object.keys(effectsByCharacter).length,
    inspectedEffects: Object.values(effectsByCharacter).reduce((sum, character) => sum + effectItems(character).length, 0),
    findings: {
        error: findings.filter(item => item.severity === 'error').length,
        warning: findings.filter(item => item.severity === 'warning').length,
        info: findings.filter(item => item.severity === 'info').length
    },
    codes: Object.fromEntries([...new Set(findings.map(item => item.code))].map(code => [
        code,
        findings.filter(item => item.code === code).length
    ])),
    bracketTerms: bracketTerms.size,
    tooltipTerms: Object.keys(tooltips).length,
    unusedTooltipTerms: [...tooltipOccurrences].filter(([, count]) => count === 0).map(([keyword]) => keyword)
};

if (process.argv.includes('--json')) {
    process.stdout.write(`${JSON.stringify({ summary, findings }, null, 2)}\n`);
} else {
    console.log(JSON.stringify(summary, null, 2));
    for (const finding of findings) {
        console.log(
            `[${finding.severity.toUpperCase()}] ${finding.characterName} / ${finding.section} / ${finding.name}` +
            `\n  ${finding.code}: ${finding.detail}`
        );
    }
}
