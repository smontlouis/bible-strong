import { Feather } from '@expo/vector-icons'
import { LinearGradient } from 'expo-linear-gradient'
import { useState } from 'react'
import { Pressable, ScrollView, useWindowDimensions } from 'react-native'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'
import {
  Extrapolation,
  interpolate,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
} from 'react-native-reanimated'
import { scheduleOnRN } from 'react-native-worklets'
import { useTranslation } from 'react-i18next'

import Box, { AnimatedBox, FadingBox, HStack } from '~common/ui/Box'
import Text from '~common/ui/Text'
import type { ResourceLanguage } from '~helpers/databaseTypes'
import { OFFLINE_SETUP_MOTION } from '../offlineSetupMotion'
import {
  getOfflineSetupReviewDragProgress,
  getOfflineSetupReviewLayout,
  getOfflineSetupReviewListTopInset,
  getOfflineSetupReviewSnapPoint,
  type OfflineSetupReviewItem,
} from '../offlineSetupReview'
import formatResourceSize from '../formatResourceSize'

type OfflineSetupReviewSheetProps = {
  availabilityReady: boolean
  bottomInset: number
  downloadBytes: number
  downloading: boolean
  installedBytes: number
  items: readonly OfflineSetupReviewItem[]
  lang: ResourceLanguage
  reduceMotion: boolean
  safeAreaTop: number
  onDownload: () => void
  onOpenChange?: (open: boolean) => void
}

const SHEET_TOP_INSET = 200
const CLOSED_BUTTON_TOP = 80

const getButtonOpacity = (disabled: boolean, pressed: boolean) => {
  if (disabled) return 0.45
  if (pressed) return 0.82
  return 1
}

const buttonLabelFadeIn = () => {
  'worklet'

  return {
    initialValues: {
      opacity: 0,
      transform: [{ translateY: OFFLINE_SETUP_MOTION.reviewSheet.buttonLabel.slideDistance }],
    },
    animations: {
      opacity: withDelay(
        OFFLINE_SETUP_MOTION.reviewSheet.buttonLabel.enterDelay,
        withTiming(1, {
          duration: OFFLINE_SETUP_MOTION.reviewSheet.buttonLabel.enterDuration,
        })
      ),
      transform: [
        {
          translateY: withDelay(
            OFFLINE_SETUP_MOTION.reviewSheet.buttonLabel.enterDelay,
            withTiming(0, {
              duration: OFFLINE_SETUP_MOTION.reviewSheet.buttonLabel.enterDuration,
            })
          ),
        },
      ],
    },
  }
}

const buttonLabelFadeOut = () => {
  'worklet'

  return {
    initialValues: { opacity: 1, transform: [{ translateY: 0 }] },
    animations: {
      opacity: withTiming(0, {
        duration: OFFLINE_SETUP_MOTION.reviewSheet.buttonLabel.exitDuration,
      }),
      transform: [
        {
          translateY: withTiming(-OFFLINE_SETUP_MOTION.reviewSheet.buttonLabel.slideDistance, {
            duration: OFFLINE_SETUP_MOTION.reviewSheet.buttonLabel.exitDuration,
          }),
        },
      ],
    },
  }
}

const OfflineSetupReviewSheet = ({
  availabilityReady,
  bottomInset,
  downloadBytes,
  downloading,
  installedBytes,
  items,
  lang,
  onDownload,
  onOpenChange,
  reduceMotion,
  safeAreaTop,
}: OfflineSetupReviewSheetProps) => {
  const { t } = useTranslation()
  const viewport = useWindowDimensions()
  const reviewMotion = OFFLINE_SETUP_MOTION.reviewSheet
  const layout = reviewMotion.layout
  const maxExpandedHeight = Math.max(
    reviewMotion.closedHeight,
    viewport.height - safeAreaTop - SHEET_TOP_INSET
  )
  const reviewLayout = getOfflineSetupReviewLayout({
    bottomInset,
    itemCount: items.length,
    maxHeight: maxExpandedHeight,
  })
  const expandedHeight = reviewLayout.expandedHeight
  const sheetTravel = Math.max(1, expandedHeight - reviewMotion.closedHeight)
  const expandedButtonTop = expandedHeight - layout.buttonHeight - layout.buttonBottom - bottomInset
  const buttonTravel = expandedButtonTop - CLOSED_BUTTON_TOP
  const listBottomInset =
    layout.buttonHeight + layout.buttonBottom + bottomInset + layout.bottomSpacing
  const listTopInset = getOfflineSetupReviewListTopInset()
  const progress = useSharedValue(0)
  const dragStartProgress = useSharedValue(0)
  const [reviewOpen, setReviewOpen] = useState(false)
  const [overlayActive, setOverlayActive] = useState(false)
  const disabled = downloading || items.length === 0 || !availabilityReady
  const buttonTranslationKey = reviewOpen ? 'offlineSetup.download' : 'offlineSetup.review'
  const buttonLabel = t(buttonTranslationKey)

  const settle = (open: boolean) => {
    setReviewOpen(open)
    onOpenChange?.(open)
    if (open) setOverlayActive(true)
    const target = open ? 1 : 0
    if (reduceMotion) {
      progress.set(target)
      setOverlayActive(open)
      return
    }

    progress.set(
      withSpring(target, undefined, finished => {
        if (finished && target === 0) scheduleOnRN(setOverlayActive, false)
      })
    )
  }

  const panGesture = Gesture.Pan()
    .minDistance(2)
    .onBegin(() => {
      dragStartProgress.set(progress.get())
      scheduleOnRN(setOverlayActive, true)
    })
    .onUpdate(event => {
      const dragDistance = event.translationY * reviewMotion.dragRatio
      const rawProgress = dragStartProgress.get() - dragDistance / sheetTravel
      progress.set(
        getOfflineSetupReviewDragProgress({
          rawProgress,
          sheetTravel,
        })
      )
    })
    .onEnd(event => {
      const target = getOfflineSetupReviewSnapPoint({
        progress: progress.get(),
        velocityY: event.velocityY,
      })
      scheduleOnRN(setReviewOpen, target === 1)
      if (onOpenChange) scheduleOnRN(onOpenChange, target === 1)
      progress.set(
        withSpring(target, undefined, finished => {
          if (finished && target === 0) scheduleOnRN(setOverlayActive, false)
        })
      )
    })

  const overlayStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      progress.get(),
      [0, 1],
      [0, reviewMotion.overlayMaxOpacity],
      Extrapolation.CLAMP
    ),
  }))

  const cornerRadii = useDerivedValue(() => {
    const attachedProgress = interpolate(progress.get(), [0, 1], [0, 1], Extrapolation.CLAMP)
    const overdragRatio = interpolate(
      progress.get(),
      [-reviewMotion.maxOverdrag / sheetTravel, 0],
      [1, 0],
      Extrapolation.CLAMP
    )
    const overdragRadius = overdragRatio * reviewMotion.overdragInset * 0.5

    return {
      top:
        interpolate(
          attachedProgress,
          [0, 1],
          [reviewMotion.detachedRadius, reviewMotion.attachedTopRadius],
          Extrapolation.CLAMP
        ) + overdragRadius,
      bottom:
        interpolate(
          attachedProgress,
          [0, 1],
          [reviewMotion.detachedRadius, reviewMotion.detachedRadius * 0.5],
          Extrapolation.CLAMP
        ) + overdragRadius,
    }
  })

  const sheetStyle = useAnimatedStyle(() => {
    const currentProgress = progress.get()
    const attachedProgress = interpolate(currentProgress, [0, 1], [0, 1], Extrapolation.CLAMP)
    const overdragRatio = interpolate(
      currentProgress,
      [-reviewMotion.maxOverdrag / sheetTravel, 0],
      [1, 0],
      Extrapolation.CLAMP
    )
    const sideInset =
      interpolate(
        attachedProgress,
        [0, 1],
        [reviewMotion.detachedSideInset, 0],
        Extrapolation.CLAMP
      ) +
      overdragRatio * reviewMotion.overdragInset
    const bottomOffset =
      interpolate(attachedProgress, [0, 1], [bottomInset, 0], Extrapolation.CLAMP) +
      overdragRatio * reviewMotion.overdragInset
    const radii = cornerRadii.get()

    return {
      bottom: bottomOffset,
      left: sideInset,
      right: sideInset,
      height: interpolate(currentProgress, [0, 1], [reviewMotion.closedHeight, expandedHeight]),
      borderTopLeftRadius: radii.top,
      borderTopRightRadius: radii.top,
      borderBottomLeftRadius: radii.bottom,
      borderBottomRightRadius: radii.bottom,
    }
  })

  const clippingStyle = useAnimatedStyle(() => {
    const radii = cornerRadii.get()

    return {
      borderTopLeftRadius: radii.top,
      borderTopRightRadius: radii.top,
      borderBottomLeftRadius: radii.bottom,
      borderBottomRightRadius: radii.bottom,
    }
  })

  const reviewContentStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.get(), [0.24, 0.62], [0, 1], Extrapolation.CLAMP),
    transform: [
      {
        translateY: interpolate(progress.get(), [0, 1], [14, 0], Extrapolation.CLAMP),
      },
    ],
  }))

  const reviewGradientStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.get(), [0.24, 0.62], [0, 1], Extrapolation.CLAMP),
  }))

  const buttonStyle = useAnimatedStyle(() => ({
    transform: [
      {
        translateY: interpolate(progress.get(), [0, 1], [0, buttonTravel], Extrapolation.CLAMP),
      },
    ],
  }))

  const handleButtonPress = () => {
    if (disabled) return
    if (!reviewOpen) {
      settle(true)
      return
    }
    onDownload()
  }

  return (
    <>
      <AnimatedBox
        absoluteFill
        zIndex={20}
        pointerEvents={overlayActive ? 'auto' : 'none'}
        bg="#0B1524"
        style={overlayStyle}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('offlineSetup.closeReview')}
          onPress={() => settle(false)}
          style={{ flex: 1 }}
        />
      </AnimatedBox>

      <AnimatedBox
        position="absolute"
        zIndex={21}
        style={[
          sheetStyle,
          {
            boxShadow: '0 8px 28px rgba(18,35,60,0.25)',
            overflow: 'visible',
          },
        ]}
      >
        <AnimatedBox absoluteFill bg="#172840" style={[clippingStyle, { overflow: 'hidden' }]}>
          <GestureDetector gesture={panGesture}>
            <AnimatedBox position="absolute" top={0} left={0} right={0} height={72} zIndex={4}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t(
                  reviewOpen ? 'offlineSetup.closeReview' : 'offlineSetup.openReview'
                )}
                onPress={() => settle(!reviewOpen)}
                style={{ flex: 1, alignItems: 'center' }}
              >
                <Box width={42} height={4} mt={9} borderRadius={2} bg="rgba(255,255,255,0.56)" />
              </Pressable>
            </AnimatedBox>
          </GestureDetector>

          <AnimatedBox
            position="absolute"
            top={layout.headerTop}
            left={14}
            right={14}
            zIndex={3}
            pointerEvents="none"
          >
            <HStack height={layout.summaryHeight} alignItems="center" px={12} gap={14}>
              <Box size={36} borderRadius={18} bg="#5983F0" center>
                <Feather name="archive" size={20} color="#FFFFFF" />
              </Box>
              <Box flex>
                <Text color="#B8C2D1" fontSize={11}>
                  {t('offlineSetup.toDownload')}
                </Text>
                <Text color="#FFFFFF" fontSize={18} style={{ fontFamily: 'FiraCode' }}>
                  {formatResourceSize(downloadBytes, lang)}
                </Text>
              </Box>
              <Box height={34} width={1} bg="rgba(255,255,255,0.24)" />
              <Box flex>
                <Text color="#B8C2D1" fontSize={11}>
                  {t('offlineSetup.onDevice')}
                </Text>
                <Text color="#FFFFFF" fontSize={18} style={{ fontFamily: 'FiraCode' }}>
                  {formatResourceSize(installedBytes, lang)}
                </Text>
              </Box>
            </HStack>
          </AnimatedBox>

          <AnimatedBox
            position="absolute"
            top={0}
            left={0}
            right={0}
            bottom={0}
            pointerEvents={reviewOpen ? 'auto' : 'none'}
            style={reviewContentStyle}
          >
            <ScrollView
              style={{ flex: 1 }}
              contentContainerStyle={{
                gap: layout.resourceRowGap,
                paddingTop: listTopInset,
                paddingHorizontal: 18,
                paddingBottom: listBottomInset,
              }}
              scrollIndicatorInsets={{ top: listTopInset, bottom: listBottomInset }}
              showsVerticalScrollIndicator={false}
              scrollEnabled={reviewLayout.scrollEnabled}
              nestedScrollEnabled={reviewLayout.scrollEnabled}
            >
              {items.map(item => (
                <HStack
                  key={item.id}
                  minHeight={layout.resourceRowHeight}
                  px={13}
                  py={10}
                  borderRadius={17}
                  bg="rgba(255,255,255,0.075)"
                  alignItems="center"
                  gap={11}
                >
                  <Box size={34} borderRadius={12} bg="rgba(89,131,240,0.22)" center>
                    <Feather name="file-text" size={17} color="#9BB8FF" />
                  </Box>
                  <Box flex>
                    <Text color="#FFFFFF" fontSize={13} bold numberOfLines={1}>
                      {item.name}
                    </Text>
                    <Text color="#AEB9CA" fontSize={10} mt={3} numberOfLines={1}>
                      {t('offlineSetup.reviewItemSize', {
                        download: formatResourceSize(item.downloadBytes, lang),
                        installed: formatResourceSize(item.installedBytes, lang),
                      })}
                    </Text>
                  </Box>
                  <Feather name="check" size={17} color="#9BB8FF" />
                </HStack>
              ))}
            </ScrollView>

            <LinearGradient
              pointerEvents="none"
              colors={['#172840', 'rgba(23,40,64,0)']}
              locations={[0.52, 1]}
              style={{
                position: 'absolute',
                top: 0,
                right: 0,
                left: 0,
                zIndex: 2,
                height: listTopInset + layout.headerGradientFeather,
              }}
            />

            <Box
              position="absolute"
              top={layout.headerTop + layout.summaryHeight + layout.subtitleMarginTop}
              left={26}
              right={26}
              zIndex={3}
              pointerEvents="none"
            >
              <Text color="#AEB9CA" fontSize={13} lineHeight={layout.subtitleHeight}>
                {t('offlineSetup.reviewSubtitle', { count: items.length })}
              </Text>
            </Box>
          </AnimatedBox>

          <AnimatedBox
            position="absolute"
            right={0}
            bottom={0}
            left={0}
            zIndex={2}
            pointerEvents="none"
            height={listBottomInset + layout.buttonGradientFeather}
            style={reviewGradientStyle}
          >
            <LinearGradient
              colors={['rgba(23,40,64,0)', '#172840']}
              locations={[0, 0.48]}
              style={{ flex: 1 }}
            />
          </AnimatedBox>

          <AnimatedBox
            position="absolute"
            zIndex={3}
            top={CLOSED_BUTTON_TOP}
            left={14}
            right={14}
            style={buttonStyle}
          >
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={buttonLabel}
              disabled={disabled}
              onPress={handleButtonPress}
              style={({ pressed }) => ({ opacity: getButtonOpacity(disabled, pressed) })}
            >
              <Box height={layout.buttonHeight} borderRadius={28} bg="#5983F0" center>
                <FadingBox
                  keyProp={buttonLabel}
                  animateLayout={false}
                  entering={buttonLabelFadeIn}
                  exiting={buttonLabelFadeOut}
                >
                  <Text color="#FFFFFF" title fontSize={16}>
                    {buttonLabel}
                  </Text>
                </FadingBox>
              </Box>
            </Pressable>
          </AnimatedBox>
        </AnimatedBox>
      </AnimatedBox>
    </>
  )
}

export default OfflineSetupReviewSheet
