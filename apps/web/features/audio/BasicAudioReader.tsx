import { Box, Text } from '@chakra-ui/react'
import { Howl } from 'howler'
import { useEffect, useRef, useState } from 'react'
import BibleAudioFooter from './BibleAudioFooter'

type BasicAudioReaderProps = {
  version: string
  person: string
}

const BasicAudioReader = ({ version, person }: BasicAudioReaderProps) => {
  const player = useRef<Howl | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)

  const onPlay = () => {
    if (player.current?.playing() === true) {
      player.current?.pause()
      setIsPlaying(false)
      return
    }

    if (!player.current) {
      const sound = new Howl({
        src: [`/audio/cloned/${person}.mpga`],
        format: 'mpga',
        html5: true,
      })

      player.current = sound
    }
    player.current?.rate(1)
    player.current?.play()
    setIsPlaying(true)
  }

  useEffect(() => {
    return () => {
      setIsPlaying(false)
      player.current?.pause()
      player.current = null
    }
  }, [version, person])

  return (
    <>
      <Box position="relative" lineHeight={2.2} paddingBottom="6">
        <Text as="span" fontSize="xl" px="4px" borderRadius="4px">
          In the beginning, God created the heavens and the earth. The earth was
          without form and void, and darkness was over the face of the deep. And
          the Spirit of God was hovering over the face of the waters. And God
          said, "Let there be light," and there was light. And God saw that the
          light was good. And God separated the light from the darkness. God
          called the light Day, and the darkness he called Night. And there was
          evening and there was morning, the first day.
        </Text>
      </Box>
      <BibleAudioFooter
        isPlaying={isPlaying}
        onPlay={onPlay}
        goToNext={() => {}}
        goToPrev={() => {}}
        canGoPrev={false}
        canGoNext={false}
      />
    </>
  )
}

export default BasicAudioReader
