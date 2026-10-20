import { RootStyles } from './BibleDOMWrapper'
import { scaleFontSize } from './scaleFontSize'
import { InlineItemContainer, InlineItemIconWrapper, InlineItemText } from './InlineItem'
import Feather from '@expo/vector-icons/Feather'
import { personalContentIcons } from '~common/personalContent'
import { resolveUniverseColors } from '~themes/universeColors'

export interface CrossVersionAnnotation {
  version: string
  count: number
}

interface Props {
  versions: CrossVersionAnnotation[]
  settings: RootStyles['settings']
  onClick: () => void
  isDisabled?: boolean
}

/**
 * Discrete indicator showing when annotations exist in other Bible versions
 * Example: "LSG" or "LSG +1" when viewing KJV but annotations exist in LSG and another version
 */
const VersionAnnotationIndicator = ({ versions, settings, onClick, isDisabled }: Props) => {
  if (!versions || versions.length === 0) return null

  const displayVersion = versions[0].version
  const moreCount = versions.length - 1

  return (
    <InlineItemContainer settings={settings} onClick={onClick} isButton isDisabled={isDisabled}>
      <InlineItemIconWrapper settings={settings}>
        <Feather
          color={resolveUniverseColors(settings.colors[settings.theme], 'highlights').foreground}
          name={personalContentIcons.highlights}
          size={16}
        />
      </InlineItemIconWrapper>
      <InlineItemText
        settings={settings}
        style={{
          fontSize: scaleFontSize(12, settings.fontSizeScale),
        }}
      >
        {displayVersion}
        {moreCount > 0 ? ` +${moreCount}` : ''}
      </InlineItemText>
    </InlineItemContainer>
  )
}

export default VersionAnnotationIndicator
