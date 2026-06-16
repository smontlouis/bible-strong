import { useTheme } from '@emotion/react'
import { withLayoutContext } from 'expo-router'
import type { NavigationState, ParamListBase } from 'expo-router/react-navigation'
import { Platform } from 'react-native'
import {
  createTrueSheetNavigator,
  type TrueSheetNavigationEventMap,
  type TrueSheetNavigationOptions,
} from '@lodev09/react-native-true-sheet/navigation'

const { Navigator } = createTrueSheetNavigator()

const Sheet = withLayoutContext<
  TrueSheetNavigationOptions,
  typeof Navigator,
  NavigationState<ParamListBase>,
  TrueSheetNavigationEventMap
>(Navigator)

const ExploreLayout = () => {
  const theme = useTheme()

  const defaultSheetOptions = {
    backgroundColor: theme.colors.reverse,
    cornerRadius: Platform.OS === 'android' ? 24 : undefined,
    detentIndex: 0,
    detents: [0.45, 1],
    grabber: true,
  } satisfies TrueSheetNavigationOptions

  return (
    <Sheet
      initialRouteName="index"
      screenOptions={{
        ...defaultSheetOptions,
      }}
    >
      <Sheet.Screen name="index" />
      <Sheet.Screen name="bible-view" options={{ detents: [1] }} />
      <Sheet.Screen name="strong" />
      <Sheet.Screen name="concordance" />
      <Sheet.Screen name="concordance-by-book" />
      <Sheet.Screen name="dictionnary-detail" />
      <Sheet.Screen name="nave-detail" />
      <Sheet.Screen name="note" />
      <Sheet.Screen name="link" />
      <Sheet.Screen name="edit-study" />
      <Sheet.Screen name="entity-relations" />
      <Sheet.Screen name="tag" />
      <Sheet.Screen name="event" />
      <Sheet.Screen name="pericope" />
    </Sheet>
  )
}

export default ExploreLayout
