import Clipboard from '@react-native-clipboard/clipboard'
import { useRouter } from 'expo-router'
import { getDefaultStore } from 'jotai/vanilla'
import { useTranslation } from 'react-i18next'
import { Share } from 'react-native'
import { toast } from 'sonner-native'
import type { BibleResource, VerseIds } from '~common/types'
import { useShareOptions } from '~features/settings/BibleShareOptionsScreen'
import { currentStudyIdAtom, openedFromTabAtom } from '~features/studies/atom'
import getVersesContent from '~helpers/getVersesContent'
import { cleanParams } from '~helpers/utils'
import type { VersionCode } from '../../../../state/tabs'
import { useAtomValue } from 'jotai/react'

interface UseVerseActionsParams {
  selectedVerses: VerseIds
  version: VersionCode
  isSelectionMode: string | undefined
  onClose: () => void
  onChangeResourceType: (type: BibleResource) => void
}

const useVerseActions = ({
  selectedVerses,
  version,
  isSelectionMode,
  onClose,
  onChangeResourceType,
}: UseVerseActionsParams) => {
  const router = useRouter()
  const { t } = useTranslation()
  const openedFromTab = useAtomValue(openedFromTabAtom)
  const { hasVerseNumbers, hasInlineVerses, hasQuotes, hasAppName } = useShareOptions()

  const shareVerse = async () => {
    const { all: message } = await getVersesContent({
      verses: selectedVerses,
      version,
      hasVerseNumbers,
      hasInlineVerses,
      hasQuotes,
      hasAppName,
    })
    await Share.share({ message })
  }

  const copyToClipboard = async () => {
    const { all: message } = await getVersesContent({
      verses: selectedVerses,
      version,
      hasVerseNumbers,
      hasInlineVerses,
      hasQuotes,
      hasAppName,
    })
    Clipboard.setString(message)
    toast(t('Copié dans le presse-papiers.'))
  }

  const showStrongDetail = () => {
    onChangeResourceType('strong')
  }

  const openCommentariesScreen = () => {
    onChangeResourceType('commentary')
  }

  const showDictionaryDetail = () => {
    onChangeResourceType('dictionary')
  }

  const compareVerses = () => {
    router.push({
      pathname: '/bible-compare-verses',
      params: { selectedVerses: JSON.stringify(selectedVerses) },
    })
  }

  const onOpenReferences = () => {
    onChangeResourceType('reference')
  }

  const onOpenNave = () => {
    onChangeResourceType('nave')
  }

  const sendVerseData = async () => {
    const { title, content } = await getVersesContent({
      verses: selectedVerses,
      version,
    })
    const store = getDefaultStore()
    const currentStudyId = store.get(currentStudyIdAtom)
    const pathname = openedFromTab ? '/' : '/edit-study'
    router.dismissTo({
      pathname,
      params: {
        ...cleanParams(),
        studyId: currentStudyId,
        type: isSelectionMode,
        title,
        content,
        version,
        verses: JSON.stringify(Object.keys(selectedVerses)),
      },
    })
    onClose()
  }

  return {
    shareVerse,
    copyToClipboard,
    showStrongDetail,
    openCommentariesScreen,
    showDictionaryDetail,
    compareVerses,
    onOpenReferences,
    onOpenNave,
    sendVerseData,
  }
}

export default useVerseActions
