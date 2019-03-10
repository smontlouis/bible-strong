import React from 'react'
import { connect } from 'react-redux'
import { StatusBar } from 'react-native'

import Container from '~common/ui/Container'
import BibleViewer from './BibleViewer'
import BibleHeader from './BibleHeader'

import * as BibleActions from '~redux/modules/bible'

@connect(
  ({ bible }, ownProps) => {
    const params = ownProps.navigation.state.params
    return {
      isReadOnly: params && params.isReadOnly,
      app: {
        book: (params && params.book) || bible.selectedBook,
        chapter: (params && params.chapter) || bible.selectedChapter,
        verse: (params && params.verse) || bible.selectedVerse,
        version: (params && params.version) || bible.selectedVersion
      }
    }
  },
  BibleActions
)
class BibleScreen extends React.Component {
  render () {
    const { app, navigation, isReadOnly } = this.props
    const { arrayVerses } = this.props.navigation.state.params || {}

    return (
      <Container>
        <StatusBar barStyle='dark-content' />
        <BibleHeader
          isReadOnly={isReadOnly}
          book={app.book}
          chapter={app.chapter}
          verse={app.verse}
          version={app.version}
          isBible
        />
        <BibleViewer
          isReadOnly={isReadOnly}
          arrayVerses={arrayVerses}
          book={app.book}
          chapter={app.chapter}
          verse={app.verse}
          version={app.version}
          navigation={navigation}
        />
      </Container>
    )
  }
}

export default BibleScreen
