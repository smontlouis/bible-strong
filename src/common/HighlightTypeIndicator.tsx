import React from 'react'
import { View } from 'react-native'
import styled from '@emotion/native'
import { useTheme } from '@emotion/react'
import Text from '~common/ui/Text'
import type { HighlightType } from '~redux/modules/user'

const Touchable = styled.TouchableOpacity({
  alignItems: 'center',
  justifyContent: 'center',
})

const CircleContainer = styled.View<{ color: string; size: number }>(({ color, size }) => ({
  width: size,
  height: size,
  borderRadius: size / 3,
  backgroundColor: color,
}))

const TextContainer = styled.View<{ size: number }>(({ size }) => ({
  width: size,
  height: size,
  alignItems: 'center',
  justifyContent: 'center',
  boxShadow: 'inset 0 0 2px 0 rgba(0, 0, 0, 0.15)',
  borderRadius: size / 3,
}))

type Props = {
  color: string
  type?: HighlightType
  size?: number
  onPress?: () => void
  onLongPress?: () => void
  disabled?: boolean
}

const HighlightTypeIndicator = ({
  color,
  type = 'background',
  size = 30,
  onPress,
  onLongPress,
  disabled = false,
}: Props) => {
  const theme = useTheme()
  const fontSize = size * 0.85

  const renderIndicator = () => {
    switch (type) {
      case 'textColor':
        return (
          <TextContainer size={size}>
            <Text
              style={{
                fontSize,
                fontWeight: 'bold',
                color: color,
              }}
            >
              A
            </Text>
          </TextContainer>
        )

      case 'underline':
        return (
          <TextContainer size={size}>
            <Text
              style={{
                fontSize,
                fontWeight: 'bold',
                color: theme.colors.darkGrey,
                opacity: 0.6,
              }}
            >
              A
            </Text>
            <View
              style={{
                position: 'absolute',
                bottom: 0,
                left: size * 0.15,
                right: size * 0.15,
                height: size * 0.2,
                borderWidth: size * 0.05,
                borderColor: theme.colors.reverse,
                backgroundColor: color,
                borderRadius: size * 0.3,
              }}
            />
          </TextContainer>
        )

      case 'background':
      default:
        return <CircleContainer color={color} size={size} />
    }
  }

  if (onPress || onLongPress) {
    return (
      <Touchable onPress={onPress} onLongPress={onLongPress} disabled={disabled} hitSlop={10}>
        {renderIndicator()}
      </Touchable>
    )
  }

  return renderIndicator()
}

export default HighlightTypeIndicator
