import React from 'react'
import Box, { TouchableBox } from '~common/ui/Box'
import { IonIcon } from '~common/ui/Icon'

export interface ChapterButtonProps {
  hasNextChapter: boolean
  disabled?: boolean
  onPress: () => void
  direction: 'left' | 'right'
}

const ChapterButton = ({ direction, hasNextChapter, disabled, onPress }: ChapterButtonProps) => {
  return (
    <Box width={40} height={40} overflow="visible">
      {hasNextChapter && (
        <>
          <TouchableBox
            disabled={disabled}
            activeOpacity={0.5}
            onPress={onPress}
            width={40}
            height={40}
            center
          >
            <IonIcon
              name={`play-skip-${direction === 'left' ? 'back' : 'forward'}`}
              size={20}
              color="tertiary"
            />
          </TouchableBox>
        </>
      )}
    </Box>
  )
}

export default ChapterButton
