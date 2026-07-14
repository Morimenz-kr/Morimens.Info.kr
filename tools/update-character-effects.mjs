import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import {
    getCharacterEffectShardPath,
    serializeDeterministicJson
} from '../shared/runtime-data-shards.js';

const ROOT = path.resolve(import.meta.dirname, '..');
const DATA_PATH = path.join(ROOT, 'data', 'character_effects.json');
const MANIFEST_PATH = path.join(ROOT, 'data', 'character_manifest.json');
const MAIN_CARD_TYPES = new Set(['명령', '영지 각성', '최종 법칙', '광기 폭발', '초월 폭발']);
const DERIVED_CARD_TYPES = new Set(['파생 명령', '버프', '증상', '추가 공격']);
const ALL_CARD_TYPES = new Set([...MAIN_CARD_TYPES, ...DERIVED_CARD_TYPES]);

function decodeEntities(value) {
    return value
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&#91;/g, '[')
        .replace(/&#93;/g, ']')
        .replace(
            /&#x([0-9a-f]+);/gi,
            (_, hex) => String.fromCodePoint(parseInt(hex, 16))
        )
        .replace(
            /&#(\d+);/g,
            (_, decimal) => String.fromCodePoint(parseInt(decimal, 10))
        );
}

function removeBlocks(html, tagName) {
    const open = `<${tagName}`;
    const close = `</${tagName}>`;
    let result = '';
    let cursor = 0;

    while (cursor < html.length) {
        const start = html.indexOf(open, cursor);
        if (start < 0) {
            result += html.slice(cursor);
            break;
        }

        result += html.slice(cursor, start);
        const end = html.indexOf(close, start);
        if (end < 0) break;
        cursor = end + close.length;
    }

    return result;
}

function htmlToText(html) {
    const withoutScripts = removeBlocks(removeBlocks(html, 'script'), 'style');
    return decodeEntities(
        withoutScripts
            .replace(/<br\s*\/?\s*>/gi, '\n')
            .replace(
                /<\/p>|<\/div>|<\/tr>|<\/h[1-6]>|<\/li>|<\/table>|<\/section>/gi,
                '\n'
            )
            .replace(/<[^>]+>/g, ' ')
    )
        .replace(/\r/g, '')
        .replace(/[ \t]+/g, ' ')
        .replace(/\n\s*\n+/g, '\n')
        .trim();
}

function extractSection(text, heading, nextHeading) {
    const startPattern = new RegExp(
        `(?:^|\\n)\\s*\\d+(?:\\.\\d+)+\\.\\s*${heading}\\s*\\[편집\\]`
    );
    const startMatch = text.match(startPattern);
    if (!startMatch) return '';

    const start = startMatch.index;
    const rest = text.slice(start + startMatch[0].length);
    const endPattern = new RegExp(
        `(?:^|\\n)\\s*\\d+(?:\\.\\d+)+\\.\\s*${nextHeading}\\s*\\[편집\\]`
    );
    const endMatch = rest.match(endPattern);
    const end = endMatch
        ? start + startMatch[0].length + endMatch.index
        : text.length;

    return text.slice(start, end).trim();
}

function normalizeTerminology(value) {
    return value
        .replaceAll('리모리아', '레무리아')
        .replaceAll('나선원무', '레무리아의 왈츠')
        .replaceAll('나선역류', '레무리아의 역류')
        .replaceAll('나선재림', '레무리아의 재림');
}

function cleanEffect(value) {
    return normalizeTerminology(value)
        .replace(/\s*\[[^\]]+]\s*/g, ' ')
        .replace(/\s*[\(\{]\s*돌파\s*\d+\s*\|[^)\}]*[\)\}]\s*/g, ' ')
        .replace(/\s+/g, ' ')
        .replace(/\s+([,.])/g, '$1')
        .trim();
}

function parseLevelTable(block) {
    const tableStart = block.match(/(?:^|\n)\s*레벨\s*(?:\n|$)/);
    if (!tableStart) return undefined;

    const lines = block
        .slice(tableStart.index + tableStart[0].length)
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean);
    const firstLevel = lines.findIndex((line) => /^Lv\.\d+$/.test(line));
    if (firstLevel < 0) return undefined;

    const columns = lines.slice(0, firstLevel);
    if (columns.length === 0) return undefined;

    const levels = [];
    let cursor = firstLevel;
    while (cursor < lines.length) {
        const levelMatch = lines[cursor].match(/^Lv\.(\d+)$/);
        if (!levelMatch) break;

        const values = lines.slice(cursor + 1, cursor + 1 + columns.length);
        if (values.length !== columns.length) break;

        levels.push({
            level: Number(levelMatch[1]),
            ...Object.fromEntries(
                columns.map((column, index) => [column, values[index]])
            )
        });
        cursor += columns.length + 1;
    }

    return levels.length > 0 ? levels : undefined;
}

function extractCards(section, allowedTypes) {
    const typePattern = [...ALL_CARD_TYPES]
        .map((type) => type.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
        .join('|');
    const pattern = new RegExp(
        `(?:^|\\n)\\s*(${typePattern})\\s*\\n\\s*([^\\n]+?)(?:\\s+(산출력|광기) 소모:\\s*(\\d+)|\\s+영지 각성 강화)\\s*(?:\\n|$)`,
        'g'
    );
    const matches = [...section.matchAll(pattern)];

    return matches.flatMap((match, index) => {
        if (!allowedTypes.has(match[1])) return [];

        const next = matches[index + 1];
        const precedingText = section.slice(0, match.index);
        const headingMatches = [
            ...precedingText.matchAll(
                /(?:^|\n)\s*\d+(?:\.\d+)+\.\s*([^\n]+?)\s*\[편집\]/g
            )
        ];
        const context = normalizeTerminology(
            headingMatches.at(-1)?.[1]?.replace(/\s+/g, ' ').trim() ?? ''
        );
        const block = section.slice(
            match.index + match[0].length,
            next?.index ?? section.length
        );
        const effect = block
            .split('\n')
            .map((line) => line.trim())
            .find(Boolean);
        const card = {
            type: match[1],
            name: normalizeTerminology(match[2].trim()),
            context
        };

        if (match[3]) {
            card.cost = {
                type: match[3],
                value: Number(match[4])
            };
        }

        card.effect = cleanEffect(effect);
        const levels = parseLevelTable(block);
        if (levels) card.levels = levels;
        return [card];
    });
}

function extractSkills(section) {
    const skills = extractCards(section, MAIN_CARD_TYPES);

    return groupSkillVariants(skills);
}

function extractDerivedCards(section) {
    const cards = extractCards(section, DERIVED_CARD_TYPES).map(({ context, ...card }) => ({
        ...card,
        ...(context ? { context } : {})
    }));

    return groupNamedVariants(cards);
}

function groupNamedVariants(cards) {
    const groups = new Map();
    for (const card of cards) {
        const key = `${card.type}::${card.name}`;
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key).push(card);
    }

    return [...groups.values()].map((group) => {
        if (group.length === 1) {
            const { context, ...single } = group[0];
            return single;
        }

        const { type, name } = group[0];
        return {
            type,
            name,
            variants: group.map(({ type: _type, context, ...variant }) => {
                if (context) variant.condition = context;
                return variant;
            })
        };
    });
}

function groupSkillVariants(skills) {
    const variantTypes = new Set(['영지 각성', '광기 폭발']);
    const groupedTypes = new Set();
    const result = [];

    for (const skill of skills) {
        if (!variantTypes.has(skill.type)) {
            const { context, ...plainSkill } = skill;
            result.push(plainSkill);
            continue;
        }
        if (groupedTypes.has(skill.type)) continue;

        const sameType = skills.filter((item) => item.type === skill.type);
        groupedTypes.add(skill.type);

        if (sameType.length === 1) {
            const { context, ...plainSkill } = skill;
            result.push(plainSkill);
            continue;
        }

        const variants = sameType.map((item) => {
            const { type, context, ...variant } = item;
            const condition = context.includes(' - ')
                ? context.slice(context.lastIndexOf(' - ') + 3).trim()
                : undefined;
            if (condition) variant.condition = condition;
            return variant;
        });

        result.push({
            type: skill.type,
            name: skill.name,
            variants
        });
    }

    return result;
}

function extractEnlighten(section) {
    const tableStart = section.match(
        /(?:^|\n)\s*(?:돌파|계령)\s*\n\s*설명\s*(?:\n|$)/
    );
    if (!tableStart) return [];

    const lines = section
        .slice(tableStart.index + tableStart[0].length)
        .split(/\n\s*인격 심화/, 1)[0]
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean);
    const items = [];

    for (let index = 0; index + 1 < lines.length; index += 2) {
        items.push({
            name: normalizeTerminology(lines[index]),
            effect: cleanEffect(lines[index + 1])
        });
    }

    return items;
}

async function readJson(filePath, fallback) {
    try {
        return JSON.parse(await fs.readFile(filePath, 'utf8'));
    } catch (error) {
        if (error.code === 'ENOENT') return fallback;
        throw error;
    }
}

async function readSource(source) {
    if (/^https?:\/\//.test(source)) {
        const response = await fetch(source, {
            headers: {
                'User-Agent':
                    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/137 Safari/537.36'
            },
            redirect: 'follow'
        });
        if (!response.ok) {
            throw new Error(`문서 요청 실패: HTTP ${response.status}`);
        }
        return response.text();
    }

    return fs.readFile(path.resolve(source), 'utf8');
}

function validateCharacter(character) {
    if (character.skills.length === 0) {
        throw new Error('스킬을 찾지 못했습니다.');
    }
    if (character.enlighten.length !== 5) {
        throw new Error(
            `계령 3개, 초월 폭발, 최종 법칙을 합쳐 5개여야 하지만 ${character.enlighten.length}개를 찾았습니다.`
        );
    }
    if (character.skills.some((skill) => !skill.effect)) {
        const invalid = character.skills.filter(
            (skill) =>
                !skill.effect &&
                (!skill.variants ||
                    skill.variants.length === 0 ||
                    skill.variants.some((variant) => !variant.effect))
        );
        if (invalid.length > 0) {
            throw new Error('효과가 없는 스킬이 있습니다.');
        }
    }
    if (
        character.skills.filter((skill) => skill.type === '영지 각성').length !==
        1
    ) {
        throw new Error('영지 각성은 캐릭터당 하나여야 합니다.');
    }
    if (
        character.enlighten.filter((item) => item.type === '최종 법칙').length !==
        1
    ) {
        throw new Error('최종 법칙은 캐릭터당 하나여야 합니다.');
    }
    if (
        character.enlighten.filter((item) => item.type === '초월 폭발').length !==
        1
    ) {
        throw new Error('초월 폭발은 캐릭터당 하나여야 합니다.');
    }
}

const [characterId, source] = process.argv.slice(2);
if (!characterId || !source) {
    console.error(
        '사용법: node tools/update-character-effects.mjs <character-id> <나무위키 URL 또는 HTML 파일>'
    );
    process.exit(1);
}

const manifest = await readJson(MANIFEST_PATH, []);
if (!manifest.some((character) => String(character.id) === characterId)) {
    throw new Error(
        `character_manifest.json에 '${characterId}' 캐릭터가 없습니다. 매니페스트를 먼저 추가하세요.`
    );
}

const html = await readSource(source);
const text = htmlToText(html);
const skillsSection = extractSection(text, '스킬', '계령');
const enlightenSection = extractSection(text, '계령', '특성');
const extractedSkills = extractSkills(skillsSection);
const enlightenTypes = new Set(['초월 폭발', '최종 법칙']);
const enlightenOrder = new Map([
    ['초월 폭발', 0],
    ['최종 법칙', 1]
]);
const character = {
    skills: extractedSkills.filter((skill) => !enlightenTypes.has(skill.type)),
    derivedCards: extractDerivedCards(skillsSection),
    enlighten: [
        ...extractEnlighten(enlightenSection),
        ...extractedSkills
            .filter((skill) => enlightenTypes.has(skill.type))
            .sort((left, right) => enlightenOrder.get(left.type) - enlightenOrder.get(right.type))
    ]
};

validateCharacter(character);

const data = await readJson(DATA_PATH, {});
data[characterId] = {
    ...data[characterId],
    ...character
};

const ordered = Object.fromEntries(
    manifest
        .map((item) => String(item.id))
        .filter((id) => data[id])
        .map((id) => [id, data[id]])
);

const shardPath = path.resolve(ROOT, ...getCharacterEffectShardPath(characterId).split('/'));
await fs.mkdir(path.dirname(shardPath), { recursive: true });
await Promise.all([
    fs.writeFile(DATA_PATH, `${JSON.stringify(ordered, null, 2)}\n`, 'utf8'),
    fs.writeFile(shardPath, serializeDeterministicJson(ordered[characterId]), 'utf8')
]);
console.log(
    `${characterId}: 스킬 ${character.skills.length}개, 파생 ${character.derivedCards.length}개, 계령 ${character.enlighten.length}개와 런타임 샤드 저장`
);
