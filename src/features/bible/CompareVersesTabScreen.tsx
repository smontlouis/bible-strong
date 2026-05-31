import React, { useEffect } from 'react'
import { MenuView } from '@expo/ui/community/menu'
import { shallowEqual, useSelector } from 'react-redux'

import verseToReference from '~helpers/verseToReference'

import Empty from '~common/Empty'
import Header from '~common/Header'
import Box from '~common/ui/Box'
import Container from '~common/ui/Container'
import ScrollView from '~common/ui/ScrollView'
import BibleCompareVerseItem from '~features/bible/BibleCompareVerseItem'
import BibleVerseDetailFooter from '~features/bible/BibleVerseDetailFooter'

import { produce } from 'immer'
import { useAtom } from 'jotai/react'
import { PrimitiveAtom } from 'jotai/vanilla'
import { useTranslation } from 'react-i18next'
import countLsgChapters from '~assets/bible_versions/countLsgChapters'
import { FeatherIcon } from '~common/ui/Icon'
import { useOpenInNewTab } from '~features/app-switcher/utils/useOpenInNewTab'
import generateUUID from '~helpers/generateUUID'
import { versions } from '~helpers/bibleVersions'
import { getMaxChapterVerseCount } from '~helpers/bibleCoverage'
import { selectCompareVersions } from '~redux/selectors/user'
import { CompareTab, SelectedVerses, VersionCode } from '../../state/tabs'
import CompareVersionSelectorBottomSheet from './CompareVersionSelectorBottomSheet'
import type { BottomSheet as BottomSheetRef } from '~common/bottom-sheet'

interface CompareVersesTabScreenProps {
  compareAtom: PrimitiveAtom<CompareTab>
}

type PrevNextItems = {
  verseNumber: number
  versesInCurrentChapter: number
}

const CompareVersesTabScreen = ({ compareAtom }: CompareVersesTabScreenProps) => {
  const compareVersionSelectorRef = React.useRef<BottomSheetRef>(null)
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

  const [prevNextItems, setPrevNextItems] = React.useState<PrevNextItems>()
  const title = verseToReference(selectedVerses)
  const openInNewTab = useOpenInNewTab()
  const versionsToCompare = useSelector(selectCompareVersions, shallowEqual)
  useEffect(() => {
    setTitle(`${t('Comparer')} ${title}`)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title])

  const goToVerse = (value: number) => {
    const [livre, chapitre, verse] = Object.keys(selectedVerses)[0].split('-').map(Number)
    setSelectedVerses({ [`${livre}-${chapitre}-${verse + value}`]: true })
  }

  React.useEffect(() => {
    const hasPrevNextButtons = Object.keys(selectedVerses).length === 1
    let cancelled = false

    const loadPrevNextData = async () => {
      const [livre, chapitre, verse] = Object.keys(selectedVerses)[0].split('-').map(Number)
      const versesInCurrentChapter =
        (await getMaxChapterVerseCount(versionsToCompare, livre, chapitre)) ||
        countLsgChapters[`${livre}-${chapitre}`]
      if (cancelled) return
      setPrevNextItems({
        verseNumber: verse,
        versesInCurrentChapter,
      })
    }

    if (hasPrevNextButtons) {
      loadPrevNextData()
    }
    return () => {
      cancelled = true
    }
  }, [selectedVerses, versionsToCompare])

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
                case 'choose-versions':
                  compareVersionSelectorRef.current?.expand()
                  break
                case 'open-tab':
                  openInNewTab({
                    id: `compare-${generateUUID()}`,
                    title: t('tabs.new'),
                    isRemovable: true,
                    type: 'compare',
                    data: {
                      selectedVerses,
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
                versionId={versionId as VersionCode}
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
      <CompareVersionSelectorBottomSheet bottomSheetRef={compareVersionSelectorRef} />
    </Container>
  )
}
export default CompareVersesTabScreen
