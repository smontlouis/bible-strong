import React from 'react'
import Modal from 'react-native-modalbox'
import styled from '@emotion/native'
import { pure, compose } from 'recompose'
import { connect } from 'react-redux'
import { TextInput, Button } from 'react-native-paper'

import getVersesRef from '~helpers/getVersesRef'
import * as UserActions from '~redux/modules/user'
import Box from '~common/ui/Box'
import Text from '~common/ui/Text'
import orderVerses from '~helpers/orderVerses'

const StylizedModal = styled(Modal)({
  backgroundColor: 'transparent',
  flexDirection: 'row',
  alignItems: 'center',
  justifyContent: 'center'
})

const Container = styled.View(({ theme }) => ({
  width: 300,
  backgroundColor: theme.colors.reverse,
  borderRadius: 10,
  shadowColor: theme.colors.default,
  shadowOffset: { width: 0, height: 4 },
  shadowOpacity: 0.3,
  shadowRadius: 4,
  elevation: 2,
  alignItems: 'stretch',
  justifyContent: 'space-between',
  padding: 20
}))

const TextArea = styled(TextInput)(() => ({
  marginTop: 10,
  height: 200
}))

class BibleParamsModal extends React.Component {
  componentDidMount () {
    this.loadPage(this.props.selectedVerses)
  }
  componentWillReceiveProps (nextProps) {
    this.loadPage(nextProps.selectedVerses)
    if (!nextProps.isOpen && this.props.isOpen) this.setState({ title: '', description: '' })
  }

  checkIfExistingNote (notes, selectedVerses) {
    let orderedVerses = orderVerses(selectedVerses)
    let key = Object.keys(orderedVerses).join('/')
    if (notes[key]) return notes[key]
    else return null
  }

  loadPage = async (selectedVerses) => {
    const { notes } = this.props
    const existingNote = this.checkIfExistingNote(notes, selectedVerses)
    const { title: reference } = await getVersesRef(selectedVerses)
    if (existingNote) this.setState({ reference, title: existingNote.title, description: existingNote.description })
    else this.setState({ reference, title: '', description: '' })
  }

  state = {
    reference: '',
    title: '',
    description: ''
  }

  onTitleChange = (text) => {
    this.setState({ title: text })
  }

  onDescriptionChange = (text) => {
    this.setState({ description: text })
  }

  onSaveNote = () => {
    const { title, description } = this.state
    this.props.addNote({ title, description, date: Date.now() })
    this.props.onClosed()
  }

  render () {
    const { isOpen, onClosed } = this.props
    const { title, description } = this.state
    const submitIsDisabled = !title

    return (
      <StylizedModal
        isOpen={isOpen}
        animationDuration={200}
        position='top'
        entry='center'
        backdropPressToClose={false}
        backdropOpacity={0.1}
      >
        <Container>
          <Text fontSize={16} bold color='darkGrey' marginBottom={10}>
            Note pour {this.state.reference}
          </Text>
          <TextInput
            label='Titre'
            mode='outlined'
            onChangeText={this.onTitleChange}
            value={title}
          />
          <TextArea
            label='Description'
            mode='outlined'
            multiline
            numberOfLines={5}
            onChangeText={this.onDescriptionChange}
            value={description}
          />
          <Box
            row
            marginTop={15}
            justifyContent='space-between'
          >
            <Button
              mode='outlined'
              onPress={onClosed}
            >
              Annuler
            </Button>
            <Button
              mode='contained'
              disabled={submitIsDisabled}
              onPress={this.onSaveNote}
            >
              Sauvegarder
            </Button>
          </Box>
        </Container>
      </StylizedModal>
    )
  }
}

export default compose(
  pure,
  connect(
    state => ({
      selectedVerses: state.bible.selectedVerses,
      notes: state.user.bible.notes
    }),
    { ...UserActions }
  )
)(BibleParamsModal)
