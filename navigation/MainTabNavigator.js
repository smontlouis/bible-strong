import React from 'react'
import { createMaterialBottomTabNavigator } from 'react-navigation-material-bottom-tabs'

import TabBarIcon from '../components/TabBarIcon'

import BibleScreen from '../screens/BibleScreen'
import LexiqueScreen from '../screens/LexiqueScreen'
import SettingsScreen from '../screens/SettingsScreen'
import FeedbackScreen from '../screens/FeedbackScreen'

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
    Lexique: {
      screen: LexiqueScreen,
      navigationOptions: {
        title: 'Lexique',
        tabBarIcon: ({ focused }) => (
          <TabBarIcon focused={focused} name='book' />
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
