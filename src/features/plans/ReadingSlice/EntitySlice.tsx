import React from 'react'
import styled from '@emotion/native'

import verseToReference from '~helpers/verseToReference'
import chapterToReference from '~helpers/chapterToReference'
import Box from '~common/ui/Box'
import Text from '~common/ui/Text'
import { FeatherIcon, MaterialIcon } from '~common/ui/Icon'
import { MyEntitySlice as EntitySliceProps, SliceType } from '~common/types'

const extractTitle = (props: EntitySliceProps) => {
  switch (props.type) {
    case SliceType.Text:
      return `Méditation: ${props.title}`
    case SliceType.Video:
      return `Vidéo: ${props.title}`
    case SliceType.Verse:
      return verseToReference(props.verses)
    case SliceType.Chapter:
      return chapterToReference(props.chapters)
    default:
      return 'No type found for this item'
  }
}

const renderIcon = (props: EntitySliceProps) => {
  switch (props.type) {
    case SliceType.Text:
      return (
        <FeatherIcon
          name="type"
          size={8}
          color={props.isComplete ? 'white' : 'primary'}
        />
      )
    case SliceType.Video:
      return (
        <MaterialIcon
          name="play-arrow"
          color={props.isComplete ? 'white' : 'primary'}
        />
      )
    case SliceType.Verse:
    case SliceType.Chapter:
      return props.isComplete ? (
        <FeatherIcon name="check" size={10} color="white" />
      ) : (
        <SmallCircle />
      )

    default:
      return 'No type found for this item'
  }
}

const SmallCircle = styled(Box)(({ theme }: { theme: any }) => ({
  width: 6,
  height: 6,
  opacity: 0.5,
  backgroundColor: theme.colors.primary,
  borderRadius: 3,
  alignItems: 'center',
  justifyContent: 'center',
}))

const Circle = styled(Box)(
  ({ theme, isComplete }: { theme: any; isComplete: boolean }) => ({
    width: 16,
    height: 16,
    backgroundColor: isComplete
      ? theme.colors.primary
      : theme.colors.lightPrimary,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  })
)

const Line = styled(Box)(
  ({ theme, isComplete }: { theme: any; isComplete: boolean }) => ({
    height: 10,
    width: isComplete ? 3 : 2,
    backgroundColor: isComplete
      ? theme.colors.primary
      : theme.colors.lightPrimary,
  })
)

const EntitySlice = (props: EntitySliceProps) => {
  const { isComplete, isLast } = props
  const title = extractTitle(props)
  return (
    <Box row>
      <Box marginRight={25} center>
        <Circle isComplete={isComplete}>{renderIcon(props)}</Circle>
        {!isLast && <Line isComplete={isComplete} />}
      </Box>
      <Text opacity={isComplete ? 1 : 0.3}>{title}</Text>
    </Box>
  )
}

export default EntitySlice
