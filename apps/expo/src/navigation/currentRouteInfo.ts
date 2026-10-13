import { getRouteInfoFromState } from 'expo-router/build/global-state/getRouteInfoFromState'
import { navigationRef } from 'expo-router/build/global-state/navigationRef'

// expo-router 58 removed its router store. The route info it exposed was derived from the root
// navigation state, which is still reachable outside React through the navigation ref.
export const getCurrentRouteInfo = () =>
  getRouteInfoFromState(navigationRef.isReady() ? navigationRef.getRootState() : undefined)
