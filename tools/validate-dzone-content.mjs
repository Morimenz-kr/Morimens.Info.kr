// Validate published output only; data generation is maintained privately.
export function validateDzoneContent(document) {
  if (!document.contentAudit) return; // Archived pre-semantic snapshots keep their existing checks.
  if (document.contentAudit.diagnostics?.length) throw new Error('Unresolved D-Zone content diagnostics');
  for (const match of JSON.stringify(document.waves).matchAll(/<(kw_[a-f0-9]{16}):/g)) {
    if (!document.keywordGlossary?.[match[1]]?.description) throw new Error(`Missing D-Zone reference ${match[1]}`);
  }
  for (const item of Object.values(document.keywordGlossary || {})) {
    if (!item.source?.id || /\[(?:[A-Za-z]+:)?(?:Arg|StateArg|DescArg)\d+\]|NaN|\[object Object\]/.test(item.description)) throw new Error(`Invalid D-Zone tooltip ${item.name}`);
  }
}

