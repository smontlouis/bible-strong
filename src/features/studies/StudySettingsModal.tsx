import { useSetAtom } from 'jotai/react'
import React from 'react'
import { useTranslation } from 'react-i18next'
import { Alert } from 'react-native'
import { shallowEqual, useDispatch, useSelector } from 'react-redux'
import { ActionSheetItem } from '~common/ActionMenu'
import Modal from '~common/Modal'
import { useOpenInNewTab } from '~features/app-switcher/utils/useOpenInNewTab'
import generateUUID from '~helpers/generateUUID'
import { RootState } from '~redux/modules/reducer'
import { deleteStudy } from '~redux/modules/user'
import { unifiedTagsModalAtom } from '../../state/app'
import PublishStudyMenuItem from './PublishStudyMenuItem'
import { BottomSheetModal } from '~common/bottom-sheet'

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
  const setUnifiedTagsModal = useSetAtom(unifiedTagsModalAtom)

  const close = () => {
    ref?.current?.dismiss()
  }

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
      <ActionSheetItem
        icon="tag"
        label={t('Éditer les tags')}
        onPress={() => {
          if (!study) return

          close()
          setUnifiedTagsModal({ mode: 'select', id: study.id, entity: 'studies' })
        }}
      />
      <ActionSheetItem
        icon="edit-3"
        label={t('Renommer')}
        onPress={() => {
          if (!study) return

          close()
          openRenameModal({ id: study.id, title: study.title })
        }}
      />
      <ActionSheetItem
        icon="external-link"
        label={t('tab.openInNewTab')}
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
      />
      <ActionSheetItem
        icon="trash-2"
        label={t('Supprimer')}
        color="quart"
        onPress={() => {
          if (!study || !studyId) return

          deleteStudyConfirmation(studyId)
        }}
      />
    </Modal.Body>
  )
}

export default StudySettingsModal
