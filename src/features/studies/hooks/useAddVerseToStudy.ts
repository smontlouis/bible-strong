import { useCallback } from 'react'
import { useNavigation } from '@react-navigation/native'
import { useAtomValue, useSetAtom } from 'jotai/react'
import { useTranslation } from 'react-i18next'
import { useDispatch, useSelector } from 'react-redux'
import { toast } from 'sonner-native'
import type { RootState } from '~redux/modules/reducer'
import { updateStudy } from '~redux/modules/user'
import { StudyTab, tabsAtom, tabsAtomsAtom } from '../../../state/tabs'
import { useSlideNewTab } from '../../app-switcher/utils/useSlideNewTab'
import { useTabAnimations } from '~features/app-switcher/utils/useTabAnimations'

interface VerseData {
  title: string
  content: string
  version: string
  verses: string[]
}

type VerseFormat = 'inline' | 'block'

interface QuillDelta {
  ops: unknown[]
}

export const useAddVerseToStudy = () => {
  const dispatch = useDispatch()
  const navigation = useNavigation()
  const { t } = useTranslation()
  const tabs = useAtomValue(tabsAtom)
  const dispatchTabs = useSetAtom(tabsAtomsAtom)
  const { triggerSlideNewTab } = useSlideNewTab()
  const studies = useSelector((state: RootState) => state.user.bible.studies)
  const { slideToIndex } = useTabAnimations()

  const addVerseToStudy = (studyId: string, verseData: VerseData, format: VerseFormat) => {
    const study = studies[studyId]
    const isNewStudy = !study

    // Parse existing content or create empty delta
    let delta: QuillDelta
    if (study?.content) {
      try {
        delta = typeof study.content === 'string' ? JSON.parse(study.content) : study.content
      } catch (e) {
        console.error('Error parsing study content:', e)
        delta = { ops: [] }
      }
    } else {
      delta = { ops: [] }
    }
    // Create the verse operation based on format
    if (format === 'inline') {
      // Add inline verse link
      // Format: { insert: "Jean 3:16", attributes: { "inline-verse": { title, verses } } }
      delta.ops.push({
        insert: verseData.title,
        attributes: {
          'inline-verse': {
            title: verseData.title,
            verses: verseData.verses,
          },
        },
      })
      // Add a space after
      delta.ops.push({ insert: ' ' })
    } else {
      // Add block verse
      // Format: { insert: { "block-verse": { title, content, version, verses } } }
      delta.ops.push({
        insert: {
          'block-verse': {
            title: verseData.title,
            content: verseData.content,
            version: verseData.version,
            verses: verseData.verses,
          },
        },
      })
      // Add newline after block
      delta.ops.push({ insert: '\n' })
    }

    // Update study in Redux
    // If new study, also set title and created_at
    dispatch(
      // @ts-ignore
      updateStudy({
        id: studyId,
        // @ts-ignore
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
          navigation.navigate('AppSwitcher')
          triggerSlideNewTab(newTabId)
          toast.dismiss()
        },
      },
    })
  }

  return addVerseToStudy
}
