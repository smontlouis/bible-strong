import React from 'react'
import * as Icon from '@expo/vector-icons'
import { useSelector } from 'react-redux'

import verseToReference from '~helpers/verseToReference'
import Container from '~common/ui/Container'
import Empty from '~common/Empty'
import ScrollView from '~common/ui/ScrollView'
import Header from '~common/Header'
import Link from '~common/Link'
import BibleCompareVerseItem from '~features/bible/BibleCompareVerseItem'
import { versions } from '~helpers/bibleVersions'

const BibleCompareVerses = ({ navigation }) => {
  const { selectedVerses } = navigation.state.params || {}
  const title = verseToReference(selectedVerses)

  const versionsToCompare = useSelector(state => Object.keys(state.user.bible.settings.compare))

  return (
    <Container>
      <Header
        hasBackButton
        fontSize={16}
        title={title}
        rightComponent={
          <Link route="ToggleCompareVerses" padding>
            <Icon.Feather name="check-square" size={20} />
          </Link>
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
                key={versionId}
                versionId={versionId}
                name={obj.name}
                selectedVerses={selectedVerses}
                position={position}
              />
            ))
        )}
      </ScrollView>
    </Container>
  )
}
export default BibleCompareVerses
