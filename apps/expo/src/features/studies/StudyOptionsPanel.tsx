import { useConfirmDelete } from '~common/ContextualPanel/useConfirmDelete'
import { useTranslation } from 'react-i18next'
import { useDispatch } from 'react-redux'
import ContextualPanel from '~common/ContextualPanel'
import PanelAction from '~common/ContextualPanel/PanelAction'
import PanelTextForm from '~common/ContextualPanel/PanelTextForm'
import { useEntityTagsScreen } from '~common/ContextualPanel/useEntityTagsScreen'
import { FeatherIcon } from '~common/ui/Icon'
import { deleteStudy, updateStudy, type Study } from '~redux/modules/user'
import PublishStudyMenuItem from './PublishStudyMenuItem'
import { useOpenInNewTab } from '~features/app-switcher/utils/useOpenInNewTab'
import generateUUID from '~helpers/generateUUID'
export default function StudyOptionsPanel({ study }: { study: Study }) {
  const { t } = useTranslation()
  const confirmDelete = useConfirmDelete()
  const dispatch = useDispatch()
  const openTab = useOpenInNewTab()
  const tags = useEntityTagsScreen('studies', study.id)
  return (
    <ContextualPanel
      triggerSize={40}
      trigger={<FeatherIcon name="more-vertical" size={20} color="tertiary" />}
      accessibilityLabel={t('accessibility.options')}
      initialScreen="actions"
      onClose={tags.reset}
      screens={{
        actions: {
          title: t('Études'),
          content: nav => (
            <>
              <PublishStudyMenuItem study={study} onClosed={nav.close} />
              <PanelAction
                nested
                icon="tag"
                label={t('Éditer les tags')}
                onPress={() => nav.open('tags')}
              />
              <PanelAction
                nested
                icon="edit-3"
                label={t('Renommer')}
                onPress={() => nav.open('rename')}
              />
              <PanelAction
                icon="external-link"
                label={t('tab.openInNewTab')}
                onPress={() => {
                  nav.close()
                  openTab(
                    {
                      id: 'study-' + generateUUID(),
                      type: 'study',
                      title: study.title,
                      isRemovable: true,
                      data: { studyId: study.id },
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
                  void confirmDelete(t('Voulez-vous vraiment supprimer cette étude?'), () => {
                    dispatch(deleteStudy(study.id))
                  })
                }}
              />
            </>
          ),
        },
        tags: tags.screen,
        rename: {
          title: t("Renommer l'étude"),
          content: nav => (
            <PanelTextForm
              initialValue={study.title}
              label={t("Nom de l'étude")}
              onSave={title => {
                dispatch(updateStudy({ id: study.id, title, modified_at: Date.now() }))
                nav.close()
              }}
            />
          ),
        },
      }}
    />
  )
}
