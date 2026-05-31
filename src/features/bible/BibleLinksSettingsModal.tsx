import { BottomSheetModal } from '~common/bottom-sheet'
import { useRouter } from 'expo-router'
import React, { useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { Alert } from 'react-native'
import { useDispatch, useSelector } from 'react-redux'
import { useSetAtom } from 'jotai/react'
import { ActionSheetItem } from '~common/ActionMenu'
import Modal from '~common/Modal'
import { deleteLink } from '~redux/modules/user'
import books from '~assets/bible_versions/books-desc'
import { unifiedTagsModalAtom } from '../../state/app'
import { RootState } from '~redux/modules/reducer'

type Props = {
  ref?: React.RefObject<BottomSheetModal | null>
  linkId: string | null
  onClosed: () => void
  title: string
  onEditRelations?: (linkId: string) => void
}

const LinksSettingsModal = ({ ref, linkId, onClosed, title, onEditRelations }: Props) => {
  const { t } = useTranslation()
  const dispatch = useDispatch()
  const router = useRouter()
  const setUnifiedTagsModal = useSetAtom(unifiedTagsModalAtom)
  const relations = useSelector((state: RootState) => state.user.bible.relations)

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
    const relation = Object.values(relations).find(
      candidate =>
        candidate.kind === 'system' &&
        candidate.type === 'externalLink' &&
        candidate.endpoints.some(
          endpoint => endpoint.type === 'externalLink' && endpoint.linkId === linkId
        )
    )
    const verseEndpoint = relation?.endpoints.find(endpoint => endpoint.type === 'verse')
    if (verseEndpoint?.type !== 'verse' || !verseEndpoint.verseKeys[0]) return
    const [Livre, Chapitre, Verset] = verseEndpoint.verseKeys[0].split('-')
    close()
    setTimeout(() => {
      router.push({
        pathname: '/bible-view',
        params: {
          contextDisplayMode: 'focused',
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

  const editRelations = () => {
    if (!linkId) return
    close()
    setTimeout(() => onEditRelations?.(linkId), 300)
  }

  return (
    <Modal.Body ref={ref} onModalClose={onClosed} enableDynamicSizing>
      <ActionSheetItem icon="book-open" label={t('Voir dans la Bible')} onPress={navigateToBible} />
      <ActionSheetItem icon="tag" label={t('Éditer les tags')} onPress={editTags} />
      <ActionSheetItem icon="git-merge" label={t('Éditer les relations')} onPress={editRelations} />
      <ActionSheetItem
        icon="trash-2"
        label={t('Supprimer')}
        color="quart"
        onPress={deleteLinkConfirmation}
      />
    </Modal.Body>
  )
}

export default LinksSettingsModal
