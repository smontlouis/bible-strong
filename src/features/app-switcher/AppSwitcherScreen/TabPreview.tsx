import { PrimitiveAtom, useAtom } from 'jotai'
import React, { memo, useEffect } from 'react'
import { Image } from 'react-native'
import {
  TapGestureHandler,
  TapGestureHandlerGestureEvent,
} from 'react-native-gesture-handler'
import { Layout, runOnUI, scrollTo, ZoomOut } from 'react-native-reanimated'

import { useTheme } from '@emotion/react'
import {
  Extrapolate,
  interpolate,
  measure,
  runOnJS,
  useAnimatedGestureHandler,
  useAnimatedRef,
  useAnimatedStyle,
} from 'react-native-reanimated'
import CommentIcon from '~common/CommentIcon'
import DictionnaryIcon from '~common/DictionnaryIcon'
import LexiqueIcon from '~common/LexiqueIcon'
import NaveIcon from '~common/NaveIcon'
import Box, { AnimatedBox, BoxProps } from '~common/ui/Box'
import { FeatherIcon } from '~common/ui/Icon'
import Text from '~common/ui/Text'
import { useTabAnimations } from '~features/app-switcher/utils/worklets'
import { TabItem } from '../../../state/tabs'
import { useAppSwitcherContext } from '../AppSwitcherProvider'
import useTabConstants from '../utils/useTabConstants'
import useMeasureTabPreview from '../utils/useMesureTabPreview'
import wait from '~helpers/wait'

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
  const theme = useTheme()

  const { activeTabPreview, tabPreviews, scrollView } = useAppSwitcherContext()
  const measureTabPreview = useMeasureTabPreview()
  // @ts-ignore: FIXME(TS) correct type for createAnimatedComponent
  tabPreviews.refs[index] = useAnimatedRef<AnimatedBox>()
  const ref = tabPreviews.refs[index]

  const { expandTab } = useTabAnimations()

  const {
    GAP,
    TAB_PREVIEW_WIDTH,
    TAB_PREVIEW_HEIGHT,
    TAB_BORDER_RADIUS,
    TEXTBOX_HEIGHT,
    WIDTH,
    HEIGHT,
    STATUS_BAR_HEIGHT,
    SCREEN_MARGIN,
  } = useTabConstants()

  // On mount, measure the initial tab preview
  useEffect(() => {
    if (index === activeTabPreview.index.value) {
      ;(async () => {
        await wait(300)
        const { pageX, pageY } = await measureTabPreview(index)
        activeTabPreview.top.value = pageY
        activeTabPreview.left.value = pageX

        const scrollToTop = pageY - STATUS_BAR_HEIGHT - SCREEN_MARGIN
        runOnUI(scrollTo)(scrollView.ref, 0, scrollToTop, false)
      })()
    }
  }, [])

  const onTap = useAnimatedGestureHandler<TapGestureHandlerGestureEvent>({
    onFinish: (_evt, _ctx, isCanceledOrFailed) => {
      if (isCanceledOrFailed) {
        return
      }

      // measure the image
      // width/height and position to animate from it to the full screen one
      const measurements = measure(ref)
      expandTab({ index, left: measurements.pageX, top: measurements.pageY })
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
          activeTabPreview.animationProgress.value,
          [0, 1],
          [TAB_PREVIEW_WIDTH, WIDTH]
        ),
        height: interpolate(
          activeTabPreview.animationProgress.value,
          [0, 1],
          [TAB_PREVIEW_HEIGHT, HEIGHT]
        ),
        top: interpolate(
          activeTabPreview.animationProgress.value,
          [0, 1],
          [0, -activeTabPreview.top.value]
        ),
        left: interpolate(
          activeTabPreview.animationProgress.value,
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
          activeTabPreview.animationProgress.value,
          [0, 1],
          [0, -activeTabPreview.top.value]
        ),
        left: interpolate(
          activeTabPreview.animationProgress.value,
          [0, 1],
          [0, -activeTabPreview.left.value]
        ),
        opacity: interpolate(
          activeTabPreview.animationProgress.value,
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
        activeTabPreview.animationProgress.value,
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
              backgroundColor: theme.colors.reverse,
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
            <TapGestureHandler onGestureEvent={closeButtonHandler}>
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
