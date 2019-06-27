import React from 'react'
import { createMaterialBottomTabNavigator } from 'react-navigation-material-bottom-tabs'
import BibleScreen from '~features/bible/BibleScreen'
import SearchScreen from '~features/search/SearchScreen'
import SettingsScreen from '~features/settings/SettingsScreen'
import ProfileScreen from '~features/settings/ProfileScreen'
import TabBarIcon from '~common/TabBarIcon'
import getTheme from '~themes'
export default createMaterialBottomTabNavigator(
  {
    Bible: {
      screen: BibleScreen,
      navigationOptions: ({ screenProps }) => {
        return {
          title: 'Bible',
          tabBarIcon: ({ focused }) => (
            <TabBarIcon focused={focused} name='book-open' />
          ),
          tabBarColor: getTheme[screenProps.theme].colors.reverse,
          activeColor: getTheme[screenProps.theme].colors.primary
        }
      }
    },
    Search: {
      screen: SearchScreen,
      navigationOptions: ({ screenProps }) => ({
        title: 'Recherche',
        tabBarIcon: ({ focused }) => (
          <TabBarIcon focused={focused} name='search' />
        ),
        tabBarColor: getTheme[screenProps.theme].colors.reverse,
        activeColor: getTheme[screenProps.theme].colors.primary
      })
    },
    Profile: {
      screen: ProfileScreen,
      navigationOptions: ({ screenProps }) => ({
        title: 'Profil',
        tabBarIcon: ({ focused }) => (
          <TabBarIcon focused={focused} name='menu' />
        ),
        tabBarColor: getTheme[screenProps.theme].colors.reverse,
        activeColor: getTheme[screenProps.theme].colors.primary
      })
    }
    // Settings: {
    //   screen: SettingsScreen,
    //   navigationOptions: ({ screenProps }) => ({
    //     title: 'Paramètres',
    //     tabBarIcon: ({ focused }) => (
    //       <TabBarIcon focused={focused} name='settings' />
    //     ),
    //     tabBarColor: getTheme[screenProps.theme].colors.reverse,
    //     activeColor: getTheme[screenProps.theme].colors.primary
    //   })
    // }
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
