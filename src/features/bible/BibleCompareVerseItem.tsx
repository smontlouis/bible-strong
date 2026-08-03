import React from 'react'
import styled from '@emotion/native'
import { useQuery } from '@tanstack/react-query'

import getVersesContent from '~helpers/getVersesContent'
import Paragraph from '~common/ui/Paragraph'
import Box from '~common/ui/Box'
import Link from '~common/Link'
import Text from '~common/ui/Text'
import { getIfVersionNeedsDownload } from '~helpers/bibleVersions'
import { removeBreakLines } from '~helpers/utils'
import { getBook } from '~helpers/bibleBookCatalog'
import type { VerseIds } from '~common/types'
import type { VersionCode } from '~state/tabs'
import { useResourceAccess } from '~features/resources/resourceAccess'
import {
  isStrongCapableBibleVersion,
  type StrongBibleVersionId,
} from '~helpers/strongBiblePublications'
import type { StrongSelection } from '~helpers/strongSelection'
import { useResourcesLanguageValue } from '~state/resourcesLanguage'
import { localQueryOptions } from '~helpers/queryOptions'
import CompareStrongVerseText from './CompareStrongVerseText'

const Container = styled.View(({ theme }) => ({
  padding: 20,
  borderTopColor: theme.colors.border,
  borderTopWidth: 1,
}))

type CompareVerseItemProps = {
  versionId: VersionCode
  name: string
  selectedVerses: VerseIds
  position: number
  strongMode?: boolean
  onStrongSelect?: (selection: StrongSelection) => void
}

type CompareVerseItemState = {
  content: string
  versionNeedsDownload: boolean
}

class PlainCompareVerseItem extends React.Component<CompareVerseItemProps, CompareVerseItemState> {
  state: CompareVerseItemState = {
    content: '',
    versionNeedsDownload: true,
  }

  async componentDidMount() {
    const { selectedVerses, versionId, position } = this.props
    const versionNeedsDownload = await getIfVersionNeedsDownload(versionId)

    if (!versionNeedsDownload) {
      try {
        const { content } = await getVersesContent({
          verses: selectedVerses,
          version: versionId,
          position,
        })
        this.setState({ content, versionNeedsDownload })
      } catch {
        this.setState({
          content: 'Impossible de charger ce verset',
          versionNeedsDownload,
        })
      }
    }
  }

  render() {
    const { content, versionNeedsDownload } = this.state
    const { versionId, name, selectedVerses } = this.props

    const focusVerses = Object.keys(selectedVerses)
      .map(v => v.split('-')[v.split('-').length - 1])
      .map(Number)

    focusVerses.sort((a, b) => a - b)

    const [book, chapter, verse] = Object.keys(selectedVerses)[0].split('-').map(Number)

    if (!content && versionNeedsDownload) {
      return null
    }

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
          <Box row>
            <Text color="darkGrey" bold fontSize={14} marginBottom={5}>
              {versionId} - {name}
            </Text>
          </Box>
          <Paragraph scale={-1}>{removeBreakLines(content)}</Paragraph>
        </Container>
      </Link>
    )
  }
}

const StrongCompareVerseItem = ({
  versionId,
  name,
  selectedVerses,
  position,
  onStrongSelect,
}: CompareVerseItemProps & { versionId: StrongBibleVersionId }) => {
  const resources = useResourceAccess()
  const strongLanguage = useResourcesLanguageValue().STRONG
  const selectedVerseKeys = Object.keys(selectedVerses)
  const { data: strongVerses } = useQuery({
    queryKey: ['compare-strong-verses', versionId, selectedVerseKeys, strongLanguage],
    queryFn: async () => {
      const results = await Promise.all(
        selectedVerseKeys.map(async verseKey => {
          const [book, chapter, verse] = verseKey.split('-').map(Number)
          return resources.lexiconBible.loadVerse({
            currentVersionId: versionId,
            defaultVersionId: versionId,
            preferredVersionId: versionId,
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
      <Box row>
        <Text color="darkGrey" bold fontSize={14} marginBottom={5}>
          {versionId} - {name}
        </Text>
      </Box>
      {strongVerses.map(verse => (
        <CompareStrongVerseText
          key={`${verse.Livre}-${verse.Chapitre}-${verse.Verset}`}
          verse={verse}
          version={versionId}
          onStrongSelect={onStrongSelect}
        />
      ))}
    </Container>
  )
}

const BibleCompareVerseItem = (props: CompareVerseItemProps) => {
  if (props.strongMode && isStrongCapableBibleVersion(props.versionId)) {
    return <StrongCompareVerseItem {...props} versionId={props.versionId} />
  }

  return <PlainCompareVerseItem {...props} />
}

export default BibleCompareVerseItem
