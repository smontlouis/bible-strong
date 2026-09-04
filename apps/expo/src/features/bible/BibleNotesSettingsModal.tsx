import { Sheet, type SheetRef } from '~common/sheet'
import React, { useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { Alert } from 'react-native'
import { useDispatch, useSelector } from 'react-redux'
import { ActionSheetItem } from '~common/ActionMenu'
import { useOpenInNewTab } from '~features/app-switcher/utils/useOpenInNewTab'
import generateUUID from '~helpers/generateUUID'
import { RootState } from '~redux/modules/reducer'
import { deleteNote } from '~redux/modules/user'
import { usePushRouteOnce } from '~navigation/usePushRouteOnce'
import { getBibleViewParamsForVerseKeys } from '~features/studyRelations/openableStudyObjects'

type Props = {
  ref?: React.RefObject<SheetRef | null>
  noteId: string | null
  onClosed?: () => void
}

const NotesSettingsModal = ({ ref, noteId, onClosed }: Props) => {
  const { t } = useTranslation()
  const dispatch = useDispatch()
  const pushRouteOnce = usePushRouteOnce()
  const openInNewTab = useOpenInNewTab()
  const wordAnnotations = useSelector((state: RootState) => state.user.bible.wordAnnotations)
  const relations = useSelector((state: RootState) => state.user.bible.relations)

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

    let verseKeys: string[]
    let version: string | undefined

    // Handle annotation notes
    if (noteId.startsWith('annotation:')) {
      const annotationId = noteId.replace('annotation:', '')
      const annotation = wordAnnotations[annotationId]
      if (!annotation) return
      verseKeys = annotation.ranges.map(range => range.verseKey)
      version = annotation.version
    } else {
      const relation = Object.values(relations).find(
        candidate =>
          candidate.kind === 'system' &&
          candidate.type === 'annotates' &&
          candidate.endpoints.some(
            endpoint => endpoint.type === 'note' && endpoint.noteId === noteId
          )
      )
      const verseEndpoint = relation?.endpoints.find(endpoint => endpoint.type === 'verse')
      if (verseEndpoint?.type !== 'verse') return
      verseKeys = verseEndpoint.verseKeys
      version = verseEndpoint.version
    }

    close()
    setTimeout(() => {
      pushRouteOnce({
        pathname: '/bible-view',
        params: getBibleViewParamsForVerseKeys(verseKeys, version),
      })
    }, 300)
  }

  return (
    <Sheet ref={ref} onDismiss={onClosed}>
      <ActionSheetItem icon="book-open" label={t('Voir dans la Bible')} onPress={navigateToBible} />
      <ActionSheetItem
        icon="external-link"
        label={t('tab.openInNewTab')}
        onPress={openNoteInNewTab}
      />
      <ActionSheetItem
        icon="trash-2"
        label={t('Supprimer')}
        color="quart"
        onPress={deleteNoteConfirmation}
      />
    </Sheet>
  )
}

export default NotesSettingsModal
