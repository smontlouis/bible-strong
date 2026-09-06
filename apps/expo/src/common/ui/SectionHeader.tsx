import { Feather } from '@expo/vector-icons'
import type { ComponentProps, ComponentPropsWithRef as UIComponentProps } from 'react'
import { twMerge } from '~common/ui/classNames'
import { useResolveClassNames } from 'uniwind'
import Box from '~common/ui/Box'
import { FeatherIcon } from '~common/ui/Icon'
import Text from '~common/ui/Text'
import type { Theme as AppTheme } from '~themes'

interface SectionHeaderProps {
  icon: ComponentProps<typeof Feather>['name']
  title: string
}

const SectionHeader = ({ icon, title }: SectionHeaderProps) => (
  <Container>
    <FeatherIcon name={icon} size={16} color="grey" />
    <Title accessibilityRole="header">{title}</Title>
  </Container>
)

const Container = (
  componentProps: Omit<UIComponentProps<typeof Box>, 'theme'> & {
    theme?: AppTheme
    className?: string
  }
) => {
  const { theme: _themeOverride, className, ...props } = componentProps

  const classStyles = useResolveClassNames(
    twMerge('flex-row items-center px-[20px] pt-[20px] pb-[8px] gap-[8px]', className)
  )
  return (
    <Box
      {...props}
      style={[classStyles, {}, props.style] as UIComponentProps<typeof Box>['style']}
      className="overflow-hidden border-continuous"
    />
  )
}

const Title = (
  componentProps: Omit<UIComponentProps<typeof Text>, 'theme'> & {
    theme?: AppTheme
    className?: string
  }
) => {
  const { theme: _themeOverride, className, ...props } = componentProps

  const classStyles = useResolveClassNames(
    twMerge('text-[12px] font-semibold text-grey uppercase', className)
  )
  return (
    <Text
      {...props}
      style={
        [classStyles, { letterSpacing: 0.5 }, props.style] as UIComponentProps<typeof Text>['style']
      }
    />
  )
}

export default SectionHeader
