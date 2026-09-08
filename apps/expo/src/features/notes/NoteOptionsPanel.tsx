import { useConfirmDelete } from '~common/ContextualPanel/useConfirmDelete'
import { useTranslation } from 'react-i18next'
import { useDispatch, useSelector } from 'react-redux'
import ContextualPanel from '~common/ContextualPanel'
import PanelAction from '~common/ContextualPanel/PanelAction'
import { FeatherIcon } from '~common/ui/Icon'
import type { RootState } from '~redux/modules/reducer'
import { deleteNote } from '~redux/modules/user'
import { usePushRouteOnce } from '~navigation/usePushRouteOnce'
import { useOpenInNewTab } from '~features/app-switcher/utils/useOpenInNewTab'
import generateUUID from '~helpers/generateUUID'
import { getBibleViewParamsForVerseKeys } from '~features/studyRelations/openableStudyObjects'

export default function NoteOptionsPanel({ noteId, title }: { noteId: string; title: string }) {
  const { t } = useTranslation()
  const confirmDelete = useConfirmDelete()
  const dispatch = useDispatch()
  const push = usePushRouteOnce()
  const openTab = useOpenInNewTab()
  const annotations = useSelector((state: RootState) => state.user.bible.wordAnnotations)
  const relations = useSelector((state: RootState) => state.user.bible.relations)
  const annotation = noteId.startsWith('annotation:') ? annotations[noteId.slice(11)] : undefined
  const relation = Object.values(relations).find(
    candidate =>
      candidate.kind === 'system' &&
      candidate.type === 'annotates' &&
      candidate.endpoints.some(endpoint => endpoint.type === 'note' && endpoint.noteId === noteId)
  )
  const verseEndpoint = relation?.endpoints.find(endpoint => endpoint.type === 'verse')
  const verseKeys =
    annotation?.ranges.map(range => range.verseKey) ??
    (verseEndpoint?.type === 'verse' ? verseEndpoint.verseKeys : [])
  const version =
    annotation?.version ?? (verseEndpoint?.type === 'verse' ? verseEndpoint.version : undefined)
  return (
    <ContextualPanel
      accessibilityLabel={t('accessibility.options')}
      triggerSize={54}
      trigger={<FeatherIcon name="more-vertical" size={20} />}
      initialScreen="actions"
      width={300}
      screens={{
        actions: {
          title: t('Notes'),
          content: nav => (
            <>
              <PanelAction
                icon="file-text"
                label={t('Voir la note')}
                onPress={() => {
                  nav.close()
                  push({ pathname: '/note', params: { noteId } })
                }}
              />
              {verseKeys.length > 0 && (
                <PanelAction
                  icon="book-open"
                  label={t('Voir dans la Bible')}
                  onPress={() => {
                    nav.close()
                    push({
                      pathname: '/bible-view',
                      params: getBibleViewParamsForVerseKeys(verseKeys, version),
                    })
                  }}
                />
              )}
              <PanelAction
                icon="external-link"
                label={t('tab.openInNewTab')}
                onPress={() => {
                  nav.close()
                  openTab(
                    {
                      id: 'notes-' + generateUUID(),
                      type: 'notes',
                      title,
                      isRemovable: true,
                      data: { noteId },
                    },
                    { autoRedirect: true }
                  )
                }}
              />
              <PanelAction
                icon="trash-2"
                destructive
                label={t('Supprimer')}
                onPress={() => {
                  nav.close()
                  void confirmDelete(t('Voulez-vous vraiment supprimer cette note?'), () => {
                    dispatch(deleteNote(noteId))
                  })
                }}
              />
            </>
          ),
        },
      }}
    />
  )
}
