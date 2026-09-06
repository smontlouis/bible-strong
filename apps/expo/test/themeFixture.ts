import colors from '../src/themes/colors'
import type { Theme } from '../src/themes'

export const themeFixture: Theme = {
  colors,
  measures: { headerHeight: 60, headerMarginTop: 0, maxWidth: 320, paddingBottom: 30 },
  fontFamily: { text: 'System', title: 'eina-03-bold', titleItalic: 'System', paragraph: 'System' },
}
