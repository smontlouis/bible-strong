// eslint-disable-next-line
import { render, h } from 'preact'

import './index.css'
import VersesRenderer from './VersesRenderer'
import mockVerses from './mockVerses'

const desktopMode = false

try {
  render(<VersesRenderer verses={desktopMode ? mockVerses : []} />, document.getElementById('app'))
} catch (e) {
  window.postMessage(e)
}
