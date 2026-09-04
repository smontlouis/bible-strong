import { useTheme } from '@emotion/react'
import { Stack } from 'expo-router'

const CommentaryLayout = () => {
  const theme = useTheme()

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: {
          backgroundColor: theme.colors.reverse,
        },
      }}
    >
      <Stack.Screen name="commentary-chapter" />
      <Stack.Screen name="commentary-entry" />
    </Stack>
  )
}

export default CommentaryLayout
