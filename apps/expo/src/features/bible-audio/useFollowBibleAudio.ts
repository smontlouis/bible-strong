import { useAtom, useAtomValue } from 'jotai/react'
import { useEffect, useEffectEvent, useRef } from 'react'
import type { Book } from '~assets/bible_versions/books-desc'
import { isInPlanPassage } from '~features/bible/planPassage'
import type { BiblePlanPassage, VersionCode } from '~state/tabs'
import { bibleAudioFollowingTabIdAtom, bibleAudioPassageAtom } from './atoms'

type FollowBibleAudioParams = {
  tabId: string
  /** Only a reader in a tab follows: a page opened over the app keeps its own passage. */
  enabled: boolean
  version: VersionCode
  book: Book
  chapter: number
  planPassage?: BiblePlanPassage
  goToChapter: (target: { book: Book; chapter: number }) => void
}

/**
 * The soft link between a Bible tab and the audio player. The following tab turns its pages with
 * the audio; as soon as its reader goes to another passage, it lets go and the audio plays on, and
 * a tab whose reader comes back to the passage heard follows it again.
 */
export const useFollowBibleAudio = ({
  tabId,
  enabled,
  version,
  book,
  chapter,
  planPassage,
  goToChapter,
}: FollowBibleAudioParams) => {
  const [followingTabId, setFollowingTabId] = useAtom(bibleAudioFollowingTabIdAtom)
  const passage = useAtomValue(bibleAudioPassageAtom)
  const isFollowing = enabled && followingTabId === tabId

  const letGo = useEffectEvent(() => {
    if (followingTabId === tabId) setFollowingTabId('')
  })

  // The audio moved: the page follows.
  const follow = useEffectEvent(() => {
    if (!isFollowing || !passage) return
    if (passage.book.Numero === book.Numero && passage.chapter === chapter) return
    if (
      passage.version !== version ||
      !isInPlanPassage(planPassage, { book: passage.book.Numero, chapter: passage.chapter })
    ) {
      letGo()
      return
    }
    goToChapter({ book: passage.book, chapter: passage.chapter })
  })

  useEffect(() => {
    follow()
  }, [isFollowing, passage?.version, passage?.book.Numero, passage?.chapter])

  // The reader moved: going elsewhere, the page lets go; coming back to what plays, it follows again.
  const lastLocation = useRef<string | null>(null)
  const checkReaderMove = useEffectEvent((location: string) => {
    const previous = lastLocation.current
    lastLocation.current = location
    if (previous === null || previous === location || !enabled || !passage) return
    const audioLocation = `${passage.version}:${passage.book.Numero}:${passage.chapter}`
    if (location !== audioLocation) letGo()
    else if (!isFollowing) setFollowingTabId(tabId)
  })

  useEffect(() => {
    checkReaderMove(`${version}:${book.Numero}:${chapter}`)
  }, [version, book.Numero, chapter])
}
