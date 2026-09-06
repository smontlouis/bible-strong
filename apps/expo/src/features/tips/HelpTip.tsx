import { resolveThemeColor } from '~themes/colorValues'
import { useTheme as useStylingTheme } from '~themes/ThemeProvider'
import { twMerge } from '~common/ui/classNames'
import { TouchableOpacity } from 'react-native'
import { BoxProps, HStack } from '~common/ui/Box'
import { FeatherIcon } from '~common/ui/Icon'
import Text from '~common/ui/Text'
import { dismissTipAtom, useTip } from './atom'
import { useSetAtom } from 'jotai/react'
import { useTranslation } from 'react-i18next'
export const HelpTip = ({
  id,
  description,
  type = 'info',
  ...props
}: {
  id: string
  description: string
  type?: 'info' | 'warning'
} & BoxProps) => {
  const stylingTheme = useStylingTheme()

  const isDismissed = useTip(id)
  const dismissTip = useSetAtom(dismissTipAtom)
  const { t } = useTranslation()
  const dismiss = () => dismissTip(id)

  if (isDismissed) return null

  return (
    <HStack
      style={[
        {
          backgroundColor: resolveThemeColor(stylingTheme, type === 'info' ? 'opacity50' : 'quart'),
        },
        props.style,
        { boxShadow: '0 0 5px 0 rgba(0, 0, 0, 0.1)', borderRadius: 10 },
      ]}
      {...props}
      className={twMerge(
        'overflow-hidden border-continuous',
        twMerge(
          'overflow-hidden border-continuous px-[14px] py-[10px] mx-[10px] gap-[10px] items-center',
          props.className
        )
      )}
    >
      <FeatherIcon
        name={type === 'info' ? 'info' : 'alert-triangle'}
        size={20}
        color={type === 'info' ? 'tertiary' : 'reverse'}
      />
      <Text
        className={twMerge(
          type === 'info' ? 'text-tertiary' : 'text-reverse',
          'flex-[1] text-[14px]'
        )}
      >
        {description}
      </Text>
      <TouchableOpacity
        accessibilityLabel={t('Fermer')}
        accessibilityRole="button"
        hitSlop={10}
        onPress={dismiss}
      >
        <FeatherIcon name="x" size={20} color={type === 'info' ? 'tertiary' : 'reverse'} />
      </TouchableOpacity>
    </HStack>
  )
}
