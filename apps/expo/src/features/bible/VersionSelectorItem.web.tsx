import { isStrongCapableBibleVersion } from '~helpers/strongBiblePublications'
import { isInterlinearCapableBibleVersion } from '~helpers/interlinearBiblePublications'
import StrongMark from './StrongMark'
import InterlinearMark from './InterlinearMark'
import { twMerge } from '~common/ui/classNames'

import { TouchableOpacity } from 'react-native'
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
}: Props) => {
  const resources = useResourceAccess()
  const identity =
    selectionRequirement === 'strong'
      ? ({ kind: 'strong-bible-index', versionId: version.id } as const)
      : ({ kind: 'bible-text', versionId: version.id } as const)
  const available = resources.capabilities.getOnlineAccess(identity).status === 'remotely-readable'

  return (
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
        className="border-continuous overflow-hidden min-h-[72px] flex-row items-center px-[20px] py-[12px] border-b-[1px] border-border"
        style={{ borderLeftWidth: isSelected ? 3 : 0, opacity: available ? 1 : 0.42 }}
      >
        {showSelectionCheckbox && (
          <Box className="overflow-hidden border-continuous w-[42px] items-center justify-center">
            <Checkbox checked={Boolean(isSelected)} variant="icon" size={22} />
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
            {showStrongIndex && isInterlinearCapableBibleVersion(version.id) && (
              <InterlinearMark passive />
            )}
          </Box>
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
  )
}

export default VersionSelectorItem
