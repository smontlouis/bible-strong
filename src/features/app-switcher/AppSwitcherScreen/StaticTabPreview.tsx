import Color from 'color'
import React from 'react'
import { Image, StyleSheet } from 'react-native'

import { useTheme } from '@emotion/react'
import { LinearGradient } from 'expo-linear-gradient'
import Box, { BoxProps } from '~common/ui/Box'
import { FeatherIcon } from '~common/ui/Icon'
import Text from '~common/ui/Text'
import { TabItem } from '../../../state/tabs'
import getIconByTabType from '../utils/getIconByTabType'
import useTabConstants from '../utils/useTabConstants'

interface StaticTabPreviewProps {
  tab: TabItem
  index: number
}

/**
 * Version statique de TabPreview pour les groupes non-actifs.
 * N'utilise pas d'atoms Jotai - affichage simple et performant.
 * Doit être visuellement identique à TabPreview.
 */
const StaticTabPreview = ({ tab, index, ...props }: StaticTabPreviewProps & BoxProps) => {
  const theme = useTheme()
  const { GAP, TAB_PREVIEW_WIDTH, TAB_PREVIEW_HEIGHT, TAB_BORDER_RADIUS } = useTabConstants()

  return (
    <Box
      overflow="visible"
      marginBottom={GAP}
      width={TAB_PREVIEW_WIDTH}
      height={TAB_PREVIEW_HEIGHT}
      style={{ position: 'relative', zIndex: 2 }}
      {...props}
    >
      <Box
        bg="reverse"
        center
        overflow="visible"
        width={TAB_PREVIEW_WIDTH}
        height={TAB_PREVIEW_HEIGHT}
        borderRadius={TAB_BORDER_RADIUS}
        style={{
          shadowColor: theme.colors.default,
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.1,
          shadowRadius: 7,
          elevation: 2,
        }}
      >
        {tab.base64Preview && (
          <Image
            style={{
              width: '100%',
              height: '100%',
              borderRadius: 20,
              opacity: 0.15,
              ...StyleSheet.absoluteFillObject,
            }}
            source={{ uri: `data:image/png;base64,${tab.base64Preview}` }}
          />
        )}
        <Box center width={80} height={80} borderRadius={40} backgroundColor="reverse">
          <Box>{getIconByTabType(tab.type, 30)}</Box>
        </Box>
        <LinearGradient
          start={[0, 0]}
          end={[0, 1]}
          style={{
            height: 60,
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            borderTopLeftRadius: 20,
            borderTopRightRadius: 20,
          }}
          colors={[
            `${Color(theme.colors.reverse).alpha(1).string()}`,
            `${Color(theme.colors.reverse).alpha(0).string()}`,
          ]}
        />

        {/* Title bar - identique à TabPreview */}
        <Box
          row
          alignItems="center"
          overflow="visible"
          position="absolute"
          top={0}
          left={0}
          right={40}
          height={40}
          pl={14}
          pr={5}
        >
          {getIconByTabType(tab.type, 16)}
          <Text ml={8} fontSize={12} title numberOfLines={1} ellipsizeMode="middle">
            {tab.title}
          </Text>
        </Box>

        {/* X button - non-interactif mais visible pour cohérence visuelle */}
        {tab.isRemovable && (
          <Box position="absolute" top={0} right={0} width={40} height={40} center>
            <Box bg="reverse" width={24} height={24} borderRadius={12} center lightShadow>
              <FeatherIcon name="x" size={16} />
            </Box>
          </Box>
        )}
      </Box>
    </Box>
  )
}

export default StaticTabPreview
