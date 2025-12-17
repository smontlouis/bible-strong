import { useEffect, useState } from 'react'
import { Dimensions } from 'react-native'

import useDimensions, { MAX_WIDTH } from './useDimensions'

const screen = Dimensions.get('screen')

const useDeviceOrientation = () => {
  const isOrientationPortrait = ({ width, height }) => height >= width
  const isOrientationLandscape = ({ width, height }) => width >= height
  const dimensions = useDimensions()

  const [orientation, setOrientation] = useState({
    portrait: isOrientationPortrait(screen),
    landscape: isOrientationLandscape(screen),
    tablet:
      Math.round((dimensions.screen.width / dimensions.screen.height) * 100) / 100 === 1.33 &&
      isOrientationLandscape(screen),
    maxWidth: MAX_WIDTH,
  })

  useEffect(() => {
    const onChange = ({ screen }) => {
      setOrientation({
        portrait: isOrientationPortrait(screen),
        landscape: isOrientationLandscape(screen),
        tablet:
          Math.round((dimensions.screen.width / dimensions.screen.height) * 100) / 100 === 1.33 &&
          isOrientationLandscape(screen),
        maxWidth: MAX_WIDTH,
      })
    }

    const event = Dimensions.addEventListener('change', onChange)

    return () => {
      event.remove()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orientation.portrait, orientation.landscape])

  return orientation
}

export default useDeviceOrientation
