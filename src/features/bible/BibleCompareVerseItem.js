import React from 'react'
import styled from '@emotion/native'

import getVersesRef from '~helpers/getVersesRef'
import Paragraph from '~common/ui/Paragraph'
import Box from '~common/ui/Box'
import Link from '~common/Link'
import Text from '~common/ui/Text'
import { getIfVersionNeedsDownload } from '~helpers/bibleVersions'
import { removeBreakLines } from '~helpers/utils'
import books from '~assets/bible_versions/books-desc'

const Container = styled.View(({ theme }) => ({
  padding: 20,
  borderBottomColor: theme.colors.border,
  borderBottomWidth: 1
}))

class CompareVerseItem extends React.Component {
  async componentDidMount() {
    const { selectedVerses, versionId, position } = this.props
    const versionNeedsDownload = await getIfVersionNeedsDownload(versionId)

    if (!versionNeedsDownload) {
      try {
        const { content } = await getVersesRef(
          selectedVerses,
          versionId,
          position
        )
        this.setState({ content, versionNeedsDownload })
      } catch (e) {
        this.setState({
          content: 'Impossible de charger ce verset',
          versionNeedsDownload
        })
      }
    }
  }

  state = {
    content: '',
    versionNeedsDownload: true
  }

  render() {
    const { content, versionNeedsDownload } = this.state
    const { versionId, name, selectedVerses } = this.props

    const focusVerses = Object.keys(selectedVerses)
      .map(v => v.split('-')[v.split('-').length - 1])
      .map(Number)

    focusVerses.sort((a, b) => a - b)

    const [book, chapter, verse] = Object.keys(selectedVerses)[0]
      .split('-')
      .map(Number)

    if (
      (!content && versionNeedsDownload) ||
      versionId === 'INT' ||
      versionId === 'LSGS'
    ) {
      return null
    }

    return (
      <Link
        route="BibleView"
        params={{
          isReadOnly: true,
          book: books[book - 1],
          chapter,
          verse,
          version: versionId,
          focusVerses
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
