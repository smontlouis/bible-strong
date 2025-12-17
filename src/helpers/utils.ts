import { Dimensions } from 'react-native'

import { MAX_WIDTH } from '~helpers/useDimensions'

export const { width: viewportWidth, height: viewportHeight } = Dimensions.get('window')

export const smallSize = viewportWidth < 340

export const wp = (percentage: number, maxWidth?: boolean | number) => {
  let value
  if (maxWidth === true) {
    value = (percentage * (viewportWidth > MAX_WIDTH ? MAX_WIDTH : viewportWidth)) / 100
  } else if (typeof maxWidth === 'number') {
    value = (percentage * (viewportWidth > maxWidth ? maxWidth : viewportWidth)) / 100
  } else {
    value = (percentage * viewportWidth) / 100
  }

  return Math.round(value)
}

export const wpUI = (percentage: number, maxWidth?: boolean | number) => {
  'worklet'

  let value
  if (maxWidth === true) {
    value = (percentage * (viewportWidth > MAX_WIDTH ? MAX_WIDTH : viewportWidth)) / 100
  } else if (typeof maxWidth === 'number') {
    value = (percentage * (viewportWidth > maxWidth ? maxWidth : viewportWidth)) / 100
  } else {
    value = (percentage * viewportWidth) / 100
  }

  return Math.round(value)
}

export const hp = (percentage: number, maxHeight?: number) => {
  let value = (percentage * viewportHeight) / 100
  if (maxHeight) {
    value = value > maxHeight ? maxHeight : value
  }
  value = (percentage * viewportHeight) / 100
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
  verses: undefined,
})

export const removeBreakLines = (str: string = '') => str.replace(/\n/g, '')

export const maxWidth = (width: any, maxW = MAX_WIDTH) => (width > maxW ? maxW : width)
