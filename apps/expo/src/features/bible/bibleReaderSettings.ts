import type { CurrentTheme } from '~common/types'
import type { RootState } from '~redux/modules/reducer'
import type { Theme } from '~themes'
import { getThemePalettes } from '~themes/themePalette'

type StoredBibleSettings = RootState['user']['bible']['settings']

/** What the Bible document reads: the stored settings, with every palette resolved from code. */
export type BibleReaderSettings = Omit<StoredBibleSettings, 'colors'> & {
  colors: Record<CurrentTheme, Theme['colors']>
}

export const toBibleReaderSettings = (
  settings: StoredBibleSettings,
  theme: CurrentTheme,
  fontFamily: string
): BibleReaderSettings => ({
  ...settings,
  theme,
  fontFamily,
  colors: getThemePalettes(settings.colors),
})
