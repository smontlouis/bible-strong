import React, { memo, useEffect, useMemo, useState } from 'react'

import { useTranslation } from 'react-i18next'
import TrackPlayer from 'react-native-track-player'
import { VersionCode } from 'src/state/tabs'
import { Book } from '~assets/bible_versions/books-desc'
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
  goToNextChapter?: () => void
  goToPrevChapter?: () => void
  book: Book
  chapter: number
  version: VersionCode
}

const useLoadSound = ({ book, chapter, version }: UseLoadSoundProps) => {
  const [isExpanded, setExpandedMode] = useState(false)
  const [isPlaying, setIsPlaying] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(false)
  const { t } = useTranslation()

  const tracks = useMemo(() => {
    const bibleVersion = getVersions()[version] as Version
    const audioSubtitle = bibleVersion.name

    return [...Array(book.Chapitres).keys()].map(i => ({
      url: bibleVersion.getAudioUrl?.(book.Numero, i + 1) || '',
      title: `${t(book.Nom)} ${i + 1} ${version}`,
      album: audioSubtitle,
    }))
  }, [book, version, t])

  const onPlay = async () => {
    await TrackPlayer.skip(chapter - 1)
    TrackPlayer.play()
  }

  const onPause = () => {}

  // Audio init
  useEffect(() => {
    ;(async () => {
      await TrackPlayer.setupPlayer()
    })()
  }, [])

  useEffect(() => {
    ;(async () => {
      await TrackPlayer.add(tracks)
    })()
  }, [book, version, t])

  return {
    error,
    isPlaying,
    setIsPlaying,
    isExpanded,
    setExpandedMode,
    isLoading,
    setIsLoading,
  }
}

type AudioUrlFooterProps = {
  book: Book
  chapter: number
  goToNextChapter: () => void
  goToPrevChapter: () => void
  disabled?: boolean
  version: VersionCode
}

const AudioUrlFooter = ({
  book,
  chapter,
  goToNextChapter,
  goToPrevChapter,
  disabled,
  version,
}: AudioUrlFooterProps) => {
  const hasPreviousChapter = !(book.Numero === 1 && chapter === 1)
  const hasNextChapter = !(book.Numero === 66 && chapter === 22)
  const { t } = useTranslation()

  const {
    error,
    isPlaying,
    isExpanded,
    setExpandedMode,
    isLoading,
    onPlay,
    onPause,
  } = useLoadSound({
    book,
    chapter,
    version,
  })

  const isBuffering = isPlaying

  return (
    <Container isExpanded={isExpanded}>
      {isExpanded && (
        <>
          <Box center>
            <Link onPress={() => setExpandedMode(false)} style={{ padding: 5 }}>
              <FeatherIcon name="chevron-down" size={20} color="tertiary" />
            </Link>
          </Box>
          <AudioBar durationMillis={undefined} positionMillis={undefined} />
        </>
      )}
      <Box flex row overflow="visible" center>
        <ChapterButton
          disabled={
            disabled || (isLoading && isExpanded) || (isLoading && isPlaying)
          }
          hasNextChapter={hasPreviousChapter}
          direction="left"
          onPress={() => {
            setIsLoading(true)
            goToPrevChapter()
          }}
          isExpanded={isExpanded}
        />
        <Box flex center overflow="visible" row>
          {!isExpanded && (
            <IconButton
              big={isPlaying}
              disabled={disabled}
              activeOpacity={0.5}
              onPress={() => {
                setExpandedMode(true)
              }}
              color={isPlaying ? 'primary' : ''}
            >
              <AudioButton
                isPlaying={isPlaying}
                isLoading={isLoading}
                isBuffering={isBuffering}
                error={error}
              />
            </IconButton>
          )}
          {isExpanded && (
            <>
              <IconButton
                disabled={disabled || isLoading}
                activeOpacity={0.5}
                onPress={() => {}}
                isFlat
              >
                <FeatherIcon name="rewind" size={18} color="tertiary" />
              </IconButton>
              <PlayButton
                error={error}
                isLoading={isLoading || isBuffering}
                isPlaying={isPlaying}
                disabled={disabled}
                onToggle={isPlaying ? onPlay : onPause}
              />
              <IconButton
                disabled={disabled || isLoading}
                activeOpacity={0.5}
                onPress={() => {}}
                isFlat
              >
                <FeatherIcon name="fast-forward" size={18} color="tertiary" />
              </IconButton>
            </>
          )}
        </Box>
        <ChapterButton
          disabled={
            disabled || (isLoading && isExpanded) || (isLoading && isPlaying)
          }
          hasNextChapter={hasNextChapter}
          direction="right"
          onPress={() => {
            setIsLoading(true)
            goToNextChapter()
          }}
          isExpanded={isExpanded}
        />
      </Box>
    </Container>
  )
}

export default memo(AudioUrlFooter)
