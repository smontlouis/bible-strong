import { useAtom, useAtomValue } from 'jotai/react'
import React, { useEffect, useEffectEvent, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { PrimitiveAtom } from 'jotai/vanilla'
import { useAudioPlaylistStatus } from 'expo-audio'
import { Book } from '~assets/bible_versions/books-desc'
import Box, { TouchableBox } from '~common/ui/Box'
import { FeatherIcon } from '~common/ui/Icon'
import { HStack } from '~common/ui/Stack'
import { Version, getBibleVersionCanonId, getVersions } from '~helpers/bibleVersions'
import {
  getAvailableChapters,
  getNextAvailableChapterLocation,
  getPreviousAvailableChapterLocation,
  resolveBibleCoverageCanonId,
} from '~helpers/bibleCoverage'
import type { BibleVersionCoverage } from '~helpers/biblesDb'
import { appLogger } from '~helpers/agentObservability'
import { BiblePlanPassage, BibleTab, VersionCode } from '../../../state/tabs'
import { canGoToNextPlanChapter, canGoToPreviousPlanChapter } from '../planPassage'
import AudioBar from './AudioBar'
import AudioContainer from './AudioContainer'
import AudioRepeatButton from './AudioRepeatButton'
import AudioSleepButton from './AudioSleepButton'
import AudioSpeedButton from './AudioSpeedButton'
import BasicFooter from './BasicFooter'
import ChapterButton from './ChapterButton'
import PlayButton from './PlayButton'
import { playingBibleTabIdAtom } from './atom'
import {
  type BibleAudioTrack,
  getBibleAudioPlaylist,
  getBibleAudioTrack,
  isPausedUpdate,
  loadBibleAudioTracks,
  pauseBibleAudio,
  playBibleAudio,
  stopBibleAudio,
} from './bibleAudioPlaylist'
type UseLoadSoundProps = {
  audioUrl?: string
  canPlayAudio?: boolean
  goToNextChapter: () => void
  goToPrevChapter: () => void
  goToChapter: (x: { book: Book; chapter: number }) => void
  book: Book
  chapter: number
  version: VersionCode
  getToNextChapter?: () => void
  getToPrevChapter?: () => void
  bibleAtom: PrimitiveAtom<BibleTab>
  coverage?: BibleVersionCoverage
}

// The iOS playlist reports no load error: a chapter that does not start this long after the
// request counts as one.
const LOAD_TIMEOUT_MS = 20_000

const getBookTracks = (
  version: string,
  book: Book,
  t: (key: string) => string,
  coverage?: BibleVersionCoverage
): BibleAudioTrack[] => {
  try {
    const bibleVersion = getVersions()[version] as Version
    const tracks = getAvailableChapters(book, coverage).map(chapter => ({
      book,
      chapter,
      url: bibleVersion?.getAudioUrl?.(book.Numero, chapter) || '',
      title: `${t(book.Nom)} ${chapter} ${version}`,
      artist: bibleVersion?.name,
    }))
    return tracks
  } catch (error) {
    appLogger.captureError('download', 'audio.book_tracks_failed', error, {
      versionId: version,
      hasCoverage: Boolean(coverage),
    })
    return []
  }
}

const useLoadSound = ({
  book,
  chapter,
  version,
  goToNextChapter,
  goToPrevChapter,
  goToChapter,
  bibleAtom,
  coverage,
}: UseLoadSoundProps) => {
  const { t } = useTranslation()
  const bibleTab = useAtomValue(bibleAtom)
  const playlist = getBibleAudioPlaylist()
  const status = useAudioPlaylistStatus(playlist)
  const [isExpanded, setExpandedMode] = useState(false)
  const [error, setError] = useState(false)
  const [isSetup, setIsSetup] = useState(false)
  // Playback asked for in this footer and not paused since; the playlist has no such state.
  const [wantsPlayback, setWantsPlayback] = useState(false)
  // The last chapter of the queue ended: the iOS queue is then empty and reports itself buffering.
  const [hasEnded, setHasEnded] = useState(false)
  const wasPlayingRef = useRef(false)
  const hasAutoTrackChange = useRef(false)
  const [playingBibleTabId, setPlayingBibleTabId] = useAtom(playingBibleTabIdAtom)
  // Use stable tab.id instead of atom.toString()
  const isCurrentTabPlaying = playingBibleTabId === bibleTab.id

  // Follow the chapter the playlist moved to on its own, or from the lock screen.
  const onTrackChanged = useEffectEvent((index: number) => {
    if (!isCurrentTabPlaying) return
    const track = getBibleAudioTrack(index)
    if (track && track.chapter !== chapter) {
      hasAutoTrackChange.current = true
      goToChapter({ book: track.book, chapter: track.chapter })
    }
  })

  useEffect(() => {
    const trackSubscription = playlist.addListener('trackChanged', ({ currentIndex }) =>
      onTrackChanged(currentIndex)
    )
    const statusSubscription = playlist.addListener('playlistStatusUpdate', update => {
      const wasPlaying = wasPlayingRef.current
      wasPlayingRef.current = update.playing

      // Android reports a failed load in a single status update, which the next one forgets.
      if ((update as typeof update & { error?: unknown }).error) {
        console.warn('[Bible] An error occured while playing the current track.')
        setError(true)
      }
      if (update.didJustFinish) {
        setHasEnded(true)
        setWantsPlayback(false)
      } else if (wasPlaying && isPausedUpdate(update)) {
        // Paused from the lock screen or by the sleep timer.
        setWantsPlayback(false)
      }
    })
    return () => {
      trackSubscription.remove()
      statusSubscription.remove()
    }
  }, [playlist])

  const isPlaying = status.playing
  const isLoading = wantsPlayback && !isPlaying

  useEffect(() => {
    if (!isLoading) return
    const timeout = setTimeout(() => {
      console.warn('[Bible] The current track did not start.')
      setError(true)
    }, LOAD_TIMEOUT_MS)
    return () => clearTimeout(timeout)
  }, [isLoading, status.currentIndex])

  // Only generate tracks for the current book (not all 1189 chapters)
  const tracks = getBookTracks(version, book, t, coverage)
  // The effects below load and skip with the tracks and chapter of the render that ran them.
  const getChapterTracks = useEffectEvent(() => ({ tracks, chapter }))

  const onPlay = () => {
    // Use stable tab.id instead of atom.toString()
    setPlayingBibleTabId(bibleTab.id)
    setExpandedMode(true)

    if (!isPlaying) {
      setWantsPlayback(true)
      if (hasEnded) {
        // Nothing is left to play: start the queue again on the chapter shown.
        const trackIndex = tracks.findIndex(track => track.chapter === chapter)
        if (trackIndex !== -1) playlist.skipTo(trackIndex)
        setHasEnded(false)
      }
      playBibleAudio().catch(playError => {
        console.log('[Bible] Error playing the chapter audio:', playError)
        setWantsPlayback(false)
        setError(true)
      })
    }
  }

  const onPause = () => {
    setPlayingBibleTabId('')
    setWantsPlayback(false)
    pauseBibleAudio()
  }

  const onReduce = () => {
    setExpandedMode(false)
  }

  const onNextChapter = () => {
    goToNextChapter()
  }

  const onPrevChapter = () => {
    goToPrevChapter()
  }

  const onSeekBy = (seconds: number) => {
    // Past the end, the iOS player stalls instead of finishing the chapter.
    const end = playlist.duration > 0 ? playlist.duration - 0.5 : Infinity
    // Read live: quick taps would otherwise all start from the last rendered position.
    void playlist.seekTo(Math.max(0, Math.min(playlist.currentTime + seconds, end)))
  }

  useEffect(() => {
    return () => {
      stopBibleAudio()
      setPlayingBibleTabId('')
    }
  }, [setPlayingBibleTabId])

  // Audio init on version or book change
  useEffect(() => {
    const current = getChapterTracks()
    try {
      const trackIndex = current.tracks.findIndex(track => track.chapter === current.chapter)
      loadBibleAudioTracks(current.tracks, Math.max(trackIndex, 0))
    } catch (e) {
      console.log('[Bible] Silent catch:', e)
    }
    // A new queue starts paused, as the old player did after a book change.
    setWantsPlayback(false)
    setHasEnded(false)
    setIsSetup(true)
  }, [version, book.Numero])

  // Skip to track on chapter change
  useEffect(() => {
    setError(false)

    // If the track change was not triggered by the user, we don't want to skip
    if (!isSetup || hasAutoTrackChange.current) {
      hasAutoTrackChange.current = false
      return
    }

    const current = getChapterTracks()
    const trackIndex = current.tracks.findIndex(track => track.chapter === current.chapter)
    if (trackIndex === -1 || trackIndex === playlist.currentIndex) return
    try {
      playlist.skipTo(trackIndex)
      setHasEnded(false)
    } catch {
      console.log('[Bible] Silent catch')
    }
  }, [book.Numero, chapter, isSetup, version, playlist])

  return {
    error,
    isPlaying,
    isExpanded,
    isLoading,
    isSetup,
    position: status.currentTime,
    duration: status.duration,
    onPlay,
    onPause,
    onReduce,
    onNextChapter,
    onPrevChapter,
    onSeekBy,
  }
}

type AudioUrlFooterProps = {
  isParallel?: boolean
  book: Book
  chapter: number
  goToNextChapter: () => void
  goToPrevChapter: () => void
  goToChapter: (x: { book: Book; chapter: number }) => void
  disabled?: boolean
  version: VersionCode
  onChangeMode?: (mode: 'tts' | 'url') => void
  bibleAtom: PrimitiveAtom<BibleTab>
  coverage?: BibleVersionCoverage
  planPassage?: BiblePlanPassage
}

const AudioUrlFooter = ({
  isParallel = false,
  book,
  chapter,
  goToNextChapter,
  goToPrevChapter,
  goToChapter,
  disabled,
  version,
  onChangeMode,
  bibleAtom,
  coverage,
  planPassage,
}: AudioUrlFooterProps) => {
  const { t } = useTranslation()
  const canonId = resolveBibleCoverageCanonId(coverage, getBibleVersionCanonId(version))
  const location = { book: book.Numero, chapter }
  const hasPreviousChapter =
    canGoToPreviousPlanChapter(planPassage, location) &&
    !!getPreviousAvailableChapterLocation(book, chapter, coverage, canonId)
  const hasNextChapter =
    canGoToNextPlanChapter(planPassage, location) &&
    !!getNextAvailableChapterLocation(book, chapter, coverage, canonId)

  const {
    error,
    isPlaying,
    isExpanded,
    onReduce,
    isLoading,
    isSetup,
    onPlay,
    onPause,
    onNextChapter,
    onPrevChapter,
    onSeekBy,
    position,
    duration,
  } = useLoadSound({
    book,
    chapter,
    version,
    goToNextChapter,
    goToPrevChapter,
    goToChapter,
    bibleAtom,
    coverage,
  })

  if (!isExpanded) {
    return (
      <BasicFooter
        isParallel={isParallel}
        onPlay={onPlay}
        onPrevChapter={hasPreviousChapter ? onPrevChapter : undefined}
        onNextChapter={hasNextChapter ? onNextChapter : undefined}
        isPlaying={isPlaying}
        isDisabled={disabled}
        isLoading={isLoading || !isSetup}
        hasError={error}
      />
    )
  }

  return (
    <AudioContainer onReduce={onReduce} audioMode="url" onChangeMode={onChangeMode}>
      <AudioBar duration={duration} position={position} />
      <Box className="border-continuous overflow-visible flex-[1] flex-row items-center justify-center mt-[10px]">
        <ChapterButton
          disabled={disabled}
          hasNextChapter={hasPreviousChapter}
          direction="left"
          onPress={onPrevChapter}
        />
        <Box className="border-continuous overflow-visible flex-[1] items-center justify-center flex-row">
          <TouchableBox
            className="overflow-hidden border-continuous w-[40px] h-[40px] items-center justify-center"
            disabled={disabled || isLoading || !isSetup}
            activeOpacity={0.5}
            onPress={() => onSeekBy(-10)}
            accessibilityRole="button"
            accessibilityLabel={t('accessibility.rewindTenSeconds')}
            accessibilityState={{ disabled: disabled || isLoading || !isSetup }}
            style={[
              { opacity: disabled || isLoading || !isSetup ? 0.6 : 1 },
              [{ opacity: disabled || isLoading || !isSetup ? 0.6 : 1 }],
            ]}
          >
            <FeatherIcon name="rotate-ccw" size={20} color="tertiary" />
          </TouchableBox>
          <PlayButton
            error={error}
            isLoading={isLoading || !isSetup}
            isPlaying={isPlaying}
            disabled={disabled || !isSetup}
            onToggle={isPlaying ? onPause : onPlay}
          />
          <TouchableBox
            className="overflow-hidden border-continuous w-[40px] h-[40px] items-center justify-center"
            disabled={disabled || isLoading}
            activeOpacity={0.5}
            onPress={() => onSeekBy(10)}
            accessibilityRole="button"
            accessibilityLabel={t('accessibility.forwardTenSeconds')}
            accessibilityState={{ disabled: disabled || isLoading }}
            style={[
              { opacity: disabled || isLoading ? 0.6 : 1 },
              [{ opacity: disabled || isLoading ? 0.6 : 1 }],
            ]}
          >
            <FeatherIcon name="rotate-cw" size={20} color="tertiary" />
          </TouchableBox>
        </Box>
        <ChapterButton
          disabled={disabled}
          hasNextChapter={hasNextChapter}
          direction="right"
          onPress={onNextChapter}
        />
      </Box>
      <HStack className="mt-[10px] items-center justify-center">
        <AudioSpeedButton />
        <AudioRepeatButton />
        <AudioSleepButton />
      </HStack>
    </AudioContainer>
  )
}

export default AudioUrlFooter
