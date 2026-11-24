import themes, { themeNames, type Theme } from './index'
import { isDarkThemeName } from './darkThemes'

/**
 * The colours of a part of the Bible, for what stands for a book as a whole: the cover of the
 * audio player. One family per part, a light set for the light themes and a dark one for the dark
 * themes. The ground, ink and accent are the `bible-part-*` tokens of design-system/project/tokens.json.
 */
export type BiblePart =
  | 'pentateuch'
  | 'history'
  | 'poetry'
  | 'prophets'
  | 'gospels'
  | 'letters'
  | 'revelation'

export type BiblePartColors = {
  /** The ground of the cover. */
  ground: string
  /** Text on the ground. */
  ink: string
  /** The chapter number and the progress: large type and fills only, never small text. */
  accent: string
  /** A tint of the ground, behind the top of the player. */
  glow: string
}

const PART_COLORS: Record<BiblePart, { light: BiblePartColors; dark: BiblePartColors }> = {
  pentateuch: {
    light: { ground: '#F4E7D0', ink: '#3A2914', accent: '#C17F24', glow: '#F4E7D0' },
    dark: { ground: '#2B2214', ink: '#F4E7D0', accent: '#E3A64C', glow: '#3E311C' },
  },
  history: {
    light: { ground: '#F7DED4', ink: '#4A1F14', accent: '#C4553C', glow: '#F7DED4' },
    dark: { ground: '#2E1A15', ink: '#F7DED4', accent: '#E57E62', glow: '#44271F' },
  },
  poetry: {
    light: { ground: '#E9E0FB', ink: '#2A1C4E', accent: '#7457D1', glow: '#E9E0FB' },
    dark: { ground: '#221B38', ink: '#E9E0FB', accent: '#A48DF2', glow: '#33294F' },
  },
  prophets: {
    light: { ground: '#D7F0EA', ink: '#0E3A34', accent: '#1F9384', glow: '#D7F0EA' },
    dark: { ground: '#11261F', ink: '#D7F0EA', accent: '#4CC3B2', glow: '#1B3A31' },
  },
  gospels: {
    light: { ground: '#DFE9FF', ink: '#101B35', accent: '#5983F0', glow: '#DFE9FF' },
    dark: { ground: '#16213A', ink: '#DFE9FF', accent: '#7E9CF2', glow: '#22304F' },
  },
  letters: {
    light: { ground: '#FFE3DE', ink: '#4A1621', accent: '#D24A5C', glow: '#FFE3DE' },
    dark: { ground: '#2E1719', ink: '#FFE3DE', accent: '#EE7383', glow: '#45232A' },
  },
  revelation: {
    light: { ground: '#FFF0C8', ink: '#1B1630', accent: '#C98F0F', glow: '#FFF0C8' },
    dark: { ground: '#1B1630', ink: '#FFF0C8', accent: '#E8B53A', glow: '#2B2449' },
  },
}

/**
 * The part a book belongs to, by its number: 1 to 66 in the Protestant canon, then the
 * deuterocanonical books, each with the part it reads like.
 */
export const getBiblePart = (bookNumber: number): BiblePart => {
  if (bookNumber <= 5) return 'pentateuch'
  if (bookNumber <= 17) return 'history'
  if (bookNumber <= 22) return 'poetry'
  if (bookNumber <= 39) return 'prophets'
  if (bookNumber <= 43) return 'gospels'
  if (bookNumber <= 65) return 'letters'
  if (bookNumber === 66) return 'revelation'
  // Wisdom, Sirach and the Psalms of Solomon; Baruch; the others tell a history.
  if (bookNumber === 69 || bookNumber === 70 || bookNumber === 77) return 'poetry'
  if (bookNumber === 71) return 'prophets'
  return 'history'
}

export const isDarkTheme = (theme: Theme) => {
  const name = themeNames.find(name => themes[name].colors === theme.colors) ?? 'default'
  return isDarkThemeName(name)
}

export const getBiblePartColors = (part: BiblePart, theme: Theme): BiblePartColors =>
  PART_COLORS[part][isDarkTheme(theme) ? 'dark' : 'light']
