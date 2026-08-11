import { Feather } from '@expo/vector-icons'
import { useTheme } from '@emotion/react'
import { useTranslation } from 'react-i18next'
import { Pressable } from 'react-native'
import { FadeIn, FadeOut } from 'react-native-reanimated'

import Box, { FadingBox, HStack } from '~common/ui/Box'
import Text from '~common/ui/Text'
import type { ResourceLanguage } from '~helpers/databaseTypes'
import {
  getOfflineResourceSizeEntry,
  type OfflineResourceSizeManifest,
} from '~helpers/offlineResourceSizeManifest'
import formatResourceSize from '../formatResourceSize'
import { createDownloadItemFromOnboardingSelection } from '../onboardingResources'
import type { OfflineSetupOption } from '../offlineSetupPresets'
import type { OfflineSetupFolderVisual } from '../offlineSetupPresentation'

type OfflineSetupResourceOptionProps = {
  lang: ResourceLanguage
  locked: boolean
  onPress: () => void
  option: OfflineSetupOption
  selected: boolean
  sizeManifest: OfflineResourceSizeManifest
  visual: OfflineSetupFolderVisual
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
  selected,
  sizeManifest,
  visual,
}: OfflineSetupResourceOptionProps) => {
  const { t } = useTranslation()
  const theme = useTheme()
  let label = option.label
  if (option.labelKey) {
    label = t(option.labelKey, {
      name: option.label,
      language: option.language ? t(`offlineSetup.language.${option.language}`) : undefined,
    })
  }

  let description = option.description
  if (option.descriptionKey) description = t(option.descriptionKey)

  const badgeKey = option.required ? 'offlineSetup.requiredBadge' : 'offlineSetup.includedBadge'
  const selectedBorderColor = selected ? visual.colors.frontEnd : theme.colors.border
  const checkboxBorderColor = selected ? visual.colors.frontEnd : theme.colors.tertiary
  const checkboxBackground = selected ? visual.colors.frontEnd : theme.colors.reverse

  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked: selected, disabled: option.required }}
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => ({ opacity: pressed && !option.required ? 0.8 : 1 })}
    >
      <HStack
        minHeight={68}
        px={14}
        py={11}
        borderRadius={17}
        bg="reverse"
        borderWidth={1.5}
        borderColor={selectedBorderColor}
        alignItems="center"
        gap={12}
      >
        <Box flex>
          <HStack alignItems="center" gap={7} wrap>
            <Text title fontSize={14} lineHeight={18} style={{ flexShrink: 1 }}>
              {label}
            </Text>
            {locked ? (
              <FadingBox
                keyProp={option.required ? 'required' : 'included'}
                entering={FadeIn.duration(140)}
                exiting={FadeOut.duration(140)}
                skipEntering={false}
                skipExiting={false}
              >
                <Box px={7} py={3} borderRadius={9} bg={visual.colors.back}>
                  <Text color={visual.colors.icon} fontSize={9} bold>
                    {t(badgeKey)}
                  </Text>
                </Box>
              </FadingBox>
            ) : null}
          </HStack>
          {description ? (
            <Text color="tertiary" fontSize={11} lineHeight={15} mt={3} numberOfLines={1}>
              {description}
            </Text>
          ) : null}
          <Text color="tertiary" fontSize={10} mt={4}>
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
          {selected ? <Feather name="check" size={13} color="#FFFFFF" /> : null}
        </FadingBox>
      </HStack>
    </Pressable>
  )
}

export default OfflineSetupResourceOption
