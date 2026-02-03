import { useTranslation } from 'react-i18next'

import Box, { AnimatedBox, HStack } from '~common/ui/Box'
import { FeatherIcon } from '~common/ui/Icon'
import MenuOption from '~common/ui/MenuOption'
import Text from '~common/ui/Text'
import { ParallelColumnWidth, VersionCode } from '../../state/tabs'
import { useEffect } from 'react'

interface ParallelVersionsPopoverProps {
  version: VersionCode
  parallelVersions: VersionCode[]
  addParallelVersion: () => void
  removeParallelVersion: (index: number) => void
  removeAllParallelVersions: () => void
  columnWidth: ParallelColumnWidth
  setColumnWidth: (width: ParallelColumnWidth) => void
}

const ParallelVersionsPopover = ({
  version,
  parallelVersions,
  addParallelVersion,
  removeParallelVersion,
  removeAllParallelVersions,
  columnWidth,
  setColumnWidth,
}: ParallelVersionsPopoverProps) => {
  const { t } = useTranslation()

  const toggleColumnWidth = () => {
    // Cycle: 50 -> 75 -> 100 -> 50
    const nextWidth = columnWidth === 50 ? 75 : columnWidth === 75 ? 100 : 50
    setColumnWidth(nextWidth)
  }

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
            <Text fontWeight="bold">{pVersion}</Text>
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

      <MenuOption onSelect={toggleColumnWidth} closeOnSelect={false}>
        <Box row alignItems="center">
          <FeatherIcon name="columns" size={18} />
          <Text marginLeft={10}>{t('Largeur des colonnes')}</Text>
          <HStack ml="auto" width={40} height={20}>
            <AnimatedBox
              height={20}
              style={{
                transitionProperty: 'width',
                transitionDuration: '0.4s',
                width: `${columnWidth}%`,
              }}
            >
              <Box position="absolute" inset={2} bg="primary" borderRadius={3} />
            </AnimatedBox>
            <AnimatedBox
              height={20}
              style={{
                transitionProperty: 'width',
                transitionDuration: '0.4s',
                width: `${100 - columnWidth}%`,
              }}
            >
              <Box position="absolute" inset={2} bg="tertiary" borderRadius={3} />
            </AnimatedBox>
          </HStack>
        </Box>
      </MenuOption>

      <MenuOption onSelect={removeAllParallelVersions}>
        <Box row alignItems="center">
          <FeatherIcon name="log-out" color="quart" size={18} />
          <Text marginLeft={10}>{t('Sortir du mode parallèle')}</Text>
        </Box>
      </MenuOption>
    </>
  )
}

export default ParallelVersionsPopover
