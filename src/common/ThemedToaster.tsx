import { useTheme } from '@emotion/react'
import { Toaster } from 'sonner-native'

const ThemedToaster = () => {
  const theme = useTheme()

  return (
    <Toaster
      duration={3000}
      position="top-center"
      icons={{ info: <></> }}
      toastOptions={{
        style: {
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
