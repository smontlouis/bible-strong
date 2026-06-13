import { to } from 'await-to-js'
import React from 'react'
import { shallowEqual, useDispatch, useSelector } from 'react-redux'
import i18n from '~i18n'

import { cdnUrl } from '~helpers/firebase'
import { cacheImage, fetchPlan, updatePlans } from '~redux/modules/plan'
import { getPlanByIdSelector, getOngoingPlanByIdSelector } from '~redux/selectors/plan'

import { ComputedPlan, ComputedPlanItem, Plan, Status } from 'src/common/types'
import { RootState } from 'src/redux/modules/reducer'
import books from '~assets/bible_versions/books-desc'
import { toast } from '~helpers/toast'
import { localBibleContentAccess } from '~features/resources/bibleContentAccess'
import { localBibleReadingResourceAccess } from '~features/resources/bibleReadingResourceAccess'
import { range } from '~helpers/range'
import verseToReference from '~helpers/verseToReference'
import { useDefaultBibleVersion } from '../../state/useDefaultBibleVersion'
import { VersionCode } from '~state/tabs'
import type { AppDispatch } from '~redux/store'
import { areOngoingPlansEqual, buildComputedPlan, buildComputedPlanItem } from './planProgress'

interface VerseContent {
  Pericope: {
    h1?: string
    h2?: string
    h3?: string
    h4?: string
  }
  Verset: string
  Texte: string
}

interface ChapterForPlanContent {
  title: string
  verses: VerseContent[]
  viewMore: {
    route: 'BibleView'
    params: {
      contextDisplayMode: 'focused'
      book: number
      chapter: number
      verse: number
    }
  }
}

interface ChapterForPlan {
  bookName: string
  chapters: ChapterForPlanContent[]
}

interface VerseForPlan {
  bookName: string
  verses: VerseContent[]
  viewMore?: {
    route: 'BibleView'
    params: {
      contextDisplayMode: 'focused'
      book: number
      chapter: number
      verse: number
    }
  }
}

/**
 * Return computedPlan based on id
 * @param id
 */
export const useComputedPlan = (id: string): ComputedPlan | undefined => {
  // Use cached selectors to avoid recreating them on every render
  const selectPlanById = getPlanByIdSelector(id)
  const selectOngoingPlanById = getOngoingPlanByIdSelector(id)

  const plan = useSelector((state: RootState) => selectPlanById(state, id))
  const ongoingPlan = useSelector((state: RootState) => selectOngoingPlanById(state, id))

  if (!plan) {
    return
  }

  return buildComputedPlan(plan, ongoingPlan)
}

const compareMyPlans = (prev: Plan[], next: Plan[]) => {
  if (prev.length !== next.length) {
    return false
  }
  // Loop and compare lastUpdate field
  for (let i = 0; i < prev.length; i++) {
    if (prev[i]?.lastUpdate !== next[i]?.lastUpdate) {
      return false
    }
  }

  return true
}

/**
 * Return computed plan items for the plan list
 */
export const useComputedPlanItems = (): ComputedPlanItem[] => {
  const myPlans = useSelector((state: RootState) => state.plan.myPlans, compareMyPlans)
  const ongoingPlans = useSelector(
    (state: RootState) => state.plan.ongoingPlans,
    areOngoingPlansEqual
  )

  return myPlans.map(plan =>
    buildComputedPlanItem(
      plan,
      ongoingPlans.find(ongoingPlan => ongoingPlan.id === plan.id)
    )
  )
}

/**
 * Download ongoing plans to local
 */
export const useDownloadPlans = () => {
  const myPlans = useSelector((state: RootState) => state.plan.myPlans)
  const [isLoading, setIsLoading] = React.useState(false)
  const dispatch = useDispatch<AppDispatch>()
  const ongoingPlans = useSelector((state: RootState) => state.plan.ongoingPlans, shallowEqual)

  React.useEffect(() => {
    ;(async () => {
      const planNeedsToBeDownloaded = ongoingPlans.filter(
        plan => !myPlans.find(myPlan => myPlan.id === plan.id)
      )

      let err
      ;[err] = await to(
        Promise.all(
          planNeedsToBeDownloaded.map(async planToDownload => {
            setIsLoading(true)
            return dispatch(fetchPlan({ id: planToDownload.id })).unwrap()
          })
        )
      )

      setIsLoading(false)

      if (err) {
        toast.error('Impossible de télécharger vos plans, vérifiez votre connexion internet.')
      }
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return { isLoading }
}

/**
 * Update myplans
 */

export const useUpdatePlans = () => {
  const dispatch = useDispatch<AppDispatch>()
  React.useEffect(() => {
    dispatch(updatePlans())
  }, [dispatch])
}

/**
 * Transform 1|1-3 to ['1-1', '1-2', '1-3']
 * @param chapters
 */
const chapterStringToArray = (chapters: string) => {
  const [book, numberRange] = chapters.split('|')
  const [startChapter, endChapter] = numberRange.split('-').map(Number)

  return (
    endChapter
      ? range(startChapter, endChapter).map(n => `${book}-${n}`)
      : [`${book}-${startChapter}`]
  ).map(c => c.split('-'))
}

/**
 * Get verses, pericope, title for chapterSlice
 * @param chapters
 * @param version
 */
export const getChaptersForPlan = async (
  chapters: string,
  version: VersionCode
): Promise<ChapterForPlan> => {
  const book = chapters.split('|').map(Number)[0]
  const bookName = i18n.t(books[book - 1].Nom)
  const chaptersRange = chapterStringToArray(chapters)

  const pericope = await localBibleReadingResourceAccess.loadPericope(version)

  const content: ChapterForPlanContent[] = await Promise.all(
    chaptersRange.map(async (cRange: string[]) => {
      const [, chapter] = cRange.map(Number)

      const verses = await localBibleContentAccess.loadChapterVerses(version, book, chapter)
      const chapterContent: VerseContent[] = verses.map(v => ({
        Pericope: pericope?.[book]?.[chapter]?.[v.Verset] || {},
        Verset: `${v.Verset}`,
        Texte: v.Texte,
      }))

      return {
        title: `${i18n.t('Chapitre')} ${chapter}`,
        verses: chapterContent,
        viewMore: {
          route: 'BibleView',
          params: {
            contextDisplayMode: 'focused',
            book,
            chapter,
            verse: 1,
          },
        },
      }
    })
  )

  return { bookName, chapters: content }
}

export const useChapterToContent = (chapters: string) => {
  const [status, setStatus] = React.useState<Status>('Idle')
  const [content, setContent] = React.useState<ChapterForPlan>()

  const version = useDefaultBibleVersion()

  React.useEffect(() => {
    ;(async () => {
      try {
        setStatus('Pending')
        const result = await getChaptersForPlan(chapters, version)
        setContent(result)
        setStatus('Resolved')
      } catch {
        setStatus('Rejected')
      }
    })()
  }, [chapters, version])

  return { status, content }
}

/**
 * Get verses, pericope,  for verseSlice
 * @param verses
 * @param version
 */
export const getVersesForPlan = async (
  verses: string,
  version: VersionCode
): Promise<VerseForPlan> => {
  const [book, rest] = verses.split('|')
  const bookName = verseToReference(verses, { isPlan: true })

  const [chapter, numberRange] = rest.split(':')
  const [startVerse, endVerse] = numberRange.split('-').map(Number)
  const versesRange: number[][] = (
    endVerse
      ? range(startVerse, endVerse).map(n => `${book}-${chapter}-${n}`)
      : [`${book}-${chapter}-${startVerse}`]
  ).map(c => c.split('-').map(Number))

  const pericope = await localBibleReadingResourceAccess.loadPericope(version)

  const content: VerseContent[] = await Promise.all(
    versesRange.map(async (vRange: number[]) => {
      const [bookNum, chapterNum, verse] = vRange

      const text =
        (await localBibleContentAccess.loadVerseText(version, bookNum, chapterNum, verse)) ?? ''

      return {
        Pericope: pericope?.[book]?.[chapter]?.[verse] || {},
        Verset: `${verse}`,
        Texte: text,
      }
    })
  )

  return {
    bookName,
    verses: content,
    viewMore: {
      route: 'BibleView',
      params: {
        contextDisplayMode: 'focused',
        book: Number(book),
        chapter: Number(chapter),
        verse: startVerse,
      },
    },
  }
}

export const useVersesToContent = (verses: string) => {
  const [status, setStatus] = React.useState<Status>('Idle')
  const [content, setContent] = React.useState<VerseForPlan>()

  const version = useDefaultBibleVersion()

  React.useEffect(() => {
    ;(async () => {
      try {
        setStatus('Pending')
        const result = await getVersesForPlan(verses, version)
        setContent(result)
        setStatus('Resolved')
      } catch {
        setStatus('Rejected')
      }
    })()
  }, [verses, version])

  return { status, content }
}

export const useFireStorage = (src?: string) => {
  const [imageUrl, setImageUrl] = React.useState<string>()
  const dispatch = useDispatch<AppDispatch>()
  const cachedUri = useSelector((state: RootState) => src && state.plan.images[src])

  React.useEffect(() => {
    if (!src) return
    ;(async () => {
      if (cachedUri) {
        setImageUrl(cachedUri)
        return
      }

      try {
        const uri = cdnUrl(`images/${src}.png`)
        setImageUrl(uri)
        dispatch(cacheImage({ id: src, value: uri }))
      } catch {
        console.log(`[Plans] Can't find: images/${src}`)
      }
    })()
  }, [src, cachedUri, dispatch])

  return imageUrl
}
