import React, { Component } from 'react'
import { connect } from 'react-redux'

import * as BibleActions from '~redux/modules/bible'
import BibleSelectTabNavigator from '~navigation/BibleSelectTabNavigator'

import Container from '~common/ui/Container'
import Header from '~common/Header'

class BibleSelect extends Component {
  static router = BibleSelectTabNavigator.router

  componentDidMount() {
    const { resetTempSelected } = this.props
    resetTempSelected()
  }

  render() {
    const { navigation } = this.props
    return (
      <Container>
        <Header hasBackButton title="Références" />
        <BibleSelectTabNavigator
          screenProps={{ mainNavigation: navigation }}
          navigation={navigation}
        />
        {/* <SelectorButtons /> */}
      </Container>
    )
  }
}

export default connect(
  null,
  BibleActions
)(BibleSelect)
