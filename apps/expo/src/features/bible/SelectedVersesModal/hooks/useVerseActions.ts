import { useRouter } from 'expo-router'
import { getDefaultStore } from 'jotai/vanilla'
import { Share } from 'react-native'
import type { BibleResource, VerseIds } from '~common/types'
import { useShareOptions } from '~features/settings/BibleShareOptionsScreen'
import { currentStudyIdAtom, openedFromTabAtom } from '~features/studies/atom'
import { copyResourceText, shareResourceLink } from '~features/share/resourceShare'
import getVersesContent from '~helpers/getVersesContent'
import { getVersesShareUrl } from '~helpers/publicSiteLinks'
import { cleanParams } from '~helpers/utils'
import type { VersionCode } from '../../../../state/tabs'
import { useAtomValue } from 'jotai/react'
import { useResourceAccess } from '~features/resources/resourceAccess'
import { loadBibleVerseTexts } from '~features/resources/resourceQueries'

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
  const resources = useResourceAccess()
  const openedFromTab = useAtomValue(openedFromTabAtom)
  const { hasVerseNumbers, hasInlineVerses, hasQuotes } = useShareOptions()

  const versesText = async () => {
    const { all } = await getVersesContent({
      verses: selectedVerses,
      version,
      hasVerseNumbers,
      hasInlineVerses,
      hasQuotes,
      loadVerseTexts: (versionId, verseKeys) =>
        loadBibleVerseTexts(resources, versionId, verseKeys),
    })
    return all
  }

  // Sharing sends the link of the passage alone, so that its card is drawn where it lands.
  // Verses the public site does not serve have no link: their text is shared instead.
  const shareVerse = async () => {
    const url = getVersesShareUrl(Object.keys(selectedVerses), version)
    if (url) return shareResourceLink({ url })
    await Share.share({ message: await versesText() })
  }

  const copyToClipboard = () => copyResourceText({ text: versesText })

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
    onChangeResourceType('compare')
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
      loadVerseTexts: (versionId, verseKeys) =>
        loadBibleVerseTexts(resources, versionId, verseKeys),
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
        // Makes each return unique so picking the same verse again still inserts it.
        insertionId: Date.now(),
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
