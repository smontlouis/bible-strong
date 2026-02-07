import { ScrollView, TouchableOpacity } from 'react-native'

import Box, { HStack } from '~common/ui/Box'
import { FeatherIcon } from '~common/ui/Icon'
import HighlightTypeIndicator from '~common/HighlightTypeIndicator'
import type { HighlightType } from '~redux/modules/user'
import { wp } from '~helpers/utils'
import { COLOR_CIRCLE_MIN_WIDTH } from '~helpers/constants'

export interface ColorItem {
  key: string
  hex: string
  type?: HighlightType
}

interface ColorCircleGridProps {
  colors: ColorItem[]
  selectedColor?: string
  onSelect: (colorKey: string) => void
  onLongPress?: (colorKey: string) => void
  circleSize?: number
  showAddButton?: boolean
  onAddPress?: () => void
  /**
   * Layout mode:
   * - 'scroll': Horizontal ScrollView with dynamic width (like ColorCirclesBar)
   * - 'grid': Flex wrap grid (like AnnotationColorSelector)
   */
  layout?: 'scroll' | 'grid'
  /**
   * For scroll layout: padding applied to container
   */
  scrollPadding?: { vertical?: number; horizontal?: number }
  /**
   * For scroll layout: height of items container
   */
  itemHeight?: number
}

const ColorCircleGrid = ({
  colors,
  selectedColor,
  onSelect,
  onLongPress,
  circleSize = 20,
  showAddButton = false,
  onAddPress,
  layout = 'scroll',
  scrollPadding,
  itemHeight = 60,
}: ColorCircleGridProps) => {
  if (layout === 'grid') {
    return (
      <HStack gap={8} wrap overflow="visible" justifyContent="flex-end">
        {colors.map(color => (
          <HighlightTypeIndicator
            key={color.key}
            color={color.hex}
            type={color.type || 'background'}
            onPress={() => onSelect(color.key)}
            onLongPress={onLongPress ? () => onLongPress(color.key) : undefined}
            size={circleSize}
            isSelected={selectedColor === color.key}
          />
        ))}
        {showAddButton && onAddPress && (
          <TouchableOpacity onPress={onAddPress}>
            <FeatherIcon name="arrow-right-circle" size={circleSize} color="tertiary" />
          </TouchableOpacity>
        )}
      </HStack>
    )
  }

  // Calculate dynamic item width for scroll layout
  const screenWidth = wp(100, 500)
  const itemCount = colors.length + (showAddButton ? 1 : 0)
  const itemWidth = Math.max(screenWidth / itemCount, COLOR_CIRCLE_MIN_WIDTH)

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: scrollPadding?.vertical,
        paddingHorizontal: scrollPadding?.horizontal,
      }}
    >
      {colors.map(color => (
        <Box key={color.key} width={itemWidth} height={itemHeight} center>
          <HighlightTypeIndicator
            color={color.hex}
            type={color.type || 'background'}
            onPress={() => onSelect(color.key)}
            onLongPress={onLongPress ? () => onLongPress(color.key) : undefined}
            size={circleSize}
            isSelected={selectedColor === color.key}
          />
        </Box>
      ))}
      {showAddButton && onAddPress && (
        <Box width={itemWidth} height={itemHeight} center>
          <TouchableOpacity onPress={onAddPress}>
            <FeatherIcon name="arrow-right-circle" size={circleSize} color="tertiary" />
          </TouchableOpacity>
        </Box>
      )}
    </ScrollView>
  )
}

export default ColorCircleGrid
