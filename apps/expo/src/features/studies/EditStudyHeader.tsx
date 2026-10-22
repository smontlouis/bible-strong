import { goBackOrHome } from '~navigation/goBackOrHome'
import { useConfirmDialog } from '~common/ConfirmDialog/useConfirmDialog'
import * as Icon from '~common/ui/classNameIcons'
import type { ComponentPropsWithRef as UIComponentProps } from 'react'
import React, { memo, useCallback } from 'react'
import { twMerge } from '~common/ui/classNames'

import type { Theme as AppTheme } from '~themes'

import { useRouter } from 'expo-router'
import { useSetAtom } from 'jotai/react'
import { useTranslation } from 'react-i18next'
import { Platform } from 'react-native'
import StudyOptionsPanel from './StudyOptionsPanel'
import { useDispatch } from 'react-redux'
import { ActionSheetItem } from '~common/ActionMenu'
import Header from '~common/Header'
import Link from '~common/Link'
import { Sheet } from '~common/sheet'
import { FeatherIcon } from '~common/ui/Icon'
import { useOpenInNewTab } from '~features/app-switcher/utils/useOpenInNewTab'
import generateUUID from '~helpers/generateUUID'
import { useSheet } from '~helpers/useSheet'
import { deleteStudy, Study } from '~redux/modules/user'
import type { AppDispatch } from '~redux/store'
import { unifiedTagsModalAtom } from '../../state/app'
import PublishStudyMenuItem from './PublishStudyMenuItem'

const ValidateIcon = (
  componentProps: Omit<UIComponentProps<typeof Icon.Feather>, 'theme'> & {
    theme?: AppTheme
    className?: string
  }
) => {
  const { theme: _themeOverride, className, ...props } = componentProps

  const resolvedClassName = twMerge('text-success', className)
  return (
    <Icon.Feather
      {...props}
      className={resolvedClassName}
      style={[props.style] as UIComponentProps<typeof Icon.Feather>['style']}
    />
  )
}

type EditHeaderProps = {
  isReadOnly: boolean
  setReadOnly: () => void
  title: string
  openRenameModal: () => void
  openRelationsModal: () => void
  hasBackButton?: boolean
  study: Study
  studyId: string
}

const EditHeader = ({
  isReadOnly,
  setReadOnly,
  title,
  openRenameModal,
  openRelationsModal,
  hasBackButton = true,
  study,
  studyId,
}: EditHeaderProps) => {
  const router = useRouter()
  const openInNewTab = useOpenInNewTab()
  const { t } = useTranslation()
  const confirmDeletion = useConfirmDialog()
  const dispatch = useDispatch<AppDispatch>()
  const setUnifiedTagsModal = useSetAtom(unifiedTagsModalAtom)
  const { ref, open, close } = useSheet()

  const deleteStudyConfirmation = useCallback(() => {
    void confirmDeletion({
      title: t('Attention'),
      message: t('Voulez-vous vraiment supprimer cette étude?'),
      cancelLabel: t('Non'),
      confirmLabel: t('Oui'),
      destructive: true,
    }).then(confirmed => {
      if (!confirmed) return
      dispatch(deleteStudy(study.id))
      close()
      goBackOrHome(router)
    })
  }, [dispatch, study.id, close, router, t, confirmDeletion])

  if (isReadOnly) {
    return (
      <>
        <Header
          title={title}
          onTitlePress={openRenameModal}
          hasBackButton={hasBackButton}
          rightComponent={
            Platform.OS === 'web' ? (
              <StudyOptionsPanel
                tabActions
                study={study}
                studyId={studyId}
                includeRelations
                afterDelete={() => goBackOrHome(router)}
              />
            ) : (
              <Link onPress={open} padding>
                <FeatherIcon name="more-vertical" size={20} />
              </Link>
            )
          }
        />
        <Sheet ref={ref}>
          <PublishStudyMenuItem study={study} onClosed={close} />
          <ActionSheetItem
            icon="tag"
            label={t('Éditer les tags')}
            onPress={() => {
              close()
              setUnifiedTagsModal({ mode: 'select', id: study.id, entity: 'studies' })
            }}
          />
          <ActionSheetItem
            icon="git-merge"
            label={t('Éditer les relations')}
            onPress={() => {
              close()
              openRelationsModal()
            }}
          />
          <ActionSheetItem
            icon="edit-3"
            label={t('Renommer')}
            onPress={() => {
              close()
              openRenameModal()
            }}
          />
          <ActionSheetItem
            icon="external-link"
            label={t('tab.openInNewTab')}
            onPress={() => {
              close()
              openInNewTab(
                {
                  id: `study-${generateUUID()}`,
                  title: study.title,
                  isRemovable: true,
                  type: 'study',
                  data: {
                    studyId,
                  },
                },
                { autoRedirect: true }
              )
            }}
          />
          <ActionSheetItem
            icon="trash-2"
            label={t('Supprimer')}
            color="quart"
            onPress={deleteStudyConfirmation}
          />
        </Sheet>
      </>
    )
  }

  return (
    <Header
      title={title}
      onTitlePress={openRenameModal}
      rightComponent={
        <Link onPress={setReadOnly} padding>
          <ValidateIcon name="check" size={25} />
        </Link>
      }
    />
  )
}

export default memo(EditHeader)
