import { useRouter } from 'expo-router'
import type { HrefObject } from 'expo-router'
import { store } from 'expo-router/build/global-state/router-store'

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

  return (route: PushRoute) => {
    const routeInfo = store.getRouteInfo()

    if (
      routeInfo.pathname === route.pathname &&
      normalizedParamsEqual(routeInfo.params as RouteParams, route.params)
    ) {
      return
    }

    router.push(route as HrefObject)
  }
}
