import React, { Component } from 'react'

import getVersesRef from '~helpers/getVersesRef'
import Container from '~common/ui/Container'
import ScrollView from '~common/ui/ScrollView'
import Header from '~common/Header'
import BibleCompareVerseItem from '~features/bible/BibleCompareVerseItem'
import { versions } from '~helpers/bibleVersions'

class BibleCompareVerses extends Component {
  async componentDidMount() {
    const { selectedVerses } = this.props.navigation.state.params || {}
    const { title } = await getVersesRef(selectedVerses)
    this.setState({ title })
  }

  state = { title: '' }

  render() {
    const { selectedVerses } = this.props.navigation.state.params || {}
    const { title } = this.state
    return (
      <Container>
        <Header hasBackButton title={title ? `Comparer ${title}` : 'Chargement...'} />
        <ScrollView>
          {Object.entries(versions).map(([versionId, obj]) => (
            <BibleCompareVerseItem
              key={versionId}
              versionId={versionId}
              name={obj.name}
              selectedVerses={selectedVerses}
            />
          ))}
        </ScrollView>
      </Container>
    )
  }
}

export default BibleCompareVerses
