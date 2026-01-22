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

import { useRouter } from 'expo-router'
import produce from 'immer'
import { useAtom } from 'jotai/react'
import { PrimitiveAtom } from 'jotai/vanilla'
import { useTranslation } from 'react-i18next'
import countLsgChapters from '~assets/bible_versions/countLsgChapters'
import PopOverMenu from '~common/PopOverMenu'
import { FeatherIcon } from '~common/ui/Icon'
import MenuOption from '~common/ui/MenuOption'
import Text from '~common/ui/Text'
import { useOpenInNewTab } from '~features/app-switcher/utils/useOpenInNewTab'
import generateUUID from '~helpers/generateUUID'
import { versions } from '~helpers/bibleVersions'
import { selectCompareVersions } from '~redux/selectors/user'
import { CompareTab, SelectedVerses } from '../../state/tabs'

interface CompareVersesTabScreenProps {
  compareAtom: PrimitiveAtom<CompareTab>
}

const CompareVersesTabScreen = ({ compareAtom }: CompareVersesTabScreenProps) => {
  const router = useRouter()
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

  const [prevNextItems, setPrevNextItems] = React.useState<any>()
  const title = verseToReference(selectedVerses)
  const openInNewTab = useOpenInNewTab()
  useEffect(() => {
    setTitle(`${t('Comparer')} ${title}`)
  }, [title])

  const goToVerse = (value: any) => {
    const [livre, chapitre, verse] = Object.keys(selectedVerses)[0].split('-').map(Number)
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

  const versionsToCompare = useSelector(selectCompareVersions, shallowEqual)

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
                <MenuOption onSelect={() => router.push('/toggle-compare-verses')}>
                  <Box row alignItems="center">
                    <FeatherIcon name="check-square" size={15} />
                    <Text marginLeft={10}>{t('common.chooseCompareVersions')}</Text>
                  </Box>
                </MenuOption>
                <MenuOption
                  onSelect={() => {
                    openInNewTab({
                      id: `compare-${generateUUID()}`,
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
        {!Object.entries(versions).filter(([versionId]) => versionsToCompare.includes(versionId))
          .length ? (
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
        <Box bg="reverse" borderTopWidth={1} borderColor="border">
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
