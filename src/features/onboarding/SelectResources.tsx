import { Feather } from '@expo/vector-icons'
import { useTheme } from '@emotion/react'
import { useSetAtom } from 'jotai/react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Pressable, useWindowDimensions } from 'react-native'
import { FadeIn, FadeInUp, useReducedMotion } from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { AnimatedBox, HStack } from '~common/ui/Box'
import Text from '~common/ui/Text'
import useLanguage from '~helpers/useLanguage'
import useCurrentThemeSelector from '~helpers/useCurrentThemeSelector'
import { selectedResourcesAtom } from './atom'
import DownloadResources from './DownloadResources'
import OfflineResourceFolderHero from './components/OfflineResourceFolderHero'
import OfflineSetupFolderDetail from './components/OfflineSetupFolderDetail'
import OfflineSetupOverview from './components/OfflineSetupOverview'
import OfflineSetupReviewSheet from './components/OfflineSetupReviewSheet'
import { OFFLINE_SETUP_MOTION } from './offlineSetupMotion'
import { getOfflineSetupFolderPalette, getOfflineSetupOverviewPalette } from './offlineSetupPalette'
import { getOfflineSetupFolderSections } from './offlineSetupPresets'
import type { OfflineSetupReviewFolderContext } from './offlineSetupReview'
import { OFFLINE_SETUP_FOLDER_PRESENTATIONS } from './offlineSetupPresentation'
import useOfflineSetupScene from './useOfflineSetupScene'
import useOfflineSetupSelection from './useOfflineSetupSelection'

type SelectResourcesProps =
  | { mode?: 'onboarding'; onComplete: () => void }
  | { mode: 'preview'; onClose: () => void }

const SelectResources = (props: SelectResourcesProps) => {
  const { t } = useTranslation()
  const theme = useTheme()
  const { colorScheme } = useCurrentThemeSelector()
  const lang = useLanguage()
  const insets = useSafeAreaInsets()
  const viewport = useWindowDimensions()
  const reduceMotion = useReducedMotion()
  const setSelectedResources = useSetAtom(selectedResourcesAtom)
  const [reviewOpen, setReviewOpen] = useState(false)
  const selection = useOfflineSetupSelection(lang)
  const scene = useOfflineSetupScene({ reduceMotion, viewport })
  const contentWidth = Math.min(350, viewport.width - 40)
  const folderWidth = (contentWidth - 50) / 2
  const bottomInset = Math.max(insets.bottom, 16)
  const { state } = scene
  const activeFolder = state.activeFolder
  const activeVisual = OFFLINE_SETUP_FOLDER_PRESENTATIONS.find(item => item.id === activeFolder)
  const heroVisual = OFFLINE_SETUP_FOLDER_PRESENTATIONS.find(
    item => item.id === state.hero?.folderId
  )
  const heroCount = state.hero ? selection.folderOptionIds[state.hero.folderId].length : 0
  const isClosingFolder = state.hero?.direction === 'closing'
  const downloading = state.downloadSceneActive && !state.downloadSceneSettled
  const activeFolderSummary = activeFolder
    ? selection.folderReviewSummaries[activeFolder]
    : undefined
  const overviewPalette = getOfflineSetupOverviewPalette(theme, colorScheme)
  const activePalette = activeVisual
    ? getOfflineSetupFolderPalette(activeVisual, theme, colorScheme)
    : undefined
  const sceneBackground = activePalette?.canvas ?? theme.colors.lightGrey
  let folderContext: OfflineSetupReviewFolderContext | undefined

  if (activeFolder && activeVisual && activeFolderSummary && activePalette) {
    folderContext = {
      folderId: activeFolder,
      heroOverlayActive:
        state.hero?.folderId === activeFolder && state.hero.direction !== 'settled',
      selectedCount: selection.folderOptionIds[activeFolder].length,
      palette: activePalette,
      summary: activeFolderSummary,
      title: t(`offlineSetup.presets.${activeFolder}.title`),
      visual: activeVisual,
      onClose: scene.closeFolder,
      onHeroTargetLayout: scene.handleHeroTargetLayout,
    }
  }

  const startDownload = () => {
    if (!selection.availabilityReady) return
    setReviewOpen(false)
    setSelectedResources(selection.missingSelections)
    scene.startDownload()
  }

  return (
    <AnimatedBox
      flex
      style={{
        backgroundColor: sceneBackground,
        transitionProperty: 'backgroundColor',
        transitionDuration: reduceMotion
          ? 0
          : OFFLINE_SETUP_MOTION.overview.backgroundColorDuration,
        transitionTimingFunction: 'ease-out',
      }}
    >
      {state.downloadSceneActive ? (
        <AnimatedBox absoluteFill zIndex={state.downloadSceneSettled ? 30 : 15}>
          {props.mode === 'preview' ? (
            <DownloadResources
              canvasVisible={state.downloadSceneSettled}
              mode="preview"
              transitioning={!state.downloadContentVisible}
            />
          ) : (
            <DownloadResources
              canvasVisible={state.downloadSceneSettled}
              mode="onboarding"
              onComplete={props.onComplete}
              transitioning={!state.downloadContentVisible}
            />
          )}
        </AnimatedBox>
      ) : null}

      {!state.downloadSceneSettled && activeFolder && activeVisual && activePalette ? (
        <OfflineSetupFolderDetail
          contentVisible={state.detailContentVisible}
          folderId={activeFolder}
          lang={lang}
          lockedOptionIds={selection.lockedOptionIds}
          sizeManifest={selection.sizeManifest}
          sections={getOfflineSetupFolderSections(activeFolder, lang)}
          selectedOptionIds={selection.folderOptionIds[activeFolder]}
          palette={activePalette}
          onToggleOption={option => selection.toggleOption(activeFolder, option)}
        />
      ) : null}

      {!state.downloadSceneSettled && (!activeFolder || state.openingFolder || isClosingFolder) ? (
        <AnimatedBox
          absoluteFill
          zIndex={10}
          entering={reduceMotion || !isClosingFolder ? undefined : FadeIn.duration(100)}
        >
          <OfflineSetupOverview
            bottomInset={bottomInset}
            contentWidth={contentWidth}
            downloading={downloading}
            folderOptionIds={selection.folderOptionIds}
            folderWidth={folderWidth}
            hero={state.hero}
            mergeOffsets={state.folderMergeOffsets}
            openingFolder={state.openingFolder}
            reduceMotion={reduceMotion}
            returningFolder={state.returningFolder}
            safeAreaTop={insets.top}
            onFolderPress={scene.openFolder}
            registerFolder={scene.registerFolder}
          />
        </AnimatedBox>
      ) : null}

      {!state.downloadSceneSettled ? (
        <AnimatedBox
          absoluteFill
          zIndex={20}
          pointerEvents={downloading ? 'none' : 'box-none'}
          entering={reduceMotion ? undefined : FadeInUp.duration(400).delay(450)}
          style={{
            opacity: downloading ? 0 : 1,
            transform: [{ translateY: downloading ? 10 : 0 }],
            transitionProperty: ['opacity', 'transform'],
            transitionDuration: OFFLINE_SETUP_MOTION.overview.downloadFadeDuration,
            transitionTimingFunction: 'ease-out',
          }}
        >
          <OfflineSetupReviewSheet
            availabilityReady={selection.availabilityReady}
            bottomInset={bottomInset}
            downloading={downloading}
            folderContext={folderContext}
            lang={lang}
            overviewPalette={overviewPalette}
            reduceMotion={reduceMotion}
            safeAreaTop={insets.top}
            summary={selection.reviewSummary}
            onDownload={startDownload}
            onOpenChange={setReviewOpen}
          />
        </AnimatedBox>
      ) : null}

      {!state.downloadSceneSettled && state.hero && heroVisual ? (
        <OfflineResourceFolderHero
          direction={state.hero.direction}
          origin={state.hero.origin}
          target={state.hero.target}
          title={t(`offlineSetup.presets.${state.hero.folderId}.title`)}
          subtitle={t('offlineSetup.selectedCount', { count: heroCount })}
          itemCount={heroCount}
          visual={heroVisual}
          selected={heroCount > 0}
          onTransitionEnd={scene.handleHeroTransitionEnd}
        />
      ) : null}

      {props.mode === 'preview' || props.mode === undefined ? (
        <AnimatedBox
          position="absolute"
          top={insets.top + 10}
          right={16}
          zIndex={100}
          pointerEvents={reviewOpen ? 'none' : 'auto'}
          style={{
            opacity: reviewOpen ? 0 : 1,
            transitionProperty: 'opacity',
            transitionDuration: 160,
          }}
        >
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t(
              props.mode === 'preview'
                ? 'offlineSetup.closePreview'
                : 'offlineSetup.continueWithoutDownloads'
            )}
            onPress={props.mode === 'preview' ? props.onClose : props.onComplete}
            hitSlop={8}
          >
            {({ pressed }) => (
              <HStack
                px={11}
                height={32}
                borderRadius={16}
                bg="rgba(255,255,255,0.92)"
                alignItems="center"
                gap={6}
                style={{
                  opacity: pressed ? 0.72 : 1,
                  boxShadow: '0 4px 14px rgba(28,51,88,0.10)',
                }}
              >
                <Text color="#68758C" fontSize={10} bold>
                  {t(
                    props.mode === 'preview'
                      ? 'offlineSetup.closePreview'
                      : 'offlineSetup.continueWithoutDownloads'
                  )}
                </Text>
                <Feather
                  name={props.mode === 'preview' ? 'x' : 'arrow-right'}
                  size={14}
                  color="#68758C"
                />
              </HStack>
            )}
          </Pressable>
        </AnimatedBox>
      ) : null}
    </AnimatedBox>
  )
}

export default SelectResources
