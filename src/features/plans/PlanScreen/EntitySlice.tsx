import React from 'react'

import styled from '~styled'
import verseToReference from '~helpers/verseToReference'
import chapterToReference from '~helpers/chapterToReference'
import Box from '~common/ui/Box'
import Text from '~common/ui/Text'
import { FeatherIcon, MaterialIcon } from '~common/ui/Icon'
import { EntitySlice as EntitySliceProps, PlanStatus } from '~common/types'
import { Theme } from '~themes/'

const extractTitle = (props: EntitySliceProps) => {
  switch (props.type) {
    case 'Text':
      return `Méditation: ${props.title}`
    case 'Video':
      return `${props.title}`
    case 'Verse':
      return verseToReference(props.verses, { isPlan: true })
    case 'Chapter':
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
    case 'Text':
      return (
        <FeatherIcon
          name="type"
          size={7}
          color={isComplete ? 'white' : 'primary'}
        />
      )
    case 'Video':
      return (
        <MaterialIcon
          name="play-arrow"
          size={13}
          color={isComplete ? 'white' : 'primary'}
        />
      )
    case 'Verse':
    case 'Chapter':
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
  ({ theme, isComplete, isNext, isSectionCompleted }) => ({
    width: 18,
    height: 18,
    backgroundColor: isSectionCompleted
      ? theme.colors.success
      : isComplete
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
    isSectionCompleted,
  }: {
    theme: Theme
    isComplete: boolean
    isNext: boolean
    isSectionCompleted: boolean
  }) => ({
    height: 10,
    width: isComplete || isNext ? 3 : 2,
    backgroundColor: isSectionCompleted
      ? theme.colors.success
      : isComplete || isNext
      ? theme.colors.primary
      : theme.colors.lightPrimary,
  })
)

interface Props {
  isLast?: boolean
  status?: PlanStatus
  isSectionCompleted: boolean
}

const EntitySlice = (props: EntitySliceProps & Props) => {
  const { status, isLast, isSectionCompleted } = props
  const isComplete = status === 'Completed'
  const isNext = status === 'Next'
  const title = extractTitle(props)

  return (
    <Box row>
      <Box marginRight={25} center>
        <Circle
          isSectionCompleted={isSectionCompleted}
          isComplete={isComplete}
          isNext={isNext}
        >
          {renderIcon(props, isComplete, isNext)}
        </Circle>
        {!isLast && (
          <Line
            isComplete={isComplete}
            isNext={isNext}
            isSectionCompleted={isSectionCompleted}
          />
        )}
      </Box>
      <Text opacity={isComplete || isNext ? 1 : 0.6}>{title}</Text>
    </Box>
  )
}

export default EntitySlice
