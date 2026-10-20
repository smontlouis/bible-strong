import { isStrongCapableBibleVersion } from '~helpers/strongBiblePublications'
import { isInterlinearCapableBibleVersion } from '~helpers/interlinearBiblePublications'
import StrongMark from './StrongMark'
import InterlinearShortcut from './InterlinearShortcut'
import { twMerge } from '~common/ui/classNames'

import { TouchableOpacity } from 'react-native'
import { useTranslation } from 'react-i18next'
import Box from '~common/ui/Box'
import Checkbox from '~common/ui/Checkbox'
import { FeatherIcon } from '~common/ui/Icon'
import Text from '~common/ui/Text'
import { useResourceAccess } from '~features/resources/resourceAccess'
import type { Props } from './VersionSelectorItem'
const VersionSelectorItem = ({
  version,
  isSelected,
  onChange,
  showSelectionCheckbox,
  showStrongIndex,
  selectionRequirement = 'bible',
  onOpenInterlinear,
}: Props) => {
  const { t } = useTranslation()
  const resources = useResourceAccess()
  const identity =
    selectionRequirement === 'strong'
      ? ({ kind: 'strong-bible-index', versionId: version.id } as const)
      : ({ kind: 'bible-text', versionId: version.id } as const)
  const available = resources.capabilities.getOnlineAccess(identity).status === 'remotely-readable'
  const showInterlinearCapability = showStrongIndex && isInterlinearCapableBibleVersion(version.id)

  return (
    <Box
      className="border-continuous overflow-hidden border-b-[1px] border-border"
      style={{ borderLeftWidth: isSelected ? 3 : 0 }}
    >
      <TouchableOpacity
        accessibilityRole={showSelectionCheckbox ? 'checkbox' : 'button'}
        accessibilityState={{
          ...(showSelectionCheckbox ? { checked: Boolean(isSelected) } : {}),
          disabled: !available,
        }}
        disabled={!available}
        onPress={() => onChange?.(version.id)}
      >
        <Box
          className="border-continuous overflow-hidden min-h-[72px] flex-row items-center px-[20px] py-[12px]"
          style={{ opacity: available ? 1 : 0.42 }}
        >
          {showSelectionCheckbox && (
            <Box className="overflow-hidden border-continuous w-[42px] items-center justify-center">
              <Checkbox checked={Boolean(isSelected)} size={22} />
            </Box>
          )}
          <Box className="overflow-hidden border-continuous flex-[1]">
            <Text
              className={twMerge(
                isSelected ? 'text-primary' : 'text-default',
                'text-[12px] opacity-[0.5] font-bold'
              )}
            >
              {version.id}
            </Text>
            <Box className="flex-row items-center gap-[5px] flex-wrap">
              <Text
                className={twMerge(
                  isSelected ? 'text-primary' : 'text-default',
                  'text-[16px] shrink'
                )}
              >
                {version.displayName || version.name}
              </Text>
              {version.hasAudio && <FeatherIcon name="volume-2" size={16} color="primary" />}
              {(showStrongIndex || selectionRequirement === 'strong') &&
                isStrongCapableBibleVersion(version.id) && <StrongMark passive />}
            </Box>
            {showInterlinearCapability && (
              <Text className="text-[13px] leading-[18px] text-tertiary mt-[2px]">
                {t('versionSelector.interlinearDescription')}
              </Text>
            )}
            {version.c ? (
              <Text className="text-tertiary text-[10px]" numberOfLines={1}>
                {version.c}
              </Text>
            ) : null}
          </Box>
          {(isSelected || !available) && (
            <Box className="overflow-hidden border-continuous w-[42px] items-center justify-center">
              <FeatherIcon name={available ? 'check' : 'slash'} size={18} />
            </Box>
          )}
        </Box>
      </TouchableOpacity>
      {/* Beside the row's button, not inside it: a web button cannot hold another one */}
      {showInterlinearCapability && onOpenInterlinear && available && (
        <Box className="overflow-visible border-continuous px-[20px] pb-[14px] mt-[-4px]">
          <InterlinearShortcut onPress={() => onOpenInterlinear(version.id)} />
        </Box>
      )}
    </Box>
  )
}

export default VersionSelectorItem
