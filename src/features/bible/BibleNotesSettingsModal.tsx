import { BottomSheetModal } from '@gorhom/bottom-sheet'
import { useRouter } from 'expo-router'
import React, { useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { Alert } from 'react-native'
import { useDispatch, useSelector } from 'react-redux'
import Modal from '~common/Modal'
import { useOpenInNewTab } from '~features/app-switcher/utils/useOpenInNewTab'
import generateUUID from '~helpers/generateUUID'
import { RootState } from '~redux/modules/reducer'
import { deleteNote } from '~redux/modules/user'
import books from '~assets/bible_versions/books-desc'

type Props = {
  ref?: React.RefObject<BottomSheetModal | null>
  noteId: string | null
  onClosed?: () => void
}

const NotesSettingsModal = ({ ref, noteId, onClosed }: Props) => {
  const { t } = useTranslation()
  const dispatch = useDispatch()
  const router = useRouter()
  const openInNewTab = useOpenInNewTab()
  const wordAnnotations = useSelector((state: RootState) => state.user.bible.wordAnnotations)

  const close = useCallback(() => {
    ref?.current?.dismiss()
  }, [ref])

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

    let verseKey: string
    let version: string | undefined

    // Handle annotation notes
    if (noteId.startsWith('annotation:')) {
      const annotationId = noteId.replace('annotation:', '')
      const annotation = wordAnnotations[annotationId]
      if (!annotation) return
      verseKey = annotation.ranges[0]?.verseKey
      version = annotation.version
    } else {
      // Handle regular verse notes
      verseKey = noteId.split('/')[0]
    }

    const [Livre, Chapitre, Verset] = verseKey.split('-')
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
          ...(version && { version }),
        },
      })
    }, 300)
  }

  return (
    <Modal.Body ref={ref} onModalClose={onClosed} enableDynamicSizing>
      <Modal.Item onPress={navigateToBible}>{t('Voir dans la Bible')}</Modal.Item>
      <Modal.Item onPress={openNoteInNewTab}>{t('tab.openInNewTab')}</Modal.Item>
      <Modal.Item color="quart" onPress={deleteNoteConfirmation}>
        {t('Supprimer')}
      </Modal.Item>
    </Modal.Body>
  )
}

export default NotesSettingsModal
