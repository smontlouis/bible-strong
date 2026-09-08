import * as Icon from '@expo/vector-icons'
import type { ComponentPropsWithRef as UIComponentProps } from 'react'
import React, { memo, useCallback } from 'react'
import { twMerge } from '~common/ui/classNames'
import { useResolveClassNames } from 'uniwind'
import PageContent from '~common/ui/PageContent'
import type { Theme as AppTheme } from '~themes'

import { useRouter } from 'expo-router'
import { useSetAtom } from 'jotai/react'
import { useTranslation } from 'react-i18next'
import { Alert, Platform } from 'react-native'
import StudyOptionsPanel from './StudyOptionsPanel'
import { useDispatch } from 'react-redux'
import { ActionSheetItem } from '~common/ActionMenu'
import Header from '~common/Header'
import Link from '~common/Link'
import { Sheet } from '~common/sheet'
import Box from '~common/ui/Box'
import { FeatherIcon } from '~common/ui/Icon'
import { useOpenInNewTab } from '~features/app-switcher/utils/useOpenInNewTab'
import generateUUID from '~helpers/generateUUID'
import { useSheet } from '~helpers/useSheet'
import { deleteStudy, Study } from '~redux/modules/user'
import type { AppDispatch } from '~redux/store'
import { unifiedTagsModalAtom } from '../../state/app'
import PublishStudyMenuItem from './PublishStudyMenuItem'

const HeaderBox = (
  componentProps: Omit<UIComponentProps<typeof Box>, 'theme'> & {
    theme?: AppTheme
    className?: string
  }
) => {
  const { theme: _themeOverride, className, ...props } = componentProps

  const classStyles = useResolveClassNames(
    twMerge('items-center pl-[15px] pr-[15px] border-b-[1px] border-b-border', className)
  )
  return (
    <Box
      {...props}
      style={[classStyles, {}, props.style] as UIComponentProps<typeof Box>['style']}
      className="overflow-hidden border-continuous"
    />
  )
}

const ValidateIcon = (
  componentProps: Omit<UIComponentProps<typeof Icon.Feather>, 'theme'> & {
    theme?: AppTheme
    className?: string
  }
) => {
  const { theme: _themeOverride, className, ...props } = componentProps

  const classStyles = useResolveClassNames(twMerge('text-success', className))
  return (
    <Icon.Feather
      {...props}
      style={[classStyles, {}, props.style] as UIComponentProps<typeof Icon.Feather>['style']}
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
  children?: React.ReactNode
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
  children,
}: EditHeaderProps) => {
  const router = useRouter()
  const openInNewTab = useOpenInNewTab()
  const { t } = useTranslation()
  const dispatch = useDispatch<AppDispatch>()
  const setUnifiedTagsModal = useSetAtom(unifiedTagsModalAtom)
  const { ref, open, close } = useSheet()

  const deleteStudyConfirmation = useCallback(() => {
    Alert.alert(t('Attention'), t('Voulez-vous vraiment supprimer cette étude?'), [
      { text: t('Non'), onPress: () => null, style: 'cancel' },
      {
        text: t('Oui'),
        onPress: () => {
          dispatch(deleteStudy(study.id))
          close()
          router.back()
        },
        style: 'destructive',
      },
    ])
  }, [dispatch, study.id, close, router, t])

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
                study={study}
                studyId={studyId}
                includeRelations
                afterDelete={() => router.back()}
              />
            ) : (
              <Link onPress={open} padding>
                <FeatherIcon name="more-vertical" size={20} />
              </Link>
            )
          }
        >
          {children}
        </Header>
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
    <HeaderBox>
      <PageContent className="h-[54px] items-center justify-center flex-row">
        <Box className="overflow-hidden border-continuous flex-[1] justify-center">
          <Link onPress={setReadOnly} style={{ marginRight: 15 }}>
            <ValidateIcon name="check" size={25} />
          </Link>
        </Box>
      </PageContent>
    </HeaderBox>
  )
}

export default memo(EditHeader)
