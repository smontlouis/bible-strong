import { useTranslation } from 'react-i18next'
import { ScrollView, View } from 'react-native'
import { Easing, FadeInDown, FadeInUp } from 'react-native-reanimated'

import Box, { AnimatedBox, HStack, VStack } from '~common/ui/Box'
import Text from '~common/ui/Text'
import type { OfflineSetupFolderId, OfflineSetupFolderOptionIds } from '../offlineSetupPresets'
import { OFFLINE_SETUP_MOTION } from '../offlineSetupMotion'
import {
  OFFLINE_SETUP_FOLDER_PRESENTATIONS,
  type OfflineSetupFolderMergeOffset,
} from '../offlineSetupPresentation'
import type { OfflineSetupHeroTransition } from '../offlineSetupScene'
import OfflineResourceFolder from './OfflineResourceFolder'
import OfflineSetupMergingFolder from './OfflineSetupMergingFolder'

type OfflineSetupOverviewProps = {
  bottomInset: number
  contentWidth: number
  downloading: boolean
  folderOptionIds: OfflineSetupFolderOptionIds
  folderWidth: number
  hero?: OfflineSetupHeroTransition
  openingFolder?: OfflineSetupFolderId
  reduceMotion: boolean
  returningFolder?: OfflineSetupFolderId
  safeAreaTop: number
  mergeOffsets: Partial<Record<OfflineSetupFolderId, OfflineSetupFolderMergeOffset>>
  onFolderPress: (folderId: OfflineSetupFolderId) => void
  registerFolder: (folderId: OfflineSetupFolderId, node: View | null) => void
}

const OVERVIEW_FOOTER_HEIGHT = OFFLINE_SETUP_MOTION.reviewSheet.closedHeight
const OVERVIEW_ENTRANCE_EASING = Easing.bezier(...OFFLINE_SETUP_MOTION.overview.entranceBezier)

const getFolderOpacity = ({
  isMovingHero,
  openingAnotherFolder,
}: {
  isMovingHero: boolean
  openingAnotherFolder: boolean
}) => {
  if (isMovingHero || openingAnotherFolder) return 0
  return 1
}

const getFolderTranslateY = ({ openingAnotherFolder }: { openingAnotherFolder: boolean }) => {
  if (openingAnotherFolder) return 10
  return 0
}

const getFolderScale = (openingAnotherFolder: boolean) => {
  if (openingAnotherFolder) return 0.97
  return 1
}

const getFolderTransitionDuration = ({
  heroSettled,
  isHero,
  isReturningFolder,
}: {
  heroSettled: boolean
  isHero: boolean
  isReturningFolder: boolean
}) => {
  if (heroSettled || isHero || isReturningFolder) return 0
  return OFFLINE_SETUP_MOTION.overview.exitDuration
}

const getFolderEnteringAnimation = ({
  index,
  isReturningFolder,
  reduceMotion,
  returning,
}: {
  index: number
  isReturningFolder: boolean
  reduceMotion: boolean
  returning: boolean
}) => {
  if (reduceMotion || isReturningFolder) return undefined

  const motion = returning
    ? OFFLINE_SETUP_MOTION.overview.returnEntrance
    : OFFLINE_SETUP_MOTION.overview.initialEntrance
  return FadeInUp.duration(motion.folderDuration)
    .delay(motion.initialDelay + index * motion.folderStagger)
    .easing(OVERVIEW_ENTRANCE_EASING)
}

const getHeaderEnteringAnimation = (reduceMotion: boolean) => {
  if (reduceMotion) return undefined
  const motion = OFFLINE_SETUP_MOTION.overview.initialEntrance
  return FadeInDown.duration(motion.headerDuration)
    .delay(motion.headerDelay)
    .easing(OVERVIEW_ENTRANCE_EASING)
}

const OfflineSetupOverview = ({
  bottomInset,
  contentWidth,
  downloading,
  folderOptionIds,
  folderWidth,
  hero,
  mergeOffsets,
  onFolderPress,
  openingFolder,
  reduceMotion,
  registerFolder,
  returningFolder,
  safeAreaTop,
}: OfflineSetupOverviewProps) => {
  const { t } = useTranslation()
  const returning = hero?.direction === 'closing' || Boolean(returningFolder)

  return (
    <Box flex bg="lightGrey">
      <ScrollView
        style={{ overflow: 'visible' }}
        contentContainerStyle={{
          width: contentWidth,
          alignSelf: 'center',
          paddingTop: safeAreaTop + 26,
          paddingBottom: OVERVIEW_FOOTER_HEIGHT + bottomInset + 28,
          overflow: 'visible',
        }}
        showsVerticalScrollIndicator={false}
        removeClippedSubviews={false}
      >
        <AnimatedBox entering={getHeaderEnteringAnimation(reduceMotion)}>
          <AnimatedBox
            style={{
              opacity: openingFolder || downloading ? 0 : 1,
              transform: [{ translateY: openingFolder || downloading ? -10 : 0 }],
              transitionProperty: ['opacity', 'transform'],
              transitionDuration: downloading
                ? OFFLINE_SETUP_MOTION.overview.downloadFadeDuration
                : OFFLINE_SETUP_MOTION.overview.exitDuration,
              transitionTimingFunction: 'ease-out',
            }}
          >
            <Text title fontSize={40} lineHeight={42}>
              {t('offlineSetup.title')}
            </Text>
            <Text color="tertiary" fontSize={15} lineHeight={21} mt={10} mb={28}>
              {t('offlineSetup.subtitle')}
            </Text>
          </AnimatedBox>
        </AnimatedBox>

        <VStack gap={20} overflow="visible">
          {[0, 2].map(startIndex => (
            <HStack key={startIndex} gap={20} px={10} overflow="visible">
              {OFFLINE_SETUP_FOLDER_PRESENTATIONS.slice(startIndex, startIndex + 2).map(
                (folder, index) => {
                  const count = folderOptionIds[folder.id].length
                  const isHero = hero?.folderId === folder.id
                  const isMovingHero = isHero && hero?.direction !== 'settled'
                  const mergeOffset = mergeOffsets[folder.id]
                  const openingAnotherFolder = Boolean(openingFolder && openingFolder !== folder.id)
                  const isReturningFolder = returningFolder === folder.id
                  const folderOpacity = getFolderOpacity({
                    isMovingHero,
                    openingAnotherFolder,
                  })
                  const folderTranslateY = getFolderTranslateY({
                    openingAnotherFolder,
                  })
                  const folderScale = getFolderScale(openingAnotherFolder)
                  const transitionDuration = getFolderTransitionDuration({
                    heroSettled: isHero && hero?.direction === 'settled',
                    isHero,
                    isReturningFolder,
                  })
                  const enteringAnimation = getFolderEnteringAnimation({
                    index: startIndex + index,
                    isReturningFolder,
                    reduceMotion,
                    returning,
                  })
                  return (
                    <AnimatedBox key={folder.id} overflow="visible" entering={enteringAnimation}>
                      <OfflineSetupMergingFolder
                        active={downloading}
                        index={startIndex + index}
                        offset={mergeOffset}
                        reduceMotion={reduceMotion}
                      >
                        <AnimatedBox
                          style={{
                            opacity: folderOpacity,
                            transform: [{ translateY: folderTranslateY }, { scale: folderScale }],
                            transitionProperty: ['opacity', 'transform'],
                            transitionDuration,
                            transitionTimingFunction: 'ease-out',
                          }}
                        >
                          <View ref={node => registerFolder(folder.id, node)} collapsable={false}>
                            <OfflineResourceFolder
                              width={folderWidth}
                              title={t(`offlineSetup.presets.${folder.id}.title`)}
                              subtitle={t('offlineSetup.selectedCount', { count })}
                              icon={folder.icon}
                              itemCount={count}
                              selected={count > 0}
                              colors={folder.colors}
                              onPress={() => onFolderPress(folder.id)}
                            />
                          </View>
                        </AnimatedBox>
                      </OfflineSetupMergingFolder>
                    </AnimatedBox>
                  )
                }
              )}
            </HStack>
          ))}
        </VStack>
      </ScrollView>
    </Box>
  )
}

export default OfflineSetupOverview
