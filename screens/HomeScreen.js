import React from 'react'
import { connect } from 'react-redux'
import { StatusBar, Text } from 'react-native'

import Container from '@ui/Container'
import * as BibleActions from '@modules/bible'

// componentDidMount () {
//   let db = SQLite.openDatabase('strong.sqlite')
//   db.transaction(
//     tx => {
//       tx.executeSql(
//         `SELECT name FROM sqlite_master WHERE type='table'`,
//         [],
//         (_, res) => console.log('RESPONSE :', res),
//         (txObj, error) => console.log(error)
//       )
//     },
//     error => console.log('something went wrong:' + error),
//     () => console.log('db transaction is a success')
//   )
// }

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
class HomeScreen extends React.Component {
  static navigationOptions = {
    title: 'Home'
  }

  render () {
    return (
      <Container>
        <StatusBar barStyle='light-content' />
        <Text>Test ici {this.props.app.chapter}</Text>
      </Container>
    )
  }
}

export default HomeScreen
