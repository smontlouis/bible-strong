import React, { Component } from 'react'

import PlanSelectTabNavigator from '~navigation/PlanSelectTabNavigator'

import Container from '~common/ui/Container'
import Header from '~common/Header'
import Box from '~common/ui/Box'
import { MAX_WIDTH } from '~helpers/useDimensions'

class PlanSelect extends Component {
  static router = PlanSelectTabNavigator.router

  render() {
    const { navigation } = this.props
    return (
      <Container>
        <Header hasBackButton title="Plans" />
        <Box maxWidth={MAX_WIDTH} width="100%" flex alignSelf="center">
          <PlanSelectTabNavigator
            screenProps={{ mainNavigation: navigation }}
            navigation={navigation}
          />
        </Box>
      </Container>
    )
  }
}

export default PlanSelect
