import { useWindowDimensions, type LayoutChangeEvent } from 'react-native'
import YoutubePlayer from '~helpers/react-native-youtube-iframe'
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
      <VStack className="overflow-hidden border-continuous gap-[22px]">
        {media.map(item => (
          <VStack className="overflow-hidden border-continuous gap-[9px]" key={item.editionId}>
            <Box className="border-continuous overflow-visible rounded-[12px] border-[1px] border-border bg-light-grey">
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
