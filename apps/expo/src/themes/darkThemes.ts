const DARK_THEMES: ReadonlySet<string> = new Set(['dark', 'black', 'night', 'mauve'])

/** The palettes on a dark ground, whose pages ask for dark scrollbars and form controls. */
export const isDarkThemeName = (name: string) => DARK_THEMES.has(name)
