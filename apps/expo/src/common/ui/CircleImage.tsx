import type { ComponentPropsWithRef as UIComponentProps } from 'react'
import { twMerge } from '~common/ui/classNames'
import { useResolveClassNames } from 'uniwind'
import Box from '~common/ui/Box'
import type { Theme as AppTheme } from '~themes'

const CircleImage = (
  componentProps: Omit<UIComponentProps<typeof Box>, 'theme'> & {
    theme?: AppTheme
    className?: string
    size?: number
  }
) => {
  const { theme: _themeOverride, className, ...props } = componentProps

  const { size = 30 } = props
  const classStyles = useResolveClassNames(twMerge('bg-light-grey border-light-grey', className))
  return (
    <Box
      {...props}
      style={
        [
          classStyles,
          { width: size, height: size, borderRadius: size / 2 },
          props.style,
        ] as UIComponentProps<typeof Box>['style']
      }
      className="overflow-hidden border-continuous"
    />
  )
}

export default CircleImage
