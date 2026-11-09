const SYSTEM_SANS = 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'

/**
 * The interface face, as on the site, then Arial scaled to its width until it arrives
 * (`global.web.css`), then the system sans for the letters it lacks (Greek, Hebrew, macrons).
 */
export const PULP_DISPLAY_STACK = `"Pulp Display", "Pulp Display Fallback", ${SYSTEM_SANS}`

/**
 * The face of a transliteration (ʾĕlōhîm): Literata holds its half rings, breves and macrons,
 * which Pulp Display lacks (`transliterationTextStyle` in `~common/ui/textTypography`).
 */
export const TRANSLITERATION_FONT = 'Literata Book'

/** Preserve a chosen face when installed, with a deliberate browser fallback. */
export const webFontFamily = (fontFamily?: string): string => {
  if (!fontFamily || ['System', 'normal', 'Roboto'].includes(fontFamily)) return SYSTEM_SANS
  if (fontFamily === 'Pulp Display') return PULP_DISPLAY_STACK
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

/** The title face on the web: the theme's title face at bold weight, as on the native app. */
export const webTitleFontStyle = (theme: { fontFamily: { title: string } }) => ({
  fontFamily: webFontFamily(theme.fontFamily.title),
  fontWeight: 700 as const,
})
