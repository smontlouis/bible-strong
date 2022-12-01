import { PrimitiveAtom, useAtom } from 'jotai'
import React, { forwardRef, useEffect, useImperativeHandle } from 'react'
import { Image, useWindowDimensions } from 'react-native'
import {
  TapGestureHandler,
  TapGestureHandlerGestureEvent,
} from 'react-native-gesture-handler'
import { Layout, ZoomOut } from 'react-native-reanimated'

import { useTheme } from '@emotion/react'
import {
  Easing,
  Extrapolate,
  interpolate,
  measure,
  runOnJS,
  useAnimatedGestureHandler,
  useAnimatedRef,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated'
import CommentIcon from '~common/CommentIcon'
import DictionnaryIcon from '~common/DictionnaryIcon'
import LexiqueIcon from '~common/LexiqueIcon'
import NaveIcon from '~common/NaveIcon'
import Box, { AnimatedBox, BoxProps } from '~common/ui/Box'
import { FeatherIcon } from '~common/ui/Icon'
import Text from '~common/ui/Text'
import {
  activeTabIndexAtom,
  activeTabPropertiesAtom,
  TabItem,
  TabProperties,
} from '../../state/tabs'
import { TAB_PREVIEW_SCALE } from './AppSwitcherScreen/AppSwitcherScreen'
import { useAppSwitcherContext } from './AppSwitcherProvider'

interface TabPreviewProps {
  index: number
  tabAtom: PrimitiveAtom<TabItem>
  tapGestureRef: React.RefObject<TapGestureHandler>
  simultaneousHandlers?: React.Ref<unknown> | React.Ref<unknown>[] | undefined
  onPress: (x: TabProperties & { index: number }) => void
  onDelete: (idx: number) => void
}

const getIconType = (type: TabItem['type'], size = 18) => {
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

const TabPreview = forwardRef<any, TabPreviewProps & BoxProps>(
  ({
    index,
    tabAtom,
    tapGestureRef,
    simultaneousHandlers,
    onPress,
    onDelete,
    ...props
  }) => {
    const { height: HEIGHT, width: WIDTH } = useWindowDimensions()
    const [tab] = useAtom(tabAtom)
    const [activeTabIndex] = useAtom(activeTabIndexAtom)
    const [activeTabProperties] = useAtom(activeTabPropertiesAtom)
    const theme = useTheme()

    const isActiveTabNotInitialized =
      index === activeTabIndex && !activeTabProperties

    // @ts-ignore: FIXME(TS) correct type for createAnimatedComponent
    const ref = useAnimatedRef<AnimatedBox>()
    const { isBottomTabBarVisible } = useAppSwitcherContext()
    const animationProgress = useSharedValue(isActiveTabNotInitialized ? 1 : 0)
    const x = useSharedValue(0)
    const y = useSharedValue(0)
    const zIndex = useSharedValue(2)

    const handler = useAnimatedGestureHandler<TapGestureHandlerGestureEvent>({
      onFinish: (_evt, _ctx, isCanceledOrFailed) => {
        if (isCanceledOrFailed) {
          return
        }

        // measure the image
        // width/height and position to animate from it to the full screen one
        const measurements = measure(ref)

        zIndex.value = 3
        x.value = measurements.pageX
        y.value = measurements.pageY

        runOnJS(handlePress)()
      },
    })

    const closeButtonHandler = useAnimatedGestureHandler<
      TapGestureHandlerGestureEvent
    >({
      onFinish: () => {
        zIndex.value = 1
        runOnJS(onDelete)(index)
      },
    })

    function handlePress() {
      isBottomTabBarVisible.value = withTiming(1)
      onPress({ index, x, y, animationProgress })
    }

    // @ts-ignore
    useImperativeHandle(tapGestureRef, () => ({
      open: handlePress,
    }))

    const styles = useAnimatedStyle(() => {
      const interpolateProgress = (
        range: [number, number],
        easingFn = (val: number) => val
      ) =>
        interpolate(
          easingFn(animationProgress.value),
          [0, 1],
          range,
          Extrapolate.CLAMP
        )
      return {
        width: WIDTH * TAB_PREVIEW_SCALE,
        height: HEIGHT * TAB_PREVIEW_SCALE,
        opacity: interpolateProgress([1, 0], Easing.bezierFn(1, 0, 1, 0)),
        transform: [
          {
            scale: interpolateProgress([1, 1 / TAB_PREVIEW_SCALE]),
          },
        ],
      }
    })

    const textStyles = useAnimatedStyle(() => {
      return {
        opacity: withTiming(typeof activeTabIndex !== 'undefined' ? 0 : 1),
      }
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

    // Initialize the active tab properties for selected item the first time
    useEffect(() => {
      if (isActiveTabNotInitialized) {
        x.value = 0
        y.value = 0

        runOnJS(handlePress)()
      }
    }, [])

    return (
      <TapGestureHandler
        onGestureEvent={handler}
        ref={tapGestureRef}
        simultaneousHandlers={simultaneousHandlers}
        maxDist={1}
      >
        <AnimatedBox
          layout={Layout}
          exiting={ZoomOut}
          overflow="visible"
          style={useAnimatedStyle(() => ({
            zIndex: zIndex.value,
          }))}
          {...props}
        >
          <AnimatedBox
            style={textStyles}
            marginLeft={20}
            row
            alignItems="center"
            position="absolute"
            bottom={-30}
            left={0}
          >
            {getIconType(tab.type)}
            <Text ml={8} fontSize={16} title>
              {tab.title}
            </Text>
          </AnimatedBox>
          <AnimatedBox
            ref={ref}
            borderRadius={25}
            bg="reverse"
            center
            overflow="visible"
            style={[
              styles,
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
        </AnimatedBox>
      </TapGestureHandler>
    )
  }
)

export default TabPreview
