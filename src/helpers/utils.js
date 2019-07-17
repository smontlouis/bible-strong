import { Dimensions } from 'react-native'

export const { width: viewportWidth, height: viewportHeight } = Dimensions.get(
  'window'
)

export const wp = percentage => {
  const value = (percentage * viewportWidth) / 100
  return Math.round(value)
}

export const hp = percentage => {
  const value = (percentage * viewportHeight) / 100
  return Math.round(value)
}

export const cleanParams = () => ({
  type: null,
  title: null,
  code: null,
  strongType: null,
  phonetique: null,
  definition: null,
  translatedBy: null,
  content: null,
  version: null,
  verses: null
})
