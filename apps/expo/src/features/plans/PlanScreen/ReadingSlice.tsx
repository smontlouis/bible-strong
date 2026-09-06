import type { ComponentPropsWithRef as UIComponentProps } from 'react'
import { twMerge } from '~common/ui/classNames'
import { useResolveClassNames } from 'uniwind'
import type { Theme as AppTheme } from '~themes'

import Link from '~common/Link'
import { ComputedReadingSlice, Plan } from '~common/types'
import Border from '~common/ui/Border'
import Box from '~common/ui/Box'
import { FeatherIcon } from '~common/ui/Icon'
import Text from '~common/ui/Text'
import EntitySlice from './EntitySlice'

const FineLine = (
  componentProps: Omit<UIComponentProps<typeof Box>, 'theme'> & {
    theme?: AppTheme
    className?: string
  }
) => {
  const { theme: _themeOverride, className, ...props } = componentProps

  const classStyles = useResolveClassNames(
    twMerge('absolute top-[0px] bottom-[0px] left-[36px] w-[2px] bg-light-primary', className)
  )
  return (
    <Box
      {...props}
      style={[classStyles, {}, props.style] as UIComponentProps<typeof Box>['style']}
      className="overflow-hidden border-continuous"
    />
  )
}

const NextButton = (
  componentProps: Omit<UIComponentProps<typeof Text>, 'theme'> & {
    theme?: AppTheme
    className?: string
  }
) => {
  const { theme: _themeOverride, className, ...props } = componentProps

  const classStyles = useResolveClassNames(
    twMerge(
      'p-[4px] rounded-[3px] bg-primary text-[white] text-[11px] font-bold mr-[10px]',
      className
    )
  )
  return (
    <Text
      {...props}
      style={[classStyles, {}, props.style] as UIComponentProps<typeof Text>['style']}
    />
  )
}

interface Props {
  isLast?: boolean
  planId: string
  planTitle: string
  planLanguage?: Plan['lang']
  isSectionCompleted: boolean
  onPress?: (
    slice: ComputedReadingSlice & {
      planId: string
      planTitle: string
      planLanguage?: Plan['lang']
    }
  ) => void
}

const ReadingSlice = ({
  id,
  title,
  planId,
  planTitle,
  planLanguage,
  slices,
  status,
  isLast,
  isSectionCompleted,
  onPress,
}: ComputedReadingSlice & Props) => {
  const isNext = status === 'Next'
  // Pre-filter slices to avoid double filtering in map
  const filteredSlices = slices.filter(f => f.type !== 'Image')
  const readingSlice = { id, planId, planTitle, planLanguage, title, slices, status }

  return (
    <Link
      route={onPress ? undefined : 'PlanSlice'}
      params={onPress ? undefined : { readingSlice }}
      onPress={onPress ? () => onPress(readingSlice) : undefined}
    >
      <Box className="overflow-hidden border-continuous pl-[28px] pt-[15px] bg-reverse relative">
        <FineLine />
        <Box className="overflow-hidden border-continuous flex-row mb-[15px]">
          <Box className="overflow-hidden border-continuous flex-[1]">
            {title && (
              <EntitySlice
                id={title}
                status={status}
                isSectionCompleted={isSectionCompleted}
                title={title}
                isLast
                type="Title"
              />
            )}
            {filteredSlices.map((slice, i) => (
              <EntitySlice
                status={status}
                isSectionCompleted={isSectionCompleted}
                isLast={i === filteredSlices.length - 1}
                key={slice.id}
                {...slice}
              />
            ))}
          </Box>
          <Box className="overflow-hidden border-continuous px-[10px] items-center flex-row">
            {isNext && <NextButton>LIRE</NextButton>}
            <FeatherIcon name="chevron-right" size={14} color="primary" />
          </Box>
        </Box>
        {!isLast && <Border className="ml-[40px]" />}
      </Box>
      {isLast && <Border />}
    </Link>
  )
}

export default ReadingSlice
