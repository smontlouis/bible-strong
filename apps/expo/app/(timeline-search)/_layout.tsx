import { useTheme } from '@emotion/react'
import { Stack } from 'expo-router'

const TimelineSearchLayout = () => {
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
      <Stack.Screen name="timeline-search" />
    </Stack>
  )
}

export default TimelineSearchLayout
