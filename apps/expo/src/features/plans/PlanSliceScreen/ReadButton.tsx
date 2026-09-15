import { goBackOrHome } from '~navigation/goBackOrHome'
import { useRouter } from 'expo-router'
import { useTranslation } from 'react-i18next'
import type { ComponentPropsWithRef as UIComponentProps } from 'react'
import { twMerge } from '~common/ui/classNames'

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

  const resolvedClassName = twMerge(
    'bg-success w-[60px] h-[60px] rounded-[30px] justify-center items-center flex-row elevation-[2]',
    className
  )
  return (
    <Link
      {...props}
      className={resolvedClassName}
      style={
        [
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
  const { t } = useTranslation()
  const router = useRouter()
  const dispatch = useDispatch()

  const onPress = () => {
    if (!isRead) dispatch(markAsRead({ readingSliceId, planId }))
    if (onRead) {
      onRead()
      return
    }
    goBackOrHome(router)
  }
  return (
    <StyledLink onPress={onPress} accessibilityLabel={t(isRead ? 'Retour' : 'Marquer comme lu')}>
      <MaterialIcon color="white" name={isRead ? 'arrow-back' : 'check'} size={22} />
    </StyledLink>
  )
}

export default ReadButton
