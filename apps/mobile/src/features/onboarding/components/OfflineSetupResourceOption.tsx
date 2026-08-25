import { Feather } from '@expo/vector-icons'
import { useTranslation } from 'react-i18next'
import { Pressable } from 'react-native'
import { FadeIn, FadeOut } from 'react-native-reanimated'

import Box, { AnimatedBox, FadingBox, HStack } from '~common/ui/Box'
import Text from '~common/ui/Text'
import type { ResourceLanguage } from '~helpers/databaseTypes'
import {
  getOfflineResourceSizeEntry,
  type OfflineResourceSizeManifest,
} from '~helpers/offlineResourceSizeManifest'
import formatResourceSize from '../formatResourceSize'
import { createDownloadItemFromOnboardingSelection } from '../onboardingResources'
import { OFFLINE_SETUP_MOTION } from '../offlineSetupMotion'
import type { OfflineSetupOption } from '../offlineSetupPresets'
import type { OfflineSetupPalette } from '../offlineSetupPalette'

type OfflineSetupResourceOptionProps = {
  lang: ResourceLanguage
  locked: boolean
  onPress: () => void
  option: OfflineSetupOption
  palette: OfflineSetupPalette
  selected: boolean
  sizeManifest: OfflineResourceSizeManifest
}

const getOptionBytes = (
  option: OfflineSetupOption,
  sizeManifest: OfflineResourceSizeManifest
): number =>
  [
    ...new Map(
      option.selections.map(selection => {
        const item = createDownloadItemFromOnboardingSelection(selection)
        return [item.id, item]
      })
    ).values(),
  ].reduce(
    (total, item) =>
      total + getOfflineResourceSizeEntry(item.id, item.estimatedSize, sizeManifest).installedBytes,
    0
  )

const OfflineSetupResourceOption = ({
  lang,
  locked,
  onPress,
  option,
  palette,
  selected,
  sizeManifest,
}: OfflineSetupResourceOptionProps) => {
  const { t } = useTranslation()
  let label = option.label
  if (option.labelKey) {
    label = t(option.labelKey, {
      name: option.label,
      language: option.language ? t(`offlineSetup.language.${option.language}`) : undefined,
    })
  }

  let description = option.description
  if (option.descriptionKey) description = t(option.descriptionKey)

  const selectedBorderColor = selected ? palette.accent : palette.itemBorder
  const checkboxBorderColor = selected ? palette.accent : palette.description
  const checkboxBackground = selected ? palette.accent : palette.itemSurface
  const pressMotion = OFFLINE_SETUP_MOTION.detail.resourceItem

  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked: selected }}
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => ({ opacity: pressed ? 0.88 : 1 })}
    >
      {({ pressed }) => (
        <AnimatedBox
          style={{
            transform: [{ scale: pressed ? pressMotion.pressedScale : 1 }],
            transitionProperty: 'transform',
            transitionDuration: pressed
              ? pressMotion.pressInDuration
              : pressMotion.pressOutDuration,
            transitionTimingFunction: 'ease-out',
          }}
        >
          <HStack
            minHeight={68}
            px={14}
            py={11}
            borderRadius={17}
            bg={palette.itemSurface}
            borderWidth={1.5}
            borderColor={selectedBorderColor}
            alignItems="center"
            gap={12}
          >
            <Box flex>
              <HStack alignItems="center" gap={7} wrap>
                <Text
                  color={palette.title}
                  title
                  fontSize={14}
                  lineHeight={18}
                  style={{ flexShrink: 1 }}
                >
                  {label}
                </Text>
                {locked ? (
                  <FadingBox
                    keyProp="included"
                    entering={FadeIn.duration(140)}
                    exiting={FadeOut.duration(140)}
                    skipEntering={false}
                    skipExiting={false}
                  >
                    <Box px={7} py={3} borderRadius={9} bg={palette.itemAccentSoft}>
                      <Text color={palette.itemAccentText} fontSize={9} bold>
                        {t('offlineSetup.includedBadge')}
                      </Text>
                    </Box>
                  </FadingBox>
                ) : null}
              </HStack>
              {description ? (
                <Text
                  color={palette.description}
                  fontSize={11}
                  lineHeight={15}
                  mt={3}
                  numberOfLines={1}
                >
                  {description}
                </Text>
              ) : null}
              <Text color={palette.description} fontSize={10} mt={4}>
                {formatResourceSize(getOptionBytes(option, sizeManifest), lang)}
              </Text>
            </Box>
            <FadingBox
              keyProp={selected ? 'selected' : 'unselected'}
              entering={FadeIn.duration(140)}
              exiting={FadeOut.duration(140)}
              skipEntering={false}
              skipExiting={false}
              size={22}
              borderRadius={11}
              borderWidth={1.5}
              borderColor={checkboxBorderColor}
              bg={checkboxBackground}
              center
            >
              {selected ? <Feather name="check" size={13} color={palette.onAccent} /> : null}
            </FadingBox>
          </HStack>
        </AnimatedBox>
      )}
    </Pressable>
  )
}

export default OfflineSetupResourceOption
