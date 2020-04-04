import React from 'react'
import * as Icon from '@expo/vector-icons'
import { useSelector } from 'react-redux'
import styled from '@emotion/native'

import verseToReference from '~helpers/verseToReference'
import loadCountVerses from '~helpers/loadCountVerses'

import Container from '~common/ui/Container'
import Box from '~common/ui/Box'
import Empty from '~common/Empty'
import ScrollView from '~common/ui/ScrollView'
import Header from '~common/Header'
import Link from '~common/Link'
import BibleCompareVerseItem from '~features/bible/BibleCompareVerseItem'
import BibleVerseDetailFooter from '~features/bible/BibleVerseDetailFooter'

import { versions } from '~helpers/bibleVersions'

const StyledIcon = styled(Icon.Feather)(({ theme }) => ({
  color: theme.colors.default,
}))

const BibleCompareVerses = ({ navigation }) => {
  const { selectedVerses: s } = navigation.state.params || {}
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
      const { versesInCurrentChapter, error } = await loadCountVerses(
        livre,
        chapitre
      )
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
        hasBackButton
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
        <Box paddingBottom={20}>
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
export default BibleCompareVerses
