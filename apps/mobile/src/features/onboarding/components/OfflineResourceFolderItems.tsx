import { LinearGradient } from 'expo-linear-gradient'
import Animated, { FadeInDown, FadeOutDown, useReducedMotion } from 'react-native-reanimated'

import Box from '~common/ui/Box'
import type { OfflineSetupFolderVisual } from '../offlineSetupPresentation'

type OfflineResourceFolderItemsProps = {
  colors: OfflineSetupFolderVisual['colors']
  itemCount: number
  width: number
}

const OfflineResourceFolderItems = ({
  colors,
  itemCount,
  width,
}: OfflineResourceFolderItemsProps) => {
  const scale = width / 170
  const scaled = (value: number) => value * scale
  const visibleItemCount = Math.max(0, Math.floor(itemCount))
  const maxFanSpread = scaled(120)
  const regularCardGap = maxFanSpread / 7
  const cardGap = visibleItemCount > 8 ? maxFanSpread / (visibleItemCount - 1) : regularCardGap
  const reduceMotion = useReducedMotion()

  return Array.from({ length: visibleItemCount }, (_, index) => {
    const centeredIndex = index - (visibleItemCount - 1) / 2
    const translateX = centeredIndex * cardGap
    const fanProgress = visibleItemCount > 1 ? translateX / (maxFanSpread / 2) : 0
    const translateY = scaled(14 + Math.abs(fanProgress) * 3)
    const rotation = fanProgress * 10

    return (
      <Animated.View
        key={`folder-file-${index}`}
        entering={
          reduceMotion
            ? undefined
            : FadeInDown.springify()
                .damping(15)
                .stiffness(190)
                .mass(0.55)
                .delay(Math.min(index, 7) * 24)
        }
        exiting={reduceMotion ? undefined : FadeOutDown.duration(130)}
        style={{
          position: 'absolute',
          left: scaled(62.5),
          top: scaled(5),
          zIndex: 1,
        }}
      >
        <Animated.View
          style={{
            width: scaled(45),
            height: scaled(50),
            borderRadius: scaled(7),
            overflow: 'hidden',
            borderWidth: scaled(0.7),
            borderColor: 'rgba(255,255,255,0.86)',
            boxShadow: `0 ${scaled(3)}px ${scaled(8)}px rgba(31,49,79,0.2)`,
            transform: [{ translateX }, { translateY }, { rotate: `${rotation}deg` }],
            transitionProperty: 'transform',
            transitionDuration: 240,
            transitionTimingFunction: 'ease-out',
          }}
        >
          <LinearGradient
            colors={['rgba(255,255,255,0.98)', colors.back]}
            start={{ x: 0.15, y: 0 }}
            end={{ x: 0.9, y: 1 }}
            style={{ flex: 1, padding: scaled(7) }}
          >
            <Box
              width={scaled(14)}
              height={scaled(2.5)}
              borderRadius={scaled(1.25)}
              bg={colors.frontEnd}
              opacity={0.72}
            />
            <Box
              width={scaled(9)}
              height={scaled(2.5)}
              borderRadius={scaled(1.25)}
              bg={colors.frontEnd}
              opacity={0.38}
              mt={scaled(3)}
            />
          </LinearGradient>
        </Animated.View>
      </Animated.View>
    )
  })
}

export default OfflineResourceFolderItems
