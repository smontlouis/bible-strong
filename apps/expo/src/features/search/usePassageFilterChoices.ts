import { useTranslation } from 'react-i18next'
import { useOfflineResourceRegistry } from '~features/resources/useOfflineResourceRegistry'
import { useResourceAccess } from '~features/resources/resourceAccess'
import useConnection from '~helpers/useConnection'
import { useDefaultBibleVersion } from '~state/useDefaultBibleVersion'
import { DEFAULT_BIBLE_VERSION_FILTER } from '~state/searchVersionFilter'
import { getBibleVersionCanonId, versions } from '~helpers/bibleVersions'
import { getBooksForCanon } from '~helpers/bibleBookCatalog'
import type { SearchSection, SearchCanon } from '~state/searchFilters'
import type { SearchSortOrder } from '~features/resources/bibleSearchAccess'

export function usePassageFilterChoices(canon: SearchCanon, resolvedSelectedVersion: string) {
  const { t } = useTranslation()
  const resourceRegistry = useOfflineResourceRegistry()
  const resources = useResourceAccess()
  const isConnected = useConnection()
  const defaultBibleVersion = useDefaultBibleVersion()
  const installedVersions = [...resourceRegistry.resources.values()].flatMap(entry =>
    entry.resource.kind === 'bible' &&
    (entry.availability.status === 'available' || entry.availability.status === 'corrupt')
      ? [entry.resource.versionId]
      : []
  )
  const remotelyReadableVersions = isConnected
    ? Object.keys(versions).filter(
        versionId =>
          resources.capabilities.getOnlineAccess({ kind: 'bible-text', versionId }).status ===
          'remotely-readable'
      )
    : []
  const searchableVersions = Array.from(
    new Set([...installedVersions, ...remotelyReadableVersions])
  )
  const canonBooks = getBooksForCanon(canon || getBibleVersionCanonId(resolvedSelectedVersion))
  const books = [
    {
      Numero: 0,
      Nom: t('Tout'),
      Chapitres: 0,
    },
    ...canonBooks,
  ].map(b => ({
    value: b.Numero,
    label: t(b.Nom),
  }))

  const sectionValues: { value: SearchSection; label: string }[] = [
    { value: '', label: t('Toute la Bible') },
    { value: 'at', label: t('Ancien Testament') },
    { value: 'nt', label: t('Nouveau Testament') },
  ]

  const canonLabels: Record<Exclude<SearchCanon, ''>, string> = {
    'protestant-66': t('search.canon.protestant'),
    'catholic-73': t('search.canon.catholic'),
    'clementine-vulgate': t('search.canon.clementine'),
    'theotex-septuagint': t('search.canon.septuagint'),
  }
  const availableCanons = Array.from(
    new Set(searchableVersions.map(version => getBibleVersionCanonId(version)))
  )
  const canonValues: { value: SearchCanon; label: string }[] = [
    { value: '', label: t('Tous les canons') },
    ...availableCanons.map(value => ({ value, label: canonLabels[value] })),
  ]

  const versionValues = [
    {
      value: DEFAULT_BIBLE_VERSION_FILTER,
      label: `${t('bibleDefaults.defaultReadingTitle')} (${defaultBibleVersion})`,
    },
    ...searchableVersions.map(v => ({ value: v, label: v })),
  ]

  const sortOrderValues: { value: SearchSortOrder; label: string }[] = [
    { value: 'relevance', label: t('Pertinence') },
    { value: 'book', label: t('Ordre biblique') },
  ]

  return {
    searchableVersions,
    sectionChoices: sectionValues,
    canonChoices: canonValues,
    bookChoices: books,
    versionChoices: versionValues,
    sortOrderChoices: sortOrderValues,
  }
}
