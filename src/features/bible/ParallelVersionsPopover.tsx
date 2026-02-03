import { useTranslation } from 'react-i18next'

import Box, { AnimatedBox, FadingBox, FadingText, HStack } from '~common/ui/Box'
import { FeatherIcon } from '~common/ui/Icon'
import MenuOption from '~common/ui/MenuOption'
import Text from '~common/ui/Text'
import { ParallelColumnWidth, ParallelDisplayMode, VersionCode } from '../../state/tabs'

interface ParallelVersionsPopoverProps {
  version: VersionCode
  parallelVersions: VersionCode[]
  addParallelVersion: () => void
  removeParallelVersion: (index: number) => void
  removeAllParallelVersions: () => void
  columnWidth: ParallelColumnWidth
  setColumnWidth: (width: ParallelColumnWidth) => void
  displayMode: ParallelDisplayMode
  setDisplayMode: (mode: ParallelDisplayMode) => void
}

const ParallelVersionsPopover = ({
  version,
  parallelVersions,
  addParallelVersion,
  removeParallelVersion,
  removeAllParallelVersions,
  columnWidth,
  setColumnWidth,
  displayMode,
  setDisplayMode,
}: ParallelVersionsPopoverProps) => {
  const { t } = useTranslation()

  const toggleColumnWidth = () => {
    // Cycle: 50 -> 75 -> 100 -> 50
    const nextWidth = columnWidth === 50 ? 75 : columnWidth === 75 ? 100 : 50
    setColumnWidth(nextWidth)
  }

  const toggleDisplayMode = () => {
    setDisplayMode(displayMode === 'horizontal' ? 'vertical' : 'horizontal')
  }

  const isVertical = displayMode === 'vertical'
  const columnWidthIconPadding = 3

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
            <Text marginLeft={5}>{t('Ajouter une version')}</Text>
          </Box>
        </MenuOption>
      )}

      <MenuOption onSelect={toggleDisplayMode} closeOnSelect={false}>
        <Box row alignItems="center">
          <FeatherIcon name={isVertical ? 'arrow-down' : 'arrow-right'} size={18} />
          <FadingText marginLeft={5}>
            {isVertical ? t('Affichage vertical') : t('Affichage horizontal')}
          </FadingText>
        </Box>
      </MenuOption>

      {!isVertical && (
        <MenuOption onSelect={toggleColumnWidth} closeOnSelect={false}>
          <FadingBox
            keyProp="columnWidth"
            skipEntering={false}
            skipExiting={false}
            direction="bottom"
            row
            alignItems="center"
          >
            <FeatherIcon name="columns" size={18} />
            <Text marginLeft={5}>{t('Largeur des colonnes')}</Text>
            <HStack
              ml={15}
              width={30}
              height={17}
              borderRadius={5}
              bg="lightPrimary"
              alignItems="center"
            >
              <AnimatedBox
                height={17}
                style={{
                  transitionProperty: 'width',
                  transitionDuration: '0.4s',
                  width: `${columnWidth === 75 ? 60 : columnWidth}%`,
                }}
              >
                <Box
                  position="absolute"
                  top={columnWidthIconPadding}
                  bottom={columnWidthIconPadding}
                  left={columnWidthIconPadding}
                  right={columnWidth === 100 ? columnWidthIconPadding : columnWidthIconPadding / 2}
                  bg="primary"
                  borderRadius={3}
                />
              </AnimatedBox>
              <AnimatedBox
                height={17}
                style={{
                  transitionProperty: 'width',
                  transitionDuration: '0.4s',
                  width: `${100 - (columnWidth === 75 ? 60 : columnWidth)}%`,
                }}
              >
                <Box
                  position="absolute"
                  top={columnWidthIconPadding}
                  bottom={columnWidthIconPadding}
                  left={columnWidthIconPadding / 2}
                  right={columnWidthIconPadding}
                  bg="tertiary"
                  borderRadius={3}
                />
              </AnimatedBox>
            </HStack>
          </FadingBox>
        </MenuOption>
      )}

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
