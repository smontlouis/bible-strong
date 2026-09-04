import { Feather } from '@expo/vector-icons'
import Svg, { Defs, LinearGradient, Path, Stop } from 'react-native-svg'

import Box from '~common/ui/Box'
import type { OfflineSetupFolderVisual } from '../offlineSetupPresentation'
import OfflineResourceFolderBounce from './OfflineResourceFolderBounce'
import OfflineResourceFolderItems from './OfflineResourceFolderItems'

type OfflineResourceFolderBadgeProps = {
  itemCount: number
  visual: OfflineSetupFolderVisual
  width?: number
}

const OfflineResourceFolderBadge = ({
  itemCount,
  visual,
  width = 44,
}: OfflineResourceFolderBadgeProps) => {
  const gradientId = `folder-badge-${visual.icon}`
  const scale = width / 44
  const height = width * (40 / 44)

  return (
    <Box width={width} height={height} overflow="visible">
      <OfflineResourceFolderBounce itemCount={itemCount} width={width}>
        <Svg
          width="100%"
          height="100%"
          viewBox="0 0 44 40"
          fill="none"
          style={{ position: 'absolute', zIndex: 0 }}
        >
          <Path
            d="M5 1H39C41.8 1 44 3.2 44 6V34C44 36.8 41.8 39 39 39H5C2.2 39 0 36.8 0 34V6C0 3.2 2.2 1 5 1Z"
            fill={visual.colors.back}
          />
          <Path d="M7 6H37C39.2 6 41 7.8 41 10V31H3V10C3 7.8 4.8 6 7 6Z" fill="#FFFDF8" />
        </Svg>

        <OfflineResourceFolderItems colors={visual.colors} itemCount={itemCount} width={width} />

        <Svg
          width="100%"
          height="100%"
          viewBox="0 0 44 40"
          fill="none"
          style={{ position: 'absolute', zIndex: 10 }}
        >
          <Defs>
            <LinearGradient id={gradientId} x1="36" y1="12" x2="8" y2="38">
              <Stop stopColor={visual.colors.frontStart} />
              <Stop offset="1" stopColor={visual.colors.frontEnd} />
            </LinearGradient>
          </Defs>
          <Path
            d="M0 16C0 13.2 2.2 11 5 11H18.5C22 11 23.5 11.8 25.3 15C26.2 16.6 27.7 17 29.5 17H39C41.8 17 44 19.2 44 22V34C44 36.8 41.8 39 39 39H5C2.2 39 0 36.8 0 34V16Z"
            fill={`url(#${gradientId})`}
          />
        </Svg>
        <Box
          position="absolute"
          left={5 * scale}
          top={14 * scale}
          size={17 * scale}
          borderRadius={6 * scale}
          bg="rgba(255,255,255,0.84)"
          zIndex={20}
          center
        >
          <Feather name={visual.icon} size={10 * scale} color={visual.colors.icon} />
        </Box>
      </OfflineResourceFolderBounce>
    </Box>
  )
}

export default OfflineResourceFolderBadge
