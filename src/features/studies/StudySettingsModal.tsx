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
import { useModalize } from '~helpers/useModalize'

interface Props {
  isOpen: boolean
  onClosed: () => void
  theme: Theme
  setTitlePrompt: React.Dispatch<React.SetStateAction<boolean>>
}

const StudySettingsModal = ({ isOpen, onClosed, setTitlePrompt }: Props) => {
  const { t } = useTranslation()
  const dispatch = useDispatch()
  const studyId = isOpen
  const study = useSelector(
    (state: RootState) => state.user.bible.studies[studyId],
    shallowEqual
  )
  const openInNewTab = useOpenInNewTab()
  const setMultipleTagsItem = useSetAtom(multipleTagsModalAtom)

  const deleteStudyConfirmation = (id: string) => {
    Alert.alert(
      t('Attention'),
      t('Voulez-vous vraiment supprimer cette étude?'),
      [
        { text: t('Non'), onPress: () => null, style: 'cancel' },
        {
          text: t('Oui'),
          onPress: () => {
            dispatch(deleteStudy(id))
            onClosed()
          },
          style: 'destructive',
        },
      ]
    )
  }

  const { ref, open, close } = useModalize()

  useEffect(() => {
    if (isOpen) {
      open()
    }
  }, [isOpen, open])

  return (
    <Modal.Body ref={ref} onClose={onClosed} adjustToContentHeight>
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
          setTitlePrompt({ id: study.id, title: study.title })
        }}
      >
        {t('Renommer')}
      </Modal.Item>
      <Modal.Item
        color="quart"
        onPress={() => deleteStudyConfirmation(studyId)}
      >
        {t('Supprimer')}
      </Modal.Item>
    </Modal.Body>
  )
}

export default withTheme(StudySettingsModal)
