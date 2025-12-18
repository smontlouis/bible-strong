import { useAtom, useSetAtom } from 'jotai/react'
import React, { memo, useEffect, useMemo, useRef, useState } from 'react'
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
import books, { Book } from '~assets/bible_versions/books-desc'
import Box, { TouchableBox } from '~common/ui/Box'
import { FeatherIcon } from '~common/ui/Icon'
import { HStack } from '~common/ui/Stack'
import { Version, getVersions } from '~helpers/bibleVersions'
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
}

const events = [
  Event.PlaybackState,
  Event.PlaybackError,
  Event.PlaybackActiveTrackChanged,
  Event.PlaybackProgressUpdated,
]

const getAllTracks = (version: string) => {
  try {
    // @ts-expect-error
    const bibleVersion = getVersions()[version] as Version
    const tracks = books.flatMap(book =>
      [...Array(book.Chapitres).keys()].map(i => ({
        book,
        chapter: i + 1,
        url: bibleVersion?.getAudioUrl?.(book.Numero, i + 1) || '',
        title: `${book.Nom} ${i + 1} ${version}`,
        artist: bibleVersion?.name,
        artwork: require('~assets/images/icon.png'),
      }))
    )
    return tracks
  } catch (e) {
    Sentry.withScope(scope => {
      scope.setExtra('Version', `${version}`)
      scope.setExtra('Versions', getVersions())
      Sentry.captureException('getAllTracks error')
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
}: UseLoadSoundProps) => {
  const [isExpanded, setExpandedMode] = useState(false)
  const [playerState, setPlayerState] = useState<State>(State.None)
  const [error, setError] = useState(false)
  const [isSetup, setIsSetup] = useState(false)
  const hasAutoTrackChange = useRef(false)
  const [audioSleepTime, setAudioSleepTime] = useAtom(audioSleepTimeAtom)
  const setAudioSleepMinutes = useSetAtom(audioSleepMinutesAtom)
  const [playingBibleTabId, setPlayingBibleTabId] = useAtom(playingBibleTabIdAtom)
  const isCurrentTabPlaying = playingBibleTabId === bibleAtom.toString()

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

      if (track && (track?.book?.Numero !== book.Numero || track?.chapter !== chapter)) {
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
    setPlayingBibleTabId(bibleAtom.toString())
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

  // Create tracks for the current book
  const tracks = useMemo(() => getAllTracks(version), [version])

  // Unmounting
  // useEffect(() => {
  //   return () => {
  //     TrackPlayer.pause()
  //     TrackPlayer.reset()
  //     setAudioSleepTime(0)
  //     setAudioSleepMinutes('off')

  //     console.log('----- UNMOUNT')
  //   }
  // }, [setAudioSleepMinutes, setAudioSleepTime])

  // Audio init on version change
  useEffect(() => {
    ;(async () => {
      try {
        await TrackPlayer.setupPlayer()
      } catch (e) {
        console.log('[Bible] Silent catch:', e)
      }

      // Reset player and add tracks
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
        const trackIndex = tracks.findIndex(
          track => track.book.Numero === book.Numero && track.chapter === chapter
        )
        await TrackPlayer.skip(trackIndex)
      } catch (e) {
        console.log('[Bible] Silent catch:', e)
      }
      setIsSetup(true)
    })()
  }, [version, tracks])

  // Skip to track on chapter change
  useEffect(() => {
    setError(false)

    // If the track change was not triggered by the user, we don't want to skip
    if (!isSetup || hasAutoTrackChange.current) {
      hasAutoTrackChange.current = false
      return
    }

    ;(async () => {
      const trackIndex = tracks.findIndex(
        track => track.book.Numero === book.Numero && track.chapter === chapter
      )
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
  }, [book.Numero, chapter, isSetup, tracks])

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
}: AudioUrlFooterProps) => {
  const hasPreviousChapter = !(book.Numero === 1 && chapter === 1)
  const hasNextChapter = !(book.Numero === 66 && chapter === 22)

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

export default memo(AudioUrlFooter)
