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

const mockSelectedVerses = {
  '42-11-1': true
}

const verseToScroll = 4

const version = 'LSG'

render(
  <VersesRenderer
    verses={desktopMode ? mockVerses : undefined}
    settings={desktopMode ? mockSettings : undefined}
    verseToScroll={desktopMode ? verseToScroll : undefined}
    selectedVerses={desktopMode ? mockSelectedVerses : undefined}
    version={desktopMode ? version : undefined}
  />,
  document.getElementById('app')
)
