import { Box, Center, Spinner } from '@chakra-ui/react'
import { useState } from 'react'
import BibleAudioFooter from './BibleAudioFooter'
import BibleAudioReaderHighlight from './BibleAudioReaderHighlight'
import BibleAudioReaderImmersive from './BibleAudioReaderImmersive'
import { Mode, useBibleAudioReader } from './useBibleAudioReader'

type BibleAudioReaderProps = {
  version: string
  person: string
}

const BibleAudioReader = ({ version, person }: BibleAudioReaderProps) => {
  const [mode, changeMode] = useState<Mode>('read')
  const [word, setWord] = useState<string>('')

  const onWordChange = (word: string) => {
    setWord(word)
  }

  const {
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
  } = useBibleAudioReader({
    version,
    person,
    onWordChange: mode === 'immersive' ? onWordChange : undefined,
    offsetTiming: mode === 'immersive' ? 20 : 50,
  })

  if (query.isLoading || !jsonData) {
    return (
      <Center h={200}>
        <Spinner />
      </Center>
    )
  }

  return (
    <>
      <Box ref={containerRef} position="relative" lineHeight={2.2} flex={1}>
        {mode === 'read' && (
          <BibleAudioReaderHighlight
            jsonData={jsonData}
            currentAudioIndex={currentAudioIndex.current}
            textsRef={textsRef}
          />
        )}
        {mode === 'immersive' && <BibleAudioReaderImmersive word={word} />}
      </Box>
      <BibleAudioFooter
        isPlaying={isPlaying}
        onPlay={onPlay}
        goToNext={goToNext}
        goToPrev={goToPrev}
        canGoPrev={canGoPrev}
        canGoNext={canGoNext}
        mode={mode}
        changeMode={changeMode}
      />
    </>
  )
}

export default BibleAudioReader
