import { render, h } from 'preact'
import { setup } from 'goober'
import App from './App'
import { dispatch, THROW_ERROR } from './dispatch'

setup(h)

window.addEventListener('unhandledrejection', ev => {
  dispatch({
    type: THROW_ERROR,
    payload: `${ev.reason.toString()}`,
  })
  render(<div>Error: {ev.reason.toString()}</div>, document.body)
})

// import {
//   mockHighlightedVerses,
//   mockNotedVerses,
//   mockSettings,
//   verseToScroll,
//   version,
// } from './mock/mockData'

// import mockVerses from './mock/mockVerses'
// import { dispatch, THROW_ERROR } from './dispatch'
// // import mockVerses from './mock/mockINTVerses'

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
