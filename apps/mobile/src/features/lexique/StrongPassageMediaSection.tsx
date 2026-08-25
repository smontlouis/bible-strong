import { useWindowDimensions, type LayoutChangeEvent } from 'react-native'
import YoutubePlayer from 'react-native-youtube-iframe'

import Box, { VStack } from '~common/ui/Box'
import { type ResolvedPassageMedia } from '~features/bible/passageMedia'
import { StrongEditorialSection } from './StrongDetailUI'

type Props = {
  media: ResolvedPassageMedia[]
  title: string
  onLayout?: (event: LayoutChangeEvent) => void
}

const StrongPassageMediaSection = ({ media, title, onLayout }: Props) => {
  const { width: windowWidth } = useWindowDimensions()
  const playerWidth = Math.min(windowWidth - 40, 600)
  const playerHeight = (playerWidth * 9) / 16

  return (
    <StrongEditorialSection title={title} onLayout={onLayout}>
      <VStack gap={22}>
        {media.map(item => (
          <VStack key={item.editionId} gap={9}>
            <Box
              borderRadius={12}
              borderWidth={1}
              borderColor="border"
              overflow="hidden"
              bg="lightGrey"
            >
              <YoutubePlayer
                height={playerHeight}
                width={playerWidth}
                videoId={item.providerId}
                viewContainerStyle={{ borderRadius: 12, overflow: 'hidden' }}
                webviewStyle={{ borderRadius: 12, overflow: 'hidden' }}
              />
            </Box>
          </VStack>
        ))}
      </VStack>
    </StrongEditorialSection>
  )
}

export default StrongPassageMediaSection
