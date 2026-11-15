import { Platform, type ViewStyle } from 'react-native'

/**
 * A CSS gradient as the background of a view. React Native draws it from
 * `experimental_backgroundImage`; React Native Web passes styles to CSS as they are, where only
 * `background-image` is understood. `undefined` leaves the background alone.
 */
export const backgroundImage = (value: string | undefined): ViewStyle =>
  value === undefined
    ? {}
    : Platform.OS === 'web'
      ? ({ backgroundImage: value } as ViewStyle)
      : { experimental_backgroundImage: value }
