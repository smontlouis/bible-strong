import { withTheme } from '@emotion/react'
import { useSetAtom } from 'jotai/react'
import React, { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Alert } from 'react-native'
import { shallowEqual, useDispatch, useSelector } from 'react-redux'
import Modal from '~common/Modal'
import { useOpenInNewTab } from '~features/app-switcher/utils/useOpenInNewTab'
import { RootState } from '~redux/modules/reducer'
import { deleteStudy } from '~redux/modules/user'
import { multipleTagsModalAtom } from '../../state/app'
import { Theme } from '~themes'
import PublishStudyMenuItem from './PublishStudyMenuItem'
import { useBottomSheet } from '~helpers/useBottomSheet'

interface Props {
  isOpen: any
  onClosed: () => void
  theme: Theme
  setTitlePrompt: any
}

const StudySettingsModal = ({ isOpen, onClosed, setTitlePrompt }: Props) => {
  const { t } = useTranslation()
  const dispatch = useDispatch()
  const studyId = isOpen
  const study = useSelector(
    // @ts-ignore
    (state: RootState) => state.user.bible.studies[studyId],
    shallowEqual
  )
  const openInNewTab = useOpenInNewTab()
  const setMultipleTagsItem = useSetAtom(multipleTagsModalAtom)

  const { ref, open, close } = useBottomSheet()

  const deleteStudyConfirmation = (id: string) => {
    Alert.alert(t('Attention'), t('Voulez-vous vraiment supprimer cette étude?'), [
      { text: t('Non'), onPress: () => null, style: 'cancel' },
      {
        text: t('Oui'),
        onPress: () => {
          dispatch(deleteStudy(id))
          close()
        },
        style: 'destructive',
      },
    ])
  }

  useEffect(() => {
    if (isOpen) {
      open()
    }
  }, [isOpen, open])

  return (
    <Modal.Body ref={ref} onModalClose={onClosed} enableDynamicSizing withPortal>
      {study && <PublishStudyMenuItem study={study} onClosed={close} />}
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
          // @ts-ignore
          setTitlePrompt({ id: study.id, title: study.title })
        }}
      >
        {t('Renommer')}
      </Modal.Item>
      <Modal.Item
        color="quart"
        // @ts-ignore
        onPress={() => deleteStudyConfirmation(studyId)}
      >
        {t('Supprimer')}
      </Modal.Item>
    </Modal.Body>
  )
}

export default withTheme(StudySettingsModal)
