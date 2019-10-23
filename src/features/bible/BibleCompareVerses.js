import React, { Component } from 'react'

import verseToReference from '~helpers/verseToReference'
import Container from '~common/ui/Container'
import ScrollView from '~common/ui/ScrollView'
import Header from '~common/Header'
import BibleCompareVerseItem from '~features/bible/BibleCompareVerseItem'
import { versions } from '~helpers/bibleVersions'

class BibleCompareVerses extends Component {
  componentDidMount() {
    const { selectedVerses } = this.props.navigation.state.params || {}
    const title = verseToReference(selectedVerses)
    this.setState({ title })
  }

  state = { title: '' }

  render() {
    const { selectedVerses } = this.props.navigation.state.params || {}
    const { title } = this.state
    return (
      <Container>
        <Header hasBackButton fontSize={16} title={title ? `Comparer ${title}` : 'Chargement...'} />
        <ScrollView>
          {Object.entries(versions).map(([versionId, obj], position) => (
            <BibleCompareVerseItem
              key={versionId}
              versionId={versionId}
              name={obj.name}
              selectedVerses={selectedVerses}
              position={position}
            />
          ))}
        </ScrollView>
      </Container>
    )
  }
}

export default BibleCompareVerses
