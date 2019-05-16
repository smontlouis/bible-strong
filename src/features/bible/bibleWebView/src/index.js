// eslint-disable-next-line
import { render, h } from 'preact'

import './index.css'
import mockVerses from './mockVerses'
import VersesRenderer from './VersesRenderer'

render(<VersesRenderer verses={mockVerses} />, document.getElementById('app'))
