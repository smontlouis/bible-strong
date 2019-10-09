import React from 'react'

import createAnimatedBottomTabNavigator from '~navigation/createAnimatedBottomTabNavigator'
import BibleScreen from '~features/bible/BibleScreen'
import MoreScreen from '~features/settings/MoreScreen'
import StudiesScreen from '~features/studies/StudiesScreen'
import HomeScreen from '~features/home/HomeScreen'
import SearchScreen from '~features/search/SearchScreen'
import TabBarIcon from '~common/TabBarIcon'
import getTheme from '~themes'

export default createAnimatedBottomTabNavigator(
  {
    Home: {
      screen: HomeScreen,
      navigationOptions: ({ screenProps }) => {
        return {
          title: 'Home',
          tabBarIcon: ({ focused }) => <TabBarIcon focused={focused} name="home" />,
          tabBarColor: getTheme[screenProps.theme].colors.reverse,
          activeColor: getTheme[screenProps.theme].colors.primary
        }
      }
    },
    Search: {
      screen: SearchScreen,
      navigationOptions: ({ screenProps }) => {
        return {
          title: 'Recherche',
          tabBarIcon: ({ focused }) => <TabBarIcon focused={focused} name="search" />,
          tabBarColor: getTheme[screenProps.theme].colors.reverse,
          activeColor: getTheme[screenProps.theme].colors.primary
        }
      }
    },
    Bible: {
      screen: BibleScreen,
      navigationOptions: ({ screenProps }) => {
        return {
          title: 'Bible',
          tabBarIcon: ({ focused }) => <TabBarIcon focused={focused} name="book-open" />,
          tabBarColor: getTheme[screenProps.theme].colors.reverse,
          activeColor: getTheme[screenProps.theme].colors.primary
        }
      }
    },
    Studies: {
      screen: StudiesScreen,
      navigationOptions: ({ screenProps }) => ({
        title: 'Études',
        tabBarIcon: ({ focused }) => <TabBarIcon focused={focused} name="feather" />,
        tabBarColor: getTheme[screenProps.theme].colors.reverse,
        activeColor: getTheme[screenProps.theme].colors.primary
      })
    },
    More: {
      screen: MoreScreen,
      navigationOptions: ({ screenProps }) => ({
        title: 'Plus',
        tabBarIcon: ({ focused }) => <TabBarIcon focused={focused} name="menu" />,
        tabBarColor: getTheme[screenProps.theme].colors.reverse,
        activeColor: getTheme[screenProps.theme].colors.primary
      })
    }
  },
  {
    initialRouteName: 'Home',
    activeColor: '#0ED3B9'
  }
)
