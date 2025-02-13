'use dom'

import './polyfills'
import './swiped-events'

type Props = {
  dom: import('expo/dom').DOMProps
  isLoading: boolean
}

const VersesRenderer = (props: Props) => {
  const { isLoading } = props

  return (
    <div
      style={{
        paddingTop: 100,
        backgroundColor: 'yellow',
        width: '100%',
        height: '100vh',
      }}
    >
      {isLoading ? 'Loading...' : "I'm rendered"}
    </div>
  )
}

export default VersesRenderer
