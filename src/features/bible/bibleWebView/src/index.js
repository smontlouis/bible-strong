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

// const mockSettings = {
//   alignContent: 'justify',
//   fontSizeScale: 0,
//   textDisplay: 'inline',
//   theme: 'default',
//   press: 'shortPress',
//   notesDisplay: 'inline',
//   colors: {
//     default: defaultColors,
//     dark: darkColors,
//     black: blackColors,
//     sepia: sepiaColors,
//   },
//   commentsDisplay: true,
// }

// const mockSelectedVerses = {
//   '1-4-10': true,
// }

// const verseToScroll = 4

// const version = 'INT'

// const mockNotedVerses = {
//   '1-4-1': {
//     title: 'Le ciel et la terre',
//     description:
//       'Informe et vide signifient ici « Tohu bohu », c’est exactemement le même mot que Jérémie utilise dans sa vision quand il décrit la terre dans [Jérémie 4:23]',
//     date: 1563909941027,
//   },
//   '1-4-7/1-4-8': {
//     title: 'Ceci est une note sur 2 versets',
//     description: 'Cool !',
//     date: 1563912012088,
//   },
// }

// const selectedCode = {
//   reference: 8689,
//   book: 38,
// }

// const focusVerses = [11, 12, 13]

// render(
//   <App
//     focusVerses={focusVerses}
//     // verses={require('./mockVerses')}
//     verses={require('./mockINTVerses')}
//     // parallelVerses={
//     //   [
//     //         {
//     //           id: 'BDS',
//     //           name: 'Bible du Semeur',
//     //           verses: mockVerses,
//     //         },
//     //         {
//     //           id: 'FRC97',
//     //           name: 'Français courant',
//     //           verses: mockVerses,
//     //         },
//     //       ]
//     // }
//     secondaryVerses={require('./mockSecondaryVerses')}
//     notedVerses={mockNotedVerses}
//     settings={mockSettings}
//     verseToScroll={verseToScroll}
//     selectedVerses={mockSelectedVerses}
//     version={version}
//     comments={require('./mockComments')}
//     // selectedCode={selectedCode}
//   />,
//   document.getElementById('app')
// )

render(<App />, document.getElementById('app'))
