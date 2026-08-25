import { Box, Text } from '@chakra-ui/react'
import { MutableRefObject } from 'react'
import { BibleData } from './useBibleAudioReader'

export interface BibleAudioReaderHighlightProps {
  jsonData: BibleData
  currentAudioIndex: number
  textsRef: MutableRefObject<Map<number, HTMLParagraphElement>>
}

const BibleAudioReaderHighlight = ({
  jsonData,
  currentAudioIndex,
  textsRef,
}: BibleAudioReaderHighlightProps) => {
  return (
    <>
      {jsonData.map((data, index) => (
        <Text
          key={index}
          as="span"
          fontSize="xl"
          px="4px"
          borderRadius="4px"
          background={
            index === currentAudioIndex ? 'rgb(119, 179, 253, .2)' : 'none'
          }
          ref={(node) => {
            if (node) {
              textsRef.current.set(index, node)
            } else {
              textsRef.current.delete(index)
            }
          }}
        >
          {data.speechMarks.chunks[0].value}
        </Text>
      ))}
      <Box
        key="word-coordinate"
        position="absolute"
        sx={{
          position: 'absolute',
          top: 'var(--word-y)',
          left: 'var(--word-x)',
          width: 'var(--word-width)',
          height: 'var(--word-height)',
          transitionProperty: "var(--word-transition, 'left, width')",
          transitionDuration: '0.05s',
          backgroundColor: 'rgb(119, 179, 253)',
          borderRadius: '3px',
          paddingBottom: '2px',
          opacity: '0.5',
          mixBlendMode: 'darken',
          pointerEvents: 'none',
        }}
      />
    </>
  )
}

export default BibleAudioReaderHighlight
