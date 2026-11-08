import { useState, type ComponentProps, type ReactNode } from 'react'
import { LinearGradient } from 'expo-linear-gradient'
import ResourceIcon from '~common/icons/ResourceIcon'
import Box, { HStack, TouchableBox } from '~common/ui/Box'
import { FeatherIcon } from '~common/ui/Icon'
import Text from '~common/ui/Text'
import { colorWithOpacity } from '~themes/colorValues'
import { useTheme } from '~themes/ThemeProvider'
import { resolveUniverseColors } from '~themes/universeColors'

export type QuoteMark =
  | ComponentProps<typeof ResourceIcon>['kind']
  | 'person'
  | 'place'
  | 'timeline'

/**
 * A resource quoted in the flow of an answer, as a reader quotes a source (2026-11-08): no frame
 * and no tinted bubble, a rule in the resource's colour, a preview of its content, then a foot
 * line with its mark and name. The whole block opens the resource when `onPress` is given.
 */
export function QuoteBlock({
  mark,
  foot,
  onPress,
  children,
}: {
  mark: QuoteMark
  foot: string
  onPress?: () => void
  children: ReactNode
}) {
  const { colors } = useTheme()
  const rule = resolveUniverseColors(
    colors,
    mark === 'person' || mark === 'place' ? 'word' : mark
  ).foreground
  return (
    <TouchableBox
      accessibilityRole={onPress ? 'button' : undefined}
      disabled={!onPress}
      onPress={onPress}
      className="my-3 flex-row items-center gap-3"
    >
      <Box className="flex-1 pl-[14px]" style={{ borderLeftWidth: 2, borderLeftColor: rule }}>
        {children}
        <HStack className="mt-[6px] items-center gap-[6px]">
          {mark === 'person' || mark === 'place' || mark === 'timeline' ? (
            <FeatherIcon
              name={mark === 'person' ? 'user' : mark === 'place' ? 'map-pin' : 'clock'}
              size={13}
              color="grey"
            />
          ) : (
            <ResourceIcon kind={mark} size={14} />
          )}
          <Text className="text-link flex-1 text-[13px]" numberOfLines={1}>
            {foot}
          </Text>
        </HStack>
      </Box>
      {onPress && <FeatherIcon name="chevron-right" size={16} color="link" />}
    </TouchableBox>
  )
}

/** A preview cut at `maxHeight`, faded into the page only when its content is taller. */
export function QuoteCut({ maxHeight, children }: { maxHeight: number; children: ReactNode }) {
  const { colors } = useTheme()
  const [tall, setTall] = useState(false)
  return (
    <Box style={{ maxHeight, overflow: 'hidden' }}>
      <Box onLayout={event => setTall(event.nativeEvent.layout.height > maxHeight)}>{children}</Box>
      {tall && (
        <LinearGradient
          pointerEvents="none"
          colors={[colorWithOpacity(colors.reverse, 0) || 'transparent', colors.reverse]}
          style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 40 }}
        />
      )}
    </Box>
  )
}

/** The rest of a list, shown on demand. */
export function QuoteMore({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <TouchableBox accessibilityRole="button" onPress={onPress} className="self-start py-1">
      <Text className="text-link text-[14px]">{label}</Text>
    </TouchableBox>
  )
}
