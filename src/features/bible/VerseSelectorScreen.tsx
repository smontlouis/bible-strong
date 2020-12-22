import React, { Component } from 'react'
import { ScrollView } from 'react-native'
import { connect } from 'react-redux'
import { compose } from 'recompose'

import { strongDB } from '~helpers/database'
import * as BibleActions from '~redux/modules/bible'
import SelectorItem from './SelectorItem'
import i18n from '~i18n'
import countLsgChapters from '~assets/bible_versions/countLsgChapters'

class VerseSelector extends Component {
  state = {
    versesInCurrentChapter: undefined,
    error: false,
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
    const versesInCurrentChapter =
      countLsgChapters[`${selectedBook.Numero}-${selectedChapter}`]
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
          paddingTop: 10,
        }}
      >
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

const EnhancedVerseSelector = compose(
  connect(
    ({ bible: { temp } }) => ({
      selectedBook: temp.selectedBook,
      selectedChapter: temp.selectedChapter,
      selectedVerse: temp.selectedVerse,
    }),
    { ...BibleActions }
  )
)(VerseSelector)

EnhancedVerseSelector.navigationOptions = () => ({
  tabBarLabel: i18n.t('Versets'),
})

export default EnhancedVerseSelector
