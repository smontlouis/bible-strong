import React, { Component } from 'react'
import Container from '~common/ui/Container'
import SearchTabNavigator from '~navigation/SearchTabNavigator'

class SearchSelect extends Component {
  static router = SearchTabNavigator.router

  render() {
    const { navigation } = this.props
    return (
      <Container>
        <SearchTabNavigator
          screenProps={{ mainNavigation: navigation }}
          navigation={navigation}
        />
      </Container>
    )
  }
}

export default SearchSelect
