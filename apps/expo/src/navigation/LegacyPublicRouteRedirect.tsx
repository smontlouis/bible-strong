import type { ReactNode } from 'react'
import { Redirect, type Href, useLocalSearchParams } from 'expo-router'

import { getLanguage } from '~i18n'
import { useDefaultBibleVersion } from '~state/useDefaultBibleVersion'
import { useResourcesLanguageValue } from '~state/resourcesLanguage'
import { normalizePublicRoute } from './publicRouteNormalization'

export const LegacyPublicRouteRedirect = ({
  pathname,
  children,
}: {
  pathname: string
  children: ReactNode
}) => {
  const params = useLocalSearchParams<Record<string, string | string[]>>()
  const defaultBibleVersion = useDefaultBibleVersion()
  const timelineLanguage = useResourcesLanguageValue().TIMELINE
  const normalized = normalizePublicRoute(
    { pathname, params },
    defaultBibleVersion,
    getLanguage(),
    timelineLanguage
  )

  return normalized.pathname === pathname ? children : <Redirect href={normalized as Href} />
}
