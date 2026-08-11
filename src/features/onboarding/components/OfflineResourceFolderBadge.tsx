import { Feather } from '@expo/vector-icons'
import Svg, { Defs, LinearGradient, Path, Stop } from 'react-native-svg'

import Box from '~common/ui/Box'
import type { OfflineSetupFolderVisual } from '../offlineSetupPresentation'

type OfflineResourceFolderBadgeProps = {
  visual: OfflineSetupFolderVisual
}

const OfflineResourceFolderBadge = ({ visual }: OfflineResourceFolderBadgeProps) => {
  const gradientId = `folder-badge-${visual.icon}`

  return (
    <Box width={44} height={40} overflow="visible">
      <Svg width={44} height={40} viewBox="0 0 44 40" fill="none">
        <Defs>
          <LinearGradient id={gradientId} x1="36" y1="12" x2="8" y2="38">
            <Stop stopColor={visual.colors.frontStart} />
            <Stop offset="1" stopColor={visual.colors.frontEnd} />
          </LinearGradient>
        </Defs>
        <Path
          d="M5 1H39C41.8 1 44 3.2 44 6V34C44 36.8 41.8 39 39 39H5C2.2 39 0 36.8 0 34V6C0 3.2 2.2 1 5 1Z"
          fill={visual.colors.back}
        />
        <Path d="M7 6H37C39.2 6 41 7.8 41 10V31H3V10C3 7.8 4.8 6 7 6Z" fill="#FFFDF8" />
        <Path
          d="M0 16C0 13.2 2.2 11 5 11H18.5C22 11 23.5 11.8 25.3 15C26.2 16.6 27.7 17 29.5 17H39C41.8 17 44 19.2 44 22V34C44 36.8 41.8 39 39 39H5C2.2 39 0 36.8 0 34V16Z"
          fill={`url(#${gradientId})`}
        />
      </Svg>
      <Box
        position="absolute"
        left={5}
        top={14}
        size={17}
        borderRadius={6}
        bg="rgba(255,255,255,0.84)"
        center
      >
        <Feather name={visual.icon} size={10} color={visual.colors.icon} />
      </Box>
    </Box>
  )
}

export default OfflineResourceFolderBadge
