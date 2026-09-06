import type { ComponentPropsWithRef as UIComponentProps } from 'react'
import { twMerge } from '~common/ui/classNames'
import { useResolveClassNames } from 'uniwind'
import Link, { LinkProps } from '~common/Link'
import { MainStackProps } from '~navigation/type'
import type { Theme as AppTheme } from '~themes'

interface CardLinkItemProps {
  isLast?: boolean
}

const CardLinkItem = (
  componentProps: Omit<
    UIComponentProps<typeof Link>,
    keyof (LinkProps<keyof MainStackProps> & CardLinkItemProps) | 'theme'
  > &
    Omit<LinkProps<keyof MainStackProps> & CardLinkItemProps, 'theme'> & {
      theme?: AppTheme
      className?: string
    }
) => {
  const { theme: _themeOverride, className, ...props } = componentProps

  const { isLast } = props
  const classStyles = useResolveClassNames(
    twMerge('flex-row items-center gap-[10px] px-[12px] pt-[12px]', className)
  )
  return (
    <Link
      {...props}
      style={
        [classStyles, { paddingBottom: isLast ? 12 : 0 }, props.style] as UIComponentProps<
          typeof Link
        >['style']
      }
    />
  )
}

export default CardLinkItem
