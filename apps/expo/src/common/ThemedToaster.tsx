import { useTheme } from '~themes/ThemeProvider'
import { Toaster } from 'sonner-native'
import { Platform, useWindowDimensions } from 'react-native'
const ThemedToaster = () => {
  const theme = useTheme()
  const { width } = useWindowDimensions()

  return (
    <Toaster
      duration={3000}
      position="top-center"
      icons={{ info: <></> }}
      toastOptions={{
        style: {
          ...(Platform.OS === 'web'
            ? {
                width: Math.max(0, Math.min(420, width - 32)),
                maxWidth: 420,
                alignSelf: 'center' as const,
              }
            : {}),
          backgroundColor: theme.colors.reverse,
          borderColor: theme.colors.border,
          borderWidth: 1,
        },
        titleStyle: {
          color: theme.colors.default,
        },
        descriptionStyle: {
          color: theme.colors.grey,
        },
        actionButtonStyle: {
          borderColor: 'transparent',
          backgroundColor: theme.colors.primary,
        },
        actionButtonTextStyle: {
          color: theme.colors.reverse,
        },
        cancelButtonStyle: {
          borderColor: 'transparent',
          backgroundColor: theme.colors.lightGrey,
        },
        cancelButtonTextStyle: {
          color: theme.colors.default,
        },
        // success: {
        //   borderLeftColor: theme.colors.success,
        //   borderLeftWidth: 3,
        // },
        // error: {
        //   borderLeftColor: theme.colors.quart,
        //   borderLeftWidth: 3,
        // },
        // warning: {
        //   borderLeftColor: theme.colors.secondary,
        //   borderLeftWidth: 3,
        // },
        // info: {
        //   borderLeftColor: theme.colors.primary,
        //   borderLeftWidth: 3,
        // },
      }}
    />
  )
}

export default ThemedToaster
