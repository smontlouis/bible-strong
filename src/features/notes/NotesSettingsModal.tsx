import { BottomSheetModal } from '@gorhom/bottom-sheet'
import { useRouter } from 'expo-router'
import produce from 'immer'
import { PrimitiveAtom, useAtom } from 'jotai'
import React, { useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { Alert } from 'react-native'
import { useDispatch } from 'react-redux'
import Modal from '~common/Modal'
import books from '~assets/bible_versions/books-desc'
import { useOpenInNewTab } from '~features/app-switcher/utils/useOpenInNewTab'
import generateUUID from '~helpers/generateUUID'
import { deleteNote } from '~redux/modules/user'
import { NotesTab } from '~state/tabs'

type Props = {
  ref?: React.RefObject<BottomSheetModal | null>
  noteId: string | null
  onClosed?: () => void
  notesAtom: PrimitiveAtom<NotesTab>
}

const NotesSettingsModal = ({ ref, noteId, onClosed, notesAtom }: Props) => {
  const { t } = useTranslation()
  const dispatch = useDispatch()
  const router = useRouter()
  const openInNewTab = useOpenInNewTab()
  const [, setNotesTab] = useAtom(notesAtom)

  const close = useCallback(() => {
    ref?.current?.dismiss()
  }, [ref])

  const deleteNoteConfirmation = () => {
    if (!noteId) return
    Alert.alert(t('Attention'), t('Voulez-vous vraiment supprimer cette note?'), [
      { text: t('Non'), onPress: () => null, style: 'cancel' },
      {
        text: t('Oui'),
        onPress: () => {
          dispatch(deleteNote(noteId))
          close()
        },
        style: 'destructive',
      },
    ])
  }

  const navigateToBible = () => {
    if (!noteId) return
    const [Livre, Chapitre, Verset] = noteId.split('/')[0].split('-')
    close()
    setTimeout(() => {
      router.push({
        pathname: '/bible-view',
        params: {
          isReadOnly: 'true',
          book: JSON.stringify(books[Number(Livre) - 1]),
          chapter: String(Chapitre),
          verse: String(Verset),
          focusVerses: JSON.stringify([Number(Verset)]),
        },
      })
    }, 300)
  }

  const openNoteInNewTab = () => {
    if (!noteId) return
    close()
    setTimeout(() => {
      openInNewTab({
        id: `notes-${generateUUID()}`,
        title: t('Notes'),
        isRemovable: true,
        type: 'notes',
        data: { noteId },
      })
    }, 300)
  }

  const openNoteDetail = () => {
    if (!noteId) return
    close()
    setNotesTab(
      produce(draft => {
        draft.data.noteId = noteId
      })
    )
  }

  return (
    <Modal.Body ref={ref} onModalClose={onClosed} enableDynamicSizing>
      <Modal.Item onPress={openNoteDetail}>{t('Voir la note')}</Modal.Item>
      <Modal.Item onPress={navigateToBible}>{t('Voir dans la Bible')}</Modal.Item>
      <Modal.Item onPress={openNoteInNewTab}>{t('tab.openInNewTab')}</Modal.Item>
      <Modal.Item color="quart" onPress={deleteNoteConfirmation}>
        {t('Supprimer')}
      </Modal.Item>
    </Modal.Body>
  )
}

export default NotesSettingsModal
