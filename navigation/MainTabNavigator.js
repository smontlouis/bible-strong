import React from 'react'
import { createMaterialBottomTabNavigator } from 'react-navigation-material-bottom-tabs'

import TabBarIcon from '../components/TabBarIcon'

import BibleScreen from '../screens/BibleScreen'
import LinksScreen from '../screens/LinksScreen'
import SettingsScreen from '../screens/SettingsScreen'

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
    Links: {
      screen: LinksScreen,
      navigationOptions: {
        title: 'Links',
        tabBarIcon: ({ focused }) => (
          <TabBarIcon focused={focused} name='box' />
        )
      }
    },
    Settings: {
      screen: SettingsScreen,
      navigationOptions: {
        title: 'Settings',
        tabBarIcon: ({ focused }) => (
          <TabBarIcon focused={focused} name='settings' />
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
