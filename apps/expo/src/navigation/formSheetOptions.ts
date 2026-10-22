import { Stack } from 'expo-router'
import type { ComponentProps } from 'react'
import { Platform } from 'react-native'
import type { Theme } from '~themes'

type StackScreenOptions = Exclude<
  NonNullable<ComponentProps<typeof Stack.Screen>['options']>,
  (...args: never[]) => unknown
>

const defaultFormSheetOptions = {
  presentation: 'formSheet',
  sheetGrabberVisible: true,
  sheetExpandsWhenScrolledToEdge: false,
} satisfies StackScreenOptions

export const createFormSheetOptions = (
  theme: Theme,
  overrides: StackScreenOptions = {}
): StackScreenOptions => {
  const { contentStyle, ...restOverrides } = overrides
  const defaultContentStyle = {
    backgroundColor: theme.colors.reverse,
  } satisfies NonNullable<StackScreenOptions['contentStyle']>

  if (Platform.OS === 'android') {
    return {}
  }

  if (Platform.OS === 'web') {
    return {
      ...restOverrides,
      // Keep the navigator presentation stable across responsive breakpoints.
      // ModalRouteFrame owns the panel/full-content geometry on Web.
      presentation: 'transparentModal',
      animation: 'none',
      contentStyle: { backgroundColor: 'transparent' },
    }
  }

  // On iPhone an undimmed sheet leaves the page behind it to scroll and read. On iPad the sheet
  // stands in front of the page and takes its room, so it always keeps the dimmed overlay.
  const { sheetLargestUndimmedDetentIndex, ...sharedOverrides } = restOverrides
  return {
    ...defaultFormSheetOptions,
    ...sharedOverrides,
    ...(Platform.OS === 'ios' && Platform.isPad ? {} : { sheetLargestUndimmedDetentIndex }),
    contentStyle: contentStyle ? [defaultContentStyle, contentStyle] : defaultContentStyle,
  }
}
