import { useWindowDimensions, type LayoutChangeEvent } from 'react-native'
import YoutubePlayer from '~helpers/react-native-youtube-iframe'
import Box from '~common/ui/Box'
import { radii } from '~common/ui/surfaces'
import { type ResolvedPassageMedia } from '~features/bible/passageMedia'
import { STUDY_COLUMN_MAX_WIDTH, StudySection } from '~common/ui/StudySection'
type Props = {
  media: ResolvedPassageMedia[]
  title: string
  onLayout?: (event: LayoutChangeEvent) => void
}

/** The player is the object of the section: it takes a card's corners, with no frame around it. */
const StrongPassageMediaSection = ({ media, title, onLayout }: Props) => {
  const { width: windowWidth } = useWindowDimensions()
  const playerWidth = Math.min(windowWidth - 40, STUDY_COLUMN_MAX_WIDTH)
  const playerHeight = (playerWidth * 9) / 16

  return (
    <StudySection title={title} surface="none" onLayout={onLayout}>
      {media.map(item => (
        <Box
          className="overflow-hidden border-continuous rounded-[16px] bg-surface"
          key={item.editionId}
        >
          <YoutubePlayer
            height={playerHeight}
            width={playerWidth}
            videoId={item.providerId}
            viewContainerStyle={{ borderRadius: radii.card, overflow: 'hidden' }}
            webviewStyle={{ borderRadius: radii.card, overflow: 'hidden' }}
          />
        </Box>
      ))}
    </StudySection>
  )
}

export default StrongPassageMediaSection
