import * as Icon from '@expo/vector-icons'
import * as Sentry from '@sentry/react-native'
import React, { useEffect, useState } from 'react'
import Modal from 'react-native-modal'

import styled from '@emotion/native'
import { Alert, ScrollView, Share } from 'react-native'
import { useDispatch, useSelector } from 'react-redux'

import { useTranslation } from 'react-i18next'
import Snackbar from '~common/SnackBar'
import TagList from '~common/TagList'
import Box from '~common/ui/Box'
import Button from '~common/ui/Button'
import Paragraph from '~common/ui/Paragraph'
import Text from '~common/ui/Text'
import TextArea from '~common/ui/TextArea'
import TextInput from '~common/ui/TextInput'
import orderVerses from '~helpers/orderVerses'
import { useMediaQueriesArray } from '~helpers/useMediaQueries'
import verseToReference from '~helpers/verseToReference'
import { RootState } from '~redux/modules/reducer'
import { addNote, deleteNote } from '~redux/modules/user'

const StylizedModal = styled(Modal)({
  flexDirection: 'row',
  alignItems: 'center',
  justifyContent: 'center',
})

const Container = ({ ...props }) => {
  const r = useMediaQueriesArray()
  const modalWidth = r([300, 340, 400, 500])
  const modalHeight = r([400, 450, 500, 600])

  return (
    <StyledContainer
      modalHeight={modalHeight}
      modalWidth={modalWidth}
      {...props}
    />
  )
}
const StyledContainer = styled.View(({ theme, modalWidth, modalHeight }) => ({
  width: modalWidth,
  height: modalHeight,
  backgroundColor: theme.colors.reverse,
  borderRadius: 3,
  shadowColor: theme.colors.default,
  shadowOffset: { width: 0, height: 4 },
  shadowOpacity: 0.3,
  shadowRadius: 4,
  elevation: 2,
  padding: 20,
}))

const StyledIcon = styled.TouchableOpacity(({ theme, color }) => ({
  backgroundColor: theme.colors[color],
  width: 30,
  height: 30,
  color: 'white',
  borderRadius: 5,
  alignItems: 'center',
  justifyContent: 'center',
  marginLeft: 10,
}))

const BibleNoteModal = ({
  noteVerses,
  selectedVerses,
  onClosed,
  onSaveNote,
  isOpen,
}) => {
  const [id, setId] = useState(null)
  const [reference, setReference] = useState('')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [tags, setTags] = useState({})
  const [isEditing, setIsEditing] = useState(false)

  const dispatch = useDispatch()
  const { t } = useTranslation()
  const notes = useSelector((state: RootState) => state.user.bible.notes)

  useEffect(() => {
    loadPage(noteVerses || selectedVerses)
  }, [])

  const checkIfExistingNote = (notes, selectedVerses) => {
    const orderedVerses = orderVerses(selectedVerses)
    const key = Object.keys(orderedVerses).join('/')
    if (notes[key]) {
      return {
        key,
        ...notes[key],
      }
    }
    return null
  }

  const loadPage = verses => {
    const existingNote = checkIfExistingNote(notes, verses)
    const reference = verseToReference(verses)

    if (existingNote) {
      setId(existingNote.key)
      setReference(reference)
      setTitle(existingNote.title)
      setDescription(existingNote.description)
      setTags(existingNote.tags)
      setIsEditing(false)
    } else {
      setReference(reference)
      setTitle('')
      setDescription('')
      setIsEditing(true)
    }
  }

  const onTitleChange = (text: string) => {
    setTitle(text)
  }

  const onDescriptionChange = (text: string) => {
    setDescription(text)
  }

  const onSaveNoteFunc = () => {
    dispatch(
      addNote(
        { title, description, date: Date.now(), ...(tags && { tags }) },
        noteVerses || selectedVerses
      )
    )
    // TODO - clear selected verses
    onClosed()

    const orderedVerses = orderVerses(noteVerses || selectedVerses)
    const key = Object.keys(orderedVerses).join('/')

    onSaveNote?.(key)
  }

  const deleteNoteFunc = (noteId: string) => {
    Alert.alert(
      t('Attention'),
      t('Voulez-vous vraiment supprimer cette note?'),
      [
        { text: t('Non'), onPress: () => null, style: 'cancel' },
        {
          text: t('Oui'),
          onPress: () => {
            dispatch(deleteNote(noteId))
            onClosed()
          },
          style: 'destructive',
        },
      ]
    )
  }

  const cancelEditing = () => {
    if (!title) {
      onClosed()
    }
    setIsEditing(false)
  }

  const shareNote = () => {
    try {
      const message = `
Note pour ${reference}

${title}

${description}
      `
      Share.share({ message })
    } catch (e) {
      Snackbar.show(t('Erreur lors du partage.'))
      console.log(e)
      Sentry.captureException(e)
    }
  }

  const submitIsDisabled = !title || !description

  return (
    <StylizedModal
      isVisible={isOpen}
      animationInTiming={300}
      avoidKeyboard
      onBackButtonPress={onClosed}
      animationIn="fadeInDown"
      animationOut="fadeOutUp"
    >
      <Container>
        <Text fontSize={16} bold color="darkGrey" marginBottom={10}>
          {t('Note pour')} {reference}
        </Text>
        {isEditing && (
          <>
            <TextInput
              placeholder={t('Titre')}
              onChangeText={onTitleChange}
              value={title}
              style={{ marginTop: 20 }}
            />
            <TextArea
              placeholder={t('Description')}
              multiline
              onChangeText={onDescriptionChange}
              value={description}
            />
            <Box row marginTop="auto" justifyContent="flex-end">
              <Button
                small
                reverse
                onPress={cancelEditing}
                style={{ marginRight: 10 }}
              >
                {t('Annuler')}
              </Button>
              <Button
                small
                disabled={submitIsDisabled}
                onPress={onSaveNoteFunc}
              >
                {t('Sauvegarder')}
              </Button>
            </Box>
          </>
        )}
        {!isEditing && (
          <>
            <Text title fontSize={20} marginBottom={10}>
              {title}
            </Text>
            <ScrollView style={{ flex: 1 }}>
              <Paragraph small>{description}</Paragraph>
              <TagList tags={tags} />
            </ScrollView>
            <Box row marginTop={10} justifyContent="flex-end">
              {id && (
                <StyledIcon onPress={() => deleteNoteFunc(id)} color="quart">
                  <Icon.Feather name="trash-2" size={15} color="white" />
                </StyledIcon>
              )}
              {id && (
                <StyledIcon onPress={() => shareNote()} color="success">
                  <Icon.MaterialIcons name="share" size={15} color="white" />
                </StyledIcon>
              )}
              {id && (
                <StyledIcon onPress={() => setIsEditing(true)} color="primary">
                  <Icon.MaterialIcons name="edit" size={15} color="white" />
                </StyledIcon>
              )}
              <StyledIcon onPress={onClosed} color="grey">
                <Icon.MaterialIcons name="close" size={15} color="white" />
              </StyledIcon>
            </Box>
          </>
        )}
      </Container>
    </StylizedModal>
  )
}

export default BibleNoteModal
