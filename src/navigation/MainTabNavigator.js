import React from 'react'
import { createMaterialBottomTabNavigator } from 'react-navigation-material-bottom-tabs'
import BibleScreen from '~features/bible/BibleScreen'
import MoreScreen from '~features/settings/MoreScreen'
// import StudiesScreen from '~features/studies/StudiesScreen'
import LexiqueScreen from '~features/lexique/LexiqueScreen'
import DictionnaryScreen from '~features/dictionnary/DictionnaryScreen'
import SearchScreen from '~features/search/SearchScreen'
import TabBarIcon from '~common/TabBarIcon'
import DictionnaryIcon from '~common/DictionnaryIcon'
import LexiqueIcon from '~common/LexiqueIcon'
import getTheme from '~themes'

export default createMaterialBottomTabNavigator(
  {
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
    // Studies: {
    //   screen: StudiesScreen,
    //   navigationOptions: ({ screenProps }) => ({
    //     title: 'Études',
    //     tabBarIcon: ({ focused }) => <TabBarIcon focused={focused} name="feather" />,
    //     tabBarColor: getTheme[screenProps.theme].colors.reverse,
    //     activeColor: getTheme[screenProps.theme].colors.primary
    //   })
    // },
    Lexique: {
      screen: LexiqueScreen,
      navigationOptions: ({ screenProps }) => ({
        title: 'Lexique',
        tabBarIcon: ({ focused }) => <TabBarIcon focused={focused} component={LexiqueIcon} />,
        tabBarColor: getTheme[screenProps.theme].colors.reverse,
        activeColor: getTheme[screenProps.theme].colors.primary
      })
    },
    Dictionnary: {
      screen: DictionnaryScreen,
      navigationOptions: ({ screenProps }) => ({
        title: 'Dictionnaire',
        tabBarIcon: ({ focused }) => <TabBarIcon focused={focused} component={DictionnaryIcon} />,
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
