import React from 'react'
import * as Icon from '@expo/vector-icons'
import { useSelector } from 'react-redux'
import styled from '@emotion/native'

import verseToReference from '~helpers/verseToReference'

import Container from '~common/ui/Container'
import Box from '~common/ui/Box'
import Empty from '~common/Empty'
import ScrollView from '~common/ui/ScrollView'
import Header from '~common/Header'
import Link from '~common/Link'
import BibleCompareVerseItem from '~features/bible/BibleCompareVerseItem'
import BibleVerseDetailFooter from '~features/bible/BibleVerseDetailFooter'

import { versions } from '~helpers/bibleVersions'
import countLsgChapters from '~assets/bible_versions/countLsgChapters'
import { NavigationStackProp } from 'react-navigation-stack'
import { PrimitiveAtom, useAtomValue } from 'jotai'
import { CompareTab } from '~state/tabs'
import { getBottomSpace } from 'react-native-iphone-x-helper'

const StyledIcon = styled(Icon.Feather)(({ theme }) => ({
  color: theme.colors.default,
}))

interface CompareVersesTabScreenProps {
  navigation: NavigationStackProp
  compareAtom: PrimitiveAtom<CompareTab>
}

const CompareVersesTabScreen = ({
  compareAtom,
  navigation,
}: CompareVersesTabScreenProps) => {
  const compareTab = useAtomValue(compareAtom)

  const {
    hasBackButton,
    data: { selectedVerses: s },
  } = compareTab

  const [selectedVerses, setSelectedVerses] = React.useState(s)
  const [prevNextItems, setPrevNextItems] = React.useState()
  const title = verseToReference(selectedVerses)

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

  const versionsToCompare = useSelector(state =>
    Object.keys(state.user.bible.settings.compare)
  )

  return (
    <Container>
      <Header
        hasBackButton={hasBackButton}
        fontSize={16}
        title={title}
        rightComponent={
          <Link route="ToggleCompareVerses" padding>
            <StyledIcon name="check-square" size={20} />
          </Link>
        }
      />
      <ScrollView key={title}>
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
                key={versionId}
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
