import { render, h } from 'preact'
import { setup } from 'goober'
import App from './App'

setup(h)

// import {
//   mockHighlightedVerses,
//   mockNotedVerses,
//   mockSettings,
//   verseToScroll,
//   version,
// } from './mock/mockData'

// import mockVerses from './mock/mockVerses'
// import mockVerses from './mock/mockINTVerses'

// render(
//   <App
//     focusVerses={undefined}
//     highlightedVerses={mockHighlightedVerses}
//     verses={mockVerses}
//     notedVerses={mockNotedVerses}
//     settings={mockSettings}
//     verseToScroll={verseToScroll}
//     selectedVerses={{}}
//     version={version}
//   />,
//   document.body
// )

render(<App />, document.body)
