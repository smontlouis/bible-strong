import React, { Component } from 'react'
import { ScrollView } from 'react-native'
import { connect } from 'react-redux'
import { compose } from 'recompose'
import waitForStrongDB from '~common/waitForStrongDB'

import Container from '~common/ui/Container'
import Header from '~common/Header'
import Empty from '~common/Empty'

import { strongDB } from '~helpers/database'
import loadCountVerses from '~helpers/loadCountVerses'
import * as BibleActions from '~redux/modules/bible'
import SelectorItem from './SelectorItem'

class VerseSelector extends Component {
  static navigationOptions = {
    tabBarLabel: 'VERSET'
  }

  state = {
    versesInCurrentChapter: undefined,
    error: false
  }

  componentDidMount() {
    strongDB.init() // Fix weird bug on iOS
    this.loadVerses()
  }

  componentDidUpdate(oldProps) {
    if (
      this.props.selectedChapter !== oldProps.selectedChapter ||
      this.props.selectedBook.Numero !== oldProps.selectedBook.Numero
    ) {
      this.loadVerses()
    }
  }

  loadVerses = async () => {
    const { selectedBook, selectedChapter } = this.props
    const { versesInCurrentChapter, error } = await loadCountVerses(
      selectedBook.Numero,
      selectedChapter
    )
    if (error) {
      this.setState({ error })
      return
    }
    this.setState({ versesInCurrentChapter })
  }

  onValidate = (verse: number) => {
    this.props.setTempSelectedVerse(verse)
    this.props.validateSelected()
    setTimeout(() => this.props.screenProps.mainNavigation.goBack(), 0)
  }

  render() {
    const { versesInCurrentChapter } = this.state
    const { selectedVerse } = this.props

    if (this.state.error) {
      return (
        <Container>
          <Empty
            source={require('~assets/images/empty.json')}
            message={`Impossible de charger cette page...${
              this.state.error === 'CORRUPTED_DATABASE'
                ? '\n\nVotre base de données semble être corrompue. Rendez-vous dans la gestion de téléchargements pour retélécharger la base de données.'
                : ''
            }`}
          />
        </Container>
      )
    }

    if (!versesInCurrentChapter) {
      return null
    }

    const array = Array(...Array(versesInCurrentChapter)).map((_, i) => i)

    return (
      <ScrollView
        contentContainerStyle={{
          flexWrap: 'wrap',
          flexDirection: 'row',
          alignItems: 'flex-start',
          justifyContent: 'flex-start',
          paddingTop: 10
        }}>
        {array.map(v => (
          <SelectorItem
            key={v}
            item={v + 1}
            isSelected={selectedVerse === v + 1}
            onChange={this.onValidate}
          />
        ))}
      </ScrollView>
    )
  }
}

export default compose(
  waitForStrongDB,
  connect(
    ({ bible: { temp } }) => ({
      selectedBook: temp.selectedBook,
      selectedChapter: temp.selectedChapter,
      selectedVerse: temp.selectedVerse
    }),
    { ...BibleActions }
  )
)(VerseSelector)
