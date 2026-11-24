import { useAtomValue, useStore } from 'jotai/react'
import { PrimitiveAtom } from 'jotai/vanilla'
import { Book } from '~assets/bible_versions/books-desc'
import {
  bibleAudioFollowingTabIdAtom,
  bibleAudioSourceTabIdAtom,
  bibleAudioStateAtom,
} from '~features/bible-audio/atoms'
import { listenToPassage, pause, play } from '~features/bible-audio/bibleAudioPlayer'
import { isSamePassage } from '~features/bible-audio/samePassage'
import { hasRecordedAudio } from '~features/bible-audio/recordedEngine'
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
 * plays the passage shown. The player belongs to the app, not to the tab (ADR-0116).
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
  const { passage, status } = useAtomValue(bibleAudioStateAtom)
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

  const onPlay = () => {
    if (!isShownPassage) {
      listenToPassage(shown, { tabId })
      return
    }
    if (isPlaying || isLoading) {
      pause()
      return
    }
    // Playing the passage shown again ties the tab back to the audio.
    if (tabId) {
      store.set(bibleAudioSourceTabIdAtom, tabId)
      store.set(bibleAudioFollowingTabIdAtom, tabId)
    }
    void play()
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
      type={hasRecordedAudio(version) ? 'url' : 'tts'}
    />
  )
}

export default BibleFooter
