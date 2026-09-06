import { resolveThemeColor, resolveFontFamily } from '~themes/styleValues'
import { useTheme as useStylingTheme } from '~themes/ThemeProvider'
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
  const stylingTheme = useStylingTheme()

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
          className="overflow-hidden border-continuous"
        >
          <HStack
            className="overflow-hidden border-continuous min-h-[68px] px-[14px] py-[11px] rounded-[17px] border-[1.5px] items-center gap-[12px]"
            style={{
              backgroundColor: resolveThemeColor(stylingTheme, palette.itemSurface),
              borderColor: resolveThemeColor(stylingTheme, selectedBorderColor),
            }}
          >
            <Box className="overflow-hidden border-continuous flex-[1]">
              <HStack className="overflow-hidden border-continuous items-center gap-[7px] flex-wrap">
                <Text
                  className="text-[14px] leading-[18px]"
                  style={[
                    {
                      color:
                        resolveThemeColor(stylingTheme, palette.title) ||
                        stylingTheme.colors.default,
                      fontFamily: resolveFontFamily(stylingTheme.fontFamily.title),
                    },
                    { flexShrink: 1 },
                  ]}
                >
                  {label}
                </Text>
                {locked ? (
                  <FadingBox
                    className="overflow-hidden border-continuous"
                    keyProp="included"
                    entering={FadeIn.duration(140)}
                    exiting={FadeOut.duration(140)}
                    skipEntering={false}
                    skipExiting={false}
                  >
                    <Box
                      className="overflow-hidden border-continuous px-[7px] py-[3px] rounded-[9px]"
                      style={{
                        backgroundColor: resolveThemeColor(stylingTheme, palette.itemAccentSoft),
                      }}
                    >
                      <Text
                        className="text-[9px] font-bold"
                        style={{
                          color:
                            resolveThemeColor(stylingTheme, palette.itemAccentText) ||
                            stylingTheme.colors.default,
                        }}
                      >
                        {t('offlineSetup.includedBadge')}
                      </Text>
                    </Box>
                  </FadingBox>
                ) : null}
              </HStack>
              {description ? (
                <Text
                  className="text-[11px] leading-[15px] mt-[3px]"
                  numberOfLines={1}
                  style={{
                    color:
                      resolveThemeColor(stylingTheme, palette.description) ||
                      stylingTheme.colors.default,
                  }}
                >
                  {description}
                </Text>
              ) : null}
              <Text
                className="text-[10px] mt-[4px]"
                style={{
                  color:
                    resolveThemeColor(stylingTheme, palette.description) ||
                    stylingTheme.colors.default,
                }}
              >
                {formatResourceSize(getOptionBytes(option, sizeManifest), lang)}
              </Text>
            </Box>
            <FadingBox
              className="overflow-hidden border-continuous rounded-[11px] border-[1.5px] items-center justify-center"
              keyProp={selected ? 'selected' : 'unselected'}
              entering={FadeIn.duration(140)}
              exiting={FadeOut.duration(140)}
              skipEntering={false}
              skipExiting={false}
              style={{
                backgroundColor: resolveThemeColor(stylingTheme, checkboxBackground),
                borderColor: resolveThemeColor(stylingTheme, checkboxBorderColor),
                width: 22,
                height: 22,
              }}
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
