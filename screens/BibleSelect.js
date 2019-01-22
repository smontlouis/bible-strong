import React, { Component } from 'react'
import { connect } from 'react-redux'

import * as BibleActions from '@modules/bible'
import BibleSelectTabNavigator from '../navigation/BibleSelectTabNavigator'

import Container from '@ui/Container'

@connect(
  null,
  BibleActions
)
class BibleSelect extends Component {
  static router = BibleSelectTabNavigator.router

  componentDidMount () {
    const { resetTempSelected } = this.props
    resetTempSelected()
  }

  render () {
    const { navigation } = this.props
    return (
      <Container>
        {/* <Header title='Livres' /> */}
        <BibleSelectTabNavigator
          screenProps={{ mainNavigation: navigation }}
          navigation={navigation}
        />
        {/* <SelectorButtons /> */}
      </Container>
    )
  }
}

export default BibleSelect
