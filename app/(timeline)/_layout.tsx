import { useTheme } from '@emotion/react'
import { Stack } from 'expo-router'

const TimelineLayout = () => {
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
      <Stack.Screen name="timeline-home" />
      <Stack.Screen name="timeline" />
      <Stack.Screen name="event" />
    </Stack>
  )
}

export default TimelineLayout
