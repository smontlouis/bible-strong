import React from 'react'
import Box from '~common/ui/Box'
import { FeatherIcon } from '~common/ui/Icon'
import IconButton from './IconButton'

export interface ChapterButtonProps {
  hasNextChapter: boolean
  isExpanded: boolean
  disabled?: boolean
  onPress: () => void
  direction: 'left' | 'right'
}

const ChapterButton = ({
  direction,
  hasNextChapter,
  isExpanded,
  disabled,
  onPress,
}: ChapterButtonProps) => {
  return (
    <Box width={40} height={40} overflow="visible">
      {hasNextChapter && (
        <IconButton
          isFlat={isExpanded}
          disabled={disabled}
          activeOpacity={0.5}
          onPress={onPress}
        >
          <FeatherIcon name={`arrow-${direction}`} size={20} color="tertiary" />
        </IconButton>
      )}
    </Box>
  )
}

export default ChapterButton
