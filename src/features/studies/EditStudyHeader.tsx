import styled from '@emotion/native'
import * as Icon from '@expo/vector-icons'
import React, { memo, useCallback } from 'react'

import { NavigationProp } from '@react-navigation/native'
import { useSetAtom } from 'jotai/react'
import { useTranslation } from 'react-i18next'
import { Alert } from 'react-native'
import { useDispatch } from 'react-redux'
import Header from '~common/Header'
import Link from '~common/Link'
import Modal from '~common/Modal'
import Box from '~common/ui/Box'
import { FeatherIcon } from '~common/ui/Icon'
import { useOpenInNewTab } from '~features/app-switcher/utils/useOpenInNewTab'
import { useBottomSheetModal } from '~helpers/useBottomSheet'
import { MainStackProps } from '~navigation/type'
import { deleteStudy, Study } from '~redux/modules/user'
import { multipleTagsModalAtom } from '../../state/app'
import PublishStudyMenuItem from './PublishStudyMenuItem'

const HeaderBox = styled(Box)({
  alignItems: 'center',
  paddingLeft: 15,
  paddingRight: 15,
})

const ValidateIcon = styled(Icon.Feather)(({ theme }) => ({
  color: theme.colors.success,
}))

type EditHeaderProps = {
  isReadOnly: boolean
  setReadOnly: () => void
  title: string
  openRenameModal: () => void
  hasBackButton?: boolean
  study: Study
  navigation: NavigationProp<MainStackProps>
}

const EditHeader = ({
  isReadOnly,
  setReadOnly,
  title,
  openRenameModal,
  hasBackButton = true,
  study,
  navigation,
}: EditHeaderProps) => {
  const openInNewTab = useOpenInNewTab()
  const { t } = useTranslation()
  const dispatch = useDispatch()
  const setMultipleTagsItem = useSetAtom(multipleTagsModalAtom)
  const { ref, open, close } = useBottomSheetModal()

  const deleteStudyConfirmation = useCallback(() => {
    Alert.alert(t('Attention'), t('Voulez-vous vraiment supprimer cette étude?'), [
      { text: t('Non'), onPress: () => null, style: 'cancel' },
      {
        text: t('Oui'),
        onPress: () => {
          dispatch(deleteStudy(study.id))
          close()
          navigation.goBack()
        },
        style: 'destructive',
      },
    ])
  }, [dispatch, study.id, close, navigation, t])

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
        />
        <Modal.Body ref={ref} enableDynamicSizing withPortal>
          <PublishStudyMenuItem study={study} onClosed={close} />
          <Modal.Item
            onPress={() => {
              close()
              openInNewTab(
                {
                  id: `study-${Date.now()}`,
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
          >
            {t('tab.openInNewTab')}
          </Modal.Item>
          <Modal.Item
            onPress={() => {
              close()
              setMultipleTagsItem({ ...study, entity: 'studies' })
            }}
          >
            {t('Éditer les tags')}
          </Modal.Item>
          <Modal.Item
            onPress={() => {
              close()
              openRenameModal()
            }}
          >
            {t('Renommer')}
          </Modal.Item>
          <Modal.Item color="quart" onPress={deleteStudyConfirmation}>
            {t('Supprimer')}
          </Modal.Item>
        </Modal.Body>
      </>
    )
  }

  return (
    <HeaderBox>
      <Box row height={50} center>
        <Box flex justifyContent="center">
          <Link
            // @ts-ignore
            onPress={setReadOnly}
            // @ts-ignore
            underlayColor="transparent"
            // @ts-ignore
            style={{ marginRight: 15 }}
          >
            <ValidateIcon name="check" size={25} />
          </Link>
        </Box>
      </Box>
    </HeaderBox>
  )
}

export default memo(EditHeader)
