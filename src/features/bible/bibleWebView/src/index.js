// eslint-disable-next-line
import { render, h } from 'preact'

import './index.css'
import VersesRenderer from './VersesRenderer'
import mockVerses from './mockVerses'
import { desktopMode } from './env'

const mockSettings = {
  alignContent: 'justify',
  fontSizeScale: 0,
  textDisplay: 'inline',
  theme: 'default'
}

const verseToScroll = 4

render(
  <VersesRenderer
    verses={desktopMode ? mockVerses : undefined}
    settings={desktopMode ? mockSettings : undefined}
    verseToScroll={desktopMode ? verseToScroll : undefined}
  />,
  document.getElementById('app')
)
