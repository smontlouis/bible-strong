import { useEffect, useEffectEvent, useState } from 'react'
import { Dimensions } from 'react-native'

import useDimensions, { MAX_WIDTH } from './useDimensions'

const screen = Dimensions.get('screen')

export interface Orientation {
  portrait: boolean
  landscape: boolean
  tablet: boolean
  maxWidth: number
}

interface ScreenDimensions {
  width: number
  height: number
}

const isOrientationPortrait = ({ width, height }: ScreenDimensions): boolean => height >= width
const isOrientationLandscape = ({ width, height }: ScreenDimensions): boolean => width >= height

const useDeviceOrientation = (): Orientation => {
  const dimensions = useDimensions()

  const [orientation, setOrientation] = useState({
    portrait: isOrientationPortrait(screen),
    landscape: isOrientationLandscape(screen),
    tablet:
      Math.round((dimensions.screen.width / dimensions.screen.height) * 100) / 100 === 1.33 &&
      isOrientationLandscape(screen),
    maxWidth: MAX_WIDTH,
  })

  const readScreenDimensions = useEffectEvent(() => dimensions.screen)

  useEffect(() => {
    // Read when the listener is set up, not when it fires
    const subscribedScreen = readScreenDimensions()
    const onChange = ({ screen }: { screen: ScreenDimensions }): void => {
      setOrientation({
        portrait: isOrientationPortrait(screen),
        landscape: isOrientationLandscape(screen),
        tablet:
          Math.round((subscribedScreen.width / subscribedScreen.height) * 100) / 100 === 1.33 &&
          isOrientationLandscape(screen),
        maxWidth: MAX_WIDTH,
      })
    }

    const event = Dimensions.addEventListener('change', onChange)

    return () => {
      event.remove()
    }
  }, [orientation.portrait, orientation.landscape])

  return orientation
}

export default useDeviceOrientation
