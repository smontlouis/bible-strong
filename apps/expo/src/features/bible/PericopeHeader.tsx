import { resolveFontFamily } from '~themes/styleValues'
import { useTheme as useStylingTheme } from '~themes/ThemeProvider'
import * as Icon from '@expo/vector-icons'
import type { ComponentPropsWithRef as UIComponentProps } from 'react'
import { twMerge } from '~common/ui/classNames'
import { useResolveClassNames } from 'uniwind'
import PageContent from '~common/ui/PageContent'
import type { Theme as AppTheme } from '~themes'

import Back from '~common/Back'
import Box from '~common/ui/Box'
import Text from '~common/ui/Text'

const HeaderBox = (
  componentProps: Omit<UIComponentProps<typeof Box>, 'theme'> & {
    theme?: AppTheme
    className?: string
  }
) => {
  const { theme: _themeOverride, className, ...props } = componentProps

  const classStyles = useResolveClassNames(
    twMerge('h-[60px] items-center border-b-border', className)
  )
  return (
    <Box
      {...props}
      style={[classStyles, {}, props.style] as UIComponentProps<typeof Box>['style']}
      className="overflow-hidden border-continuous"
    />
  )
}

const FeatherIcon = (
  componentProps: Omit<UIComponentProps<typeof Icon.Feather>, 'theme'> & {
    theme?: AppTheme
    className?: string
  }
) => {
  const { theme: _themeOverride, className, ...props } = componentProps

  const classStyles = useResolveClassNames(twMerge('text-default', className))
  return (
    <Icon.Feather
      {...props}
      style={[classStyles, {}, props.style] as UIComponentProps<typeof Icon.Feather>['style']}
    />
  )
}

interface PericopeHeaderProps {
  hasBackButton?: boolean
  title: string
}

function PericopeHeader({ hasBackButton, title }: PericopeHeaderProps) {
  const stylingTheme = useStylingTheme()

  return (
    <HeaderBox className="overflow-visible">
      <PageContent className="flex-[1] items-center flex-row">
        <Box className="overflow-hidden border-continuous justify-center">
          {hasBackButton && (
            <Back padding>
              <FeatherIcon name="arrow-left" size={20} />
            </Back>
          )}
        </Box>
        <Box className="overflow-hidden border-continuous items-center justify-center flex-[1]">
          <Text
            className="text-[16px] ml-[10px] mr-[10px]"
            style={{ fontFamily: resolveFontFamily(stylingTheme.fontFamily.title) }}
          >
            {title}
          </Text>
        </Box>
        <Box className="overflow-hidden border-continuous w-[30px]" />
      </PageContent>
    </HeaderBox>
  )
}

export default PericopeHeader
