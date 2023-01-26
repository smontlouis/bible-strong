import React, { useEffect } from 'react'
import { shallowEqual, useSelector } from 'react-redux'

import verseToReference from '~helpers/verseToReference'

import Empty from '~common/Empty'
import Header from '~common/Header'
import Box from '~common/ui/Box'
import Container from '~common/ui/Container'
import ScrollView from '~common/ui/ScrollView'
import BibleCompareVerseItem from '~features/bible/BibleCompareVerseItem'
import BibleVerseDetailFooter from '~features/bible/BibleVerseDetailFooter'

import produce from 'immer'
import { PrimitiveAtom } from 'jotai/vanilla'
import { useAtom } from 'jotai/react'
import { useTranslation } from 'react-i18next'
import { getBottomSpace } from 'react-native-iphone-x-helper'
import { NavigationStackProp } from 'react-navigation-stack'
import countLsgChapters from '~assets/bible_versions/countLsgChapters'
import PopOverMenu from '~common/PopOverMenu'
import { FeatherIcon } from '~common/ui/Icon'
import MenuOption from '~common/ui/MenuOption'
import Text from '~common/ui/Text'
import { versions } from '~helpers/bibleVersions'
import { CompareTab, SelectedVerses } from '~state/tabs'
import { useOpenInNewTab } from '~features/app-switcher/utils/useOpenInNewTab'

interface CompareVersesTabScreenProps {
  navigation: NavigationStackProp
  compareAtom: PrimitiveAtom<CompareTab>
}

const CompareVersesTabScreen = ({
  compareAtom,
  navigation,
}: CompareVersesTabScreenProps) => {
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

  const {
    hasBackButton,
    data: { selectedVerses },
  } = compareTab

  const [prevNextItems, setPrevNextItems] = React.useState()
  const title = verseToReference(selectedVerses)
  const openInNewTab = useOpenInNewTab()
  useEffect(() => {
    setTitle(`${t('Comparer')} ${title}`)
  }, [title])

  const goToVerse = value => {
    const [livre, chapitre, verse] = Object.keys(selectedVerses)[0]
      .split('-')
      .map(Number)
    setSelectedVerses({ [`${livre}-${chapitre}-${verse + value}`]: true })
  }

  React.useEffect(() => {
    const hasPrevNextButtons = Object.keys(selectedVerses).length === 1

    const loadPrevNextData = async () => {
      const [livre, chapitre, verse] = Object.keys(selectedVerses)[0].split('-')
      const versesInCurrentChapter = countLsgChapters[`${livre}-${chapitre}`]
      setPrevNextItems({
        verseNumber: verse,
        versesInCurrentChapter,
      })
    }

    if (hasPrevNextButtons) {
      loadPrevNextData()
    }
  }, [selectedVerses])

  const versionsToCompare = useSelector(
    state => Object.keys(state.user.bible.settings.compare),
    shallowEqual
  )

  return (
    <Container>
      <Header
        hasBackButton={hasBackButton}
        fontSize={16}
        title={title}
        rightComponent={
          <PopOverMenu
            popover={
              <>
                <MenuOption
                  onSelect={() => navigation.navigate('ToggleCompareVerses')}
                >
                  <Box row alignItems="center">
                    <FeatherIcon name="check-square" size={15} />
                    <Text marginLeft={10}>
                      {t('common.chooseCompareVersions')}
                    </Text>
                  </Box>
                </MenuOption>
                <MenuOption
                  onSelect={() => {
                    openInNewTab({
                      id: `compare-${Date.now()}`,
                      title: t('tabs.new'),
                      isRemovable: true,
                      type: 'compare',
                      data: {
                        selectedVerses,
                      },
                    })
                  }}
                >
                  <Box row alignItems="center">
                    <FeatherIcon name="external-link" size={15} />
                    <Text marginLeft={10}>{t('tab.openInNewTab')}</Text>
                  </Box>
                </MenuOption>
              </>
            }
          />
        }
      />
      <ScrollView>
        {!Object.entries(versions).filter(([versionId]) =>
          versionsToCompare.includes(versionId)
        ).length ? (
          <Empty
            source={require('~assets/images/empty.json')}
            message="Aucune version à comparer..."
          />
        ) : (
          Object.entries(versions)
            .filter(([versionId]) => versionsToCompare.includes(versionId))
            .map(([versionId, obj], position) => (
              <BibleCompareVerseItem
                key={`${versionId}-${title}`}
                versionId={versionId}
                name={obj.name}
                selectedVerses={selectedVerses}
                position={position}
              />
            ))
        )}
      </ScrollView>
      {prevNextItems && (
        <Box paddingBottom={getBottomSpace()} bg="reverse">
          <BibleVerseDetailFooter
            verseNumber={prevNextItems.verseNumber}
            goToNextVerse={() => goToVerse(+1)}
            goToPrevVerse={() => goToVerse(-1)}
            versesInCurrentChapter={prevNextItems.versesInCurrentChapter}
          />
        </Box>
      )}
    </Container>
  )
}
export default CompareVersesTabScreen
