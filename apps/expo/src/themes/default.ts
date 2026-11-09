import { Platform } from 'react-native'

/**
 * The interface face of the site, Pulp Display (design-system README, « Type »): built into the
 * native apps (`app.config.ts`), served by the web from `public/fonts`. A binary built without
 * it draws the system sans instead. `paragraph` stays on the platform's sans: it sets verses
 * and other text read.
 */
const nativeSans = Platform.OS === 'ios' ? 'System' : 'normal'
const interfaceFont = 'Pulp Display'

const theme = {
  measures: {
    headerHeight: 60,
    headerMarginTop: Platform.OS === 'ios' ? 0 : 25,
    maxWidth: 320,
    paddingBottom: 30,
  },
  fontFamily: {
    text: interfaceFont,
    title: interfaceFont,
    titleItalic: interfaceFont,
    paragraph: nativeSans,
  },
}

export default theme
