import { useEffect, useState } from 'react'
import { Dimensions } from 'react-native'

const window = Dimensions.get('window')
const screen = Dimensions.get('screen')

export const MAX_WIDTH = 800

export const maxWidth = (width, maxW = MAX_WIDTH) =>
  width > maxW ? maxW : width

export default function useDimensions() {
  const [dimensions, setDimensions] = useState({
    window,
    screen,
  })

  useEffect(() => {
    const onChange = ({ window, screen }) => {
      setDimensions({ window, screen })
    }

    Dimensions.addEventListener('change', onChange)

    return () => Dimensions.removeEventListener('change', onChange)
  })

  return dimensions
}
