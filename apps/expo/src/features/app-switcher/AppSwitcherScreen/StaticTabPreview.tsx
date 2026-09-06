import { resolveFontFamily } from '~themes/styleValues'
import { useTheme as useStylingTheme, useTheme } from '~themes/ThemeProvider'
import { twMerge } from '~common/ui/classNames'
import Color from 'color'
import React from 'react'
import { Image, StyleSheet } from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import Box, { BoxProps } from '~common/ui/Box'
import { FeatherIcon } from '~common/ui/Icon'
import Text from '~common/ui/Text'
import { TabItem } from '../../../state/tabs'
import TabIcon from '../utils/getIconByTabType'
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
  const stylingTheme = useStylingTheme()

  const theme = useTheme()
  const { GAP, TAB_PREVIEW_WIDTH, TAB_PREVIEW_HEIGHT, TAB_BORDER_RADIUS } = useTabConstants()

  return (
    <Box
      style={[
        { marginBottom: GAP, width: TAB_PREVIEW_WIDTH, height: TAB_PREVIEW_HEIGHT },
        props.style,
        { position: 'relative', zIndex: 2 },
      ]}
      {...props}
      className={twMerge(
        'overflow-hidden border-continuous',
        twMerge('border-continuous overflow-visible', props.className)
      )}
    >
      <Box
        className="border-continuous overflow-visible bg-reverse items-center justify-center"
        style={[
          { width: TAB_PREVIEW_WIDTH, height: TAB_PREVIEW_HEIGHT, borderRadius: TAB_BORDER_RADIUS },
          {
            shadowColor: theme.colors.default,
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.1,
            shadowRadius: 7,
            elevation: 2,
          },
        ]}
      >
        {tab.base64Preview && (
          <Image
            style={{
              width: '100%',
              height: '100%',
              borderRadius: 20,
              opacity: 0.15,
              ...StyleSheet.absoluteFill,
            }}
            source={{ uri: `data:image/jpeg;base64,${tab.base64Preview}` }}
          />
        )}
        <Box className="overflow-hidden border-continuous items-center justify-center w-[80px] h-[80px] rounded-[40px] bg-reverse">
          <Box className="overflow-hidden border-continuous">
            <TabIcon type={tab.type} size={30} />
          </Box>
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
        <Box className="border-continuous overflow-visible flex-row items-center absolute top-[0px] left-[0px] right-[40px] h-[40px] pl-[14px] pr-[5px]">
          <TabIcon type={tab.type} size={16} />
          <Text
            className="ml-[8px] text-[12px]"
            numberOfLines={1}
            ellipsizeMode="middle"
            style={{ fontFamily: resolveFontFamily(stylingTheme.fontFamily.title) }}
          >
            {tab.title}
          </Text>
        </Box>

        {/* X button - non-interactif mais visible pour cohérence visuelle */}
        {tab.isRemovable && (
          <Box className="overflow-hidden border-continuous absolute top-[0px] right-[0px] w-[40px] h-[40px] items-center justify-center">
            <Box
              className="overflow-hidden border-continuous bg-reverse w-[24px] h-[24px] rounded-[12px] items-center justify-center"
              style={{
                shadowColor: 'rgb(89,131,240)',
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.1,
                shadowRadius: 7,
                elevation: 1,
                overflow: 'visible',
              }}
            >
              <FeatherIcon name="x" size={16} />
            </Box>
          </Box>
        )}
      </Box>
    </Box>
  )
}

export default StaticTabPreview
