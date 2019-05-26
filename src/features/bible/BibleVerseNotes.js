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
    notes: {}
  }

  loadPage = async (props) => {
    const { verse } = props.navigation.state.params || {}
    const { Livre, Chapitre, Verset } = verse
    let notes = []
    let { title } = await getVersesRef({ [Object.keys(props.notes)[0].split('/')[0]]: true })
    await Object.entries(props.notes).map(async (note, index) => {
      let firstVerseRef = note[0].split('/')[0]
      let bookNumber = parseInt(firstVerseRef.split('-')[0])
      let chapterNumber = parseInt(firstVerseRef.split('-')[1])
      let verseNumber = firstVerseRef.split('-')[2]
      let verseNumbers = {}
      note[0].split('/').map(ref => { verseNumbers[ref] = true })
      if (bookNumber === Livre && chapterNumber === Chapitre && verseNumber === Verset) {
        const { title } = await getVersesRef(verseNumbers)
        notes.push({ reference: title, notes: note[1] })
      }
    })
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
        <Paragraph scale={-2} style={{ fontWeight: 'bold' }}>
          {item.notes.title}
        </Paragraph>
        <Paragraph scale={-3} scaleLineHeight={-2}>
          {item.notes.description}
        </Paragraph>
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
