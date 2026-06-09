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
  ...(Platform.OS === 'android' && {
    sheetCornerRadius: 24,
  }),
} satisfies StackScreenOptions

export const createFormSheetOptions = (
  theme: Theme,
  overrides: StackScreenOptions = {}
): StackScreenOptions => {
  const { contentStyle, ...restOverrides } = overrides
  const defaultContentStyle = {
    backgroundColor: theme.colors.reverse,
  } satisfies NonNullable<StackScreenOptions['contentStyle']>

  return {
    ...defaultFormSheetOptions,
    ...restOverrides,
    contentStyle: contentStyle ? [defaultContentStyle, contentStyle] : defaultContentStyle,
  }
}
