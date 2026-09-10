import type { ComponentPropsWithRef as UIComponentProps } from 'react'
import { twMerge } from '~common/ui/classNames'

import type { Theme as AppTheme } from '~themes'
import { useTheme as useAppTheme } from '~themes/ThemeProvider'

import { EntitySlice as EntitySliceProps, PlanStatus } from '~common/types'
import Box from '~common/ui/Box'
import { FeatherIcon, MaterialIcon } from '~common/ui/Icon'
import Text from '~common/ui/Text'
import { chapterToReference } from '~helpers/chapterToReference'
import truncate from '~helpers/truncate'
import verseToReference from '~helpers/verseToReference'
import { Theme } from '~themes'

const extractTitle = (props: EntitySliceProps) => {
  switch (props.type) {
    case 'Text':
      return `${truncate(props.description, 20)}`
    case 'Video':
      return `${props.title}`
    case 'Verse':
      return verseToReference(props.verses, { isPlan: true })
    case 'Title':
      return props.title
    case 'Chapter':
      return chapterToReference(props.chapters)
    default:
      return `No type found for this item: ${props.type}`
  }
}

const renderIcon = (props: EntitySliceProps, isComplete: boolean, isNext: boolean) => {
  switch (props.type) {
    case 'Text':
      return <FeatherIcon name="type" size={7} color={isComplete ? 'white' : 'primary'} />
    case 'Video':
      return <MaterialIcon name="play-arrow" size={13} color={isComplete ? 'white' : 'primary'} />
    case 'Verse':
    case 'Chapter':
      return isComplete ? (
        <FeatherIcon name="check" size={10} color="white" />
      ) : isNext ? null : (
        <SmallCircle />
      )

    default:
      return isComplete ? (
        <FeatherIcon name="check" size={10} color="white" />
      ) : isNext ? null : (
        <SmallCircle />
      )
  }
}

const SmallCircle = (
  componentProps: Omit<UIComponentProps<typeof Box>, keyof { theme: Theme } | 'theme'> &
    Omit<{ theme: Theme }, 'theme'> & { theme?: AppTheme; className?: string }
) => {
  const { theme: _themeOverride, className, ...props } = componentProps

  const resolvedClassName = twMerge(
    'w-[6px] h-[6px] opacity-[0.5] bg-primary rounded-[3px] items-center justify-center',
    className
  )
  return (
    <Box
      {...props}
      style={[props.style] as UIComponentProps<typeof Box>['style']}
      className={twMerge('overflow-hidden border-continuous', resolvedClassName)}
    />
  )
}

interface CircleProps {
  isComplete: boolean
  isNext: boolean
  isSectionCompleted: boolean
}

const Circle = (
  componentProps: Omit<UIComponentProps<typeof Box>, keyof CircleProps | 'theme'> &
    Omit<CircleProps, 'theme'> & { theme?: AppTheme; className?: string }
) => {
  const contextTheme = useAppTheme()
  const { theme: themeOverride, className, ...props } = componentProps
  const theme = themeOverride ?? contextTheme
  const { isComplete, isNext, isSectionCompleted } = props
  const resolvedClassName = twMerge(
    'w-[18px] h-[18px] rounded-[9px] items-center justify-center',
    className
  )
  return (
    <Box
      {...props}
      style={
        [
          {
            backgroundColor: isSectionCompleted
              ? theme.colors.success
              : isComplete
                ? theme.colors.primary
                : theme.colors.lightPrimary,
            ...(isNext && {
              borderWidth: 2,
              borderColor: theme.colors.primary,
            }),
          },
          props.style,
        ] as UIComponentProps<typeof Box>['style']
      }
      className={twMerge('overflow-hidden border-continuous', resolvedClassName)}
    />
  )
}

const Line = (
  componentProps: Omit<UIComponentProps<typeof Box>, keyof CircleProps | 'theme'> &
    Omit<CircleProps, 'theme'> & { theme?: AppTheme; className?: string }
) => {
  const contextTheme = useAppTheme()
  const { theme: themeOverride, className, ...props } = componentProps
  const theme = themeOverride ?? contextTheme
  const { isComplete, isNext, isSectionCompleted } = props
  const resolvedClassName = twMerge('h-[10px]', className)
  return (
    <Box
      {...props}
      style={
        [
          {
            width: isComplete || isNext ? 3 : 2,
            backgroundColor: isSectionCompleted
              ? theme.colors.success
              : isComplete || isNext
                ? theme.colors.primary
                : theme.colors.lightPrimary,
          },
          props.style,
        ] as UIComponentProps<typeof Box>['style']
      }
      className={twMerge('overflow-hidden border-continuous', resolvedClassName)}
    />
  )
}

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

  if ((props.type === 'Text' && !props.title) || props.type === 'Image') {
    return null
  }

  return (
    <Box className="overflow-hidden border-continuous flex-row">
      <Box className="overflow-hidden border-continuous mr-[25px] items-center justify-center">
        <Circle isSectionCompleted={isSectionCompleted} isComplete={isComplete} isNext={isNext}>
          {renderIcon(props, isComplete, isNext)}
        </Circle>
        {!isLast && (
          <Line isComplete={isComplete} isNext={isNext} isSectionCompleted={isSectionCompleted} />
        )}
      </Box>
      <Text style={[{ opacity: isComplete || isNext ? 1 : 0.6 }, { flex: 1 }]} numberOfLines={1}>
        {title}
      </Text>
    </Box>
  )
}

export default EntitySlice
