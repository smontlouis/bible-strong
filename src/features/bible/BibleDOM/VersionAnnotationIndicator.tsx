import React from 'react'
import { styled } from 'goober'
import { RootStyles } from './BibleDOMWrapper'
import { scaleFontSize } from './scaleFontSize'
import { isDarkTheme } from './utils'
import { InlineItemContainer, InlineItemIconWrapper, InlineItemText } from './InlineItem'
import * as Icon from '@expo/vector-icons'

/**
 * Discrete indicator showing when annotations exist in other Bible versions
 * Example: "LSG" or "LSG +1" when viewing KJV but annotations exist in LSG and another version
 */

const Indicator = styled('span')<RootStyles>(({ settings: { fontSizeScale, theme, colors } }) => ({
  fontSize: scaleFontSize(14, fontSizeScale),
  color: colors[theme].tertiary,
  backgroundColor: colors[theme].reverse,
  boxShadow: isDarkTheme(theme)
    ? `0 0 10px 0 rgba(255, 255, 255, 0.1)`
    : `0 0 10px 0 rgba(0, 0, 0, 0.2)`,
  borderRadius: '8px',
  padding: '4px ',
  marginRight: '4px',
  marginLeft: '4px',
  '&:active': {
    opacity: 0.4,
  },
}))

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

const VersionAnnotationIndicator = ({ versions, settings, onClick, isDisabled }: Props) => {
  if (!versions || versions.length === 0) return null

  const displayVersion = versions[0].version
  const moreCount = versions.length - 1

  return (
    <InlineItemContainer settings={settings} onClick={onClick} isButton isDisabled={isDisabled}>
      <InlineItemIconWrapper settings={settings}>
        <Icon.Feather color={settings.colors[settings.theme].secondary} name="edit-3" size={16} />
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
