import React from 'react'
import * as Sentry from '@sentry/react-native'
import { useDispatch, useSelector } from 'react-redux'
import to from 'await-to-js'
import i18n from '~i18n'

import { storageRef } from '~helpers/firebase'
import { cacheImage, fetchPlan, updatePlans } from '~redux/modules/plan'

import {
  ComputedPlan,
  ComputedPlanItem,
  ComputedSection,
  Section,
  OngoingReadingSlice,
  ReadingSlice,
  Status,
} from 'src/common/types'
import { RootState } from 'src/redux/modules/reducer'
import books from '~assets/bible_versions/books-desc'
import getBiblePericope from '~helpers/getBiblePericope'
import { range } from '~helpers/range'
import loadBible from '~helpers/loadBible'
import SnackBar from '~common/SnackBar'
import verseToReference from '~helpers/verseToReference'
import { useGetDefaultBibleTabAtom } from '../../state/tabs'
import { useAtom } from 'jotai'

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
      isReadOnly: true
      book: number
      chapter: number
      verse: 1
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
      isReadOnly: true
      book: number
      chapter: number
      verse: 1
    }
  }
}

/**
 * Calculate Section Progress
 * @param readingSlices
 * @param ongoingReadingSlices
 */
const calculateProgress = (
  readingSlices: ReadingSlice[],
  ongoingReadingSlices?: OngoingReadingSlice[]
) => {
  if (!ongoingReadingSlices) {
    return 0
  }

  return (
    ongoingReadingSlices.filter(oReadingSlice =>
      readingSlices.find(
        rSlice =>
          rSlice.id === oReadingSlice.id && oReadingSlice.status === 'Completed'
      )
    ).length / readingSlices.length
  )
}

/**
 * Transform sections to computedSections with progress and status
 * @param sections
 * @param ongoingReadingSlices
 */
const transformSections = (
  sections: Section[],
  ongoingReadingSlices?: OngoingReadingSlice[]
): ComputedSection[] =>
  sections.map((s, i) => ({
    ...s,
    progress: calculateProgress(s.readingSlices, ongoingReadingSlices),
    readingSlices: undefined,
    data: s.readingSlices.map(rSlice => {
      const ongoingReadingSlice = ongoingReadingSlices?.find(
        r => r.id === rSlice.id
      )
      if (ongoingReadingSlice) {
        return {
          ...rSlice,
          status: ongoingReadingSlice.status,
        }
      }
      return {
        ...rSlice,
        status: 'Idle',
      }
    }),
  }))

/**
 * Return computedPlan based on id
 * @param id
 */
export const useComputedPlan = (id: string): ComputedPlan | undefined => {
  const plan = useSelector((state: RootState) =>
    state.plan.myPlans.find(p => p.id === id)
  )
  const ongoingPlan = useSelector((state: RootState) =>
    state.plan.ongoingPlans.find(uP => uP.id === id)
  )

  if (!plan) {
    return
  }

  if (ongoingPlan) {
    // Calculate progress
    const flattenedReadingSlices: ReadingSlice[] = plan.sections.reduce(
      (acc: ReadingSlice[], curr) => [...acc, ...curr.readingSlices],
      []
    )

    const onGoingReadingSlicesArray = Object.entries(
      ongoingPlan?.readingSlices
    ).map(([id, status]) => ({
      id,
      status,
    }))

    return {
      ...plan,
      status: ongoingPlan.status,
      progress: calculateProgress(
        flattenedReadingSlices,
        onGoingReadingSlicesArray
      ),
      sections: transformSections(plan.sections, onGoingReadingSlicesArray),
    }
  }
  return {
    ...plan,
    status: 'Idle',
    progress: 0,
    sections: transformSections(plan.sections),
  }
}

/**
 * Return computed plan items for the plan list
 */
export const useComputedPlanItems = (): ComputedPlanItem[] => {
  const myPlans = useSelector((state: RootState) => state.plan.myPlans)
  const ongoingPlans = useSelector(
    (state: RootState) => state.plan.ongoingPlans
  )

  const computedPlansItems: ComputedPlanItem[] = myPlans.map(
    ({ sections, ...plan }) => {
      const ongoingPlan = ongoingPlans.find(uP => uP.id === plan.id)

      if (ongoingPlan) {
        const onGoingReadingSlicesArray = Object.entries(
          ongoingPlan?.readingSlices
        ).map(([id, status]) => ({
          id,
          status,
        }))

        // Calculate progress
        const flattenedReadingSlices: ReadingSlice[] = sections.reduce(
          (acc: ReadingSlice[], curr) => [...acc, ...curr.readingSlices],
          []
        )
        return {
          ...plan,
          status: ongoingPlan.status,
          progress: calculateProgress(
            flattenedReadingSlices,
            onGoingReadingSlicesArray
          ),
        }
      }
      return {
        ...plan,
        status: 'Idle',
        progress: 0,
      }
    }
  )

  return computedPlansItems
}

/**
 * Download ongoing plans to local
 */
export const useDownloadPlans = () => {
  const myPlans = useSelector((state: RootState) => state.plan.myPlans)
  const [isLoading, setIsLoading] = React.useState(false)
  const dispatch = useDispatch()
  const ongoingPlans = useSelector(
    (state: RootState) => state.plan.ongoingPlans
  )

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
            return (await dispatch(fetchPlan({ id: planToDownload.id }))) as any
          })
        )
      )

      setIsLoading(false)

      if (err) {
        SnackBar.show(
          'Impossible de télécharger vos plans, vérifiez votre connexion internet.'
        )
      }
    })()
  }, [])

  return { isLoading }
}

/**
 * Update myplans
 */

export const useUpdatePlans = () => {
  const dispatch = useDispatch()
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

  return (endChapter
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
  version: string
): Promise<ChapterForPlan> => {
  const book = chapters.split('|').map(Number)[0]
  const bookName = i18n.t(books[book - 1].Nom)
  const chaptersRange = chapterStringToArray(chapters)
  const bible = await loadBible(version)
  const pericope = getBiblePericope(version)

  const content: ChapterForPlanContent[] = chaptersRange.map(
    (cRange: string[]) => {
      const [, chapter] = cRange.map(Number)
      const chapterContent = Object.keys(bible[book][chapter]).map(v => ({
        Pericope: pericope?.[book]?.[chapter]?.[v] || {},
        Verset: v,
        Texte: bible[book][chapter][v],
      }))

      return {
        title: `${i18n.t('Chapitre')} ${chapter}`,
        verses: chapterContent,
        viewMore: {
          route: 'BibleView',
          params: {
            isReadOnly: true,
            book,
            chapter,
            verse: 1,
          },
        },
      }
    }
  )

  return { bookName, chapters: content }
}

export const useChapterToContent = (chapters: string) => {
  const [status, setStatus] = React.useState<Status>('Idle')
  const [content, setContent] = React.useState<ChapterForPlan>()

  const defaultBibleAtom = useGetDefaultBibleTabAtom()
  const [bible] = useAtom(defaultBibleAtom)
  const { selectedVersion: version } = bible.data

  React.useEffect(() => {
    ;(async () => {
      try {
        setStatus('Pending')
        const result = await getChaptersForPlan(chapters, version)
        setContent(result)
        setStatus('Resolved')
      } catch (e) {
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
  version: string
): Promise<VerseForPlan> => {
  const [book, rest] = verses.split('|')
  const bookName = verseToReference(verses, { isPlan: true })

  const [chapter, numberRange] = rest.split(':')
  const [startVerse, endVerse] = numberRange.split('-').map(Number)
  const versesRange: number[][] = (endVerse
    ? range(startVerse, endVerse).map(n => `${book}-${chapter}-${n}`)
    : [`${book}-${chapter}-${startVerse}`]
  ).map(c => c.split('-').map(Number))

  const bible = await loadBible(version)
  const pericope = getBiblePericope(version)

  const content: VerseContent[] = versesRange.map((vRange: number[]) => {
    const [, , verse] = vRange
    const verseContent = {
      Pericope: pericope?.[book]?.[chapter]?.[verse] || {},
      Verset: `${verse}`,
      Texte: bible[book][chapter][verse],
    }

    return verseContent
  })

  return {
    bookName,
    verses: content,
    viewMore: {
      route: 'BibleView',
      params: {
        isReadOnly: true,
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

  const defaultBibleAtom = useGetDefaultBibleTabAtom()
  const [bible] = useAtom(defaultBibleAtom)
  const { selectedVersion: version } = bible.data

  React.useEffect(() => {
    ;(async () => {
      try {
        setStatus('Pending')
        const result = await getVersesForPlan(verses, version)
        setContent(result)
        setStatus('Resolved')
      } catch (e) {
        setStatus('Rejected')
      }
    })()
  }, [verses, version])

  return { status, content }
}

export const useFireStorage = (src?: string) => {
  const [imageUrl, setImageUrl] = React.useState<string>()
  const dispatch = useDispatch()
  const cachedUri = useSelector(
    (state: RootState) => src && state.plan.images[src]
  )

  React.useEffect(() => {
    if (!src) return
    ;(async () => {
      if (cachedUri) {
        setImageUrl(cachedUri)
        return
      }

      try {
        const uri = await storageRef.child(`images/${src}.png`).getDownloadURL()
        setImageUrl(uri)
        dispatch(cacheImage({ id: src, value: uri }))
      } catch (e) {
        Sentry.captureException(e)
        console.log(`can't find: images/${src}`)
      }
    })()
  }, [src, cachedUri, dispatch])

  return imageUrl
}
