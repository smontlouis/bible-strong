import { useTheme } from '~themes/ThemeProvider'
import { Stack } from 'expo-router'
import ModalRouteFrame from '~navigation/ModalRouteFrame'
const ExploreLayout = () => {
  const theme = useTheme()

  return (
    <ModalRouteFrame>
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: {
            backgroundColor: theme.colors.reverse,
          },
        }}
      >
        <Stack.Screen name="bible-view" />
        <Stack.Screen name="bible/[...segments]" />
        <Stack.Screen name="concordance" />
        <Stack.Screen name="concordance-by-book" />
        <Stack.Screen name="dictionnary-detail" />
        <Stack.Screen name="dictionary/[language]/[work]/[entryId]/[slug]" />
        <Stack.Screen name="nave-detail" />
        <Stack.Screen name="nave/[language]/[topic]" />
        <Stack.Screen name="timeline/[language]/index" />
        <Stack.Screen name="timeline/[language]/[slug]" />
        <Stack.Screen name="note" />
        <Stack.Screen name="link" />
        <Stack.Screen name="edit-study" />
        <Stack.Screen name="entity-relations" />
        <Stack.Screen name="tag" />
        <Stack.Screen name="event" />
        <Stack.Screen name="pericope" />
        <Stack.Screen name="passage-media-player" />
        <Stack.Screen name="passage-resources" />
      </Stack>
    </ModalRouteFrame>
  )
}

export default ExploreLayout
