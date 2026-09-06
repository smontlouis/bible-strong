import type { ComponentPropsWithRef as UIComponentProps } from 'react'
import { twMerge } from '~common/ui/classNames'
import { useResolveClassNames } from 'uniwind'
import type { Theme as AppTheme } from '~themes'
import Box from './Box'

interface SpacerProps {
  size?: number
}

const Spacer = (
  componentProps: Omit<UIComponentProps<typeof Box>, keyof SpacerProps | 'theme'> &
    Omit<SpacerProps, 'theme'> & { theme?: AppTheme; className?: string }
) => {
  const { theme: _themeOverride, className, ...props } = componentProps

  const { size = 1 } = props
  const classStyles = useResolveClassNames(twMerge('', className))
  return (
    <Box
      {...props}
      style={
        [classStyles, { marginTop: size * 15 }, props.style] as UIComponentProps<
          typeof Box
        >['style']
      }
      className="overflow-hidden border-continuous"
    />
  )
}

export default Spacer
