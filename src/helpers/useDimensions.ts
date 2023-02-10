import { useEffect, useState } from 'react'
import { Dimensions } from 'react-native'

const window = Dimensions.get('window')
const screen = Dimensions.get('screen')

export const MAX_WIDTH = 700

export default function useDimensions() {
  const [dimensions, setDimensions] = useState({
    window,
    screen,
  })

  useEffect(() => {
    const onChange = ({ window, screen }) => {
      setDimensions({ window, screen })
    }

    const event = Dimensions.addEventListener('change', onChange)

    return () => event.remove()
  })

  return dimensions
}
