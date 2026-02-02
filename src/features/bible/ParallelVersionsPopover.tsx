import { useTranslation } from 'react-i18next'

import Box from '~common/ui/Box'
import { FeatherIcon } from '~common/ui/Icon'
import MenuOption from '~common/ui/MenuOption'
import Text from '~common/ui/Text'
import { VersionCode } from '../../state/tabs'

interface ParallelVersionsPopoverProps {
  version: VersionCode
  parallelVersions: VersionCode[]
  addParallelVersion: () => void
  removeParallelVersion: (index: number) => void
  removeAllParallelVersions: () => void
}

const ParallelVersionsPopover = ({
  version,
  parallelVersions,
  addParallelVersion,
  removeParallelVersion,
  removeAllParallelVersions,
}: ParallelVersionsPopoverProps) => {
  const { t } = useTranslation()

  return (
    <>
      <MenuOption disabled>
        <Box row alignItems="center">
          <Text fontWeight="bold">{version}</Text>
          <Text marginLeft={10} color="grey" fontSize={12}>
            {t('Version principale')}
          </Text>
        </Box>
      </MenuOption>

      {parallelVersions.map((pVersion, index) => (
        <MenuOption key={`${pVersion}-${index}`} onSelect={() => removeParallelVersion(index)}>
          <Box row alignItems="center" justifyContent="space-between" flex={1}>
            <Text>{pVersion}</Text>
            <FeatherIcon name="x-circle" size={16} color="quart" />
          </Box>
        </MenuOption>
      ))}

      <Box height={1} bg="border" marginVertical={5} />

      {parallelVersions.length < 3 && (
        <MenuOption onSelect={addParallelVersion}>
          <Box row alignItems="center">
            <FeatherIcon name="plus-circle" size={18} />
            <Text marginLeft={10}>{t('Ajouter une version')}</Text>
          </Box>
        </MenuOption>
      )}

      <MenuOption onSelect={removeAllParallelVersions}>
        <Box row alignItems="center">
          <FeatherIcon name="log-out" size={18} />
          <Text marginLeft={10}>{t('Sortir du mode parallèle')}</Text>
        </Box>
      </MenuOption>
    </>
  )
}

export default ParallelVersionsPopover
