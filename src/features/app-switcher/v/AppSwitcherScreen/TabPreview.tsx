import { PrimitiveAtom, useAtom, useSetAtom } from 'jotai'
import React, { memo } from 'react'
import { Image } from 'react-native'
import {
  TapGestureHandler,
  TapGestureHandlerGestureEvent,
} from 'react-native-gesture-handler'
import { Layout, ZoomOut } from 'react-native-reanimated'

import { useTheme } from '@emotion/react'
import {
  Extrapolate,
  interpolate,
  measure,
  runOnJS,
  useAnimatedGestureHandler,
  useAnimatedRef,
  useAnimatedStyle,
  withTiming,
} from 'react-native-reanimated'
import CommentIcon from '~common/CommentIcon'
import DictionnaryIcon from '~common/DictionnaryIcon'
import LexiqueIcon from '~common/LexiqueIcon'
import NaveIcon from '~common/NaveIcon'
import Box, { AnimatedBox, BoxProps } from '~common/ui/Box'
import { FeatherIcon } from '~common/ui/Icon'
import Text from '~common/ui/Text'
import { tabTimingConfig } from '~features/app-switcher/utils/constants'
import { activeTabIndexAtom, TabItem } from '../../../../state/tabs'
import { useAppSwitcherContext } from '../../AppSwitcherProvider'
import useTabConstants from './useTabConstants'

interface TabPreviewProps {
  index: number
  tabAtom: PrimitiveAtom<TabItem>
  tapGestureRef: React.RefObject<TapGestureHandler>
  simultaneousHandlers?: React.Ref<unknown> | React.Ref<unknown>[] | undefined
  onDelete: (idx: number) => void
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
  onDelete,
  ...props
}: TabPreviewProps & BoxProps) => {
  const [tab] = useAtom(tabAtom)
  const setActiveTabIndex = useSetAtom(activeTabIndexAtom)
  const theme = useTheme()

  // @ts-ignore: FIXME(TS) correct type for createAnimatedComponent
  const ref = useAnimatedRef<AnimatedBox>()
  const { activeTabPreview, activeTabScreen } = useAppSwitcherContext()

  const { animationProgress } = activeTabPreview

  const {
    GAP,
    TAB_PREVIEW_WIDTH,
    TAB_PREVIEW_HEIGHT,
    TAB_BORDER_RADIUS,
    WIDTH,
    HEIGHT,
  } = useTabConstants()

  const onTap = useAnimatedGestureHandler<TapGestureHandlerGestureEvent>({
    onFinish: (_evt, _ctx, isCanceledOrFailed) => {
      if (isCanceledOrFailed) {
        return
      }

      // measure the image
      // width/height and position to animate from it to the full screen one
      const measurements = measure(ref)

      activeTabPreview.zIndex.value = 3
      activeTabPreview.left.value = measurements.pageX
      activeTabPreview.top.value = measurements.pageY
      activeTabPreview.index.value = index
      animationProgress.value = withTiming(1, tabTimingConfig, () => {
        runOnJS(setActiveTabIndex)(index)
        activeTabScreen.opacity.value = withTiming(1)
      })
    },
  })

  const closeButtonHandler = useAnimatedGestureHandler<
    TapGestureHandlerGestureEvent
  >({
    onFinish: () => {
      activeTabPreview.zIndex.value = 1
      runOnJS(onDelete)(index)
    },
  })

  const boxStyles = useAnimatedStyle(() => {
    if (activeTabPreview.index.value === index) {
      return {
        position: 'relative',
        zIndex: activeTabPreview.zIndex.value,
      }
    }
    return {}
  })

  const previewImageStyles = useAnimatedStyle(() => {
    if (activeTabPreview.index.value === index) {
      return {
        width: interpolate(
          animationProgress.value,
          [0, 1],
          [TAB_PREVIEW_WIDTH, WIDTH]
        ),
        height: interpolate(
          animationProgress.value,
          [0, 1],
          [TAB_PREVIEW_HEIGHT, HEIGHT]
        ),
        top: interpolate(
          animationProgress.value,
          [0, 1],
          [0, -activeTabPreview.top.value]
        ),
        left: interpolate(
          animationProgress.value,
          [0, 1],
          [0, -activeTabPreview.left.value]
        ),
        borderRadius: TAB_BORDER_RADIUS,
      }
    }

    return {
      width: TAB_PREVIEW_WIDTH,
      height: TAB_PREVIEW_HEIGHT,
      top: 0,
      left: 0,
      borderRadius: TAB_BORDER_RADIUS,
    }
  })

  const textStyles = useAnimatedStyle(() => {
    if (activeTabPreview.index.value === index) {
      return {
        top: interpolate(
          animationProgress.value,
          [0, 1],
          [0, -activeTabPreview.top.value]
        ),
        left: interpolate(
          animationProgress.value,
          [0, 1],
          [0, -activeTabPreview.left.value]
        ),
        opacity: interpolate(
          animationProgress.value,
          [0, 1],
          [1, 0],
          Extrapolate.CLAMP
        ),
      }
    }

    return {}
  })

  const xStyles = useAnimatedStyle(() => {
    return {
      opacity: interpolate(
        animationProgress.value,
        [0, 1],
        [1, 0],
        Extrapolate.CLAMP
      ),
    }
  })

  return (
    <TapGestureHandler
      onGestureEvent={onTap}
      ref={tapGestureRef}
      simultaneousHandlers={simultaneousHandlers}
      maxDist={1}
    >
      <AnimatedBox
        layout={Layout}
        exiting={ZoomOut}
        overflow="visible"
        style={boxStyles}
        marginBottom={GAP + 20}
        width={TAB_PREVIEW_WIDTH}
        height={TAB_PREVIEW_HEIGHT}
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
              backgroundColor: theme.colors.reverse,
              shadowColor: theme.colors.default,
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.1,
              shadowRadius: 20,
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
            <TapGestureHandler onGestureEvent={closeButtonHandler}>
              <AnimatedBox
                bg="reverse"
                width={24}
                height={24}
                borderRadius={12}
                center
                lightShadow
                style={[
                  xStyles,
                  {
                    position: 'absolute',
                    top: 10,
                    right: 10,
                  },
                ]}
              >
                <FeatherIcon name="x" size={14} />
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
