import { useAtomValue } from 'jotai/react'
import { PrimitiveAtom } from 'jotai/vanilla'
import React, { memo, useMemo } from 'react'
import { Image, StyleSheet } from 'react-native'
import { FadeIn, Layout, ZoomOut } from 'react-native-reanimated'

import { useTheme } from '@emotion/react'
import { selectAtom } from 'jotai/vanilla/utils'
import Box, {
  AnimatedBox,
  AnimatedTouchableBox,
  BoxProps,
  TouchableBox,
} from '~common/ui/Box'
import { FeatherIcon } from '~common/ui/Icon'
import Text from '~common/ui/Text'
import { TabItem } from '../../../state/tabs'
import getIconByTabType from '../utils/getIconByTabType'
import useTabConstants from '../utils/useTabConstants'
import useTabPreview from './useTabPreview'

interface TabPreviewProps {
  index: number
  tabAtom: PrimitiveAtom<TabItem>
}

const TabPreview = ({
  index,
  tabAtom,
  ...props
}: TabPreviewProps & BoxProps) => {
  const theme = useTheme()

  const base64Preview = useAtomValue(
    useMemo(() => selectAtom(tabAtom, tab => tab.base64Preview), [])
  )
  const title = useAtomValue(
    useMemo(() => selectAtom(tabAtom, tab => tab.title), [])
  )
  const type = useAtomValue(
    useMemo(() => selectAtom(tabAtom, tab => tab.type), [])
  )
  const isRemovable = useAtomValue(
    useMemo(() => selectAtom(tabAtom, tab => tab.isRemovable), [])
  )

  const {
    GAP,
    TAB_PREVIEW_WIDTH,
    TAB_PREVIEW_HEIGHT,
    TEXTBOX_HEIGHT,
  } = useTabConstants()

  const {
    ref,
    boxStyles,
    previewImageStyles,
    textStyles,
    xStyles,
    onOpen,
    onClose,
  } = useTabPreview({
    index,
    tabAtom,
  })

  return (
    <AnimatedTouchableBox
      layout={Layout}
      entering={FadeIn}
      exiting={ZoomOut}
      overflow="visible"
      style={boxStyles}
      marginBottom={GAP}
      width={TAB_PREVIEW_WIDTH}
      height={TAB_PREVIEW_HEIGHT + TEXTBOX_HEIGHT}
      onPress={onOpen}
      activeOpacity={0.8}
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
              style={{
                width: '100%',
                height: '100%',
                borderRadius: 20,
                opacity: 0.8,
                ...StyleSheet.absoluteFillObject,
              }}
              source={{ uri: `data:image/png;base64,${base64Preview}` }}
            />
          )}
          <Box
            center
            width={80}
            height={80}
            borderRadius={20}
            backgroundColor="lightGrey"
            opacity={0.7}
          >
            <Box>{getIconByTabType(type, 30)}</Box>
          </Box>
        </>

        {isRemovable && (
          <AnimatedTouchableBox
            position="absolute"
            top={0}
            right={0}
            width={40}
            height={40}
            center
            activeOpacity={1}
            style={xStyles}
            onPress={onClose}
          >
            <Box
              bg="reverse"
              width={24}
              height={24}
              borderRadius={12}
              center
              lightShadow
            >
              <FeatherIcon name="x" size={16} />
            </Box>
          </AnimatedTouchableBox>
        )}
      </AnimatedBox>
      <AnimatedTouchableBox
        style={textStyles}
        marginTop={10}
        row
        alignItems="center"
        justifyContent="center"
        overflow="visible"
      >
        {getIconByTabType(type, 16)}
        <Text
          ml={8}
          fontSize={12}
          title
          numberOfLines={1}
          ellipsizeMode="middle"
        >
          {title}
        </Text>
      </AnimatedTouchableBox>
    </AnimatedTouchableBox>
  )
}

export default memo(TabPreview)
