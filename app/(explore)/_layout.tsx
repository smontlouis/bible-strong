import { useTheme } from '@emotion/react'
import { Stack } from 'expo-router'

const ExploreLayout = () => {
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
      <Stack.Screen name="bible-view" />
      <Stack.Screen name="strong" />
      <Stack.Screen name="concordance" />
      <Stack.Screen name="concordance-by-book" />
      <Stack.Screen name="dictionnary-detail" />
      <Stack.Screen name="nave-detail" />
      <Stack.Screen name="lexique" />
      <Stack.Screen name="dictionnaire" />
      <Stack.Screen name="nave" />
      <Stack.Screen name="note" />
      <Stack.Screen name="link" />
      <Stack.Screen name="edit-study" />
      <Stack.Screen name="entity-relations" />
      <Stack.Screen name="tag" />
      <Stack.Screen name="highlights" />
      <Stack.Screen name="bookmarks" />
      <Stack.Screen name="bible-verse-notes" />
      <Stack.Screen name="studies" />
      <Stack.Screen name="bible-verse-links" />
      <Stack.Screen name="tags" />
    </Stack>
  )
}

export default ExploreLayout
