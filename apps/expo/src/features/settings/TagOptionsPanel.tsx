import { useConfirmDelete } from '~common/ContextualPanel/useConfirmDelete'
import { useTranslation } from 'react-i18next'
import { useDispatch, useStore } from 'react-redux'
import ContextualPanel from '~common/ContextualPanel'
import PanelAction from '~common/ContextualPanel/PanelAction'
import PanelTextForm from '~common/ContextualPanel/PanelTextForm'
import { FeatherIcon } from '~common/ui/Icon'
import type { Tag } from '~common/types'
import type { RootState } from '~redux/modules/reducer'
import { updateTag, removeTag } from '~redux/modules/user'
import { makeTagDataSelector } from '~redux/selectors/bible'
import { useCreateTabGroupFromTag } from './useCreateTabGroupFromTag'
export default function TagOptionsPanel({ tag }: { tag: Tag }) {
  const { t } = useTranslation()
  const confirmDelete = useConfirmDelete()
  const dispatch = useDispatch()
  const store = useStore<RootState>()
  const createGroup = useCreateTabGroupFromTag()
  return (
    <ContextualPanel
      triggerSize={54}
      trigger={<FeatherIcon name="more-vertical" size={20} />}
      accessibilityLabel={t('accessibility.options')}
      initialScreen="actions"
      screens={{
        actions: {
          title: t('Étiquettes'),
          content: nav => (
            <>
              <PanelAction
                nested
                icon="edit-3"
                label={t('Éditer')}
                onPress={() => nav.open('rename')}
              />
              <PanelAction
                icon="layers"
                label={t('tabs.createGroupFromTag')}
                onPress={() => {
                  const data = makeTagDataSelector()(store.getState(), tag)
                  createGroup(tag, data)
                  nav.close()
                }}
              />
              <PanelAction
                icon="trash-2"
                destructive
                label={t('Supprimer')}
                onPress={() => {
                  nav.close()
                  void confirmDelete(t('Êtes-vous vraiment sur de supprimer ce tag ?'), () => {
                    dispatch(removeTag(tag.id))
                  })
                }}
              />
            </>
          ),
        },
        rename: {
          title: t("Renommer l'étiquette"),
          content: nav => (
            <PanelTextForm
              initialValue={tag.name}
              label={t("Nom de l'étiquette")}
              onSave={name => {
                dispatch(updateTag(tag.id, name))
                nav.close()
              }}
            />
          ),
        },
      }}
    />
  )
}
