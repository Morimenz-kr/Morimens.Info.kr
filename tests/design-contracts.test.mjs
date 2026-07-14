import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { ROOT, relativeTo, walkFiles } from './helpers/site-fixture.mjs';

const TAG_TOKEN_NAMES = [
    'color-chaos',
    'color-aequor',
    'color-caro',
    'color-ultra',
    'color-assault',
    'color-warden',
    'color-chorus',
    'color-sr'
];

function tokenValue(css, tokenName) {
    const match = css.match(new RegExp(`--${tokenName}\\s*:\\s*(#[0-9a-f]{6})\\s*;`, 'i'));
    assert.ok(match, `missing hexadecimal CSS token: --${tokenName}`);
    return match[1].toLowerCase();
}

function relativeLuminance(hex) {
    const channels = hex.slice(1).match(/.{2}/g).map(channel => parseInt(channel, 16) / 255);
    const linear = channels.map(channel => channel <= 0.04045
        ? channel / 12.92
        : ((channel + 0.055) / 1.055) ** 2.4);
    return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
}

function contrastRatio(first, second) {
    const luminances = [relativeLuminance(first), relativeLuminance(second)].sort((left, right) => right - left);
    return (luminances[0] + 0.05) / (luminances[1] + 0.05);
}

test('small realm, role, and grade tags retain WCAG AA color contrast', async () => {
    const [tokensCss, componentsCss] = await Promise.all([
        readFile(path.join(ROOT, 'css', 'common.css'), 'utf8'),
        readFile(path.join(ROOT, 'css', 'components.css'), 'utf8')
    ]);

    assert.match(
        componentsCss,
        /\.relems-tag\s*,\s*\.tag\s*\{[^}]*color:\s*var\(--color-text-on-strong\)\s*;[^}]*font-size:\s*0\.75rem\s*;/s,
        'small tag foreground must use the shared primary text token and remain explicitly sized'
    );

    const tagForeground = tokenValue(tokensCss, 'color-text-on-strong');
    for (const tokenName of TAG_TOKEN_NAMES) {
        const className = tokenName.replace('color-', '');
        assert.match(
            componentsCss,
            new RegExp(`\\.${className}[^}]*background\\s*:\\s*var\\(--${tokenName}\\)`, 's'),
            `.${className} must use --${tokenName}`
        );
        const ratio = contrastRatio(tagForeground, tokenValue(tokensCss, tokenName));
        assert.ok(ratio >= 4.5, `primary text on --${tokenName} has insufficient contrast: ${ratio.toFixed(2)}:1`);
    }

    assert.match(
        componentsCss,
        /\.tag\.ssr\s*\{[^}]*background:\s*var\(--color-ssr\)\s*;[^}]*color:\s*var\(--color-accent-ink\)\s*;/s,
        'SSR tags must use the dark accent foreground'
    );
    const ssrRatio = contrastRatio(
        tokenValue(tokensCss, 'color-accent-ink'),
        tokenValue(tokensCss, 'color-ssr')
    );
    assert.ok(ssrRatio >= 4.5, `SSR tag has insufficient contrast: ${ssrRatio.toFixed(2)}:1`);
});

test('page and component styles consume the shared semantic color tokens', async () => {
    const cssRoot = path.join(ROOT, 'css');
    const files = (await walkFiles(cssRoot))
        .filter(file => file.endsWith('.css') && path.basename(file) !== 'common.css');
    const rawColorPattern = /#[0-9a-f]{3,8}\b|rgba?\s*\(/i;

    for (const file of files) {
        const source = await readFile(file, 'utf8');
        assert.doesNotMatch(
            source,
            rawColorPattern,
            `${relativeTo(ROOT, file)} must use semantic color tokens instead of raw color literals`
        );
    }
});

test('shared classic-script namespaces expose immutable public APIs only', async () => {
    const contracts = [
        ['js/ui/dialog.js', 'SiteDialog'],
        ['js/search_utils.js', 'SearchUtils'],
        ['js/character-effects.js', 'CharacterEffects']
    ];

    for (const [relativePath, namespace] of contracts) {
        const source = await readFile(path.join(ROOT, relativePath), 'utf8');
        assert.match(
            source,
            new RegExp(`window\\.${namespace}\\s*=\\s*Object\\.freeze\\(`),
            `${relativePath} must freeze window.${namespace}`
        );
    }
});

test('narrow cards and effect tabs reflow under enlarged Korean text', async () => {
    const [components, effects] = await Promise.all([
        readFile(path.join(ROOT, 'css/components.css'), 'utf8'),
        readFile(path.join(ROOT, 'css/character-effects.css'), 'utf8')
    ]);

    assert.match(
        components,
        /\.character-card h3\s*\{[^}]*overflow-wrap:\s*anywhere\s*;[^}]*word-break:\s*normal\s*;/s
    );
    assert.match(
        effects,
        /@media \(max-width:\s*600px\)[\s\S]*\.character-effects-switch\s*\{[^}]*display:\s*grid\s*;[^}]*grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)\s*;/s
    );
    assert.match(
        effects,
        /\.character-effects-switch button\s*\{[^}]*overflow-wrap:\s*anywhere\s*;[^}]*white-space:\s*normal\s*;/s
    );
});
