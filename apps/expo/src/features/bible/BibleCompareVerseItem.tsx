import { useQuery } from '@tanstack/react-query'
import type { ComponentPropsWithRef as UIComponentProps } from 'react'
import { useTranslation } from 'react-i18next'
import { StyleSheet, View } from 'react-native'
import { twMerge } from '~common/ui/classNames'

import type { Theme as AppTheme } from '~themes'

import Link from '~common/Link'
import type { VerseIds } from '~common/types'
import Box from '~common/ui/Box'
import Paragraph from '~common/ui/Paragraph'
import Text from '~common/ui/Text'
import { useResourceAccess } from '~features/resources/resourceAccess'
import { loadBibleVerseTexts } from '~features/resources/resourceQueries'
import { getBook } from '~helpers/bibleBookCatalog'
import getVersesContent from '~helpers/getVersesContent'
import { isInterlinearCapableBibleVersion } from '~helpers/interlinearBiblePublications'
import { localQueryOptions } from '~helpers/queryOptions'
import { resourceQueryKeys } from '~helpers/resourceQueryKeys'
import {
  isStrongCapableBibleVersion,
  type StrongBibleVersionId,
} from '~helpers/strongBiblePublications'
import type { StrongSelection } from '~helpers/strongSelection'
import { removeBreakLines } from '~helpers/utils'
import verseToReference from '~helpers/verseToReference'
import { useResourcesLanguageValue } from '~state/resourcesLanguage'
import type { VersionCode } from '~state/tabs'
import CompareStrongVerseText from './CompareStrongVerseText'
import { getCompareVerseKeys } from './parallelVersification'

const Container = (
  componentProps: Omit<UIComponentProps<typeof View>, 'theme'> & {
    theme?: AppTheme
    className?: string
  }
) => {
  const { theme: _themeOverride, className, children, ...props } = componentProps

  const resolvedClassName = twMerge('p-[20px]', className)
  return (
    <View
      {...props}
      className={resolvedClassName}
      style={[props.style] as UIComponentProps<typeof View>['style']}
    >
      {/* A hairline above the version, from where its text starts. */}
      <View
        className="absolute top-[0px] right-[0px] left-[20px] bg-separator"
        style={{ height: StyleSheet.hairlineWidth }}
      />
      {children}
    </View>
  )
}

type CompareVerseItemProps = {
  versionId: VersionCode
  name: string
  selectedVerses: VerseIds
  // The version the verses were selected in: they are read in each version's own numbering
  sourceVersion?: string
  position: number
  strongMode?: boolean
  selectedStrongReference?: string
  onStrongSelect?: (selection: StrongSelection) => void
}

// The selected verses as a version numbers them, and whether that differs from the selection.
const useVersionVerseKeys = (
  selectedVerses: VerseIds,
  sourceVersion: string | undefined,
  versionId: string
) => {
  const selectedVerseKeys = Object.keys(selectedVerses)
  const verseKeys = getCompareVerseKeys(selectedVerseKeys, sourceVersion, versionId)
  return {
    verseKeys,
    isConverted:
      verseKeys.length !== selectedVerseKeys.length || verseKeys.some(key => !selectedVerses[key]),
  }
}

const CompareVerseItemTitle = ({
  versionId,
  name,
  reference,
}: {
  versionId: string
  name: string
  reference?: string
}) => (
  <Box className="overflow-hidden border-continuous flex-row">
    <Text className="text-dark-grey font-bold text-[14px] mb-[5px]">
      {versionId} - {name}
      {reference ? ` · ${reference}` : ''}
    </Text>
  </Box>
)

/** A version with no equivalent of the selected verses keeps its row (ADR draft, versification). */
const NoEquivalentCompareVerseItem = ({ versionId, name }: { versionId: string; name: string }) => {
  const { t } = useTranslation()
  return (
    <Container>
      <CompareVerseItemTitle versionId={versionId} name={name} />
      <Paragraph scale={-1} className="text-grey">
        {t('compare.noEquivalentVerse')}
      </Paragraph>
    </Container>
  )
}

const PlainCompareVerseItem = ({
  versionId,
  name,
  selectedVerses,
  sourceVersion,
  position,
}: CompareVerseItemProps) => {
  const resources = useResourceAccess()
  const { verseKeys: selectedVerseKeys, isConverted } = useVersionVerseKeys(
    selectedVerses,
    sourceVersion,
    versionId
  )
  const versionVerses: VerseIds = Object.fromEntries(
    selectedVerseKeys.map(key => [key, true] as const)
  )
  const { data, error, isPending } = useQuery({
    queryKey: resourceQueryKeys.bibleVerseSelection(versionId, selectedVerseKeys),
    queryFn: () =>
      getVersesContent({
        verses: versionVerses,
        version: versionId,
        position,
        loadVerseTexts: (version, verseKeys) => loadBibleVerseTexts(resources, version, verseKeys),
      }),
    networkMode: 'always',
    staleTime: Infinity,
    enabled: selectedVerseKeys.length > 0,
  })
  if (!selectedVerseKeys.length)
    return <NoEquivalentCompareVerseItem versionId={versionId} name={name} />

  const content = error ? 'Impossible de charger ce verset' : (data?.content ?? '')

  const [book, chapter, verse] = selectedVerseKeys[0].split('-').map(Number)
  // The reader opens one chapter: the converted verses may run into the next (KJV Malachi 3:18
  // and 4:1 for LSG 3:18-19)
  const focusVerses = selectedVerseKeys
    .map(key => key.split('-').map(Number))
    // eslint-disable-next-line eqeqeq
    .filter(([keyBook, keyChapter]) => keyBook == book && keyChapter == chapter)
    .map(([, , keyVerse]) => keyVerse)

  focusVerses.sort((a, b) => a - b)

  if (isPending) return null

  return (
    <Link
      route="BibleView"
      params={{
        contextDisplayMode: 'focused',
        book: getBook(book) || getBook(1)!,
        chapter,
        verse,
        version: versionId,
        focusVerses,
      }}
    >
      <Container>
        <CompareVerseItemTitle
          versionId={versionId}
          name={name}
          reference={isConverted ? data?.title : undefined}
        />
        <Paragraph scale={-1}>{removeBreakLines(content)}</Paragraph>
      </Container>
    </Link>
  )
}

type LexiconCompareVersionId = StrongBibleVersionId | 'BHG'

const StrongCompareVerseItem = ({
  versionId,
  name,
  selectedVerses,
  sourceVersion,
  position,
  selectedStrongReference,
  onStrongSelect,
}: CompareVerseItemProps & { versionId: LexiconCompareVersionId }) => {
  const resources = useResourceAccess()
  const strongLanguage = useResourcesLanguageValue().STRONG
  const { verseKeys: selectedVerseKeys, isConverted } = useVersionVerseKeys(
    selectedVerses,
    sourceVersion,
    versionId
  )
  const { data: strongVerses } = useQuery({
    queryKey: resourceQueryKeys.lexiconBibleVerseSelection({
      currentVersionId: versionId,
      defaultVersionId: versionId === 'BHG' ? 'LSG' : versionId,
      preferredVersionId: versionId === 'BHG' ? undefined : versionId,
      preferredInterlinearLocale: strongLanguage,
      verseKeys: selectedVerseKeys,
    }),
    queryFn: async () => {
      const results = await Promise.all(
        selectedVerseKeys.map(async verseKey => {
          const [book, chapter, verse] = verseKey.split('-').map(Number)
          return resources.lexiconBible.loadVerse({
            currentVersionId: versionId,
            defaultVersionId: versionId === 'BHG' ? 'LSG' : versionId,
            preferredVersionId: versionId === 'BHG' ? undefined : versionId,
            preferredInterlinearLocale: strongLanguage,
            fallbackVersionIds: [],
            book,
            chapter,
            verse,
          })
        })
      )
      if (!results.every(result => result.status === 'available')) return null
      return results.flatMap(result => (result.status === 'available' ? [result.verse] : []))
    },
    enabled: selectedVerseKeys.length > 0,
    ...localQueryOptions,
  })

  if (!strongVerses?.length || !onStrongSelect) {
    return (
      <PlainCompareVerseItem
        versionId={versionId}
        name={name}
        selectedVerses={selectedVerses}
        sourceVersion={sourceVersion}
        position={position}
      />
    )
  }

  return (
    <Container>
      <CompareVerseItemTitle
        versionId={versionId}
        name={name}
        reference={isConverted ? verseToReference(selectedVerseKeys) : undefined}
      />
      {strongVerses.map(verse => (
        <CompareStrongVerseText
          key={`${verse.Livre}-${verse.Chapitre}-${verse.Verset}`}
          verse={verse}
          version={versionId}
          selectedStrongReference={selectedStrongReference}
          onStrongSelect={onStrongSelect}
        />
      ))}
    </Container>
  )
}

const BibleCompareVerseItem = (props: CompareVerseItemProps) => {
  if (
    props.strongMode &&
    (isStrongCapableBibleVersion(props.versionId) ||
      isInterlinearCapableBibleVersion(props.versionId))
  ) {
    return <StrongCompareVerseItem {...props} versionId={props.versionId} />
  }

  return <PlainCompareVerseItem {...props} />
}

export default BibleCompareVerseItem
