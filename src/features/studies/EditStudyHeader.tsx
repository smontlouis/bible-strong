import styled from '@emotion/native'
import * as Icon from '@expo/vector-icons'
import React, { memo, useCallback } from 'react'

import { useRouter } from 'expo-router'
import { useSetAtom } from 'jotai/react'
import { useTranslation } from 'react-i18next'
import { Alert } from 'react-native'
import { useDispatch } from 'react-redux'
import { ActionSheetItem } from '~common/ActionMenu'
import Header from '~common/Header'
import Link from '~common/Link'
import Modal from '~common/Modal'
import Box from '~common/ui/Box'
import { FeatherIcon } from '~common/ui/Icon'
import { useOpenInNewTab } from '~features/app-switcher/utils/useOpenInNewTab'
import generateUUID from '~helpers/generateUUID'
import { useBottomSheetModal } from '~helpers/useBottomSheet'
import { deleteStudy, Study } from '~redux/modules/user'
import type { AppDispatch } from '~redux/store'
import { unifiedTagsModalAtom } from '../../state/app'
import PublishStudyMenuItem from './PublishStudyMenuItem'

const HeaderBox = styled(Box)(({ theme }) => ({
  alignItems: 'center',
  paddingLeft: 15,
  paddingRight: 15,
  borderBottomWidth: 1,
  borderBottomColor: theme.colors.border,
}))

const ValidateIcon = styled(Icon.Feather)(({ theme }) => ({
  color: theme.colors.success,
}))

type EditHeaderProps = {
  isReadOnly: boolean
  setReadOnly: () => void
  title: string
  openRenameModal: () => void
  openRelationsModal: () => void
  hasBackButton?: boolean
  study: Study
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
  children,
}: EditHeaderProps) => {
  const router = useRouter()
  const openInNewTab = useOpenInNewTab()
  const { t } = useTranslation()
  const dispatch = useDispatch<AppDispatch>()
  const setUnifiedTagsModal = useSetAtom(unifiedTagsModalAtom)
  const { ref, open, close } = useBottomSheetModal()

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
            <Link onPress={open} padding>
              <FeatherIcon name="more-vertical" size={20} />
            </Link>
          }
        >
          {children}
        </Header>
        <Modal.Body ref={ref} enableDynamicSizing withPortal>
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
                    studyId: study.id,
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
        </Modal.Body>
      </>
    )
  }

  return (
    <HeaderBox>
      <Box row height={54} center>
        <Box flex justifyContent="center">
          <Link onPress={setReadOnly} style={{ marginRight: 15 }}>
            <ValidateIcon name="check" size={25} />
          </Link>
        </Box>
      </Box>
    </HeaderBox>
  )
}

export default memo(EditHeader)
