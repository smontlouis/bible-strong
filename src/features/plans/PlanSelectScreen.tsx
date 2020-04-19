import React, { Component } from 'react'

import PlanSelectTabNavigator from '~navigation/PlanSelectTabNavigator'

import Container from '~common/ui/Container'
import Header from '~common/Header'

class PlanSelect extends Component {
  static router = PlanSelectTabNavigator.router

  render() {
    const { navigation } = this.props
    return (
      <Container>
        <Header hasBackButton title="Plans" />
        <PlanSelectTabNavigator
          screenProps={{ mainNavigation: navigation }}
          navigation={navigation}
        />
      </Container>
    )
  }
}

export default PlanSelect
