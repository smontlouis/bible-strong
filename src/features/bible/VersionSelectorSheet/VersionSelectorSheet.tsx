import { Sheet, SheetHeader, type SheetRef } from '~common/sheet'
import { useAtomValue, useSetAtom } from 'jotai/react'
import { atom } from 'jotai/vanilla'
import React from 'react'
import { useTranslation } from 'react-i18next'
import { SectionList } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import Border from '~common/ui/Border'
import Box from '~common/ui/Box'
import Text from '~common/ui/Text'
import { getVersionsBySections } from '~helpers/bibleVersions'
import { BibleTab, BibleTabActions, VersionCode } from '../../../state/tabs'
import VersionSelectorItem from '../VersionSelectorItem'
import { bookSelectorDataAtom } from '../BookSelectorSheet/BookSelectorSheet'
import { useTheme } from '@emotion/react'

interface VersionSelectorSheetProps {
  sheetRef: React.RefObject<SheetRef | null>
}

export const versionSelectorDataAtom = atom<{
  actions?: Pick<BibleTabActions, 'setSelectedVersion' | 'setParallelVersion'>
  data?: BibleTab['data']
  parallelVersionIndex?: number
}>({})

const VersionSelectorSheet = ({ sheetRef }: VersionSelectorSheetProps) => {
  const insets = useSafeAreaInsets()
  const { t } = useTranslation()
  const theme = useTheme()

  const { actions, data, parallelVersionIndex } = useAtomValue(versionSelectorDataAtom)
  const setBookSelectorData = useSetAtom(bookSelectorDataAtom)

  const handleVersionSelect = (vers: VersionCode) => {
    if (!actions) return

    if (parallelVersionIndex === undefined) {
      actions.setSelectedVersion(vers)
      setBookSelectorData(current => ({
        ...current,
        data: current.data
          ? {
              ...current.data,
              selectedVersion: vers,
            }
          : current.data,
      }))
    } else {
      actions.setParallelVersion(vers, parallelVersionIndex)
    }
    sheetRef.current?.dismiss()
  }

  return (
    <Sheet
      ref={sheetRef}
      snapPoints={[1]}
      backgroundColor={theme.colors.reverse}
      header={<SheetHeader title={t('Version')} centerTitle />}
    >
      <SectionList
        contentContainerStyle={{
          paddingTop: 0,
          paddingBottom: insets.bottom,
        }}
        stickySectionHeadersEnabled={false}
        sections={getVersionsBySections()}
        keyExtractor={item => item.id}
        renderSectionHeader={({ section: { title } }) => (
          <Box paddingHorizontal={20} marginTop={30}>
            <Text fontSize={16} color="tertiary">
              {title}
            </Text>
            <Border marginTop={10} />
          </Box>
        )}
        renderItem={({ item }) => (
          <VersionSelectorItem
            onChange={handleVersionSelect}
            version={item}
            isSelected={
              item.id ===
              (parallelVersionIndex === undefined
                ? data?.selectedVersion
                : data?.parallelVersions[parallelVersionIndex])
            }
          />
        )}
      />
    </Sheet>
  )
}

export default VersionSelectorSheet
