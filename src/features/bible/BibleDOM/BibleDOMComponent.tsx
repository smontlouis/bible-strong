'use dom'

import { setup, styled } from 'goober'
import React, { useEffect, useState } from 'react'
import { TagsObj, Verse as TVerse } from '~common/types'
import { HighlightsObj, NotesObj, LinksObj } from '~redux/modules/user'
import {
  Dispatch,
  LinkedVerse,
  NotedVerse,
  ParallelVerse,
  PericopeChapter,
  RootStyles,
  TaggedVerse,
  WebViewProps,
} from './BibleDOMWrapper'
import ChevronDownIcon from './ChevronDownIcon'
import Comment from './Comment'
import {
  ADD_PARALLEL_VERSION,
  NAVIGATE_TO_PERICOPE,
  NAVIGATE_TO_VERSION,
  REMOVE_PARALLEL_VERSION,
  SWIPE_LEFT,
  SWIPE_RIGHT,
  SWIPE_DOWN,
  SWIPE_UP,
} from './dispatch'
import { DispatchProvider, useDispatch } from './DispatchProvider'
import { TranslationsProvider, BibleDOMTranslations } from './TranslationsContext'
import ExternalIcon from './ExternalIcon'
import MinusIcon from './MinusIcon'
import PlusIcon from './PlusIcon'
import './polyfills'
import { scaleFontSize } from './scaleFontSize'
import './swiped-events'
import Verse from './Verse'
import { useFonts } from 'expo-font'
import { HEADER_HEIGHT, HEADER_HEIGHT_MIN } from '~features/app-switcher/utils/constants'

declare global {
  interface Window {
    disableSwipeDownEvent: boolean
  }
}

const forwardProps = [
  'isHebreu',
  'isFocused',
  'isParallel',
  'isParallelVerse',
  'isTouched',
  'isSelected',
  'isVerseToScroll',
  'highlightedColor',
  'rtl',
]
setup(React.createElement, undefined, undefined, (props: { [key: string]: any }) => {
  for (let prop in props) {
    if (forwardProps.includes(prop)) {
      delete props[prop]
    }
  }
})

type Props = Pick<
  WebViewProps,
  | 'verses'
  | 'parallelVerses'
  | 'focusVerses'
  | 'secondaryVerses'
  | 'selectedVerses'
  | 'highlightedVerses'
  | 'notedVerses'
  | 'bookmarkedVerses'
  | 'linkedVerses'
  | 'settings'
  | 'verseToScroll'
  | 'isReadOnly'
  | 'version'
  | 'pericopeChapter'
  | 'chapter'
  | 'isSelectionMode'
  | 'selectedCode'
  | 'comments'
> & {
  dispatch: Dispatch
  dom: import('expo/dom').DOMProps
  translations: BibleDOMTranslations
}

const extractParallelVerse = (
  i: number,
  parallelVerses: ParallelVerse[],
  verse: TVerse,
  version: string
) => [
  { version, verse, error: undefined },
  ...parallelVerses.map(p => ({
    version: p.id,
    verse: p.verses[i],
    error: p.error,
  })),
]

const extractParallelVersionTitles = (parallelVerses: ParallelVerse[], currentVersion: string) => {
  if (!parallelVerses?.length) return []

  return [
    { id: currentVersion, error: undefined },
    ...parallelVerses.map(p => ({ id: p.id, error: p.error })),
  ]
}

const Container = styled('div')<RootStyles & { rtl: boolean; isParallelVerse: boolean }>(
  ({ settings: { alignContent, theme, colors }, rtl, isParallelVerse }) => ({
    maxWidth: isParallelVerse ? 'none' : '800px',
    margin: '0 auto',
    padding: isParallelVerse ? '10px 5px' : '10px 15px',
    paddingBottom: '300px',
    textAlign: alignContent,
    background: colors[theme].reverse,
    color: colors[theme].default,
    direction: rtl ? 'rtl' : 'ltr',
    paddingTop: `${HEADER_HEIGHT + 10}px`,
    ...(rtl ? { textAlign: 'right' } : {}),
  })
)

const RightDirection = styled('div')<RootStyles>(({ settings: { theme, colors } }) => ({
  textAlign: 'right',
  marginBottom: '20px',
  fontFamily: 'arial',
  fontSize: '13px',
  color: colors[theme].darkGrey,
}))

const IntMode = styled('div')<RootStyles>(({ settings: { theme, colors } }) => ({
  textAlign: 'right',
  marginBottom: '20px',
  fontFamily: 'arial',
  fontSize: '13px',
  color: colors[theme].default,
}))

const Span = styled('span')({})

const H1 = styled('h1')<RootStyles & { isHebreu: boolean }>(
  ({ settings: { fontSizeScale, fontFamily }, isHebreu }) => ({
    fontFamily,
    fontSize: scaleFontSize(28, fontSizeScale),
    textAlign: isHebreu ? 'right' : 'left',
  })
)

const H2 = styled('h2')<RootStyles & { isHebreu: boolean }>(
  ({ settings: { fontSizeScale, fontFamily }, isHebreu }) => ({
    fontFamily,
    fontSize: scaleFontSize(24, fontSizeScale),
    textAlign: isHebreu ? 'right' : 'left',
  })
)

const H3 = styled('h3')<RootStyles & { isHebreu: boolean }>(
  ({ settings: { fontSizeScale, fontFamily }, isHebreu }) => ({
    fontFamily,
    fontSize: scaleFontSize(20, fontSizeScale),
    textAlign: isHebreu ? 'right' : 'left',
  })
)

const H4 = styled('h4')<RootStyles & { isHebreu: boolean }>(
  ({ settings: { fontSizeScale, fontFamily }, isHebreu }) => ({
    fontFamily,
    fontSize: scaleFontSize(18, fontSizeScale),
    textAlign: isHebreu ? 'right' : 'left',
  })
)

const VersionTitle = styled('div')<RootStyles>(({ settings: { fontSizeScale, fontFamily } }) => ({
  fontFamily,
  fontWeight: 'bold',
  fontSize: scaleFontSize(18, fontSizeScale),
}))

const VersionErrorIndicator = styled('span')<RootStyles>(({ settings: { theme, colors } }) => ({
  color: colors[theme].quart,
  marginLeft: '4px',
  fontSize: '12px',
}))

const ParallelVersionError = styled('div')<RootStyles>(({ settings: { theme, colors, fontFamily, fontSizeScale } }) => ({
  fontFamily,
  fontSize: scaleFontSize(14, fontSizeScale),
  color: colors[theme].darkGrey,
  padding: '10px',
  textAlign: 'center',
  fontStyle: 'italic',
}))

const VersionsContainer = styled('div')<RootStyles>(({ settings: { theme, colors } }) => ({
  display: 'flex',
  position: 'sticky',
  top: 'var(--header-height)',
  background: colors[theme].reverse,
  paddingTop: '5px',
  paddingBottom: '10px',
  transition: 'top 0.3s cubic-bezier(.13,.69,.5,.98)',
}))

const mediaQueries = ['@media (min-width: 640px)']

const ResponsivePlusIcon = styled(PlusIcon)<RootStyles>(({ settings: { theme, colors } }) => ({
  position: 'absolute',
  top: '50%',
  transform: 'translateY(-50%)',
  right: '0',
  color: colors[theme].primary,
  display: 'none',

  [mediaQueries[0]]: {
    display: 'block',
  },
}))

const getPericopeVerse = (pericopeChapter: PericopeChapter, verse: number) => {
  if (pericopeChapter && pericopeChapter[verse]) {
    return pericopeChapter[verse]
  }

  return {}
}

const VersesRenderer = ({
  verses,
  parallelVerses,
  focusVerses,
  secondaryVerses,
  comments: originalComments,
  selectedVerses,
  highlightedVerses,
  notedVerses,
  bookmarkedVerses,
  linkedVerses,
  settings,
  verseToScroll,
  isReadOnly,
  version,
  pericopeChapter,
  chapter,
  isSelectionMode,
  selectedCode,
  dispatch,
  translations,
}: Props) => {
  const [isINTComplete, setIsINTComplete] = useState(true)
  const [loaded, error] = useFonts({
    'Literata Book': require('~assets/fonts/LiterataBook-Regular.otf'),
  })

  useEffect(() => {
    // Notify parent component that we've mounted
    console.log('[Bible] WEB: DOM component mounted')
    dispatch({
      type: 'DOM_COMPONENT_MOUNTED',
    }).catch(console.error)

    // Set initial header height CSS variable
    document.documentElement.style.setProperty('--header-height', `${HEADER_HEIGHT}px`)
  }, [])

  useEffect(() => {
    let lastScrollTop = 0
    let lastScrollTime = Date.now()
    const VELOCITY_THRESHOLD = 400
    let canSwipeDown = true
    let canSwipeUp = true
    let reachedBoundaries = false

    const handleScroll = () => {
      const currentScrollTop = window.scrollY
      const currentTime = Date.now()
      const timeDiff = currentTime - lastScrollTime
      const scrollDiff = currentScrollTop - lastScrollTop

      // Calculate velocity (pixels per millisecond)
      const velocity = Math.abs(scrollDiff / timeDiff)

      // Get total scrollable height
      const totalHeight = document.documentElement.scrollHeight - window.innerHeight

      // Don't dispatch if scroll is beyond boundaries (iOS momentum scrolling)
      if (currentScrollTop < 0 || currentScrollTop > totalHeight) {
        if (!reachedBoundaries) {
          dispatch({
            type: SWIPE_UP,
          })
          document.documentElement.style.setProperty('--header-height', `${HEADER_HEIGHT}px`)
        }
        reachedBoundaries = true
        return
      }

      reachedBoundaries = false

      // Only trigger if velocity is above threshold
      if (velocity * 1000 > VELOCITY_THRESHOLD) {
        if (scrollDiff > 0 && canSwipeDown) {
          if (window.disableSwipeDownEvent) return
          dispatch({
            type: SWIPE_DOWN,
          })
          document.documentElement.style.setProperty('--header-height', `${HEADER_HEIGHT_MIN}px`)
          canSwipeDown = false
          canSwipeUp = true
        } else if (scrollDiff < 0 && canSwipeUp) {
          dispatch({
            type: SWIPE_UP,
          })
          document.documentElement.style.setProperty('--header-height', `${HEADER_HEIGHT}px`)
          canSwipeUp = false
          canSwipeDown = true
        }
      }

      lastScrollTop = currentScrollTop
      lastScrollTime = currentTime
    }

    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  useEffect(() => {
    document.addEventListener('swiped-left', function (e) {
      dispatch({
        type: SWIPE_LEFT,
      })
    })

    document.addEventListener('swiped-right', function (e) {
      dispatch({
        type: SWIPE_RIGHT,
      })
    })
  }, [])

  const hasVerses = verses.length > 0
  useEffect(() => {
    if (!hasVerses) return
    if (verseToScroll === 1) {
      window.scrollTo(0, 0)
    }
  }, [chapter, verseToScroll, hasVerses])

  useEffect(() => {
    if (settings?.theme) {
      document.body.style.backgroundColor = settings.colors[settings.theme].reverse
    }
  }, [settings?.theme])

  useEffect(() => {
    if (!verseToScroll || !hasVerses) return

    if (verseToScroll === 1) return

    requestAnimationFrame(() => {
      const element = document.querySelector(`#verset-${verseToScroll}`)
      if (element) {
        window.disableSwipeDownEvent = true
        const elementPosition = element.getBoundingClientRect().top
        window.scrollTo({
          top: window.scrollY + elementPosition - 100,
        })
        setTimeout(() => {
          window.disableSwipeDownEvent = false
        }, 400)
      }
    })
  }, [verseToScroll, hasVerses])

  const sortVersesToTags = (highlightedVerses: HighlightsObj): TaggedVerse[] | null => {
    if (!highlightedVerses) return null
    const p = highlightedVerses
    const taggedVerses = Object.keys(p).reduce(
      (
        arr: {
          date: number
          color: string
          verseIds: any[]
          tags: TagsObj
        }[],
        verse,
        i
      ) => {
        const [Livre, Chapitre, Verset] = verse.split('-').map(Number)
        const formattedVerse = { Livre, Chapitre, Verset, Texte: '' }

        if (!arr.find(a => a.date === p[verse].date)) {
          arr.push({
            date: p[verse].date,
            color: p[verse].color,
            verseIds: [],
            tags: {},
          })
        }

        const dateInArray = arr.find(a => a.date === p[verse].date)
        if (dateInArray) {
          dateInArray.verseIds.push(verse)
          dateInArray.verseIds.sort((a, b) => Number(a.Verset) - Number(b.Verset))
          dateInArray.tags = { ...dateInArray.tags, ...p[verse].tags }
        }

        arr.sort((a, b) => Number(b.date) - Number(a.date))

        return arr
      },
      []
    )

    return taggedVerses.map(verse => ({
      ...verse,
      lastVerse: verse.verseIds[verse.verseIds.length - 1],
      tags: Object.values(verse.tags),
    }))
  }

  const getNotedVersesCount = (verses: any, notedVerses: any) => {
    const newNotedVerses: { [key: string]: number } = {}
    if (verses?.length) {
      const { Livre, Chapitre } = verses[0]
      Object.keys(notedVerses).map(key => {
        const firstVerseRef = key.split('/')[0]
        const bookNumber = parseInt(firstVerseRef.split('-')[0])
        const chapterNumber = parseInt(firstVerseRef.split('-')[1])
        const verseNumber = firstVerseRef.split('-')[2]
        if (bookNumber === Livre && chapterNumber === Chapitre) {
          if (newNotedVerses[verseNumber])
            newNotedVerses[verseNumber] = newNotedVerses[verseNumber] + 1
          else newNotedVerses[verseNumber] = 1
        }
      })
    }
    return newNotedVerses
  }

  const getNotedVersesText = (verses: TVerse[], notedVerses: NotesObj) => {
    const newNotedVerses: {
      [key: string]: NotedVerse[]
    } = {}

    if (verses?.length) {
      const { Livre, Chapitre } = verses[0]
      Object.entries(notedVerses).map(([key, value]) => {
        const versesInArray = key.split('/')

        const lastVerseRef = versesInArray[versesInArray.length - 1]
        const bookNumber = parseInt(lastVerseRef.split('-')[0])
        const chapterNumber = parseInt(lastVerseRef.split('-')[1])
        const verseNumber = lastVerseRef.split('-')[2]

        if (bookNumber === Livre && chapterNumber === Chapitre) {
          const verseToPush = {
            key,
            verses:
              versesInArray.length > 1
                ? `${versesInArray[0].split('-')[2]}-${
                    versesInArray[versesInArray.length - 1].split('-')[2]
                  }`
                : versesInArray[0].split('-')[2],
            ...value,
          }
          if (newNotedVerses[verseNumber]) {
            newNotedVerses[verseNumber].push(verseToPush)
          } else {
            newNotedVerses[verseNumber] = [verseToPush]
          }
        }
      })
    }
    return newNotedVerses
  }

  const getLinkedVersesCount = (verses: TVerse[], linkedVerses: LinksObj | undefined) => {
    const newLinkedVerses: { [key: string]: number } = {}
    if (verses?.length && linkedVerses) {
      const { Livre, Chapitre } = verses[0]
      Object.keys(linkedVerses).map(key => {
        const firstVerseRef = key.split('/')[0]
        const bookNumber = parseInt(firstVerseRef.split('-')[0])
        const chapterNumber = parseInt(firstVerseRef.split('-')[1])
        const verseNumber = firstVerseRef.split('-')[2]
        if (bookNumber === Livre && chapterNumber === Chapitre) {
          if (newLinkedVerses[verseNumber])
            newLinkedVerses[verseNumber] = newLinkedVerses[verseNumber] + 1
          else newLinkedVerses[verseNumber] = 1
        }
      })
    }
    return newLinkedVerses
  }

  const getLinkedVersesText = (verses: TVerse[], linkedVerses: LinksObj | undefined) => {
    const newLinkedVerses: {
      [key: string]: LinkedVerse[]
    } = {}

    if (verses?.length && linkedVerses) {
      const { Livre, Chapitre } = verses[0]
      Object.entries(linkedVerses).map(([key, value]) => {
        const versesInArray = key.split('/')

        const lastVerseRef = versesInArray[versesInArray.length - 1]
        const bookNumber = parseInt(lastVerseRef.split('-')[0])
        const chapterNumber = parseInt(lastVerseRef.split('-')[1])
        const verseNumber = lastVerseRef.split('-')[2]

        if (bookNumber === Livre && chapterNumber === Chapitre) {
          const title = value.customTitle || value.ogData?.title || value.url
          const verseToPush: LinkedVerse = {
            key,
            verses:
              versesInArray.length > 1
                ? `${versesInArray[0].split('-')[2]}-${
                    versesInArray[versesInArray.length - 1].split('-')[2]
                  }`
                : versesInArray[0].split('-')[2],
            url: value.url,
            title,
            linkType: value.linkType || 'website',
            date: value.date,
            tags: value.tags,
          }
          if (newLinkedVerses[verseNumber]) {
            newLinkedVerses[verseNumber].push(verseToPush)
          } else {
            newLinkedVerses[verseNumber] = [verseToPush]
          }
        }
      })
    }
    return newLinkedVerses
  }

  const transformComments = (comments: { [key: string]: string } | null, versesLength: number) => {
    if (!comments) return null

    return Object.entries(comments).reduce(
      (acc, [key, value], i) => {
        if (key === '0') {
          return { ...acc, [key]: value }
        }

        if (Object.entries(comments)[i + 1]) {
          const newKey = Number(Object.keys(comments)[i + 1]) - 1
          return { ...acc, [newKey]: value }
        }
        return { ...acc, [versesLength]: value }
      },
      {} as { [key: string]: string }
    )
  }

  const navigateToPericope = () => {
    dispatch({
      type: NAVIGATE_TO_PERICOPE,
    })
  }

  const navigateToVersion = (version: string, index: number) => {
    dispatch({
      type: NAVIGATE_TO_VERSION,
      payload: { version, index },
    })
  }

  const removeParallelVersion = (index: number) => {
    dispatch({
      type: REMOVE_PARALLEL_VERSION,
      payload: index,
    })
  }

  const addParallelVersion = () => {
    dispatch({
      type: ADD_PARALLEL_VERSION,
    })
  }

  const comments = transformComments(originalComments, verses.length)

  const isHebreu =
    version === 'BHS' ||
    ((version === 'INT' || version === 'INT_EN') && Number(verses[0].Livre) < 40)
  const introComment = comments?.[0]
  const isParallelVerse = Boolean(parallelVerses?.length)
  const parallelVersionTitles = isParallelVerse
    ? extractParallelVersionTitles(parallelVerses, version)
    : []

  const taggedVerses = sortVersesToTags(highlightedVerses)
  const notedVersesCount = getNotedVersesCount(verses, notedVerses)
  const notedVersesText = getNotedVersesText(verses, notedVerses)
  const linkedVersesCount = getLinkedVersesCount(verses, linkedVerses)
  const linkedVersesText = getLinkedVersesText(verses, linkedVerses)

  return (
    <TranslationsProvider translations={translations}>
      <DispatchProvider dispatch={dispatch}>
        <Container
        rtl={isHebreu}
        settings={settings}
        isParallelVerse={isParallelVerse}
        data-swipe-threshold="100"
      >
        {isParallelVerse && (
          <VersionsContainer settings={settings}>
            {parallelVersionTitles?.map((p, i) => (
              <div
                key={i}
                style={{
                  flex: 1,
                  display: 'flex',
                  alignItems: 'center',
                }}
              >
                <VersionTitle
                  onClick={() => navigateToVersion(p.id, i)}
                  style={{ paddingLeft: i === 0 ? '0px' : '10px' }}
                  settings={settings}
                >
                  {p.id}
                  {p.error && (
                    <VersionErrorIndicator settings={settings}>⚠</VersionErrorIndicator>
                  )}
                  <ChevronDownIcon style={{ marginLeft: 4 }} />
                </VersionTitle>
                {i !== 0 && (
                  <MinusIcon
                    onClick={() => removeParallelVersion(i)}
                    style={{ marginLeft: 20, opacity: 0.5 }}
                  />
                )}
              </div>
            ))}
            {parallelVerses.length < 3 && (
              <ResponsivePlusIcon settings={settings} onClick={() => addParallelVersion()} />
            )}
          </VersionsContainer>
        )}
        {(version === 'INT' || version === 'INT_EN') && (
          <IntMode settings={settings} onClick={() => setIsINTComplete(!isINTComplete)}>
            {isINTComplete ? 'Mode 1' : 'Mode 2'}
          </IntMode>
        )}
        {isHebreu && <RightDirection settings={settings}>Sens de la lecture ←</RightDirection>}
        {!!introComment && settings.commentsDisplay && (
          <Comment isIntro id="comment-0" settings={settings} comment={introComment} />
        )}

        {verses.map((verse, i) => {
          if (verse.Verset == 0) return null

          const { Livre, Chapitre, Verset } = verse

          // In readonly mode, only show focused verses
          const isFocused = focusVerses ? focusVerses.includes(Number(Verset)) : undefined
          if (isReadOnly && focusVerses && !isFocused) return null
          const isSelected = Boolean(selectedVerses[`${Livre}-${Chapitre}-${Verset}`])
          const isSelectedMode = Boolean(Object.keys(selectedVerses).length)
          const isHighlighted = Boolean(highlightedVerses[`${Livre}-${Chapitre}-${Verset}`])
          const tag: TaggedVerse | undefined = taggedVerses?.find(
            v => v.lastVerse === `${Livre}-${Chapitre}-${Verset}`
          )
          const highlightedColor = isHighlighted
            ? (highlightedVerses[`${Livre}-${Chapitre}-${Verset}`]
                .color as keyof RootStyles['settings']['colors'][keyof RootStyles['settings']['colors']])
            : undefined

          const notesCount = notedVersesCount[Verset]
          const notesText = notedVersesText[Verset]
          const linksCount = linkedVersesCount[Verset]
          const linksText = linkedVersesText[Verset]
          const comment = comments?.[Verset]
          const isVerseToScroll = verseToScroll == Verset
          const secondaryVerse = secondaryVerses && secondaryVerses[i]
          const parallelVerse = isParallelVerse
            ? extractParallelVerse(i, parallelVerses, verse, version)
            : []

          const { h1, h2, h3, h4 } = getPericopeVerse(pericopeChapter, Number(Verset))

          const bookmark = bookmarkedVerses?.[Number(Verset)]

          return (
            <Span key={`${Livre}-${Chapitre}-${Verset}`}>
              {h1 && (
                <H1 isHebreu={isHebreu} settings={settings} onClick={navigateToPericope}>
                  {h1}
                  <ExternalIcon />
                </H1>
              )}
              {h2 && (
                <H2 isHebreu={isHebreu} settings={settings} onClick={navigateToPericope}>
                  {h2}
                  <ExternalIcon />
                </H2>
              )}
              {h3 && (
                <H3 isHebreu={isHebreu} settings={settings} onClick={navigateToPericope}>
                  {h3}
                  <ExternalIcon />
                </H3>
              )}
              {h4 && (
                <H4 isHebreu={isHebreu} settings={settings} onClick={navigateToPericope}>
                  {h4}
                  <ExternalIcon />
                </H4>
              )}
              <Verse
                isHebreu={isHebreu}
                version={version}
                verse={verse}
                isParallelVerse={isParallelVerse}
                parallelVerse={parallelVerse}
                secondaryVerse={secondaryVerse}
                settings={settings}
                isSelected={isSelected}
                isSelectedMode={isSelectedMode}
                isSelectionMode={isSelectionMode}
                highlightedColor={highlightedColor}
                notesCount={notesCount}
                notesText={notesText}
                linksCount={linksCount}
                linksText={linksText}
                isVerseToScroll={isVerseToScroll}
                selectedCode={selectedCode}
                isFocused={isFocused}
                isINTComplete={isINTComplete}
                tag={tag}
                bookmark={bookmark}
              />
              {!!comment && settings.commentsDisplay && (
                <Comment id={`comment-${verse.Verset}`} settings={settings} comment={comment} />
              )}
            </Span>
          )
        })}
      </Container>
      <svg
        style={{
          visibility: 'hidden',
          position: 'absolute',
        }}
        width="0"
        height="0"
        xmlns="http://www.w3.org/2000/svg"
        version="1.1"
      >
        <defs>
          <filter id="goo">
            <feGaussianBlur in="SourceGraphic" stdDeviation="5" result="blur" />
            <feColorMatrix
              in="blur"
              mode="matrix"
              values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 35 -4"
              result="goo"
            />
            <feComposite in="SourceGraphic" in2="goo" operator="atop" />
          </filter>
        </defs>
      </svg>
      </DispatchProvider>
    </TranslationsProvider>
  )
}

export default VersesRenderer
