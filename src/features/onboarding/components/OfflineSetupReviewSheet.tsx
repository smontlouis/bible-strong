import { Feather } from '@expo/vector-icons'
import { LinearGradient } from 'expo-linear-gradient'
import { useState } from 'react'
import { Pressable, ScrollView, useWindowDimensions } from 'react-native'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'
import {
  Extrapolation,
  FadeIn,
  FadeOut,
  interpolate,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated'
import { scheduleOnRN } from 'react-native-worklets'
import { useTranslation } from 'react-i18next'

import Box, { AnimatedBox, FadingBox, HStack } from '~common/ui/Box'
import Text from '~common/ui/Text'
import type { ResourceLanguage } from '~helpers/databaseTypes'
import { OFFLINE_SETUP_MOTION } from '../offlineSetupMotion'
import type { OfflineSetupPalette } from '../offlineSetupPalette'
import {
  getOfflineSetupReviewButtonLabelTransition,
  getOfflineSetupReviewDragProgress,
  getOfflineSetupReviewLayout,
  getOfflineSetupReviewListTopInset,
  getOfflineSetupReviewSnapPoint,
  type OfflineSetupReviewFolderContext,
  type OfflineSetupReviewSummary,
} from '../offlineSetupReview'
import formatResourceSize from '../formatResourceSize'
import useOfflineSetupFolderHeroHandoff from '../useOfflineSetupFolderHeroHandoff'
import OfflineSetupReviewHeader from './OfflineSetupReviewHeader'

type OfflineSetupReviewSheetProps = {
  availabilityReady: boolean
  bottomInset: number
  downloading: boolean
  folderContext?: OfflineSetupReviewFolderContext
  lang: ResourceLanguage
  overviewPalette: OfflineSetupPalette
  reduceMotion: boolean
  safeAreaTop: number
  summary: OfflineSetupReviewSummary
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

const getButtonTranslationKey = ({
  folderContext,
  reviewOpen,
}: {
  folderContext: boolean
  reviewOpen: boolean
}) => {
  if (folderContext) return 'offlineSetup.done'
  if (reviewOpen) return 'offlineSetup.download'
  return 'offlineSetup.review'
}

const OfflineSetupReviewSheet = ({
  availabilityReady,
  bottomInset,
  downloading,
  folderContext,
  lang,
  onDownload,
  onOpenChange,
  overviewPalette,
  reduceMotion,
  safeAreaTop,
  summary,
}: OfflineSetupReviewSheetProps) => {
  const { t } = useTranslation()
  const viewport = useWindowDimensions()
  const reviewMotion = OFFLINE_SETUP_MOTION.reviewSheet
  const layout = reviewMotion.layout
  const displayedSummary = folderContext?.summary ?? summary
  const displayedItems = displayedSummary.items
  const displayedDownloadBytes = displayedSummary.downloadBytes
  const displayedInstalledBytes = displayedSummary.installedBytes
  const palette = folderContext?.palette ?? overviewPalette
  const maxExpandedHeight = Math.max(
    reviewMotion.closedHeight,
    viewport.height - safeAreaTop - SHEET_TOP_INSET
  )
  const reviewLayout = getOfflineSetupReviewLayout({
    bottomInset,
    itemCount: displayedItems.length,
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
  const canReview = displayedItems.length > 0
  const gestureEnabled = canReview || Boolean(folderContext)
  const gestureLocked = !canReview
  const disabled = folderContext
    ? false
    : downloading || displayedItems.length === 0 || !availabilityReady
  const buttonTranslationKey = getButtonTranslationKey({
    folderContext: Boolean(folderContext),
    reviewOpen,
  })
  const buttonLabel = t(buttonTranslationKey)
  const closedButtonLabel = t('offlineSetup.review')
  const openButtonLabel = t('offlineSetup.download')

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

  const { closeFolder, folderBadgeRef, reportFolderHeroTarget } = useOfflineSetupFolderHeroHandoff({
    context: folderContext,
    onCloseSheet: () => settle(false),
  })

  const panGesture = Gesture.Pan()
    .enabled(gestureEnabled)
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
          locked: gestureLocked,
          rawProgress,
          sheetTravel,
        })
      )
    })
    .onEnd(event => {
      let target: 0 | 1 = 0
      if (!gestureLocked) {
        target = getOfflineSetupReviewSnapPoint({
          progress: progress.get(),
          velocityY: event.velocityY,
        })
      }
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

  const buttonLabelTransition = useDerivedValue(() =>
    getOfflineSetupReviewButtonLabelTransition(progress.get())
  )

  const closedButtonLabelStyle = useAnimatedStyle(() => {
    const transition = buttonLabelTransition.get()
    return {
      opacity: transition.closedOpacity,
      transform: [{ translateY: transition.closedTranslateY }],
    }
  })

  const openButtonLabelStyle = useAnimatedStyle(() => {
    const transition = buttonLabelTransition.get()
    return {
      opacity: transition.openOpacity,
      transform: [{ translateY: transition.openTranslateY }],
    }
  })

  const renderButtonLabel = () => {
    if (folderContext) {
      return (
        <Text color={palette.onAccent} title fontSize={16}>
          {buttonLabel}
        </Text>
      )
    }

    return (
      <>
        <AnimatedBox absoluteFill center style={closedButtonLabelStyle}>
          <Text color={palette.onAccent} title fontSize={16}>
            {closedButtonLabel}
          </Text>
        </AnimatedBox>
        <AnimatedBox absoluteFill center style={openButtonLabelStyle}>
          <Text color={palette.onAccent} title fontSize={16}>
            {openButtonLabel}
          </Text>
        </AnimatedBox>
      </>
    )
  }

  const handleButtonPress = () => {
    if (disabled) return
    if (folderContext) {
      closeFolder()
      return
    }
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
        bg={palette.overlay}
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
        <AnimatedBox
          absoluteFill
          style={[
            clippingStyle,
            {
              overflow: 'hidden',
              backgroundColor: palette.sheetSurface,
              transitionProperty: 'backgroundColor',
              transitionDuration: 220,
              transitionTimingFunction: 'ease-out',
            },
          ]}
        >
          <GestureDetector gesture={panGesture}>
            <AnimatedBox position="absolute" top={0} left={0} right={0} height={72} zIndex={4}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t(
                  reviewOpen ? 'offlineSetup.closeReview' : 'offlineSetup.openReview'
                )}
                disabled={!canReview}
                onPress={() => settle(!reviewOpen)}
                style={{ flex: 1, alignItems: 'center' }}
              >
                <Box width={42} height={4} mt={9} borderRadius={2} bg={palette.handle} />
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
            <FadingBox
              keyProp={folderContext?.folderId ?? 'overview'}
              animateLayout={false}
              entering={FadeIn.duration(170)}
              exiting={FadeOut.duration(110)}
              height={layout.summaryHeight}
            >
              <OfflineSetupReviewHeader
                downloadBytes={displayedDownloadBytes}
                folderBadgeRef={folderBadgeRef}
                folderContext={folderContext}
                height={layout.summaryHeight}
                installedBytes={displayedInstalledBytes}
                lang={lang}
                onFolderBadgeLayout={reportFolderHeroTarget}
                palette={palette}
              />
            </FadingBox>
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
              {displayedItems.map(item => (
                <HStack
                  key={item.id}
                  minHeight={layout.resourceRowHeight}
                  px={13}
                  py={10}
                  borderRadius={17}
                  bg={palette.sheetRaised}
                  alignItems="center"
                  gap={11}
                >
                  <Box size={34} borderRadius={12} bg={palette.sheetAccentSoft} center>
                    <Feather name="file-text" size={17} color={palette.accentLight} />
                  </Box>
                  <Box flex>
                    <Text color={palette.onSheet} fontSize={13} bold numberOfLines={1}>
                      {item.name}
                    </Text>
                    <Text color={palette.onSheetMuted} fontSize={10} mt={3} numberOfLines={1}>
                      {t('offlineSetup.reviewItemSize', {
                        download: formatResourceSize(item.downloadBytes, lang),
                        installed: formatResourceSize(item.installedBytes, lang),
                      })}
                    </Text>
                  </Box>
                  <Feather name="check" size={17} color={palette.accentLight} />
                </HStack>
              ))}
            </ScrollView>

            <LinearGradient
              pointerEvents="none"
              colors={[palette.sheetSurface, palette.sheetSurfaceTransparent]}
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

            {!folderContext ? (
              <Box
                position="absolute"
                top={layout.headerTop + layout.summaryHeight + layout.subtitleMarginTop}
                left={26}
                right={26}
                zIndex={3}
                pointerEvents="none"
              >
                <Text color={palette.onSheetMuted} fontSize={13} lineHeight={layout.subtitleHeight}>
                  {t('offlineSetup.reviewSubtitle', { count: displayedItems.length })}
                </Text>
              </Box>
            ) : null}
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
              colors={[palette.sheetSurfaceTransparent, palette.sheetSurface]}
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
              <Box height={layout.buttonHeight} borderRadius={28} bg={palette.accent} center>
                {renderButtonLabel()}
              </Box>
            </Pressable>
          </AnimatedBox>
        </AnimatedBox>
      </AnimatedBox>
    </>
  )
}

export default OfflineSetupReviewSheet
