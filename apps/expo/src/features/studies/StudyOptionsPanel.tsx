import { useConfirmDelete } from '~common/ContextualPanel/useConfirmDelete'
import { useTranslation } from 'react-i18next'
import { useDispatch } from 'react-redux'
import { Platform } from 'react-native'
import ContextualPanel from '~common/ContextualPanel'
import PanelAction from '~common/ContextualPanel/PanelAction'
import PanelTextForm from '~common/ContextualPanel/PanelTextForm'
import { useEntityTagsScreen } from '~common/ContextualPanel/useEntityTagsScreen'
import { FeatherIcon } from '~common/ui/Icon'
import { deleteStudy, updateStudy, type Study } from '~redux/modules/user'
import PublishStudyMenuItem from './PublishStudyMenuItem'
import { useOpenInNewTab } from '~features/app-switcher/utils/useOpenInNewTab'
import generateUUID from '~helpers/generateUUID'
import StudyRelationList from '~features/studyRelations/StudyRelationList'
import CreateEntityRelationModal from '~features/studyRelations/CreateEntityRelationModal'
import { createStudyEndpoint } from '~features/studyRelations/endpoints'
import { useOpenRelationEndpoint } from '~features/studyRelations/useOpenRelationEndpoint'
export default function StudyOptionsPanel({
  study,
  studyId = study.id,
  includeRelations = false,
  afterDelete,
  tabActions = false,
}: {
  study: Study
  studyId?: string
  includeRelations?: boolean
  afterDelete?: () => void
  tabActions?: boolean
}) {
  const { t } = useTranslation()
  const confirmDelete = useConfirmDelete()
  const dispatch = useDispatch()
  const openTab = useOpenInNewTab()
  const tags = useEntityTagsScreen('studies', studyId)
  const endpoint = createStudyEndpoint(studyId, study.title)
  const openEndpoint = useOpenRelationEndpoint()
  const openInNewTab = () =>
    openTab(
      {
        id: 'study-' + generateUUID(),
        type: 'study',
        title: study.title,
        isRemovable: true,
        data: { studyId },
      },
      { autoRedirect: true }
    )
  const removeStudy = () => {
    void confirmDelete(t('Voulez-vous vraiment supprimer cette étude?'), () => {
      dispatch(deleteStudy(studyId))
      afterDelete?.()
    })
  }
  return (
    <ContextualPanel
      commands={
        tabActions
          ? {
              actions: [
                { id: 'publish', title: t('Partager') },
                { id: 'tags', title: t('Éditer les tags') },
                { id: 'rename', title: t('Renommer') },
                ...(includeRelations
                  ? [{ id: 'relations', title: t('Éditer les relations') }]
                  : []),
                { id: 'open-tab', title: t('tab.openInNewTab') },
                { id: 'delete', title: t('Supprimer'), attributes: { destructive: true } },
              ],
              select: (id, nav) => {
                if (id === 'open-tab') openInNewTab()
                else if (id === 'delete') removeStudy()
                else nav.open(id)
              },
            }
          : undefined
      }
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
              {includeRelations && (
                <PanelAction
                  nested
                  icon="git-merge"
                  label={t('Éditer les relations')}
                  onPress={() => nav.open('relations')}
                />
              )}
              <PanelAction
                icon="external-link"
                label={t('tab.openInNewTab')}
                onPress={() => {
                  nav.close()
                  openInNewTab()
                }}
              />
              <PanelAction
                icon="trash-2"
                destructive
                label={t('Supprimer')}
                onPress={() => {
                  nav.close()
                  removeStudy()
                }}
              />
            </>
          ),
        },
        publish: {
          title: t('Partager'),
          content: nav => <PublishStudyMenuItem study={study} onClosed={nav.close} />,
        },
        tags: tags.screen,
        relations: {
          title: t('Relations'),
          width: 500,
          content: nav => (
            <>
              <PanelAction
                nested
                icon="plus"
                label={t('Ajouter une relation')}
                onPress={() => nav.open('create-relation')}
              />
              <StudyRelationList
                endpoint={endpoint}
                showEmptyState
                onOpenEndpoint={target => {
                  nav.close()
                  openEndpoint(target)
                }}
              />
            </>
          ),
        },
        'create-relation': {
          title: t('Ajouter une relation'),
          width: 500,
          content: nav => (
            <CreateEntityRelationModal inline sourceEndpoint={endpoint} onCreated={nav.back} />
          ),
        },
        rename: {
          title: t("Renommer l'étude"),
          content: nav => (
            <PanelTextForm
              initialValue={study.title}
              label={t("Nom de l'étude")}
              onSave={title => {
                dispatch(updateStudy({ id: studyId, title, modified_at: Date.now() }))
                if (Platform.OS === 'web') nav.back()
                else nav.close()
              }}
            />
          ),
        },
      }}
    />
  )
}
