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
  theme: 'default',
  press: 'shortPress',
  notesDisplay: 'inline'
}

const mockSelectedVerses = {
  '42-11-1': true
}

const verseToScroll = 4

const version = 'LSG'

const mockNotedVerses = {
  '42-11-1': {
    title: 'Le ciel et la terre',
    description: 'Informe et vide signifient ici « Tohu bohu », c’est exactemement le même mot que Jérémie utilise dans sa vision quand il décrit la terre dans [Jérémie 4:23]',
    date: 1563909941027
  },
  '42-11-7/42-11-8': {
    title: 'Ceci est une note sur 2 versets',
    description: 'Cool !',
    date: 1563912012088
  }
}
try {
  render(
    <VersesRenderer
      verses={desktopMode ? mockVerses : undefined}
      notedVerses={desktopMode ? mockNotedVerses : undefined}
      settings={desktopMode ? mockSettings : undefined}
      verseToScroll={desktopMode ? verseToScroll : undefined}
      selectedVerses={desktopMode ? mockSelectedVerses : undefined}
      version={desktopMode ? version : undefined}
    />,
    document.getElementById('app')
  )
} catch (e) {
  document.write(e)
}
