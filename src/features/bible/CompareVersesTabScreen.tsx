import React, { useEffect } from 'react'
import { MenuView } from '~common/ui/MenuView'

import verseToReference from '~helpers/verseToReference'

import Header from '~common/Header'
import Box from '~common/ui/Box'
import Container from '~common/ui/Container'
import ScrollView from '~common/ui/ScrollView'

import { produce } from 'immer'
import { useAtom } from 'jotai/react'
import { PrimitiveAtom } from 'jotai/vanilla'
import { useTranslation } from 'react-i18next'
import { FeatherIcon } from '~common/ui/Icon'
import { useOpenInNewTab } from '~features/app-switcher/utils/useOpenInNewTab'
import generateUUID from '~helpers/generateUUID'
import { CompareTab, SelectedVerses } from '../../state/tabs'
import CompareVersionSelectorSheet from './CompareVersionSelectorSheet'
import type { SheetRef } from '~common/sheet'
import CompareCard from './resources/CompareCard'

interface CompareVersesTabScreenProps {
  compareAtom: PrimitiveAtom<CompareTab>
}

const CompareVersesTabScreen = ({ compareAtom }: CompareVersesTabScreenProps) => {
  const compareVersionSelectorRef = React.useRef<SheetRef>(null)
  const [compareTab, setCompareTab] = useAtom(compareAtom)
  const { t } = useTranslation()
  const setSelectedVerses = (v: SelectedVerses) =>
    setCompareTab(
      produce(draft => {
        draft.data.selectedVerses = v
      })
    )

  const setTitle = (title: string) =>
    setCompareTab(
      produce(draft => {
        draft.title = title
      })
    )
  const toggleStrongMode = () =>
    setCompareTab(
      produce(draft => {
        draft.data.strongMode = !draft.data.strongMode
      })
    )

  const {
    hasBackButton,
    data: { selectedVerses, strongMode = false },
  } = compareTab

  const title = verseToReference(selectedVerses)
  const openInNewTab = useOpenInNewTab()
  useEffect(() => {
    setTitle(`${t('Comparer')} ${title}`)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title])

  return (
    <Container>
      <Header
        hasBackButton={hasBackButton}
        fontSize={16}
        title={title}
        rightComponent={
          <MenuView
            actions={[
              {
                id: 'toggle-strong',
                title: t('Mode Strong'),
                image: 'number',
                state: strongMode ? 'on' : 'off',
              },
              {
                id: 'choose-versions',
                title: t('common.chooseCompareVersions'),
                image: 'checkmark.square',
              },
              {
                id: 'open-tab',
                title: t('tab.openInNewTab'),
                image: 'arrow.up.forward.square',
              },
            ]}
            onPressAction={({ nativeEvent }) => {
              switch (nativeEvent.event) {
                case 'toggle-strong':
                  toggleStrongMode()
                  break
                case 'choose-versions':
                  compareVersionSelectorRef.current?.present()
                  break
                case 'open-tab':
                  openInNewTab({
                    id: `compare-${generateUUID()}`,
                    title: t('tabs.new'),
                    isRemovable: true,
                    type: 'compare',
                    data: {
                      selectedVerses,
                      strongMode,
                    },
                  })
                  break
              }
            }}
          >
            <Box row center height={60} width={60}>
              <FeatherIcon name="more-vertical" size={18} />
            </Box>
          </MenuView>
        }
      />
      <ScrollView contentContainerStyle={{ paddingBottom: 20, flexGrow: 1 }}>
        <CompareCard
          selectedVerses={selectedVerses}
          strongMode={strongMode}
          onChangeVerse={verse => setSelectedVerses({ [verse]: true })}
          onChooseVersions={() => compareVersionSelectorRef.current?.present()}
        />
      </ScrollView>
      <CompareVersionSelectorSheet sheetRef={compareVersionSelectorRef} />
    </Container>
  )
}
export default CompareVersesTabScreen
