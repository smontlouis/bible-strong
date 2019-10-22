// eslint-disable-next-line
import React from 'react'
import { render } from 'react-dom'

import './index.css'
import VersesRenderer from './VersesRenderer'
import mockVerses from './mockVerses'
import mockSecondaryVerses from './mockSecondaryVerses'
import { desktopMode } from './env'

import defaultColors from '../../../../themes/colors'
import darkColors from '../../../../themes/darkColors'

const mockSettings = {
  alignContent: 'justify',
  fontSizeScale: 0,
  textDisplay: 'inline',
  theme: 'default',
  press: 'shortPress',
  notesDisplay: 'inline',
  colors: {
    default: defaultColors,
    dark: darkColors
  }
}

const mockSelectedVerses = {
  '40-13-2': true
}

const verseToScroll = 4

const version = 'INT'

const mockNotedVerses = {
  '40-13-1': {
    title: 'Le ciel et la terre',
    description:
      'Informe et vide signifient ici « Tohu bohu », c’est exactemement le même mot que Jérémie utilise dans sa vision quand il décrit la terre dans [Jérémie 4:23]',
    date: 1563909941027
  },
  '40-13-7/40-13-8': {
    title: 'Ceci est une note sur 2 versets',
    description: 'Cool !',
    date: 1563912012088
  }
}

render(
  <VersesRenderer
    verses={desktopMode ? mockVerses : undefined}
    secondaryVerses={desktopMode ? mockSecondaryVerses : undefined}
    notedVerses={desktopMode ? mockNotedVerses : undefined}
    settings={desktopMode ? mockSettings : undefined}
    verseToScroll={desktopMode ? verseToScroll : undefined}
    selectedVerses={desktopMode ? mockSelectedVerses : undefined}
    version={desktopMode ? version : undefined}
  />,
  document.getElementById('app')
)
