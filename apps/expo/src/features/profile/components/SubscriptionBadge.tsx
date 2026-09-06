import * as Icon from '@expo/vector-icons'
import type { ComponentPropsWithRef as UIComponentProps } from 'react'
import { useTranslation } from 'react-i18next'
import { useSelector } from 'react-redux'
import { twMerge } from '~common/ui/classNames'
import { useResolveClassNames } from 'uniwind'
import type { Theme as AppTheme } from '~themes'

import Box, { HStack } from '~common/ui/Box'
import Text from '~common/ui/Text'
import { RootState } from '~redux/modules/reducer'

const SubscriptionBadge = () => {
  const { t } = useTranslation()
  const subscription = useSelector((state: RootState) => state.user.subscription)

  if (!subscription) return null

  return (
    <HStack className="overflow-hidden border-continuous gap-[10px] mt-[5px]">
      <Badge>
        <Icon.AntDesign name="star" size={14} color="#F59E0B" />
        <Text className="text-[12px] text-grey ml-[5px]">{t('profile.premium')}</Text>
      </Badge>
    </HStack>
  )
}

const Badge = (
  componentProps: Omit<UIComponentProps<typeof Box>, 'theme'> & {
    theme?: AppTheme
    className?: string
  }
) => {
  const { theme: _themeOverride, className, ...props } = componentProps

  const classStyles = useResolveClassNames(
    twMerge(
      'flex-row items-center px-[10px] py-[5px] rounded-[15px] border-[1px] border-[#F59E0B] bg-reverse',
      className
    )
  )
  return (
    <Box
      {...props}
      style={[classStyles, {}, props.style] as UIComponentProps<typeof Box>['style']}
      className="overflow-hidden border-continuous"
    />
  )
}

export default SubscriptionBadge
