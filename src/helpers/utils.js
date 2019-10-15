import { Dimensions } from 'react-native'

import { MAX_WIDTH } from '~helpers/useDimensions'

export const { width: viewportWidth, height: viewportHeight } = Dimensions.get('window')

export const wp = percentage => {
  const value = (percentage * (viewportWidth > MAX_WIDTH ? MAX_WIDTH : viewportWidth)) / 100
  return Math.round(value)
}

export const hp = percentage => {
  const value = (percentage * viewportHeight) / 100
  return Math.round(value)
}

export const cleanParams = () => ({
  type: undefined,
  title: undefined,
  code: undefined,
  strongType: undefined,
  phonetique: undefined,
  definition: undefined,
  translatedBy: undefined,
  content: undefined,
  version: undefined,
  verses: undefined
})
