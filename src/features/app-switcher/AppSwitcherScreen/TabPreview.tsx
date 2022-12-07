import { PrimitiveAtom, useAtomValue } from 'jotai'
import React, { memo } from 'react'
import { Image } from 'react-native'
import { TapGestureHandler } from 'react-native-gesture-handler'
import { FadeIn, Layout, ZoomIn, ZoomOut } from 'react-native-reanimated'

import { useTheme } from '@emotion/react'
import CommentIcon from '~common/CommentIcon'
import DictionnaryIcon from '~common/DictionnaryIcon'
import LexiqueIcon from '~common/LexiqueIcon'
import NaveIcon from '~common/NaveIcon'
import Box, { AnimatedBox, BoxProps } from '~common/ui/Box'
import { FeatherIcon } from '~common/ui/Icon'
import Text from '~common/ui/Text'
import { TabItem } from '../../../state/tabs'
import useTabConstants from '../utils/useTabConstants'
import useTabPreview from './useTabPreview'

interface TabPreviewProps {
  index: number
  tabAtom: PrimitiveAtom<TabItem>
  tapGestureRef: React.RefObject<TapGestureHandler>
  simultaneousHandlers?: React.Ref<unknown> | React.Ref<unknown>[] | undefined
}

const getIconType = (type: TabItem['type'], size = 14) => {
  switch (type) {
    case 'bible':
      return <FeatherIcon name="book-open" size={size} />
    case 'compare':
      return <FeatherIcon name="repeat" size={size} />
    case 'strong':
      return <LexiqueIcon width={size} height={size} />
    case 'commentary':
      return <CommentIcon width={size} height={size} color="#26A69A" />
    case 'dictionary':
      return <DictionnaryIcon width={size} height={size} />
    case 'search':
      return <FeatherIcon name="search" size={size} />
    case 'nave':
      return <NaveIcon width={size} height={size} />
    default:
      return <FeatherIcon name="x" size={size} />
  }
}

const TabPreview = ({
  index,
  tabAtom,
  tapGestureRef,
  simultaneousHandlers,
  ...props
}: TabPreviewProps & BoxProps) => {
  const theme = useTheme()
  const tab = useAtomValue(tabAtom)

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
    onTap,
    onClose,
  } = useTabPreview({
    index,
    tabAtom,
  })

  return (
    <TapGestureHandler
      onGestureEvent={onTap}
      ref={tapGestureRef}
      simultaneousHandlers={simultaneousHandlers}
      maxDist={1}
      maxDurationMs={500}
    >
      <AnimatedBox
        layout={Layout}
        entering={FadeIn}
        exiting={ZoomOut}
        overflow="visible"
        style={boxStyles}
        marginBottom={GAP}
        width={TAB_PREVIEW_WIDTH}
        height={TAB_PREVIEW_HEIGHT + TEXTBOX_HEIGHT}
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
              shadowOpacity: 0.3,
              shadowRadius: 10,
              elevation: 2,
            },
          ]}
        >
          {tab.base64Preview ? (
            <Image
              style={{ width: '100%', height: '100%', borderRadius: 25 }}
              source={{ uri: `data:image/png;base64,${tab.base64Preview}` }}
            />
          ) : (
            <Box opacity={0.3}>{getIconType(tab.type, 30)}</Box>
          )}
          {tab.isRemovable && (
            <TapGestureHandler
              onGestureEvent={onClose}
              maxDist={1}
              maxDurationMs={500}
            >
              <AnimatedBox
                position="absolute"
                top={0}
                right={0}
                width={40}
                height={40}
                center
                style={xStyles}
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
              </AnimatedBox>
            </TapGestureHandler>
          )}
        </AnimatedBox>
        <AnimatedBox
          style={textStyles}
          marginTop={10}
          row
          alignItems="center"
          justifyContent="center"
        >
          {getIconType(tab.type)}
          <Text ml={8} fontSize={12} title>
            {tab.title}
          </Text>
        </AnimatedBox>
      </AnimatedBox>
    </TapGestureHandler>
  )
}

export default memo(TabPreview)
