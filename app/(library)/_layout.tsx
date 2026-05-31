import { useTheme } from '@emotion/react'
import { Stack } from 'expo-router'

const LibraryLayout = () => {
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
      <Stack.Screen name="highlights" />
      <Stack.Screen name="bookmarks" />
      <Stack.Screen name="bible-verse-notes" />
      <Stack.Screen name="studies" />
      <Stack.Screen name="bible-verse-links" />
      <Stack.Screen name="tags" />
      <Stack.Screen name="lexique" />
      <Stack.Screen name="dictionnaire" />
      <Stack.Screen name="nave" />
      <Stack.Screen name="timeline-home" />
      <Stack.Screen name="timeline" />
    </Stack>
  )
}

export default LibraryLayout
