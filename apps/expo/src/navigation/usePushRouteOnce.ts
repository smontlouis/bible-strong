import { navigateWithPageTransition } from './pageTransition'
import { useRouter } from 'expo-router'
import type { HrefObject } from 'expo-router'
import { store } from 'expo-router/build/global-state/router-store'
import { useDefaultBibleVersion } from '~state/useDefaultBibleVersion'
import { normalizePublicRoute } from './publicRouteNormalization'
import { getLanguage } from '~i18n'
import { useResourcesLanguageValue } from '~state/resourcesLanguage'

type RouteParams = Record<
  string,
  string | number | boolean | (string | number | boolean)[] | null | undefined
>

type PushRoute = {
  pathname: HrefObject['pathname']
  params?: RouteParams
}

const normalizeParam = (value: RouteParams[string]) => {
  if (Array.isArray(value)) {
    return value.map(item => String(item))
  }

  return value == null ? undefined : String(value)
}

const normalizedParamsEqual = (currentParams: RouteParams, targetParams: RouteParams = {}) => {
  const keys = new Set([
    ...Object.keys(currentParams).filter(key => !key.startsWith('__')),
    ...Object.keys(targetParams),
  ])

  return Array.from(keys).every(key => {
    const currentValue = normalizeParam(currentParams[key])
    const targetValue = normalizeParam(targetParams[key])
    return JSON.stringify(currentValue) === JSON.stringify(targetValue)
  })
}

export const usePushRouteOnce = () => {
  const router = useRouter()
  const defaultBibleVersion = useDefaultBibleVersion()
  const timelineLanguage = useResourcesLanguageValue().TIMELINE

  return (route: PushRoute) => {
    const normalizedRoute = normalizePublicRoute(
      route,
      defaultBibleVersion,
      getLanguage(),
      timelineLanguage
    ) as PushRoute
    const routeInfo = store.getRouteInfo()

    if (
      routeInfo.pathname === normalizedRoute.pathname &&
      normalizedParamsEqual(routeInfo.params as RouteParams, normalizedRoute.params)
    ) {
      return
    }

    navigateWithPageTransition(normalizedRoute.pathname, () =>
      router.push(normalizedRoute as HrefObject)
    )
  }
}
