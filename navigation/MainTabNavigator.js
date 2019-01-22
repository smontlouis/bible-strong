import React from 'react'
import { createMaterialBottomTabNavigator } from 'react-navigation-material-bottom-tabs'

import TabBarIcon from '../components/TabBarIcon'
import Header from '../components/Header'

import HomeScreen from '../screens/HomeScreen'
import LinksScreen from '../screens/LinksScreen'
import SettingsScreen from '../screens/SettingsScreen'

export default createMaterialBottomTabNavigator(
  {
    Home: {
      screen: HomeScreen,
      navigationOptions: {
        title: 'Home',
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
    initialRouteName: 'Home',
    shifting: true,
    activeColor: '#0ED3B9',
    barStyle: {
      backgroundColor: '#fff',
      borderTopWidth: 1,
      borderTopColor: 'rgb(230,230,230)'
    },
    navigationOptions: ({ navigation }) => ({
      headerTitle: <Header navigation={navigation} />,
      headerStyle: {
        backgroundColor: '#fff'
      },
      headerTintColor: '#f00'
    })
  }
)
