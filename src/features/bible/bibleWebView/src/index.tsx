import React from 'react'
import { render } from 'react-dom'

import './index.css'
import App from './App'
import {
  mockHighlightedVerses,
  mockNotedVerses,
  mockSettings,
  verseToScroll,
  version,
} from './mock/mockData'

// render(
//   <App
//     focusVerses={undefined}
//     highlightedVerses={mockHighlightedVerses}
//     verses={require('./mock/mockVerses').default}
//     notedVerses={mockNotedVerses}
//     settings={mockSettings}
//     verseToScroll={verseToScroll}
//     selectedVerses={{}}
//     version={version}
//   />,
//   document.getElementById('app')
// )

render(<App />, document.getElementById('app'))
