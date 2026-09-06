type RootNavigationState = {
  index?: number
  routes?: readonly RootNavigationRoute[]
}

type RootNavigationRoute = {
  state?: RootNavigationState
}

export const hasModalBackgroundRoute = (state: RootNavigationState | undefined): boolean => {
  if (!state) return false

  const activeIndex = state.index ?? 0
  const activeRoute = state.routes?.[activeIndex]
  const appState = activeRoute?.state ?? state

  if (typeof appState.index !== 'number' || appState.index <= 0) return false
  return (appState.routes?.length ?? 0) > appState.index
}
