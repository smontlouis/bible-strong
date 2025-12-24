import { BottomSheetModal } from '@gorhom/bottom-sheet'
import { useNavigation } from '@react-navigation/native'
import React, { useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { Alert } from 'react-native'
import { useDispatch } from 'react-redux'
import Modal from '~common/Modal'
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
  const navigation = useNavigation()

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
      // @ts-ignore
      navigation.navigate('BibleView', {
        isReadOnly: true,
        book: books[Number(Livre) - 1],
        chapter: Number(Chapitre),
        verse: Number(Verset),
        focusVerses: [Number(Verset)],
      })
    }, 300)
  }

  return (
    <Modal.Body ref={ref} onModalClose={onClosed} enableDynamicSizing>
      <Modal.Item onPress={navigateToBible}>{t('Voir dans la Bible')}</Modal.Item>
      <Modal.Item color="quart" onPress={deleteNoteConfirmation}>
        {t('Supprimer')}
      </Modal.Item>
    </Modal.Body>
  )
}

export default NotesSettingsModal
