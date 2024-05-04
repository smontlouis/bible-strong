import * as Sentry from '@sentry/react-native'
import React, { useEffect, useState } from 'react'

import { Alert, ScrollView, Share } from 'react-native'
import { useDispatch, useSelector } from 'react-redux'

import { useTranslation } from 'react-i18next'
import Modal from '~common/Modal'
import ModalHeader from '~common/ModalHeader'
import PopOverMenu from '~common/PopOverMenu'
import Snackbar from '~common/SnackBar'
import TagList from '~common/TagList'
import { VerseIds } from '~common/types'
import Box from '~common/ui/Box'
import Button from '~common/ui/Button'
import { FeatherIcon } from '~common/ui/Icon'
import MenuOption from '~common/ui/MenuOption'
import Paragraph from '~common/ui/Paragraph'
import Text from '~common/ui/Text'
import TextArea from '~common/ui/TextArea'
import TextInput from '~common/ui/TextInput'
import orderVerses from '~helpers/orderVerses'
import { useBottomSheet } from '~helpers/useBottomSheet'
import verseToReference from '~helpers/verseToReference'
import { RootState } from '~redux/modules/reducer'
import { addNote, deleteNote, Note } from '~redux/modules/user'
import { HStack } from '~common/ui/Stack'
import Spacer from '~common/ui/Spacer'
import { useSetAtom } from 'jotai/react'
import FabButton from '~common/ui/FabButton'
import { multipleTagsModalAtom } from '../../state/app'
import Fab from '~common/ui/Fab'

interface BibleNoteModalProps {
  noteVerses: VerseIds | undefined
  onClosed: () => void
}

const useCurrentNote = ({
  noteVerses,
}: {
  noteVerses: VerseIds | undefined
}) => {
  const note = useSelector((state: RootState) => {
    const notes = state.user.bible.notes
    const orderedVerses = orderVerses(noteVerses || {})
    const key = Object.keys(orderedVerses).join('/')
    if (notes[key]) {
      return {
        id: key,
        ...notes[key],
      } as Note
    }

    return null
  })

  return note
}

const BibleNoteModal = ({ noteVerses, onClosed }: BibleNoteModalProps) => {
  const { ref, open, close } = useBottomSheet()

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')

  const [isEditing, setIsEditing] = useState(false)

  const dispatch = useDispatch()
  const { t } = useTranslation()

  const currentNote = useCurrentNote({ noteVerses })
  const reference = verseToReference(noteVerses)
  const setMultipleTagsItem = useSetAtom(multipleTagsModalAtom)

  useEffect(() => {
    if (noteVerses) {
      open()
    }
  }, [noteVerses, open])

  useEffect(() => {
    if (noteVerses) {
      if (currentNote) {
        setIsEditing(false)
      } else {
        setIsEditing(true)
      }
    } else {
      setTitle('')
      setDescription('')
    }
  }, [noteVerses])

  const onSaveNoteFunc = () => {
    dispatch(
      addNote(
        { ...currentNote, title, description, date: Date.now() },
        noteVerses!
      )
    )
    setIsEditing(false)
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
            close()
          },
          style: 'destructive',
        },
      ]
    )
  }

  const cancelEditing = () => {
    setIsEditing(false)
  }

  const shareNote = () => {
    try {
      const message = `
Note pour ${reference}

${currentNote?.title}

${currentNote?.description}
      `
      Share.share({ message })
    } catch (e) {
      Snackbar.show(t('Erreur lors du partage.'))
      console.log(e)
      Sentry.captureException(e)
    }
  }

  const onEditNote = () => {
    setTitle(currentNote?.title || '')
    setDescription(currentNote?.description || '')
    setIsEditing(true)
  }

  const submitIsDisabled = !title || !description

  return (
    <Modal.Body
      ref={ref}
      onClose={onClosed}
      headerComponent={
        <ModalHeader
          onClose={close}
          title={reference}
          subTitle={t('Note')}
          rightComponent={
            currentNote ? (
              <PopOverMenu
                width={24}
                height={54}
                popover={
                  <>
                    <MenuOption onSelect={shareNote}>
                      <Box row alignItems="center">
                        <FeatherIcon name="share" size={15} />
                        <Text marginLeft={10}>{t('Partager')}</Text>
                      </Box>
                    </MenuOption>
                    <MenuOption onSelect={onEditNote}>
                      <Box row alignItems="center">
                        <FeatherIcon name="edit" size={15} />
                        <Text marginLeft={10}>{t('Éditer')}</Text>
                      </Box>
                    </MenuOption>
                    <MenuOption
                      onSelect={() =>
                        setMultipleTagsItem({
                          ...currentNote,
                          id: currentNote.id!,
                          entity: 'notes',
                        })
                      }
                    >
                      <Box row alignItems="center">
                        <FeatherIcon name="tag" size={15} />
                        <Text marginLeft={10}>{t('Éditer les tags')}</Text>
                      </Box>
                    </MenuOption>
                    <MenuOption
                      onSelect={() => deleteNoteFunc(currentNote?.id!)}
                    >
                      <Box row alignItems="center">
                        <FeatherIcon name="trash-2" size={15} />
                        <Text marginLeft={10}>{t('Supprimer')}</Text>
                      </Box>
                    </MenuOption>
                  </>
                }
              />
            ) : (
              undefined
            )
          }
        />
      }
      footerComponent={() =>
        isEditing ? (
          <HStack py={10} px={20} justifyContent="flex-end">
            <Box>
              <Button reverse onPress={cancelEditing}>
                {t('Annuler')}
              </Button>
            </Box>
            <Box>
              <Button disabled={submitIsDisabled} onPress={onSaveNoteFunc}>
                {t('Sauvegarder')}
              </Button>
            </Box>
          </HStack>
        ) : (
          <HStack py={10} px={20} justifyContent="flex-end">
            <Box>
              <Fab icon="edit" onPress={onEditNote} />
            </Box>
          </HStack>
        )
      }
    >
      <Box paddingHorizontal={20}>
        {isEditing && (
          <>
            <TextInput
              placeholder={t('Titre')}
              onChangeText={setTitle}
              value={title}
              style={{ marginTop: 20 }}
            />
            <Spacer />
            <TextArea
              placeholder={t('Description')}
              onChangeText={setDescription}
              value={description}
            />
          </>
        )}
        {!isEditing && (
          <>
            <Box py={20}>
              <Text title fontSize={20} marginBottom={10}>
                {currentNote?.title}
              </Text>
              <ScrollView style={{ flex: 1 }}>
                <Paragraph small>{currentNote?.description}</Paragraph>
                <TagList tags={currentNote?.tags} />
              </ScrollView>
            </Box>
          </>
        )}
      </Box>
    </Modal.Body>
  )
}

export default BibleNoteModal
