import React, { Component } from 'react'
import { FlatList } from 'react-native'
import { connect } from 'react-redux'
import styled from '@emotion/native'

import getVersesRef from '~helpers/getVersesRef'
import Container from '~common/ui/Container'
import Paragraph from '~common/ui/Paragraph'
import Box from '~common/ui/Box'
import Text from '~common/ui/Text'
import Header from '~common/Header'

const NoteContainer = styled.View(({ theme }) => ({
  padding: 20,
  borderBottomColor: theme.colors.border,
  borderBottomWidth: 1
}))

class BibleVerseNotes extends Component {
  componentDidMount () {
    this.loadPage(this.props)
  }
  componentWillReceiveProps (nextProps) {
    this.loadPage(nextProps)
  }

  state = {
    title: '',
    verse: {},
    notes: []
  }

  loadPage = async (props) => {
    const { verse } = props.navigation.state.params || {}
    let { title } = await getVersesRef({ [verse]: true })
    let notes = []

    await Promise.all(Object.entries(props.notes).map(async (note, index) => {
      let firstVerseRef = note[0].split('/')[0]
      let verseNumbers = {}
      note[0].split('/').map(ref => { verseNumbers[ref] = true })
      if (firstVerseRef === verse) {
        const { title: reference } = await getVersesRef(verseNumbers)
        notes.push({ reference, notes: note[1] })
      }
    }))
    this.setState({ title, verse, notes })
  }

  renderNote ({ item, index }) {
    return (
      <NoteContainer style={{ marginBottom: 10 }}>
        <Box row>
          <Text color='darkGrey' bold fontSize={14}>
            {item.reference}
          </Text>
        </Box>
        {!!item.notes.title && <Paragraph scale={-2} style={{ fontWeight: 'bold' }}>
          {item.notes.title}
        </Paragraph>}
        {!!item.notes.description && <Paragraph scale={-3} scaleLineHeight={-2}>
          {item.notes.description}
        </Paragraph>}
      </NoteContainer>
    )
  }

  render () {
    const { title, notes } = this.state
    return (
      <Container>
        <Header hasBackButton noBorder title={title ? `Notes sur ${title}` : 'Chargement...'} />
        <FlatList data={notes}
          renderItem={this.renderNote.bind(this)}
          keyExtractor={(item, index) => index.toString()}
          style={{ paddingBottom: 30 }}
        />
      </Container>
    )
  }
}

export default connect(
  (state) => ({
    notes: state.user.bible.notes
  })
)(BibleVerseNotes)
