import React from 'react'
import styled from '@emotion/native'

import getVersesContent from '~helpers/getVersesContent'
import Paragraph from '~common/ui/Paragraph'
import Box from '~common/ui/Box'
import Link from '~common/Link'
import Text from '~common/ui/Text'
import { getIfVersionNeedsDownload, isStrongVersion } from '~helpers/bibleVersions'
import { removeBreakLines } from '~helpers/utils'
import books from '~assets/bible_versions/books-desc'
import type { VerseIds } from '~common/types'
import type { VersionCode } from '~state/tabs'

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
}

type CompareVerseItemState = {
  content: string
  versionNeedsDownload: boolean
}

class CompareVerseItem extends React.Component<CompareVerseItemProps, CompareVerseItemState> {
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

    if ((!content && versionNeedsDownload) || isStrongVersion(versionId)) {
      return null
    }

    return (
      <Link
        route="BibleView"
        params={{
          contextDisplayMode: 'focused',
          book: books[book - 1],
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

export default CompareVerseItem
