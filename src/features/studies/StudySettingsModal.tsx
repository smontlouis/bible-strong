import { withTheme } from '@emotion/react'
import React from 'react'
import { useTranslation } from 'react-i18next'
import { Alert } from 'react-native'
import { shallowEqual, useDispatch, useSelector } from 'react-redux'
import Modal from '~common/Modal'
import { RootState } from '~redux/modules/reducer'
import { deleteStudy } from '~redux/modules/user'
import { Theme } from '~themes'
import PublishStudyMenuItem from './PublishStudyMenuItem'

interface Props {
  isOpen: boolean
  onClosed: () => void
  theme: Theme
  setTitlePrompt: React.Dispatch<React.SetStateAction<boolean>>
  setMultipleTagsItem: React.Dispatch<React.SetStateAction<boolean>>
}

const StudySettingsModal = ({
  isOpen,
  onClosed,
  setTitlePrompt,
  setMultipleTagsItem,
}: Props) => {
  const { t } = useTranslation()
  const dispatch = useDispatch()
  const studyId = isOpen
  const study = useSelector(
    (state: RootState) => state.user.bible.studies[studyId],
    shallowEqual
  )

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

  return (
    <Modal.Menu isOpen={!!isOpen} onClose={onClosed} adjustToContentHeight>
      {study && <PublishStudyMenuItem study={study} onClosed={onClosed} />}
      <Modal.Item
        onPress={() => {
          onClosed()
          setMultipleTagsItem({ ...study, entity: 'studies' })
        }}
      >
        {t('Éditer les tags')}
      </Modal.Item>
      <Modal.Item
        onPress={() => {
          onClosed()
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
    </Modal.Menu>
  )
}

export default withTheme(StudySettingsModal)
