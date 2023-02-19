import React, { memo, useEffect, useMemo, useRef, useState } from 'react'

import TrackPlayer, {
  Capability,
  Event,
  State,
  useProgress,
  useTrackPlayerEvents,
} from 'react-native-track-player'
import { VersionCode } from 'src/state/tabs'
import books, { Book } from '~assets/bible_versions/books-desc'
import Link from '~common/Link'
import Box from '~common/ui/Box'
import { FeatherIcon } from '~common/ui/Icon'
import { getVersions, Version } from '~helpers/bibleVersions'
import AudioBar from './AudioBar'
import AudioButton from './AudioButton'
import ChapterButton from './ChapterButton'
import Container from './Container'
import IconButton from './IconButton'
import PlayButton from './PlayButton'

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
}

const events = [
  Event.PlaybackState,
  Event.PlaybackError,
  Event.PlaybackTrackChanged,
]

const getAllTracks = (version: string) => {
  const bibleVersion = getVersions()[version] as Version
  const tracks = books.flatMap(book =>
    [...Array(book.Chapitres).keys()].map(i => ({
      book,
      chapter: i + 1,
      url: bibleVersion.getAudioUrl?.(book.Numero, i + 1) || '',
      title: `${book.Nom} ${i + 1} ${version}`,
      album: bibleVersion.name,
    }))
  )
  return tracks
}

const useLoadSound = ({
  book,
  chapter,
  version,
  goToNextChapter,
  goToPrevChapter,
  goToChapter,
}: UseLoadSoundProps) => {
  const [isExpanded, setExpandedMode] = useState(false)
  const [playerState, setPlayerState] = useState<State>(State.None)
  const [error, setError] = useState(false)
  const [isSetup, setIsSetup] = useState(false)
  const hasAutoTrackChange = useRef(false)

  useTrackPlayerEvents(events, async event => {
    if (event.type === Event.PlaybackError) {
      console.warn('An error occured while playing the current track.')
      setError(true)
    }
    if (event.type === Event.PlaybackState) {
      setPlayerState(event.state)
    }
    if (event.type === Event.PlaybackTrackChanged && event.nextTrack) {
      const nextTrack = await TrackPlayer.getTrack(event.nextTrack)

      // If mismatch, it means the track change was not triggered by the user
      if (
        nextTrack &&
        (nextTrack?.book?.Numero !== book.Numero ||
          nextTrack?.chapter !== chapter)
      ) {
        hasAutoTrackChange.current = true
        goToChapter({
          book: nextTrack.book,
          chapter: nextTrack.chapter,
        })
      }
    }
  })

  const isPlaying = playerState === State.Playing
  const isLoading =
    playerState === State.Buffering ||
    playerState === State.Connecting ||
    playerState === State.None

  const onPlay = async () => {
    setExpandedMode(true)

    if (!isPlaying) {
      TrackPlayer.play()
    }
  }

  const onPause = () => {
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

  // Audio init on book change
  useEffect(() => {
    ;(async () => {
      try {
        await TrackPlayer.setupPlayer()
      } catch {
        console.log('TrackPlayer already setup')
      }

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

        // Capabilities that will show up when the notification is in the compact form on Android
        compactCapabilities: [Capability.Play, Capability.Pause],
      })

      // Reset player and add tracks
      await TrackPlayer.reset()
      await TrackPlayer.add(tracks)
      setIsSetup(true)
    })()
  }, [version, tracks])

  // Skip to track on chapter change
  useEffect(() => {
    // If the track change was not triggered by the user, we don't want to skip
    if (!isSetup || hasAutoTrackChange.current) {
      hasAutoTrackChange.current = false
      return
    }

    ;(async () => {
      const trackIndex = tracks.findIndex(
        track => track.book.Numero === book.Numero && track.chapter === chapter
      )
      await TrackPlayer.skip(trackIndex)
    })()
  }, [book.Numero, chapter, isSetup, tracks])

  return {
    error,
    isPlaying,
    isExpanded,
    isLoading,
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
}

const AudioUrlFooter = ({
  book,
  chapter,
  goToNextChapter,
  goToPrevChapter,
  goToChapter,
  disabled,
  version,
}: AudioUrlFooterProps) => {
  const hasPreviousChapter = !(book.Numero === 1 && chapter === 1)
  const hasNextChapter = !(book.Numero === 66 && chapter === 22)

  const {
    error,
    isPlaying,
    isExpanded,
    onReduce,
    isLoading,
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
  })

  const progress = useProgress(200)

  return (
    <Container isExpanded={isExpanded}>
      {isExpanded && (
        <>
          <Box center>
            <Link onPress={onReduce} style={{ padding: 5 }}>
              <FeatherIcon name="chevron-down" size={20} color="tertiary" />
            </Link>
          </Box>
          <AudioBar duration={progress.duration} position={progress.position} />
        </>
      )}
      <Box flex row overflow="visible" center>
        <ChapterButton
          disabled={disabled}
          hasNextChapter={hasPreviousChapter}
          direction="left"
          onPress={onPrevChapter}
          isExpanded={isExpanded}
        />
        <Box flex center overflow="visible" row>
          {!isExpanded && (
            <IconButton
              big={isPlaying}
              disabled={disabled}
              activeOpacity={0.5}
              onPress={onPlay}
              color={isPlaying ? 'primary' : ''}
            >
              <AudioButton
                isPlaying={isPlaying}
                isLoading={isLoading}
                error={error}
              />
            </IconButton>
          )}
          {isExpanded && (
            <>
              <IconButton
                disabled={disabled || isLoading}
                activeOpacity={0.5}
                onPress={() => TrackPlayer.seekTo(progress.position - 10)}
                isFlat
              >
                <FeatherIcon name="rotate-ccw" size={20} />
              </IconButton>
              <PlayButton
                error={error}
                isLoading={isLoading}
                isPlaying={isPlaying}
                disabled={disabled}
                onToggle={isPlaying ? onPause : onPlay}
              />
              <IconButton
                disabled={disabled || isLoading}
                activeOpacity={0.5}
                onPress={() => TrackPlayer.seekTo(progress.position + 10)}
                isFlat
              >
                <FeatherIcon name="rotate-cw" size={20} />
              </IconButton>
            </>
          )}
        </Box>
        <ChapterButton
          disabled={disabled}
          hasNextChapter={hasNextChapter}
          direction="right"
          onPress={onNextChapter}
          isExpanded={isExpanded}
        />
      </Box>
    </Container>
  )
}

export default memo(AudioUrlFooter)
