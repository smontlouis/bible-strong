import { useContext } from 'react'
import { Platform } from 'react-native'
import { NavigationContext } from 'expo-router/build/react-navigation/core/NavigationContext'
import { NavigationRouteContext } from 'expo-router/build/react-navigation/core/NavigationProvider'

/**
 * The routes of the root stack that iOS presents as sheets, by their own options in
 * `FullAppRuntime.tsx`. Keep the two in step.
 */
export const SHEET_ROUTES = new Set([
  '(timeline-search)',
  '(explore)',
  '(commentary)',
  'study-assistant',
  'premium',
  'strong',
])

type StackRoute = { key: string; name: string }

/**
 * Whether the route at `index` of the root stack is a page opened over a sheet. iOS cannot slide a
 * page under a sheet: it would show it as a sheet anyway, without its grabber and with room for the
 * status bar. Such a page is made a real sheet (FullAppRuntime) and lays itself out as one
 * (SafeAreaBox). A route declared as a sheet is not counted: it lays itself out already.
 */
export const isPageOverSheet = (routes: readonly StackRoute[], index: number) =>
  Platform.OS === 'ios' &&
  index > 0 &&
  !SHEET_ROUTES.has(routes[index]?.name ?? '') &&
  routes.slice(0, index).some(route => SHEET_ROUTES.has(route.name))

type NavigationLike = {
  getState: () => { key: string; routes: readonly (StackRoute & { state?: { key?: string } })[] }
  getParent: () => NavigationLike | undefined
}

/**
 * Whether the screen around the caller is a page opened over a sheet (`isPageOverSheet`), looked
 * up from its route in the root stack. False outside navigation (a portal, a bottom sheet).
 */
export function usePageOverSheet() {
  const navigation = useContext(NavigationContext) as NavigationLike | undefined
  const route = useContext(NavigationRouteContext)
  if (Platform.OS !== 'ios' || !navigation || !route) return false
  let state = navigation.getState()
  let key = route.key
  // Climbs the navigators, from the screen's own to the outermost (expo-router wraps the root
  // stack in one more), and asks each level for the route that holds the screen there.
  for (let level: NavigationLike | undefined = navigation; level; ) {
    const index = state.routes.findIndex(candidate => candidate.key === key)
    // On its first render, a route being pushed is not in its stack's state yet: it goes on top.
    const routes = index === -1 ? [...state.routes, { key, name: route.name }] : state.routes
    if (isPageOverSheet(routes, index === -1 ? routes.length - 1 : index)) return true
    level = level.getParent()
    if (!level) break
    const parentState = level.getState()
    const holder = parentState.routes.find(candidate => candidate.state?.key === state.key)
    if (!holder) break
    key = holder.key
    state = parentState
  }
  return false
}
