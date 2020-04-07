import React from 'react'
import styled from '@emotion/native'

import verseToReference from '~helpers/verseToReference'
import chapterToReference from '~helpers/chapterToReference'
import Box from '~common/ui/Box'
import Text from '~common/ui/Text'
import { FeatherIcon, MaterialIcon } from '~common/ui/Icon'
import {
  MyEntitySlice as EntitySliceProps,
  SliceType,
  Status,
} from '~common/types'

const extractTitle = (props: EntitySliceProps) => {
  switch (props.type) {
    case SliceType.Text:
      return `Méditation: ${props.title}`
    case SliceType.Video:
      return `Vidéo: ${props.title}`
    case SliceType.Verse:
      return verseToReference(props.verses, { isPlan: true })
    case SliceType.Chapter:
      return chapterToReference(props.chapters)
    default:
      return `No type found for this item: ${props.type}`
  }
}

const renderIcon = (
  props: EntitySliceProps,
  isComplete: boolean,
  isNext: boolean
) => {
  switch (props.type) {
    case SliceType.Text:
      return (
        <FeatherIcon
          name="type"
          size={7}
          color={isComplete ? 'white' : 'primary'}
        />
      )
    case SliceType.Video:
      return (
        <MaterialIcon
          name="play-arrow"
          size={13}
          color={isComplete ? 'white' : 'primary'}
        />
      )
    case SliceType.Verse:
    case SliceType.Chapter:
      return isComplete ? (
        <FeatherIcon name="check" size={10} color="white" />
      ) : isNext ? null : (
        <SmallCircle />
      )

    default:
      console.log(`No type found for this item: ${props.type}`)
      return isComplete ? (
        <FeatherIcon name="check" size={10} color="white" />
      ) : isNext ? null : (
        <SmallCircle />
      )
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
  ({
    theme,
    isComplete,
    isNext,
  }: {
    theme: any
    isComplete: boolean
    isNext: boolean
  }) => ({
    width: 18,
    height: 18,
    backgroundColor: isComplete
      ? theme.colors.primary
      : theme.colors.lightPrimary,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    ...(isNext && {
      borderWidth: 2,
      borderColor: theme.colors.primary,
    }),
  })
)

const Line = styled(Box)(
  ({
    theme,
    isComplete,
    isNext,
  }: {
    theme: any
    isComplete: boolean
    isNext: boolean
  }) => ({
    height: 10,
    width: isComplete || isNext ? 3 : 2,
    backgroundColor:
      isComplete || isNext ? theme.colors.primary : theme.colors.lightPrimary,
  })
)

const EntitySlice = (props: EntitySliceProps & { isLast?: boolean }) => {
  const { status, isLast } = props
  const isComplete = status === Status.Completed
  const isNext = status === Status.Next
  const title = extractTitle(props)

  return (
    <Box row>
      <Box marginRight={25} center>
        <Circle isComplete={isComplete} isNext={isNext}>
          {renderIcon(props, isComplete, isNext)}
        </Circle>
        {!isLast && <Line isComplete={isComplete} isNext={isNext} />}
      </Box>
      <Text opacity={isComplete || isNext ? 1 : 0.3}>{title}</Text>
    </Box>
  )
}

export default EntitySlice
