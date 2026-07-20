import { useRouter } from 'expo-router'
import { useAtomValue, useSetAtom } from 'jotai/react'
import { useTranslation } from 'react-i18next'
import { useDispatch, useSelector } from 'react-redux'
import { toast } from '~helpers/toast'
import type { RootState } from '~redux/modules/reducer'
import { updateStudy, type Study } from '~redux/modules/user'
import type { AppDispatch } from '~redux/store'
import { StudyTab, tabsAtom, tabsAtomsAtom } from '../../../state/tabs'
import { useSlideNewTab } from '../../app-switcher/utils/useSlideNewTab'
import { useTabAnimations } from '~features/app-switcher/utils/useTabAnimations'
import {
  createVerseOperations,
  type StudyVerseData,
  type StudyVerseFormat,
} from './verseOperations'

type QuillDelta = NonNullable<Study['content']>

export const useAddVerseToStudy = () => {
  const dispatch = useDispatch<AppDispatch>()
  const router = useRouter()
  const { t } = useTranslation()
  const tabs = useAtomValue(tabsAtom)
  const dispatchTabs = useSetAtom(tabsAtomsAtom)
  const { triggerSlideNewTab } = useSlideNewTab()
  const studies = useSelector((state: RootState) => state.user.bible.studies)
  const { slideToIndex } = useTabAnimations()

  const addVerseToStudy = (
    studyId: string,
    verseData: StudyVerseData,
    format: StudyVerseFormat
  ) => {
    const study = studies[studyId]
    const isNewStudy = !study

    // Parse existing content or create empty delta
    let delta: QuillDelta
    if (study?.content) {
      try {
        const parsed = typeof study.content === 'string' ? JSON.parse(study.content) : study.content
        // Create a copy to avoid mutating Redux state
        delta = { ops: [...parsed.ops] }
      } catch (e) {
        console.error('Error parsing study content:', e)
        delta = { ops: [] }
      }
    } else {
      delta = { ops: [] }
    }
    delta.ops.push(...createVerseOperations(verseData, format))

    // Update study in Redux
    // If new study, also set title and created_at
    dispatch(
      updateStudy({
        id: studyId,
        content: delta,
        modified_at: Date.now(),
        ...(isNewStudy
          ? {
              title: t('Document sans titre'),
              created_at: Date.now(),
            }
          : {}),
      })
    )

    // Show success toast with option to open study in new tab
    const newTabId = `new-${Date.now()}`
    const studyTitle = study?.title || t('Document sans titre')

    toast(t('study.verseAdded'), {
      action: {
        label: t('study.openStudy'),
        onClick: () => {
          // Create new study tab
          const studyIndex = tabs.findIndex(tab => (tab as StudyTab).data.studyId === studyId)
          if (studyIndex !== -1) {
            slideToIndex(studyIndex)
            return
          }
          dispatchTabs({
            type: 'insert',
            value: {
              id: newTabId,
              title: studyTitle,
              isRemovable: true,
              type: 'study',
              data: {
                studyId,
              },
            },
          })
          // Navigate to AppSwitcher and slide to new tab
          router.dismissTo('/')
          triggerSlideNewTab(newTabId)
          toast.dismiss()
        },
      },
    })
  }

  return addVerseToStudy
}
