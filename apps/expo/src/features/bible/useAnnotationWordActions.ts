import { useTranslation } from 'react-i18next'
import { Platform, Share } from 'react-native'
import * as Sentry from '@sentry/react-native'
import { toast } from '~helpers/toast'
import { copyResourceText } from '~features/share/resourceShare'
import { getVersesShareUrl } from '~helpers/publicSiteLinks'
import { usePushRouteOnce } from '~navigation/usePushRouteOnce'
import {
  formatWordsQuote,
  getWordRangesVerseKeys,
  type AnnotatedWordRange,
} from './annotationWords'
import type { SelectionStrongWordPreview } from './useSelectionStrongWords'

/** What the selection sheet does with selected words: copy and share them, open their entries. */
export default function useAnnotationWordActions(
  version: string | undefined,
  wordRanges: readonly AnnotatedWordRange[]
) {
  const { t } = useTranslation()
  const pushRouteOnce = usePushRouteOnce()
  const quote = () =>
    formatWordsQuote(wordRanges, version ?? '', text => t('annotation.quote', { text }))

  const copy = () => copyResourceText({ text: async () => quote() })

  // The words travel with the link of their verses, where the public site serves them.
  const share = async () => {
    const url = version ? getVersesShareUrl(getWordRangesVerseKeys(wordRanges), version) : undefined
    const message = url ? `${quote()}\n${url}` : quote()
    if (Platform.OS === 'web' && typeof navigator.share !== 'function') {
      return copyResourceText({ text: async () => message })
    }
    try {
      await Share.share({ message })
    } catch (error) {
      toast.error(t('Erreur lors du partage.'))
      Sentry.captureException(error)
    }
  }

  // The entry opens on the word as the verse uses it, as a word touched in the reader opens it.
  const openWord = (word: SelectionStrongWordPreview) => {
    const [book, chapter, verse] = word.verseKey.split('-')
    pushRouteOnce({
      pathname: '/strong',
      params: {
        identityKind: word.identity.kind,
        identityCode: word.identity.code,
        book,
        reference: word.identity.code,
        bibleVersion: version,
        clickedWord: word.word,
        bibleChapter: chapter,
        bibleVerse: verse,
        morphologyCodes: word.morphologyCodes.length
          ? JSON.stringify(word.morphologyCodes)
          : undefined,
      },
    })
  }

  return { copy, share, openWord }
}
