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
        minHeight={72}
        row
        alignItems="center"
        px={20}
        py={12}
        opacity={available ? 1 : 0.42}
        borderBottomWidth={1}
        borderColor="border"
        borderLeftWidth={isSelected ? 3 : 0}
        borderLeftColor="primary"
      >
        {showSelectionCheckbox && (
          <Box width={42} center>
            <Checkbox checked={Boolean(isSelected)} variant="icon" size={22} />
          </Box>
        )}
        <Box flex>
          <Text color={isSelected ? 'primary' : 'default'} fontSize={12} opacity={0.5} bold>
            {version.id}
          </Text>
          <Text color={isSelected ? 'primary' : 'default'} fontSize={16}>
            {version.displayName || version.name}
          </Text>
          {version.c ? (
            <Text color="tertiary" fontSize={10} numberOfLines={1}>
              {version.c}
            </Text>
          ) : null}
        </Box>
        <Box width={42} center>
          <FeatherIcon name={available ? (isSelected ? 'check' : 'cloud') : 'slash'} size={18} />
        </Box>
      </Box>
    </TouchableOpacity>
  )
}

export default VersionSelectorItem
