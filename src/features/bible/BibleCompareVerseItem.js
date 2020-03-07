import React from 'react'
import styled from '@emotion/native'

import getVersesRef from '~helpers/getVersesRef'
import Paragraph from '~common/ui/Paragraph'
import Box from '~common/ui/Box'
import Text from '~common/ui/Text'
import { getIfVersionNeedsDownload } from '~helpers/bibleVersions'
import { removeBreakLines } from '~helpers/utils'

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
    const { versionId, name } = this.props

    if (
      (!content && versionNeedsDownload) ||
      versionId === 'INT' ||
      versionId === 'LSGS'
    ) {
      return null
    }

    return (
      <Container>
        <Box row>
          <Text color="darkGrey" bold fontSize={14}>
            {versionId} - {name}
          </Text>
        </Box>
        <Paragraph scale={-1} scaleLineHeight={-2}>
          {removeBreakLines(content)}
        </Paragraph>
      </Container>
    )
  }
}

export default CompareVerseItem
