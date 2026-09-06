import { resolveThemeColor, resolveFontFamily } from '~themes/styleValues'
import { useTheme as useStylingTheme } from '~themes/ThemeProvider'
import { Feather } from '@expo/vector-icons'
import { LinearGradient } from 'expo-linear-gradient'
import { useState } from 'react'
import { Pressable, ScrollView, useWindowDimensions } from 'react-native'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'
import {
  Extrapolation,
  interpolate,
  type EntryExitAnimationFunction,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated'
import { scheduleOnRN } from 'react-native-worklets'
import { useTranslation } from 'react-i18next'
import useConnection from '~helpers/useConnection'
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

const reviewHeaderEntering: EntryExitAnimationFunction = () => {
  'worklet'
  const transition = OFFLINE_SETUP_MOTION.reviewSheet.contextTransition

  return {
    initialValues: {
      opacity: 0,
      transform: [{ translateY: transition.slideDistance }],
    },
    animations: {
      opacity: withTiming(1, { duration: transition.enterDuration }),
      transform: [{ translateY: withTiming(0, { duration: transition.enterDuration }) }],
    },
  }
}

const reviewHeaderExiting: EntryExitAnimationFunction = () => {
  'worklet'
  const transition = OFFLINE_SETUP_MOTION.reviewSheet.contextTransition

  return {
    initialValues: {
      opacity: 1,
      transform: [{ translateY: 0 }],
    },
    animations: {
      opacity: withTiming(0, { duration: transition.exitDuration }),
      transform: [
        {
          translateY: withTiming(-transition.slideDistance, {
            duration: transition.exitDuration,
          }),
        },
      ],
    },
  }
}

const reviewButtonLabelEntering: EntryExitAnimationFunction = () => {
  'worklet'
  const transition = OFFLINE_SETUP_MOTION.reviewSheet.buttonLabel.contextTransition

  return {
    initialValues: {
      opacity: 0,
      transform: [{ translateY: transition.slideDistance }],
    },
    animations: {
      opacity: withTiming(1, { duration: transition.enterDuration }),
      transform: [{ translateY: withTiming(0, { duration: transition.enterDuration }) }],
    },
  }
}

const reviewButtonLabelExiting: EntryExitAnimationFunction = () => {
  'worklet'
  const transition = OFFLINE_SETUP_MOTION.reviewSheet.buttonLabel.contextTransition

  return {
    initialValues: {
      opacity: 1,
      transform: [{ translateY: 0 }],
    },
    animations: {
      opacity: withTiming(0, { duration: transition.exitDuration }),
      transform: [
        {
          translateY: withTiming(-transition.slideDistance, {
            duration: transition.exitDuration,
          }),
        },
      ],
    },
  }
}

const getButtonOpacity = (disabled: boolean, pressed: boolean) => {
  if (disabled) return 0.45
  if (pressed) return 0.82
  return 1
}

const getButtonTranslationKey = ({
  folderContext,
  reviewOpen,
  canReview,
}: {
  folderContext: boolean
  reviewOpen: boolean
  canReview: boolean
}) => {
  if (folderContext) return 'offlineSetup.done'
  if (!canReview) return 'offlineSetup.continue'
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
  const stylingTheme = useStylingTheme()

  const { t } = useTranslation()
  const isConnected = useConnection()
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
    : downloading || !availabilityReady || (canReview && !isConnected)
  const buttonTranslationKey = getButtonTranslationKey({
    folderContext: Boolean(folderContext),
    reviewOpen,
    canReview,
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
    const contextKey = folderContext?.folderId ?? 'overview'

    return (
      <FadingBox
        className="overflow-hidden border-continuous absolute left-[0px] top-[0px] right-[0px] bottom-[0px] items-center justify-center"
        keyProp={contextKey}
        animateLayout={false}
        entering={reviewButtonLabelEntering}
        exiting={reviewButtonLabelExiting}
        skipEntering={false}
        skipExiting={false}
      >
        {folderContext || !canReview ? (
          <Text
            className="text-[16px]"
            style={{
              color:
                resolveThemeColor(stylingTheme, palette.onAccent) || stylingTheme.colors.default,
              fontFamily: resolveFontFamily(stylingTheme.fontFamily.title),
            }}
          >
            {buttonLabel}
          </Text>
        ) : (
          <>
            <AnimatedBox
              className="overflow-hidden border-continuous absolute left-[0px] top-[0px] right-[0px] bottom-[0px] items-center justify-center"
              style={closedButtonLabelStyle}
            >
              <Text
                className="text-[16px]"
                style={{
                  color:
                    resolveThemeColor(stylingTheme, palette.onAccent) ||
                    stylingTheme.colors.default,
                  fontFamily: resolveFontFamily(stylingTheme.fontFamily.title),
                }}
              >
                {closedButtonLabel}
              </Text>
            </AnimatedBox>
            <AnimatedBox
              className="overflow-hidden border-continuous absolute left-[0px] top-[0px] right-[0px] bottom-[0px] items-center justify-center"
              style={openButtonLabelStyle}
            >
              <Text
                className="text-[16px]"
                style={{
                  color:
                    resolveThemeColor(stylingTheme, palette.onAccent) ||
                    stylingTheme.colors.default,
                  fontFamily: resolveFontFamily(stylingTheme.fontFamily.title),
                }}
              >
                {openButtonLabel}
              </Text>
            </AnimatedBox>
          </>
        )}
      </FadingBox>
    )
  }

  const handleButtonPress = () => {
    if (disabled) return
    if (folderContext) {
      closeFolder()
      return
    }
    if (!canReview) {
      onDownload()
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
        className="overflow-hidden border-continuous absolute left-[0px] top-[0px] right-[0px] bottom-[0px] z-[20]"
        pointerEvents={overlayActive ? 'auto' : 'none'}
        style={[
          { backgroundColor: resolveThemeColor(stylingTheme, palette.overlay) },
          overlayStyle,
        ]}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('offlineSetup.closeReview')}
          onPress={() => settle(false)}
          style={{ flex: 1 }}
        />
      </AnimatedBox>

      <AnimatedBox
        className="overflow-hidden border-continuous absolute z-[21]"
        style={[
          sheetStyle,
          {
            boxShadow: '0 8px 28px rgba(18,35,60,0.25)',
            overflow: 'visible',
          },
        ]}
      >
        <AnimatedBox
          className="overflow-hidden border-continuous absolute left-[0px] top-[0px] right-[0px] bottom-[0px]"
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
            <AnimatedBox className="overflow-hidden border-continuous absolute top-[0px] left-[0px] right-[0px] h-[72px] z-[4]">
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t(
                  reviewOpen ? 'offlineSetup.closeReview' : 'offlineSetup.openReview'
                )}
                disabled={!canReview}
                onPress={() => settle(!reviewOpen)}
                style={{ flex: 1, alignItems: 'center' }}
              >
                <Box
                  className="overflow-hidden border-continuous w-[42px] h-[4px] mt-[9px] rounded-[2px]"
                  style={{ backgroundColor: resolveThemeColor(stylingTheme, palette.handle) }}
                />
              </Pressable>
            </AnimatedBox>
          </GestureDetector>

          <AnimatedBox
            className="border-continuous overflow-visible absolute left-[14px] right-[14px] z-[3]"
            pointerEvents="none"
            style={{ top: layout.headerTop }}
          >
            <FadingBox
              className="border-continuous overflow-visible"
              keyProp={folderContext?.folderId ?? 'overview'}
              animateLayout={false}
              entering={reviewHeaderEntering}
              exiting={reviewHeaderExiting}
              skipEntering={false}
              skipExiting={false}
              style={{ height: layout.summaryHeight }}
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
            className="overflow-hidden border-continuous absolute top-[0px] left-[0px] right-[0px] bottom-[0px]"
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
                  className="overflow-hidden border-continuous px-[13px] py-[10px] rounded-[17px] items-center gap-[11px]"
                  key={item.id}
                  style={{
                    minHeight: layout.resourceRowHeight,
                    backgroundColor: resolveThemeColor(stylingTheme, palette.sheetRaised),
                  }}
                >
                  <Box
                    className="overflow-hidden border-continuous rounded-[12px] items-center justify-center"
                    style={{
                      backgroundColor: resolveThemeColor(stylingTheme, palette.sheetAccentSoft),
                      width: 34,
                      height: 34,
                    }}
                  >
                    <Feather name="file-text" size={17} color={palette.accentLight} />
                  </Box>
                  <Box className="overflow-hidden border-continuous flex-[1]">
                    <Text
                      className="text-[13px] font-bold"
                      numberOfLines={1}
                      style={{
                        color:
                          resolveThemeColor(stylingTheme, palette.onSheet) ||
                          stylingTheme.colors.default,
                      }}
                    >
                      {item.name}
                    </Text>
                    <Text
                      className="text-[10px] mt-[3px]"
                      numberOfLines={1}
                      style={{
                        color:
                          resolveThemeColor(stylingTheme, palette.onSheetMuted) ||
                          stylingTheme.colors.default,
                      }}
                    >
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
                className="overflow-hidden border-continuous absolute left-[26px] right-[26px] z-[3]"
                pointerEvents="none"
                style={{ top: layout.headerTop + layout.summaryHeight + layout.subtitleMarginTop }}
              >
                <Text
                  className="text-[13px]"
                  style={{
                    lineHeight: layout.subtitleHeight,
                    color:
                      resolveThemeColor(stylingTheme, palette.onSheetMuted) ||
                      stylingTheme.colors.default,
                  }}
                >
                  {t('offlineSetup.reviewSubtitle', { count: displayedItems.length })}
                </Text>
              </Box>
            ) : null}
          </AnimatedBox>

          <AnimatedBox
            className="overflow-hidden border-continuous absolute right-[0px] bottom-[0px] left-[0px] z-[2]"
            pointerEvents="none"
            style={[
              { height: listBottomInset + layout.buttonGradientFeather },
              reviewGradientStyle,
            ]}
          >
            <LinearGradient
              colors={[palette.sheetSurfaceTransparent, palette.sheetSurface]}
              locations={[0, 0.48]}
              style={{ flex: 1 }}
            />
          </AnimatedBox>

          <AnimatedBox
            className="overflow-hidden border-continuous absolute z-[3] left-[14px] right-[14px]"
            style={[{ top: CLOSED_BUTTON_TOP }, buttonStyle]}
          >
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={buttonLabel}
              disabled={disabled}
              onPress={handleButtonPress}
              style={({ pressed }) => ({ opacity: getButtonOpacity(disabled, pressed) })}
            >
              <Box
                className="overflow-hidden border-continuous rounded-[28px] items-center justify-center"
                style={{
                  height: layout.buttonHeight,
                  backgroundColor: resolveThemeColor(stylingTheme, palette.accent),
                }}
              >
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
