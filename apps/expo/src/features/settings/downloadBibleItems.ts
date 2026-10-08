import type { Version } from '~helpers/bibleVersions'
import type { ResourceLanguage } from '~helpers/databaseTypes'
import { createOfflineCopyId } from '~helpers/offlineCopy'
import {
  getStrongBibleAttributionKey,
  getStrongDatasetId,
  isStrongCapableBibleVersion,
} from '~helpers/strongBiblePublications'

import { getStrongIndexBibleName } from './downloadVersionGroups'
import {
  createBibleDownloadItem,
  createInterlinearSidecarDownloadItem,
  createStrongSidecarDownloadItem,
} from '~helpers/downloadItemFactory'

export interface UnifiedDownloadItem {
  id: string
  name: string
  subtitle?: string
  parentItemId?: string
  estimatedSize: number
  lang: 'fr' | 'en' | 'other'
  searchText: string
}

type Translate = (key: string, options?: Record<string, unknown>) => string

export function buildBibleItems(
  versionList: Version[],
  appLang: string,
  t: Translate
): UnifiedDownloadItem[] {
  return versionList.flatMap(version => {
    const displayName = appLang === 'en' && version.name_en ? version.name_en : version.name
    const base: UnifiedDownloadItem = {
      id: createOfflineCopyId({ kind: 'bible', versionId: version.id }),
      name: `${version.id}  ${displayName}`,
      subtitle: version.c,
      estimatedSize: createBibleDownloadItem(version.id).estimatedSize,
      lang: version.type === 'en' ? 'en' : version.type === 'other' ? 'other' : 'fr',
      searchText:
        `${version.id} ${version.name} ${version.name_en || ''} ${version.c || ''}`.toLowerCase(),
    }

    if (version.id === 'BHG') {
      return [
        base,
        ...(['fr', 'en'] as ResourceLanguage[]).map(locale => {
          return {
            id: createOfflineCopyId({
              kind: 'interlinear-index',
              versionId: 'BHG',
              language: locale,
            }),
            name: `${t('downloads.interlinearIndexName')} · ${t(
              `versionCatalog.language.${locale}`
            )}`,
            subtitle: t('downloads.interlinearAttribution'),
            parentItemId: base.id,
            estimatedSize: createInterlinearSidecarDownloadItem(locale).estimatedSize,
            lang: 'other' as const,
            searchText: `BHG STEP interlinear ${locale}`.toLowerCase(),
          }
        }),
      ]
    }

    if (!isStrongCapableBibleVersion(version.id)) return [base]

    const strongIndexBibleName = getStrongIndexBibleName(displayName)
    return [
      base,
      {
        id: createOfflineCopyId({ kind: 'strong-bible-index', versionId: version.id }),
        name: t('downloads.strongIndexName', { bible: strongIndexBibleName }),
        subtitle: t(getStrongBibleAttributionKey(version.id)),
        parentItemId: base.id,
        estimatedSize: createStrongSidecarDownloadItem(version.id).estimatedSize,
        lang: version.type === 'en' ? 'en' : 'fr',
        searchText:
          `${version.id} ${version.name} ${strongIndexBibleName} strong index ${getStrongDatasetId(version.id)}`.toLowerCase(),
      },
    ]
  })
}
