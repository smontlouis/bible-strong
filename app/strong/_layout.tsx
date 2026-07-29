import { useTheme } from '@emotion/react'
import { Stack } from 'expo-router'

const StrongLayout = () => {
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
      <Stack.Screen name="index" />
      <Stack.Screen name="entity" />
      <Stack.Screen name="dictionary" />
      <Stack.Screen name="related" />
      <Stack.Screen name="concordance" />
    </Stack>
  )
}

export default StrongLayout
