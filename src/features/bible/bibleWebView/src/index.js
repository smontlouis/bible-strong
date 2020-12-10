import React from 'react'
import { render } from 'react-dom'

import './index.css'
import App from './App'

import { desktopMode } from './env'

import defaultColors from '../../../../themes/colors'
import darkColors from '../../../../themes/darkColors'
import blackColors from '../../../../themes/blackColors'
import sepiaColors from '../../../../themes/sepiaColors'
import ErrorBoundary from './ErrorBoundary'

const mockSettings = {
  alignContent: 'justify',
  fontSizeScale: 0,
  textDisplay: 'inline',
  theme: 'default',
  press: 'shortPress',
  notesDisplay: 'block',
  colors: {
    default: defaultColors,
    dark: darkColors,
    black: blackColors,
    sepia: sepiaColors,
  },
  commentsDisplay: true,
}

const mockSelectedVerses = {
  '1-4-10': true,
}

const verseToScroll = 4

const version = 'LSG'

const mockNotedVerses = {
  '1-4-1': {
    title: 'Le ciel et la terre',
    description:
      'Informe et vide signifient ici « Tohu bohu », c’est exactemement le même mot que Jérémie utilise dans sa vision quand il décrit la terre dans [Jérémie 4:23]',
    date: 1563909941027,
  },
  '1-4-7/1-4-8': {
    title: 'Ceci est une note sur 2 versets',
    description: 'Cool !',
    date: 1563912012088,
  },
}

const mockHighlightedVerses = {
  "1-4-1": {
    "color": "color4",
    "date": 1607459799580,
    "tags": {
      "4f022af5-7324-4114-adb7-5f32d6b2472e": {
        "id": "4f022af5-7324-4114-adb7-5f32d6b2472e",
        "name": "First tag"
      },
    }
  },
  "1-4-3": {
    "color": "color2",
    "date": 1607541495415,
    "tags": {
      "41133897-6ae6-4769-a644-7a718eb1c3c3": {
        "id": "41133897-6ae6-4769-a644-7a718eb1c3c3",
        "name": "Otr tag"
      },
      "4f022af5-7324-4114-adb7-5f32d6b2472e": {
        "id": "4f022af5-7324-4114-adb7-5f32d6b2472e",
        "name": "First tag"
      }
    }
  },
  "1-4-4": {
    "color": "color2",
    "date": 1607541495415,
    "tags": {
      "41133897-6ae6-4769-a644-7a718eb1c3c3": {
        "id": "41133897-6ae6-4769-a644-7a718eb1c3c3",
        "name": "Otr tag"
      },
      "4f022af5-7324-4114-adb7-5f32d6b2472e": {
        "id": "4f022af5-7324-4114-adb7-5f32d6b2472e",
        "name": "First tag"
      }
    }
  },
  "1-4-5": {
    "color": "color2",
    "date": 1607541495415,
    "tags": {
      "41133897-6ae6-4769-a644-7a718eb1c3c3": {
        "id": "41133897-6ae6-4769-a644-7a718eb1c3c3",
        "name": "Otr tag"
      },
      "4f022af5-7324-4114-adb7-5f32d6b2472e": {
        "id": "4f022af5-7324-4114-adb7-5f32d6b2472e",
        "name": "First tag"
      }
    }
  }
}



const focusVerses = [11, 12, 13]

render(
  <App
    focusVerses={undefined}
    highlightedVerses={mockHighlightedVerses}
    verses={require('./mockVerses').default}
    notedVerses={mockNotedVerses}
    settings={mockSettings}
    verseToScroll={verseToScroll}
    selectedVerses={{}}
    version={version}
  />,
  document.getElementById('app')
)

// render(<App />, document.getElementById('app'))
