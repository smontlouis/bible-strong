import * as Icon from '~common/ui/classNameIcons'
import type { ComponentPropsWithRef as UIComponentProps } from 'react'
import { Fragment, useState } from 'react'
import { TouchableOpacity } from 'react-native'
import { twMerge } from '~common/ui/classNames'

import type { Theme as AppTheme } from '~themes'

import { useQuery } from '@tanstack/react-query'
import { useLocalSearchParams } from 'expo-router'
import { useTranslation } from 'react-i18next'
import type { Book } from '~assets/bible_versions/books-desc'
import Empty from '~common/Empty'
import Link from '~common/Link'
import Loading from '~common/Loading'
import Box from '~common/ui/Box'
import FormSheetScreen from '~common/ui/FormSheetScreen'
import Paragraph from '~common/ui/Paragraph'
import ScrollView from '~common/ui/ScrollView'
import Text from '~common/ui/Text'
import type { BibleReadingAvailability } from '~features/resources/bibleReadingResourceAccess'
import { useResourceAccess } from '~features/resources/resourceAccess'
import {
  resourceFailureFromAccessError,
  resourceFailureFromAvailability,
} from '~features/resources/resourceFailure'
import ResourceUnavailableView from '~features/resources/ResourceUnavailableView'
import {
  getOfflineResourceQuerySignal,
  useOfflineResourceRegistry,
} from '~features/resources/useOfflineResourceRegistry'
import { getBook, getBooksForCanon } from '~helpers/bibleBookCatalog'
import { getBibleVersionCanonId } from '~helpers/bibleVersions'
import { createOfflineCopyDownloadItem } from '~helpers/downloadItemFactory'
import { resourceQueryKeys } from '~helpers/resourceQueryKeys'
import { useCanGoBackInStack } from '~navigation/useCanGoBackInStack'
import { usePushRouteOnce } from '~navigation/usePushRouteOnce'
import type { VersionCode } from '~state/tabs'
import { useDefaultBibleVersion } from '../../state/useDefaultBibleVersion'
import PericopeHeader from './PericopeHeader'

type PericopeVerse = {
  h1?: string
  h2?: string
  h3?: string
  h4?: string
  [key: string]: string | undefined
}
type PericopeChapter = Record<string, PericopeVerse>
type PericopeBook = Record<string, PericopeChapter>

const PericopeHeading = (
  componentProps: Omit<UIComponentProps<typeof Paragraph>, keyof { size: number } | 'theme'> &
    Omit<{ size: number }, 'theme'> & { theme?: AppTheme; className?: string }
) => {
  const { theme: _themeOverride, className, ...props } = componentProps

  const { size } = props
  const resolvedClassName = twMerge('ml-[20px] mb-[20px] font-bold', className)
  return (
    <Paragraph
      {...props}
      className={resolvedClassName}
      style={[{ fontSize: size }, props.style] as UIComponentProps<typeof Paragraph>['style']}
    />
  )
}

const StyledIcon = (
  componentProps: Omit<UIComponentProps<typeof Icon.Feather>, 'theme'> & {
    theme?: AppTheme
    className?: string
  }
) => {
  const { theme: _themeOverride, className, ...props } = componentProps

  const resolvedClassName = twMerge('text-default', className)
  return (
    <Icon.Feather
      {...props}
      className={resolvedClassName}
      style={[props.style] as UIComponentProps<typeof Icon.Feather>['style']}
    />
  )
}

/**
 * Recursively removes empty object branches from pericope data.
 * Note: this mutates the input object for performance on large pericope trees.
 */
function clearEmpties<T extends Record<string, unknown>>(o: T): T {
  for (const k in o) {
    if (!o[k] || typeof o[k] !== 'object') continue
    clearEmpties(o[k] as Record<string, unknown>)
    if (Object.keys(o[k] as Record<string, unknown>).length === 0) {
      delete o[k]
    }
  }
  return o
}

type PericopeScreenProps = {
  isFormSheet?: boolean
}

const PericopeScreen = ({ isFormSheet = false }: PericopeScreenProps) => {
  const pushRouteOnce = usePushRouteOnce()
  const canGoBackInStack = useCanGoBackInStack()
  const { t } = useTranslation()
  const resources = useResourceAccess()
  const resourceRegistry = useOfflineResourceRegistry()
  const defaultVersion = useDefaultBibleVersion()
  const params = useLocalSearchParams<{ book?: string; version?: string }>()
  const version = (params.version || defaultVersion) as VersionCode
  const hasBackButton = isFormSheet ? canGoBackInStack : true

  const initialBookNumber = params.book ? Number(params.book) : 1
  const [book, setBook] = useState<Book>(() => getBook(initialBookNumber) || getBook(1)!)

  const availabilityQuery = useQuery({
    queryKey: [
      ...resourceQueryKeys.biblePericope(version),
      'availability',
      getOfflineResourceQuerySignal(resourceRegistry, {
        kind: 'bible-pericope',
        versionId: version,
      }),
    ],
    queryFn: () =>
      resources.bibleReading.getPericopeAvailability?.(version) ??
      Promise.resolve({ status: 'available' as const }),
    networkMode: 'always',
  })
  const pericopeQuery = useQuery({
    queryKey: resourceQueryKeys.biblePericope(version),
    queryFn: () => resources.bibleReading.loadPericope(version),
    enabled: availabilityQuery.data?.status === 'available',
    networkMode: 'always',
  })
  const pericope = pericopeQuery.data
  const pericopeBook: PericopeBook = pericope
    ? clearEmpties((pericope[String(book.Numero)] || {}) as PericopeBook)
    : {}
  const canonBooks = getBooksForCanon(getBibleVersionCanonId(version))
  const currentBookIndex = canonBooks.findIndex(candidate => candidate.Numero === book.Numero)
  const previousBook = currentBookIndex > 0 ? canonBooks[currentBookIndex - 1] : undefined
  const nextBook =
    currentBookIndex >= 0 && currentBookIndex < canonBooks.length - 1
      ? canonBooks[currentBookIndex + 1]
      : undefined
  const unavailable =
    availabilityQuery.data?.status === 'unavailable'
      ? (availabilityQuery.data as Extract<BibleReadingAvailability, { status: 'unavailable' }>)
      : undefined
  const fallbackRecoveryIdentity = { kind: 'bible', versionId: version } as const
  const recoveryIdentity = unavailable?.recoveryIdentity ?? fallbackRecoveryIdentity
  const recoveryFileSize = Math.max(
    1,
    Math.round(createOfflineCopyDownloadItem(recoveryIdentity).estimatedSize / 1_000_000)
  )

  return (
    <FormSheetScreen isFormSheet={isFormSheet}>
      <Box className="overflow-hidden border-continuous flex-[1] bg-reverse">
        <PericopeHeader hasBackButton={hasBackButton} title={`${t('Péricopes')} ${version}`} />
        {availabilityQuery.isPending ? (
          <Box className="overflow-hidden border-continuous flex-[1] items-center justify-center">
            <Loading message={t('Chargement...')} />
          </Box>
        ) : availabilityQuery.isError || pericopeQuery.isError ? (
          <ResourceUnavailableView
            identity={recoveryIdentity}
            title={t('resource.pericope.temporarilyUnavailable')}
            fileSize={recoveryFileSize}
            failure={resourceFailureFromAccessError(pericopeQuery.error ?? availabilityQuery.error)}
            onRetry={() => {
              void availabilityQuery.refetch()
              void pericopeQuery.refetch()
            }}
          />
        ) : unavailable ? (
          <ResourceUnavailableView
            identity={recoveryIdentity}
            title={t('resource.pericope.offlineCopyNeeded')}
            offlineTitle={t('resource.pericope.temporarilyUnavailable')}
            fileSize={recoveryFileSize}
            failure={resourceFailureFromAvailability({
              reason: unavailable.reason,
              recoveries:
                unavailable.reason === 'invalid-offline-copy'
                  ? ['acquire-offline-copy', 'manage-offline-copies']
                  : ['acquire-offline-copy'],
            })}
            onRetry={() => {
              void availabilityQuery.refetch()
              void pericopeQuery.refetch()
            }}
          />
        ) : (
          <ScrollView>
            <Box className="overflow-hidden border-continuous p-[20px]">
              <Text className="text-[30px] font-bold mb-[40px]">{t(book.Nom)}</Text>
              {!Object.keys(pericopeBook).length ? (
                <Empty
                  message={t('Aucun péricope pour ce Livre, essayez avec une autre version.')}
                />
              ) : (
                Object.entries(pericopeBook).map(([chapterKey, chapterObject]) => (
                  <Fragment key={chapterKey}>
                    {!!Object.keys(chapterObject).length && (
                      <Text className="text-tertiary text-[12px] mb-[10px]">
                        {t('CHAPITRE')} {chapterKey}
                      </Text>
                    )}
                    {Object.entries(chapterObject).map(([verseKey, verseObject]) => {
                      const { h1, h2, h3, h4 } = verseObject
                      return (
                        <TouchableOpacity
                          accessibilityRole="button"
                          key={verseKey}
                          onPress={() =>
                            pushRouteOnce({
                              pathname: '/bible-view',
                              params: {
                                contextDisplayMode: 'focused',
                                book: JSON.stringify(book),
                                chapter: String(chapterKey),
                                version,
                                verse: '1',
                              },
                            })
                          }
                        >
                          {h1 && <PericopeHeading size={24}>{h1}</PericopeHeading>}
                          {h2 && <PericopeHeading size={20}>{h2}</PericopeHeading>}
                          {h3 && <PericopeHeading size={18}>{h3}</PericopeHeading>}
                          {h4 && <PericopeHeading size={16}>{h4}</PericopeHeading>}
                        </TouchableOpacity>
                      )
                    })}
                  </Fragment>
                ))
              )}
            </Box>
          </ScrollView>
        )}
        <Box className="overflow-hidden border-continuous bg-reverse flex-row px-[20px] py-[10px] justify-between">
          {previousBook && (
            <Link onPress={() => setBook(previousBook)}>
              <StyledIcon name="arrow-left" size={30} />
            </Link>
          )}
          {nextBook && (
            <Link onPress={() => setBook(nextBook)} style={{ marginLeft: 'auto' }}>
              <StyledIcon name="arrow-right" size={30} />
            </Link>
          )}
        </Box>
      </Box>
    </FormSheetScreen>
  )
}

export default PericopeScreen
