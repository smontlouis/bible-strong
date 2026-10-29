import {
  projectBiblicalPlace,
  type BiblicalMapPlace,
} from '@bible-strong/resource-domain/biblical-map'
import { useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'

import { useResourceAccess } from '~features/resources/resourceAccess'
import type { ResourceLanguage } from '~helpers/databaseTypes'
import { staticResourceQueryOptions } from '~helpers/queryOptions'
import { resourceQueryKeys } from '~helpers/resourceQueryKeys'
import { useEntityPortraitCatalog } from '../entityPortraitManifest'
import { getEntityPortraitLocalUri, useEntityPortraitLocalHashes } from '../entityPortraitPack'
import { getEntityPortraitUri } from '../entityPortraits'

/**
 * Every located place of the entity publication as the map draws it: on the device once the
 * entity module is downloaded, from the Resource API otherwise. A painted place carries its
 * painting, from the offline pack when the device holds it.
 */
export const useBiblicalPlaces = () => {
  const { i18n } = useTranslation()
  const language: ResourceLanguage = i18n.language === 'fr' ? 'fr' : 'en'
  const resources = useResourceAccess()
  const query = useQuery({
    queryKey: resourceQueryKeys.strongLexiconPlaces(language),
    queryFn: () => resources.strongLexicon.loadPlaces(language),
    ...staticResourceQueryOptions,
  })
  const catalog = useEntityPortraitCatalog()
  const localHashes = useEntityPortraitLocalHashes()

  const places = useMemo(
    () =>
      (query.data ?? [])
        .flatMap((place): BiblicalMapPlace[] => {
          if (place.latitude === undefined || place.longitude === undefined) return []
          const at = projectBiblicalPlace(place.latitude, place.longitude)
          if (!at) return []
          const hash = catalog?.entities[place.uniqueName]?.hash
          return [
            {
              uniqueName: place.uniqueName,
              name: place.name,
              x: at[0],
              y: at[1],
              chapterCount: place.chapterCount,
              ...(hash
                ? {
                    picture: localHashes.has(hash)
                      ? getEntityPortraitLocalUri(hash, 'w256')
                      : getEntityPortraitUri(place.uniqueName, hash),
                  }
                : {}),
            },
          ]
        })
        // The most named are drawn last, over their neighbours.
        .sort((left, right) => left.chapterCount - right.chapterCount),
    [query.data, catalog, localHashes]
  )

  return { places, loading: query.isLoading, failed: query.isError }
}
