import React from 'react'
import { connect } from 'react-redux'
import { StatusBar } from 'react-native'

import Container from '@ui/Container'
import BibleViewer from '@components/BibleViewer'
import Header from '@components/Header'
import * as BibleActions from '@modules/bible'

@connect(
  (state, ownProps) => ({
    hasBack: !!ownProps.navigation.state.params,
    app: {
      book: state.bible.selectedBook,
      chapter: state.bible.selectedChapter,
      verse: state.bible.selectedVerse,
      version: state.bible.selectedVersion
    }
  }),
  BibleActions
)
class BibleScreen extends React.Component {
  state = {
    isLoading: true
  }

  // If book, chapter, verse, version is received through params
  async componentDidMount () {
    const { book, chapter, verse, version } =
      this.props.navigation.state.params || {}
    if (book || chapter || verse) {
      await this.props.setAllAndValidateSelected({
        book,
        chapter,
        verse,
        version
      })
      this.setState({ isLoading: false })
    } else {
      this.setState({ isLoading: false })
    }
  }
  render () {
    const { isLoading } = this.state
    const { app, navigation } = this.props
    const { arrayVerses } = this.props.navigation.state.params || {}

    return (
      <Container>
        <StatusBar barStyle='dark-content' />
        <Header isBible />
        {!isLoading && (
          <BibleViewer
            arrayVerses={arrayVerses}
            book={app.book}
            chapter={app.chapter}
            verse={app.verse}
            version={app.version}
            navigation={navigation}
          />
        )}
      </Container>
    )
  }
}

export default BibleScreen
