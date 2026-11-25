import { useAtomValue, useStore } from 'jotai/react'
import { PrimitiveAtom } from 'jotai/vanilla'
import { Book } from '~assets/bible_versions/books-desc'
import {
  bibleAudioFollowingTabIdAtom,
  bibleAudioSourceTabIdAtom,
  bibleAudioStateAtom,
} from '~features/bible-audio/atoms'
import { listenToPassage, openBibleAudioPlayer, play } from '~features/bible-audio/bibleAudioPlayer'
import { isSamePassage } from '~features/bible-audio/samePassage'
import {
  bibleAudioCatalogAtom,
  bibleAudioChoiceByVersionAtom,
  resolveBibleAudio,
} from '~features/bible-audio/audioCatalog'
import {
  getNextAvailableChapterLocation,
  getPreviousAvailableChapterLocation,
  resolveBibleCoverageCanonId,
} from '~helpers/bibleCoverage'
import type { BibleVersionCoverage } from '~helpers/biblesDb'
import { getBibleVersionCanonId } from '~helpers/bibleVersions'
import { BibleTab, useIsCurrentTab, VersionCode } from '~state/tabs'
import { canGoToNextPlanChapter, canGoToPreviousPlanChapter } from '../planPassage'
import BasicFooter from './BasicFooter'

type BibleFooterProps = {
  book: Book
  chapter: number
  goToNextChapter: () => void
  goToPrevChapter: () => void
  disabled?: boolean
  version: VersionCode
  bibleAtom: PrimitiveAtom<BibleTab>
  coverage?: BibleVersionCoverage
  isInTab?: boolean
}

/**
 * The reader's footer: the previous and next chapter, and the way into the audio player, which
 * plays the passage shown, or opens on it once it is the one heard. The player belongs to the app,
 * not to the tab (ADR-0116).
 */
const BibleFooter = ({
  bibleAtom,
  book,
  chapter,
  goToNextChapter,
  goToPrevChapter,
  disabled,
  version,
  coverage,
  isInTab = true,
}: BibleFooterProps) => {
  const store = useStore()
  const bibleTab = useAtomValue(bibleAtom)
  const { passage, source, status } = useAtomValue(bibleAudioStateAtom)
  // Read so that the button follows a change of choice or of catalog.
  useAtomValue(bibleAudioChoiceByVersionAtom)
  useAtomValue(bibleAudioCatalogAtom)
  const getIsCurrentTab = useIsCurrentTab()
  const isCurrentTab = getIsCurrentTab(bibleAtom)

  if (isInTab && !isCurrentTab) {
    return null
  }

  const planPassage = bibleTab.data.planPassage
  const canonId = resolveBibleCoverageCanonId(coverage, getBibleVersionCanonId(version))
  const location = { book: book.Numero, chapter }
  const hasPreviousChapter =
    canGoToPreviousPlanChapter(planPassage, location) &&
    !!getPreviousAvailableChapterLocation(book, chapter, coverage, canonId)
  const hasNextChapter =
    canGoToNextPlanChapter(planPassage, location) &&
    !!getNextAvailableChapterLocation(book, chapter, coverage, canonId)

  const shown = { version, book, chapter }
  const isShownPassage = !!passage && isSamePassage(passage, shown)
  const isPlaying = isShownPassage && status === 'playing'
  const isLoading = isShownPassage && status === 'loading'
  const tabId = isInTab ? bibleTab.id : undefined
  // What the button plays: the voice heard for the passage shown, else the reader's choice for it.
  const heardWith = isShownPassage ? source : resolveBibleAudio(shown).source

  const onPlay = () => {
    if (!isShownPassage) {
      listenToPassage(shown, { tabId })
      return
    }
    // The passage shown is the one heard: the button opens the player, which holds its controls,
    // and ties the tab back to the audio; a paused passage plays again.
    if (tabId) {
      store.set(bibleAudioSourceTabIdAtom, tabId)
      store.set(bibleAudioFollowingTabIdAtom, tabId)
    }
    if (!isPlaying && !isLoading) void play()
    openBibleAudioPlayer()
  }

  return (
    <BasicFooter
      isParallel={Boolean(bibleTab.data.parallelVersions?.length)}
      onPlay={onPlay}
      onPrevChapter={hasPreviousChapter ? goToPrevChapter : undefined}
      onNextChapter={hasNextChapter ? goToNextChapter : undefined}
      // The button turns to its playing look, with a spinner, as soon as the chapter loads.
      isPlaying={isPlaying || isLoading}
      isDisabled={disabled}
      isLoading={isLoading}
      hasError={isShownPassage && status === 'error'}
      type={heardWith === 'recorded' ? 'url' : 'tts'}
    />
  )
}

export default BibleFooter
