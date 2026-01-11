import { useSetAtom } from 'jotai/react'
import React, { useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { Alert } from 'react-native'
import { shallowEqual, useDispatch, useSelector } from 'react-redux'
import Modal from '~common/Modal'
import { useOpenInNewTab } from '~features/app-switcher/utils/useOpenInNewTab'
import generateUUID from '~helpers/generateUUID'
import { RootState } from '~redux/modules/reducer'
import { deleteStudy } from '~redux/modules/user'
import { multipleTagsModalAtom } from '../../state/app'
import PublishStudyMenuItem from './PublishStudyMenuItem'
import { BottomSheetModal } from '@gorhom/bottom-sheet'

interface Props {
  ref?: React.RefObject<BottomSheetModal | null>
  studyId: string | false
  onClosed: () => void
  openRenameModal: (data: { id: string; title: string }) => void
}

const StudySettingsModal = ({ ref, studyId, onClosed, openRenameModal }: Props) => {
  const { t } = useTranslation()
  const dispatch = useDispatch()
  const study = useSelector(
    (state: RootState) => (studyId ? state.user.bible.studies[studyId] : undefined),
    shallowEqual
  )
  const openInNewTab = useOpenInNewTab()
  const setMultipleTagsItem = useSetAtom(multipleTagsModalAtom)

  const close = useCallback(() => {
    ref?.current?.dismiss()
  }, [ref])

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

  return (
    <Modal.Body ref={ref} onModalClose={onClosed} enableDynamicSizing withPortal>
      {study && <PublishStudyMenuItem study={study} onClosed={close} />}
      <Modal.Item
        onPress={() => {
          if (!study) return

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
      >
        {t('tab.openInNewTab')}
      </Modal.Item>
      <Modal.Item
        onPress={() => {
          if (!study) return

          close()
          setMultipleTagsItem({ ...study, entity: 'studies' })
        }}
      >
        {t('Éditer les tags')}
      </Modal.Item>
      <Modal.Item
        onPress={() => {
          if (!study) return

          close()
          openRenameModal({ id: study.id, title: study.title })
        }}
      >
        {t('Renommer')}
      </Modal.Item>
      <Modal.Item
        color="quart"
        onPress={() => {
          if (!study || !studyId) return

          deleteStudyConfirmation(studyId)
        }}
      >
        {t('Supprimer')}
      </Modal.Item>
    </Modal.Body>
  )
}

export default StudySettingsModal
