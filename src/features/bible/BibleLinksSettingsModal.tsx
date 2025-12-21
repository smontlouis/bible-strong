import { withTheme } from '@emotion/react'
import { useNavigation } from '@react-navigation/native'
import React, { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Alert } from 'react-native'
import { useDispatch } from 'react-redux'
import { useAtom } from 'jotai/react'
import Modal from '~common/Modal'
import { useBottomSheetModal } from '~helpers/useBottomSheet'
import { deleteLink } from '~redux/modules/user'
import books from '~assets/bible_versions/books-desc'
import { multipleTagsModalAtom } from '../../state/app'

type Props = {
  linkId: string | null
  onClosed: () => void
  title: string
}

const LinksSettingsModal = ({ linkId, onClosed, title }: Props) => {
  const { t } = useTranslation()
  const dispatch = useDispatch()
  const navigation = useNavigation()
  const { ref, open, close } = useBottomSheetModal()
  const [, setMultipleTagsItem] = useAtom(multipleTagsModalAtom)

  useEffect(() => {
    if (linkId) {
      open()
    }
  }, [linkId, open])

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

  const editTags = () => {
    if (!linkId) return
    setMultipleTagsItem({
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

export default withTheme(LinksSettingsModal)
