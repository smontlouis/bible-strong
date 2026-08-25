import { useQuery } from '@tanstack/react-query'
import { Howl } from 'howler'
import { useCallback, useEffect, useReducer, useRef, useState } from 'react'

export type Mode = 'immersive' | 'read'

export type Word = {
  type: string
  start: number
  end: number
  startTime: number
  endTime: number
  value: string
}

export type WordWithChunks = Word & {
  chunks: Word[]
}

export type BibleData = {
  audioStream: string
  speechMarks: {
    chunks: WordWithChunks[]
  }
}[]

export type UseBibleAudioReaderProps = {
  version: string
  person: string
  onWordChange?: (word: string) => void
  offsetTiming?: number
}

const timeout = (ms: number) =>
  new Promise((resolve) => setTimeout(resolve, ms))

const PAUSE_BETWEEN_SENTENCES = 500

export const useBibleAudioReader = ({
  version,
  person,
  onWordChange,
  offsetTiming = 50,
}: UseBibleAudioReaderProps) => {
  const player = useRef<Howl | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const currentAudioIndex = useRef(0)
  const containerRef = useRef<HTMLDivElement | null>(null)
  const textsRef = useRef(new Map<number, HTMLParagraphElement>())
  const requestRef = useRef<number>()
  const [_, forceUpdate] = useReducer((x) => x + 1, 0)

  const loadAsyncJson = useCallback(
    async (v: string, p: string) => {
      const response = await fetch(`/audio/${v}/${p}/1-1.json`)
      const data = await response.json()
      return data as BibleData
    },
    [version, person]
  )

  const query = useQuery({
    queryKey: ['json', version, person],
    queryFn: () => loadAsyncJson(version, person),
  })
  const jsonData = query.data

  const canGoNext = jsonData
    ? currentAudioIndex.current < jsonData.length - 1
    : false
  const canGoPrev = currentAudioIndex.current > 0

  const onPlay = () => {
    if (player.current?.playing() === true) {
      player.current?.pause()
      setIsPlaying(false)
      cancelAnimationFrame(requestRef.current!)
      return
    }

    if (!player.current) {
      const sound = new Howl({
        src: [
          `data:audio/mp3;base64,${
            jsonData?.[currentAudioIndex.current].audioStream
          }`,
        ],
        onend: onAudioEnded,
        format: 'mp3',
        html5: true,
      })

      player.current = sound
    }
    player.current?.rate(1)
    player.current?.play()
    setIsPlaying(true)

    requestRef.current = requestAnimationFrame(onAudioTimeUpdate)
    textsRef.current.get(currentAudioIndex.current)?.scrollIntoView({
      behavior: 'smooth',
      block: 'center',
      inline: 'center',
    })
  }

  const onAudioEnded = () => {
    goToNext(true)
  }

  const goToNext = async (forcePlay?: boolean) => {
    const canGoNext = jsonData
      ? currentAudioIndex.current < jsonData.length - 1
      : false

    if (!canGoNext) {
      setIsPlaying(false)
      currentAudioIndex.current = 0
      containerRef.current!.style.cssText = ''
      player.current?.pause()
      player.current?.off('end', onAudioEnded)
      player.current = null
      return
    }

    const isAudioPlaying = player.current?.playing() === true

    currentAudioIndex.current += 1
    containerRef.current!.style.cssText = ''
    player.current?.pause()
    player.current?.off('end', onAudioEnded)
    player.current = null

    forceUpdate() // Force update to re-render the text with new background color

    if (isAudioPlaying || forcePlay) {
      await timeout(PAUSE_BETWEEN_SENTENCES)
      onPlay()
    }
  }

  const goToPrev = () => {
    if (!canGoPrev) return

    // If current audio is playing and current time is more than 0.5 seconds, restart the audio
    if (player.current && player.current?.seek() > 1) {
      player.current.seek(0)
      return
    }

    currentAudioIndex.current -= 1
    containerRef.current!.style.cssText = ''
    player.current?.pause()
    player.current?.off('end', onAudioEnded)
    player.current = null

    forceUpdate() // Force update to re-render the text with new background color

    if (isPlaying) {
      onPlay()
    }
  }

  const getWordCoordinatesBySentence = useCallback(() => {
    const textRef = textsRef.current.get(currentAudioIndex.current)

    if (!textRef) {
      return []
    }

    const wordPositions: Word[] =
      jsonData?.[currentAudioIndex.current].speechMarks.chunks[0].chunks.filter(
        (w) => w.value.length !== 1
      ) || []

    const wordCoordinatesBySentence = wordPositions.map((word) => {
      const range = document.createRange()
      range.setStart(textRef?.firstChild as Node, word.start)
      range.setEnd(textRef?.firstChild as Node, word.end)

      const rects = range.getClientRects()
      const rect = rects[0]

      const containerRect = containerRef.current?.getBoundingClientRect()!

      return {
        x: rect.x - containerRect.x,
        y: rect.y - containerRect.y,
        width: rect.width,
        height: rect.height,
      }
    })

    return wordCoordinatesBySentence
  }, [currentAudioIndex.current, query.isSuccess])

  const onAudioTimeUpdate = () => {
    if (!player.current) return

    const currentTime = player.current.seek() * 1000 // Convert to milliseconds
    const wordPositions: Word[] =
      jsonData?.[currentAudioIndex.current].speechMarks.chunks[0].chunks || []

    for (let i = 0; i < wordPositions.length; i++) {
      if (
        currentTime >= wordPositions[i].startTime - offsetTiming && // -50 to make the word highlight a bit earlier
        currentTime <= wordPositions[i].endTime - offsetTiming // -50 to make the word highlight a bit earlier
      ) {
        /**
         * If the word is a single character, combine it with the next word
         * This is working only when generating ogg audio
         */
        onWordChange?.(
          wordPositions[i].value +
            (wordPositions[i + 1]?.value.length === 1
              ? wordPositions[i + 1].value
              : '')
        )

        const word = getWordCoordinatesBySentence()?.[i]
        if (word && wordPositions[i + 1]?.value.length !== 1) {
          containerRef.current?.style.setProperty('--word-x', `${word.x}px`)
          containerRef.current?.style.setProperty('--word-y', `${word.y}px`)
          containerRef.current?.style.setProperty(
            '--word-width',
            `${word.width}px`
          )
          containerRef.current?.style.setProperty(
            '--word-height',
            `${word.height}px`
          )

          // If next word has different y position or next word is a single character and the word after that has different y position
          // remove 'left' transition to avoid the word highlight jumping to the next line
          if (
            (wordPositions[i + 1] &&
              word.y !== getWordCoordinatesBySentence()?.[i + 1].y) ||
            (wordPositions[i + 1]?.value.length === 1 &&
              word.y !== getWordCoordinatesBySentence()?.[i + 2].y)
          ) {
            containerRef.current?.style.setProperty(
              '--word-transition',
              'width'
            )
          } else {
            containerRef.current?.style.setProperty(
              '--word-transition',
              'left, width'
            )
          }
        }
        break
      }
    }

    requestRef.current = requestAnimationFrame(onAudioTimeUpdate)
  }

  useEffect(() => {
    return () => {
      setIsPlaying(false)
      currentAudioIndex.current = 0
      player.current?.pause()
      player.current?.off('end', onAudioEnded)
      player.current = null
      cancelAnimationFrame(requestRef.current!)
    }
  }, [version, person])

  return {
    isPlaying,
    onPlay,
    goToNext,
    goToPrev,
    canGoPrev,
    canGoNext,
    containerRef,
    jsonData,
    currentAudioIndex,
    textsRef,
    query,
  }
}
