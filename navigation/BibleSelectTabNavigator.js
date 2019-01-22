import { createMaterialTopTabNavigator } from 'react-navigation'
import BookSelector from '../screens/BookSelector'
import ChapterSelector from '../screens/ChapterSelector'
import VerseSelector from '../screens/VerseSelector'

const RouteConfigs = {
  livres: { screen: BookSelector },
  chapitre: { screen: ChapterSelector },
  verset: { screen: VerseSelector }
}

const TabNavigatorConfig = {
  swipeEnabled: true,
  animationEnabled: true,
  pressColor: 'black',
  tabBarOptions: {
    activeTintColor: 'red',
    inactiveTintColor: 'blue',
    labelStyle: {
      fontSize: 12
    },
    style: {
      backgroundColor: 'white'
    },
    indicatorStyle: {
      backgroundColor: 'red'
    }
  }
}

export default createMaterialTopTabNavigator(RouteConfigs, TabNavigatorConfig)
