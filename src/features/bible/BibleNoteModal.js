import React from 'react'
import Modal from 'react-native-modalbox'
import * as Icon from '@expo/vector-icons'
import styled from '@emotion/native'
import { pure, compose } from 'recompose'
import { connect } from 'react-redux'
import { BackHandler, ScrollView, Alert } from 'react-native'

import getVersesRef from '~helpers/getVersesRef'
import * as UserActions from '~redux/modules/user'
import Box from '~common/ui/Box'
import Text from '~common/ui/Text'
import Paragraph from '~common/ui/Paragraph'
import Button from '~common/ui/Button'
import orderVerses from '~helpers/orderVerses'

const StylizedModal = styled(Modal)({
  backgroundColor: 'transparent',
  flexDirection: 'row',
  alignItems: 'center',
  justifyContent: 'center'
})

const StyledTextInput = styled.TextInput(({ theme }) => ({
  color: theme.colors.default,
  borderBottomColor: theme.colors.border,
  borderBottomWidth: 2,
  paddingBottom: 10,
  marginTop: 20
}))

const StyledTextArea = styled.TextInput(({ theme }) => ({
  color: theme.colors.default,
  borderBottomColor: theme.colors.border,
  borderBottomWidth: 2,
  paddingBottom: 10,
  marginTop: 20,
  height: 200
}))

const Container = styled.View(({ theme }) => ({
  width: 300,
  height: 400,
  backgroundColor: theme.colors.reverse,
  borderRadius: 3,
  shadowColor: theme.colors.default,
  shadowOffset: { width: 0, height: 4 },
  shadowOpacity: 0.3,
  shadowRadius: 4,
  elevation: 2,
  alignItems: 'stretch',
  padding: 20
}))

const StyledDeleteIcon = styled.TouchableOpacity(({ theme }) => ({
  backgroundColor: theme.colors.quart,
  width: 30,
  height: 30,
  color: 'white',
  borderRadius: 5,
  alignItems: 'center',
  justifyContent: 'center',
  marginRight: 10
}))

class BibleNoteModal extends React.Component {
  state = {
    id: null,
    reference: '',
    title: '',
    description: '',
    isEditing: false
  }

  backHandler

  componentDidMount () {
    const { noteVerses, selectedVerses } = this.props
    this.loadPage(noteVerses || selectedVerses)
  }

  componentDidUpdate (prevProps, prevState) {
    if (prevProps.isOpen !== this.props.isOpen) {
      if (this.props.isOpen) {
        this.backHandler = BackHandler.addEventListener('hardwareBackPress', this.props.onClosed)
      } else {
        this.setState({ isEditing: false })
        this.backHandler && this.backHandler.remove()
      }
    }
  }

  checkIfExistingNote (notes, selectedVerses) {
    let orderedVerses = orderVerses(selectedVerses)
    let key = Object.keys(orderedVerses).join('/')
    if (notes[key]) {
      return {
        key,
        ...notes[key]
      }
    } else return null
  }

  loadPage = async (selectedVerses) => {
    const { notes } = this.props
    const existingNote = this.checkIfExistingNote(notes, selectedVerses)
    const { title: reference } = await getVersesRef(selectedVerses)

    if (existingNote) {
      this.setState({
        id: existingNote.key,
        reference,
        title: existingNote.title,
        description: existingNote.description,
        isEditing: false
      })
    } else {
      this.setState({
        reference,
        title: '',
        description: '',
        isEditing: true
      })
    }
  }

  onTitleChange = (text) => {
    this.setState({ title: text })
  }

  onDescriptionChange = (text) => {
    this.setState({ description: text })
  }

  onSaveNote = () => {
    const { title, description } = this.state
    const { noteVerses } = this.props
    this.props.addNote({ title, description, date: Date.now() }, noteVerses)
    this.setState({ title, description, isEditing: false })
  }

  deleteNote = (noteId) => {
    Alert.alert('Attention', 'Voulez-vous vraiment supprimer cette note?',
      [ { text: 'Non', onPress: () => null, style: 'cancel' },
        { text: 'Oui', onPress: () => { this.props.deleteNote(noteId); this.props.onClosed() }, style: 'destructive' }
      ])
  }

  cancelEditing = () => {
    if (!this.state.title) {
      this.props.onClosed()
    }
    this.setState({ isEditing: false })
  }

  render () {
    const { isOpen, onClosed } = this.props
    const { title, description, isEditing, id } = this.state
    const submitIsDisabled = !title

    return (
      <StylizedModal
        isOpen={isOpen}
        animationDuration={200}
        position='top'
        entry='center'
        backdropPressToClose={false}
        swipeToClose={false}
        backdropOpacity={0.1}
      >
        <Container>
          <Text fontSize={16} bold color='darkGrey' marginBottom={10}>
            Note pour {this.state.reference}
          </Text>
          {
            isEditing &&
            <>
              <StyledTextInput
                placeholder='Titre'
                onChangeText={this.onTitleChange}
                value={title}
              />
              <StyledTextArea
                placeholder='Description'
                multiline
                numberOfLines={5}
                onChangeText={this.onDescriptionChange}
                value={description}
              />
              <Box
                row
                marginTop={'auto'}
                justifyContent='flex-end'
              >
                <Button
                  small
                  reverse
                  onPress={this.cancelEditing}
                  title='Annuler'
                  style={{ marginRight: 10 }}
                />
                <Button
                  small
                  disabled={submitIsDisabled}
                  onPress={this.onSaveNote}
                  title='Sauvegarder'
                />

              </Box>
            </>
          }
          {
            !isEditing &&
            <>
              <Text title fontSize={20} marginBottom={10}>{title}</Text>
              <ScrollView flex={1}>
                <Paragraph small>{description}</Paragraph>
              </ScrollView>
              <Box
                row
                marginTop={10}
                justifyContent='flex-end'
              >
                {
                  id &&
                  <StyledDeleteIcon onPress={() => this.deleteNote(id)}>
                    <Icon.Feather
                      name={'trash-2'}
                      size={15}
                      color='white'
                    />
                  </StyledDeleteIcon>
                }
                <Button
                  small
                  onPress={() => this.setState({ isEditing: true })}
                  style={{ marginRight: 10 }}
                  title='Editer'
                />
                <Button
                  small
                  reverse
                  onPress={onClosed}
                  title='Fermer'
                />

              </Box>
            </>
          }
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
)(BibleNoteModal)
