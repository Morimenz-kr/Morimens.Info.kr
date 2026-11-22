// Validate published output only; data generation is maintained privately.
export function validateDzoneContent(document) {
  if (!document.contentAudit) return; // Archived pre-semantic snapshots keep their existing checks.
  if (document.contentAudit.diagnostics?.length) throw new Error('Unresolved D-Zone content diagnostics');
  const presentation = document.contentAudit.presentationAudit;
  if (presentation?.issues?.length) throw new Error('Unresolved D-Zone presentation audit');
  for (const [key, icon] of Object.entries(presentation?.expectedKeywordIcons || {})) {
    if (document.keywordGlossary?.[key]?.icon !== icon) throw new Error(`Invalid D-Zone keyword icon ${key}`);
  }
  for (const match of JSON.stringify([document.waves, document.keywordGlossary]).matchAll(/<(kw_[a-f0-9]{16}):/g)) {
    if (!document.keywordGlossary?.[match[1]]?.description) throw new Error(`Missing D-Zone reference ${match[1]}`);
  }
  for (const [key, expected] of Object.entries(presentation?.expectedTooltipReferences || {})) {
    const references = new Set([...String(document.keywordGlossary?.[key]?.richDescription || '').matchAll(/<(kw_[a-f0-9]{16}):/g)].map(match => match[1]));
    for (const target of expected) if (!references.has(target)) throw new Error(`Missing D-Zone tooltip link ${key} -> ${target}`);
  }
  for (const item of Object.values(document.keywordGlossary || {})) {
    if (!item.source?.id || /\[(?:[A-Za-z]+:)?(?:Arg|StateArg|DescArg)\d+\]|NaN|\[object Object\]/.test(JSON.stringify([item.description, item.richDescription]))) throw new Error(`Invalid D-Zone tooltip ${item.name}`);
  }
}

