import { useConfirmDelete } from '~common/ContextualPanel/useConfirmDelete'
import { useTranslation } from 'react-i18next'
import { useDispatch, useSelector } from 'react-redux'
import ContextualPanel from '~common/ContextualPanel'
import PanelAction from '~common/ContextualPanel/PanelAction'
import { useEntityTagsScreen } from '~common/ContextualPanel/useEntityTagsScreen'
import { FeatherIcon } from '~common/ui/Icon'
import type { RootState } from '~redux/modules/reducer'
import { deleteLink } from '~redux/modules/user'
import { usePushRouteOnce } from '~navigation/usePushRouteOnce'
import { getBibleViewParamsForVerseKeys } from '~features/studyRelations/openableStudyObjects'
export default function LinkOptionsPanel({
  linkId,
  onRelations,
}: {
  linkId: string
  onRelations?: () => void
}) {
  const { t } = useTranslation()
  const confirmDelete = useConfirmDelete()
  const dispatch = useDispatch()
  const push = usePushRouteOnce()
  const tags = useEntityTagsScreen('links', linkId)
  const relations = useSelector((state: RootState) => state.user.bible.relations)
  const relation = Object.values(relations).find(
    candidate =>
      candidate.kind === 'system' &&
      candidate.type === 'externalLink' &&
      candidate.endpoints.some(
        endpoint => endpoint.type === 'externalLink' && endpoint.linkId === linkId
      )
  )
  const verse = relation?.endpoints.find(endpoint => endpoint.type === 'verse')
  return (
    <ContextualPanel
      triggerSize={54}
      trigger={<FeatherIcon name="more-vertical" size={20} color="tertiary" />}
      accessibilityLabel={t('accessibility.options')}
      initialScreen="actions"
      onClose={tags.reset}
      screens={{
        actions: {
          title: t('Liens'),
          content: nav => (
            <>
              {verse?.type === 'verse' && (
                <PanelAction
                  icon="book-open"
                  label={t('Voir dans la Bible')}
                  onPress={() => {
                    nav.close()
                    push({
                      pathname: '/bible-view',
                      params: getBibleViewParamsForVerseKeys(verse.verseKeys, verse.version),
                    })
                  }}
                />
              )}
              <PanelAction
                nested
                icon="tag"
                label={t('Éditer les tags')}
                onPress={() => nav.open('tags')}
              />
              {onRelations && (
                <PanelAction
                  icon="git-merge"
                  label={t('Éditer les relations')}
                  onPress={() => {
                    nav.close()
                    onRelations()
                  }}
                />
              )}
              <PanelAction
                icon="trash-2"
                destructive
                label={t('Supprimer')}
                onPress={() => {
                  nav.close()
                  void confirmDelete(t('Voulez-vous vraiment supprimer ce lien?'), () => {
                    dispatch(deleteLink(linkId))
                  })
                }}
              />
            </>
          ),
        },
        tags: tags.screen,
      }}
    />
  )
}
