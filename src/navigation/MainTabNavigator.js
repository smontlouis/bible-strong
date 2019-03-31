import React from 'react'
import { createMaterialBottomTabNavigator } from 'react-navigation-material-bottom-tabs'
import BibleScreen from '~features/bible/BibleScreen'
import SearchScreen from '~features/search/SearchScreen'
import SettingsScreen from '~features/settings/SettingsScreen'
import FeedbackScreen from '~features/settings/FeedbackScreen'
import TabBarIcon from '~common/TabBarIcon'

export default createMaterialBottomTabNavigator(
  {
    Bible: {
      screen: BibleScreen,
      navigationOptions: {
        title: 'Bible',
        tabBarIcon: ({ focused }) => (
          <TabBarIcon focused={focused} name='book-open' />
        )
      }
    },
    Search: {
      screen: SearchScreen,
      navigationOptions: {
        title: 'Recherche',
        tabBarIcon: ({ focused }) => (
          <TabBarIcon focused={focused} name='search' />
        )
      }
    },
    Settings: {
      screen: SettingsScreen,
      navigationOptions: {
        title: 'Paramètres',
        tabBarIcon: ({ focused }) => (
          <TabBarIcon focused={focused} name='settings' />
        )
      }
    },
    Feedback: {
      screen: FeedbackScreen,
      navigationOptions: {
        title: 'Feedback',
        tabBarIcon: ({ focused }) => (
          <TabBarIcon focused={focused} name='alert-triangle' />
        )
      }
    }
  },
  {
    initialRouteName: 'Bible',
    shifting: true,
    activeColor: '#0ED3B9',
    barStyle: {
      backgroundColor: '#fff',
      borderTopWidth: 1,
      borderTopColor: 'rgb(230,230,230)'
    }
  }
)
