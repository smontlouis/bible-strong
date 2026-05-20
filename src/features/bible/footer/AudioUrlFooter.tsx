import { useAtom, useAtomValue, useSetAtom } from 'jotai/react'
import React, { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import * as Sentry from '@sentry/react-native'

import { PrimitiveAtom } from 'jotai/vanilla'
import TrackPlayer, {
  AppKilledPlaybackBehavior,
  Capability,
  Event,
  State,
  useProgress,
  useTrackPlayerEvents,
} from 'react-native-track-player'
import { Book } from '~assets/bible_versions/books-desc'
import Box, { TouchableBox } from '~common/ui/Box'
import { FeatherIcon } from '~common/ui/Icon'
import { HStack } from '~common/ui/Stack'
import { Version, getVersions } from '~helpers/bibleVersions'
import {
  getAvailableChapters,
  getNextAvailableChapterLocation,
  getPreviousAvailableChapterLocation,
} from '~helpers/bibleCoverage'
import type { BibleVersionCoverage } from '~helpers/biblesDb'
import { BibleTab, VersionCode } from '../../../state/tabs'
import AudioBar from './AudioBar'
import AudioContainer from './AudioContainer'
import AudioRepeatButton from './AudioRepeatButton'
import AudioSleepButton from './AudioSleepButton'
import AudioSpeedButton from './AudioSpeedButton'
import BasicFooter from './BasicFooter'
import ChapterButton from './ChapterButton'
import PlayButton from './PlayButton'
import { audioSleepMinutesAtom, audioSleepTimeAtom, playingBibleTabIdAtom } from './atom'

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

const events = [
  Event.PlaybackState,
  Event.PlaybackError,
  Event.PlaybackActiveTrackChanged,
  Event.PlaybackProgressUpdated,
]

const getBookTracks = (
  version: string,
  book: Book,
  t: (key: string) => string,
  coverage?: BibleVersionCoverage
) => {
  try {
    const bibleVersion = getVersions()[version] as Version
    const tracks = getAvailableChapters(book, coverage).map(chapter => ({
      book,
      chapter,
      url: bibleVersion?.getAudioUrl?.(book.Numero, chapter) || '',
      title: `${t(book.Nom)} ${chapter} ${version}`,
      artist: bibleVersion?.name,
      artwork: require('~assets/images/icon.png'),
    }))
    return tracks
  } catch {
    Sentry.withScope(scope => {
      scope.setExtra('Version', `${version}`)
      scope.setExtra('Book', `${book.Numero}`)
      Sentry.captureException('getBookTracks error')
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
  const [isExpanded, setExpandedMode] = useState(false)
  const [playerState, setPlayerState] = useState<State>(State.None)
  const [error, setError] = useState(false)
  const [isSetup, setIsSetup] = useState(false)
  const hasAutoTrackChange = useRef(false)
  const [audioSleepTime, setAudioSleepTime] = useAtom(audioSleepTimeAtom)
  const setAudioSleepMinutes = useSetAtom(audioSleepMinutesAtom)
  const [playingBibleTabId, setPlayingBibleTabId] = useAtom(playingBibleTabIdAtom)
  // Use stable tab.id instead of atom.toString()
  const isCurrentTabPlaying = playingBibleTabId === bibleTab.id

  useTrackPlayerEvents(events, async event => {
    if (!isSetup) {
      return
    }
    if (event.type === Event.PlaybackError) {
      let trackObject = await TrackPlayer.getActiveTrack()
      console.log('[Bible] Track URL:', trackObject?.url)
      console.warn('[Bible] An error occured while playing the current track.')
      setError(true)
    }
    if (event.type === Event.PlaybackState) {
      setPlayerState(event.state)

      if (event.state === State.Paused && audioSleepTime) {
        setAudioSleepTime(0)
        setAudioSleepMinutes('off')
      }
    }

    if (event.type === Event.PlaybackProgressUpdated && isCurrentTabPlaying) {
      const track = await TrackPlayer.getTrack(event.track)

      if (track && track?.chapter !== chapter) {
        hasAutoTrackChange.current = true
        goToChapter({
          book: track?.book,
          chapter: track?.chapter,
        })
      }
    }
  })

  const isPlaying = playerState === State.Playing
  const isLoading =
    playerState === State.Buffering || playerState === State.Loading || playerState === State.None

  const onPlay = async () => {
    // Use stable tab.id instead of atom.toString()
    setPlayingBibleTabId(bibleTab.id)
    setExpandedMode(true)

    if (!isPlaying) {
      TrackPlayer.play()
    }
  }

  const onPause = () => {
    setPlayingBibleTabId('')
    TrackPlayer.pause()
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

  // Only generate tracks for the current book (not all 1189 chapters)
  const tracks = getBookTracks(version, book, t, coverage)

  useEffect(() => {
    return () => {
      TrackPlayer.pause()
      TrackPlayer.reset()
      setPlayingBibleTabId('')
      setAudioSleepTime(0)
      setAudioSleepMinutes('off')
    }
  }, [setPlayingBibleTabId, setAudioSleepMinutes, setAudioSleepTime])

  // Audio init on version or book change
  useEffect(() => {
    ;(async () => {
      try {
        await TrackPlayer.setupPlayer()
      } catch (e) {
        console.log('[Bible] Silent catch:', e)
      }

      // Reset player and add tracks for current book
      try {
        await TrackPlayer.reset()

        TrackPlayer.updateOptions({
          forwardJumpInterval: 10,
          backwardJumpInterval: 10,

          // Media controls capabilities
          capabilities: [
            Capability.Play,
            Capability.Pause,
            Capability.SkipToNext,
            Capability.SkipToPrevious,
            Capability.JumpForward,
            Capability.JumpBackward,
            Capability.SeekTo,
          ],

          progressUpdateEventInterval: 1,

          android: {
            appKilledPlaybackBehavior: AppKilledPlaybackBehavior.StopPlaybackAndRemoveNotification,
          },
        })

        await TrackPlayer.add(tracks)
        const trackIndex = tracks.findIndex(track => track.chapter === chapter)
        if (trackIndex !== -1) {
          await TrackPlayer.skip(trackIndex)
        }
      } catch (e) {
        console.log('[Bible] Silent catch:', e)
      }
      setIsSetup(true)
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [version, book.Numero])

  // Skip to track on chapter change
  useEffect(() => {
    setError(false)

    // If the track change was not triggered by the user, we don't want to skip
    if (!isSetup || hasAutoTrackChange.current) {
      hasAutoTrackChange.current = false
      return
    }

    ;(async () => {
      const trackIndex = tracks.findIndex(track => track.chapter === chapter)
      if (trackIndex === -1) return
      try {
        await TrackPlayer.skip(trackIndex)

        const duration = await TrackPlayer.getProgress().then(progress => progress.duration)
        await TrackPlayer.updateMetadataForTrack(trackIndex, {
          duration,
        })
      } catch {
        console.log('[Bible] Silent catch')
      }
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [book.Numero, chapter, isSetup, version])

  return {
    error,
    isPlaying,
    isExpanded,
    isLoading,
    isSetup,
    onPlay,
    onPause,
    onReduce,
    onNextChapter,
    onPrevChapter,
  }
}

type AudioUrlFooterProps = {
  book: Book
  chapter: number
  goToNextChapter: () => void
  goToPrevChapter: () => void
  goToChapter: (x: { book: Book; chapter: number }) => void
  disabled?: boolean
  version: VersionCode
  onChangeMode?: React.Dispatch<React.SetStateAction<'tts' | 'url' | undefined>>
  bibleAtom: PrimitiveAtom<BibleTab>
  coverage?: BibleVersionCoverage
}

const AudioUrlFooter = ({
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
}: AudioUrlFooterProps) => {
  const hasPreviousChapter = !!getPreviousAvailableChapterLocation(book, chapter, coverage)
  const hasNextChapter = !!getNextAvailableChapterLocation(book, chapter, coverage)

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

  const progress = useProgress(200)

  if (!isExpanded) {
    return (
      <BasicFooter
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
      <AudioBar duration={progress.duration} position={progress.position} />
      <Box flex row overflow="visible" center mt={10}>
        <ChapterButton
          disabled={disabled}
          hasNextChapter={hasPreviousChapter}
          direction="left"
          onPress={onPrevChapter}
        />
        <Box flex center overflow="visible" row>
          <TouchableBox
            disabled={disabled || isLoading || !isSetup}
            activeOpacity={0.5}
            onPress={() => TrackPlayer.seekTo(progress.position - 10)}
            width={40}
            height={40}
            center
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
            disabled={disabled || isLoading}
            activeOpacity={0.5}
            onPress={() => TrackPlayer.seekTo(progress.position + 10)}
            width={40}
            height={40}
            center
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
      <HStack alignItems="center" justifyContent="center" mt={10}>
        <AudioSpeedButton />
        <AudioRepeatButton />
        <AudioSleepButton />
      </HStack>
    </AudioContainer>
  )
}

export default AudioUrlFooter
