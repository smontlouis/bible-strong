import { useQuery } from '@tanstack/react-query'
import type { ComponentPropsWithRef as UIComponentProps } from 'react'
import * as NativeUI from 'react-native'
import { twMerge } from '~common/ui/classNames'
import { useResolveClassNames } from 'uniwind'
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
import { useResourcesLanguageValue } from '~state/resourcesLanguage'
import type { VersionCode } from '~state/tabs'
import CompareStrongVerseText from './CompareStrongVerseText'

const Container = (
  componentProps: Omit<UIComponentProps<typeof NativeUI.View>, 'theme'> & {
    theme?: AppTheme
    className?: string
  }
) => {
  const { theme: _themeOverride, className, ...props } = componentProps

  const classStyles = useResolveClassNames(
    twMerge('p-[20px] border-t-border border-t-[1px]', className)
  )
  return (
    <NativeUI.View
      {...props}
      style={[classStyles, {}, props.style] as UIComponentProps<typeof NativeUI.View>['style']}
    />
  )
}

type CompareVerseItemProps = {
  versionId: VersionCode
  name: string
  selectedVerses: VerseIds
  position: number
  strongMode?: boolean
  selectedStrongReference?: string
  onStrongSelect?: (selection: StrongSelection) => void
}

const PlainCompareVerseItem = ({
  versionId,
  name,
  selectedVerses,
  position,
}: CompareVerseItemProps) => {
  const resources = useResourceAccess()
  const selectedVerseKeys = Object.keys(selectedVerses)
  const { data, error, isPending } = useQuery({
    queryKey: resourceQueryKeys.bibleVerseSelection(versionId, selectedVerseKeys),
    queryFn: () =>
      getVersesContent({
        verses: selectedVerses,
        version: versionId,
        position,
        loadVerseTexts: (version, verseKeys) => loadBibleVerseTexts(resources, version, verseKeys),
      }),
    networkMode: 'always',
    staleTime: Infinity,
  })
  const content = error ? 'Impossible de charger ce verset' : (data?.content ?? '')

  const focusVerses = selectedVerseKeys.map(v => v.split('-')[v.split('-').length - 1]).map(Number)

  focusVerses.sort((a, b) => a - b)

  const [book, chapter, verse] = selectedVerseKeys[0].split('-').map(Number)

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
        <Box className="overflow-hidden border-continuous flex-row">
          <Text className="text-dark-grey font-bold text-[14px] mb-[5px]">
            {versionId} - {name}
          </Text>
        </Box>
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
  position,
  selectedStrongReference,
  onStrongSelect,
}: CompareVerseItemProps & { versionId: LexiconCompareVersionId }) => {
  const resources = useResourceAccess()
  const strongLanguage = useResourcesLanguageValue().STRONG
  const selectedVerseKeys = Object.keys(selectedVerses)
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
    ...localQueryOptions,
  })

  if (!strongVerses || !onStrongSelect) {
    return (
      <PlainCompareVerseItem
        versionId={versionId}
        name={name}
        selectedVerses={selectedVerses}
        position={position}
      />
    )
  }

  return (
    <Container>
      <Box className="overflow-hidden border-continuous flex-row">
        <Text className="text-dark-grey font-bold text-[14px] mb-[5px]">
          {versionId} - {name}
        </Text>
      </Box>
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
