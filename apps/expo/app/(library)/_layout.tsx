import { useTheme } from '~themes/ThemeProvider'
import { Stack } from 'expo-router'
import { IncomingLinkGate } from '~features/app-switcher/IncomingLinkGate'
const LibraryLayout = () => {
  const theme = useTheme()

  return (
    <IncomingLinkGate>
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
        <Stack.Screen name="commentary-library" />
        <Stack.Screen name="timeline-home" />
        <Stack.Screen name="timeline" />
        <Stack.Screen name="timeline/[language]/index" />
        <Stack.Screen name="passage-media" />
      </Stack>
    </IncomingLinkGate>
  )
}

export default LibraryLayout
