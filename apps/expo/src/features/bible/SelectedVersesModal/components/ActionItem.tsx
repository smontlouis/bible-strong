import { useTheme } from '~themes/ThemeProvider'
import { Image } from 'expo-image'
import Animated from 'react-native-reanimated'
import { TouchableBox } from '~common/ui/Box'
import { FeatherIcon } from '~common/ui/Icon'
import Text from '~common/ui/Text'
import { ACTION_ITEM_WIDTH, ICON_BOX_SIZE, ICON_SIZE } from '../constants'
import type { ActionItemProps } from '../types'
const ActionItem = ({
  name,
  Icon,
  svgSource,
  tintColor,
  label,
  onPress,
  disabled,
  isActive,
  variant = 'default',
}: ActionItemProps) => {
  const theme = useTheme()
  const iconColor = tintColor || theme.colors.primary

  return (
    <TouchableBox
      className="overflow-hidden border-continuous"
      onPress={onPress}
      disabled={disabled}
      style={[
        { opacity: disabled ? 0.6 : 1 },
        [
          { opacity: disabled ? 0.6 : 1 },
          { alignItems: 'center', paddingVertical: 8, width: ACTION_ITEM_WIDTH, gap: 8 },
        ],
      ]}
    >
      <Animated.View
        style={{
          opacity: disabled ? 0.4 : 1,
          transitionProperty: 'opacity',
          transitionDuration: 100,
          flexDirection: 'column',
          alignItems: 'center',
          gap: 8,
        }}
      >
        <Animated.View
          style={{
            width: ICON_BOX_SIZE,
            height: ICON_BOX_SIZE,
            borderRadius: 16,
            backgroundColor:
              variant === 'emphasized' ? theme.colors.primary : theme.colors.lightGrey,
            alignItems: 'center',
            justifyContent: 'center',
            transitionProperty: ['backgroundColor', 'boxShadow'],
            transitionDuration: 100,
            ...(variant === 'emphasized' && {
              boxShadow: `0 2px 8px 0 ${theme.colors.primary}`,
            }),
            ...(isActive && {
              boxShadow: `inset 0 0 0 2px ${theme.colors.primary}`,
            }),
          }}
        >
          {Icon ? (
            <Icon size={ICON_SIZE} />
          ) : svgSource ? (
            <Image
              source={svgSource}
              style={{ width: ICON_SIZE, height: ICON_SIZE }}
              tintColor={variant === 'emphasized' ? theme.colors.reverse : iconColor}
              contentFit="contain"
            />
          ) : name ? (
            <FeatherIcon
              name={name}
              size={ICON_SIZE}
              color={variant === 'emphasized' ? theme.colors.reverse : iconColor}
            />
          ) : null}
        </Animated.View>
        <Text className="text-[10px] text-center text-default" numberOfLines={1}>
          {label}
        </Text>
      </Animated.View>
    </TouchableBox>
  )
}

export default ActionItem
