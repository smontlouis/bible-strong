import { BottomSheetModal } from '@gorhom/bottom-sheet'
import { useRouter } from 'expo-router'
import React, { useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { Alert } from 'react-native'
import { useDispatch } from 'react-redux'
import { useSetAtom } from 'jotai/react'
import Modal from '~common/Modal'
import { deleteLink } from '~redux/modules/user'
import books from '~assets/bible_versions/books-desc'
import { unifiedTagsModalAtom } from '../../state/app'

type Props = {
  ref?: React.RefObject<BottomSheetModal | null>
  linkId: string | null
  onClosed: () => void
  title: string
}

const LinksSettingsModal = ({ ref, linkId, onClosed, title }: Props) => {
  const { t } = useTranslation()
  const dispatch = useDispatch()
  const router = useRouter()
  const setUnifiedTagsModal = useSetAtom(unifiedTagsModalAtom)

  const close = useCallback(() => {
    ref?.current?.dismiss()
  }, [ref])

  const deleteLinkConfirmation = () => {
    if (!linkId) return
    Alert.alert(t('Attention'), t('Voulez-vous vraiment supprimer ce lien?'), [
      { text: t('Non'), onPress: () => null, style: 'cancel' },
      {
        text: t('Oui'),
        onPress: () => {
          dispatch(deleteLink(linkId))
          close()
        },
        style: 'destructive',
      },
    ])
  }

  const navigateToBible = () => {
    if (!linkId) return
    const [Livre, Chapitre, Verset] = linkId.split('/')[0].split('-')
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

  const editTags = () => {
    if (!linkId) return
    setUnifiedTagsModal({
      mode: 'select',
      title,
      entity: 'links',
      ids: { [linkId]: true },
    })
  }

  return (
    <Modal.Body ref={ref} onModalClose={onClosed} enableDynamicSizing>
      <Modal.Item onPress={navigateToBible}>{t('Voir dans la Bible')}</Modal.Item>
      <Modal.Item onPress={editTags}>{t('Éditer les tags')}</Modal.Item>
      <Modal.Item color="quart" onPress={deleteLinkConfirmation}>
        {t('Supprimer')}
      </Modal.Item>
    </Modal.Body>
  )
}

export default LinksSettingsModal
