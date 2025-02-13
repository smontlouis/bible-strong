import { render, h } from 'preact'
import { setup } from 'goober'
import App from './BibleDOMComponentWrapper'

const forwardProps = [
  'isHebreu',
  'isFocused',
  'isParallel',
  'isParallelVerse',
  'isTouched',
  'isSelected',
  'isVerseToScroll',
  'highlightedColor',
  'rtl',
]

setup(h, undefined, undefined, (props: { [key: string]: any }) => {
  for (let prop in props) {
    if (forwardProps.includes(prop)) {
      delete props[prop]
    }
  }
})

render(<App />, document.body)
