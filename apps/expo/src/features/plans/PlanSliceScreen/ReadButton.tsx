import { useRouter } from 'expo-router'
import type { ComponentPropsWithRef as UIComponentProps } from 'react'
import { twMerge } from '~common/ui/classNames'
import { useResolveClassNames } from 'uniwind'
import type { Theme as AppTheme } from '~themes'
import { useTheme as useAppTheme } from '~themes/ThemeProvider'

import { useDispatch } from 'react-redux'
import Link from '~common/Link'
import { MaterialIcon } from '~common/ui/Icon'
import { markAsRead } from '~redux/modules/plan'
import { Theme } from '~themes'

const StyledLink = (
  componentProps: Omit<UIComponentProps<typeof Link>, keyof { theme: Theme } | 'theme'> &
    Omit<{ theme: Theme }, 'theme'> & { theme?: AppTheme; className?: string }
) => {
  const contextTheme = useAppTheme()
  const { theme: themeOverride, className, ...props } = componentProps
  const theme = themeOverride ?? contextTheme

  const classStyles = useResolveClassNames(
    twMerge(
      'bg-success w-[60px] h-[60px] rounded-[30px] justify-center items-center flex-row elevation-[2]',
      className
    )
  )
  return (
    <Link
      {...props}
      style={
        [
          classStyles,
          {
            shadowColor: theme.colors.default,
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.3,
            shadowRadius: 4,
          },
          props.style,
        ] as UIComponentProps<typeof Link>['style']
      }
    />
  )
}

interface Props {
  readingSliceId: string
  planId: string
  isRead: boolean
  onRead?: () => void
}

const ReadButton = ({ readingSliceId, planId, isRead, onRead }: Props) => {
  const router = useRouter()
  const dispatch = useDispatch()

  const onPress = () => {
    dispatch(markAsRead({ readingSliceId, planId }))
    if (onRead) {
      onRead()
      return
    }
    router.back()
  }
  return (
    <StyledLink onPress={onPress} style={{ opacity: isRead ? 0.3 : 1 }}>
      <MaterialIcon color="white" name="check" size={22} />
    </StyledLink>
  )
}

export default ReadButton
