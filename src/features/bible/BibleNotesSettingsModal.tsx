import { withTheme } from '@emotion/react'
import { useSetAtom } from 'jotai/react'
import React, { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Alert } from 'react-native'
import { shallowEqual, useDispatch, useSelector } from 'react-redux'
import Modal from '~common/Modal'
import { useBottomSheet } from '~helpers/useBottomSheet'
import { deleteNote } from '~redux/modules/user'
import { multipleTagsModalAtom } from '../../state/app'
import { VerseIds } from '~common/types'

type Props = {
  isOpen: VerseIds | null
  onClosed: () => void
  openNoteEditor: (noteId: string) => void
}

const NotesSettingsModal = ({ isOpen, onClosed, openNoteEditor }: Props) => {
  const { t } = useTranslation()
  const dispatch = useDispatch()
  const { ref, open, close } = useBottomSheet()

  useEffect(() => {
    if (isOpen) {
      open()
    }
  }, [isOpen, open])

  const noteId = isOpen
  const note = useSelector(
    state => state.user.bible.notes[noteId],
    shallowEqual
  )
  const setMultipleTagsItem = useSetAtom(multipleTagsModalAtom)

  const deleteNoteConfirmation = id => {
    Alert.alert(
      t('Attention'),
      t('Voulez-vous vraiment supprimer cette note?'),
      [
        { text: t('Non'), onPress: () => null, style: 'cancel' },
        {
          text: t('Oui'),
          onPress: () => {
            dispatch(deleteNote(id))
            close()
          },
          style: 'destructive',
        },
      ]
    )
  }

  return (
    <Modal.Body ref={ref} onModalClose={onClosed} enableDynamicSizing>
      <Modal.Item
        onPress={() => {
          close()
          setTimeout(() => {
            openNoteEditor(noteId)
          }, 500)
        }}
        bold
      >
        {t('Éditer')}
      </Modal.Item>
      <Modal.Item
        onPress={() => {
          close()
          setTimeout(() => {
            setMultipleTagsItem({ ...note, id: noteId, entity: 'notes' })
          }, 500)
        }}
        bold
      >
        {t('Éditer les tags')}
      </Modal.Item>
      <Modal.Item
        bold
        color="quart"
        onPress={() => deleteNoteConfirmation(noteId)}
      >
        {t('Supprimer')}
      </Modal.Item>
    </Modal.Body>
  )
}

export default withTheme(NotesSettingsModal)
