import Color from 'color'
import { useAtomValue } from 'jotai/react'
import { PrimitiveAtom } from 'jotai/vanilla'
import React from 'react'
import { Image, StyleSheet } from 'react-native'

import { useTheme } from '@emotion/react'
import { LinearGradient } from 'expo-linear-gradient'
import Box, { AnimatedBox, AnimatedTouchableBox, BoxProps } from '~common/ui/Box'
import { FeatherIcon } from '~common/ui/Icon'
import Text from '~common/ui/Text'
import { TabItem } from '../../../state/tabs'
import TabIcon from '../utils/getIconByTabType'
import useTabConstants from '../utils/useTabConstants'
import useTabPreview from './useTabPreview'
import { LinearTransition, ZoomIn, ZoomOut } from 'react-native-reanimated'

// Styles statiques hors du composant pour éviter les re-créations
const styles = StyleSheet.create({
  previewImage: {
    width: '100%',
    height: '100%',
    borderRadius: 20,
    opacity: 0.15,
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  gradient: {
    height: 60,
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
})

interface TabPreviewProps {
  index: number
  tabAtom: PrimitiveAtom<TabItem>
  groupId: string
}

const TabPreview = ({ index, tabAtom, groupId, ...props }: TabPreviewProps & BoxProps) => {
  const theme = useTheme()
  const tab = useAtomValue(tabAtom)

  const { base64Preview, type, isRemovable } = tab

  const { GAP, TAB_PREVIEW_WIDTH, TAB_PREVIEW_HEIGHT } = useTabConstants()

  const { ref, boxStyles, previewImageStyles, textStyles, xStyles, onOpen, onClose } =
    useTabPreview({
      index,
      tabAtom,
      groupId,
    })

  return (
    <AnimatedBox
      marginBottom={GAP}
      overflow="visible"
      style={boxStyles}
      width={TAB_PREVIEW_WIDTH}
      height={TAB_PREVIEW_HEIGHT}
      layout={LinearTransition}
      entering={ZoomIn}
      exiting={ZoomOut}
    >
      <AnimatedTouchableBox
        overflow="visible"
        width={TAB_PREVIEW_WIDTH}
        height={TAB_PREVIEW_HEIGHT}
        onPress={onOpen}
        {...props}
      >
        <AnimatedBox
          ref={ref}
          bg="reverse"
          center
          overflow="visible"
          style={[
            previewImageStyles,
            {
              shadowColor: theme.colors.default,
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.1,
              shadowRadius: 7,
              elevation: 2,
            },
          ]}
        >
          <>
            {base64Preview && (
              <Image
                style={styles.previewImage}
                source={{ uri: `data:image/png;base64,${base64Preview}` }}
              />
            )}
            <Box center width={80} height={80} borderRadius={40} backgroundColor="reverse">
              <Box>
                <TabIcon type={type} size={30} />
              </Box>
            </Box>
            <LinearGradient
              start={[0, 0]}
              end={[0, 1]}
              style={styles.gradient}
              colors={[
                Color(theme.colors.reverse).alpha(1).string(),
                Color(theme.colors.reverse).alpha(0).string(),
              ]}
            />
          </>

          <AnimatedTouchableBox
            style={textStyles}
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
            <TabIcon type={type} size={16} />
            <Title tabAtom={tabAtom} />
          </AnimatedTouchableBox>

          {isRemovable && (
            <AnimatedTouchableBox
              position="absolute"
              top={0}
              right={0}
              width={40}
              height={40}
              center
              style={xStyles}
              onPress={onClose}
            >
              <Box bg="reverse" width={24} height={24} borderRadius={12} center lightShadow>
                <FeatherIcon name="x" size={16} />
              </Box>
            </AnimatedTouchableBox>
          )}
        </AnimatedBox>
      </AnimatedTouchableBox>
    </AnimatedBox>
  )
}

const Title = ({ tabAtom }: { tabAtom: PrimitiveAtom<TabItem> }) => {
  const tab = useAtomValue(tabAtom)
  return (
    <Text ml={8} fontSize={12} title numberOfLines={1} ellipsizeMode="middle">
      {tab.title}
    </Text>
  )
}

export default TabPreview
