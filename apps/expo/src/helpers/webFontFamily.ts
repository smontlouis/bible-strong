const SYSTEM_SANS = 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'

/** Preserve a chosen face when installed, with a deliberate browser fallback. */
export const webFontFamily = (fontFamily?: string): string => {
  if (!fontFamily || ['System', 'normal', 'Roboto'].includes(fontFamily)) return SYSTEM_SANS
  if (fontFamily.includes(',')) return fontFamily
  if (['serif', 'sans-serif', 'monospace', 'system-ui'].includes(fontFamily)) return fontFamily
  const serif = [
    'Literata Book',
    'Georgia',
    'Times New Roman',
    'Baskerville',
    'Didot',
    'Iowan Old Style',
    'American Typewriter',
  ]
  if (serif.includes(fontFamily)) return `${JSON.stringify(fontFamily)}, Georgia, serif`
  if (fontFamily === 'FiraCode') return '"FiraCode", ui-monospace, monospace'
  return `${JSON.stringify(fontFamily)}, ${SYSTEM_SANS}`
}
