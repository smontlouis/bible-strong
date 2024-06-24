// import React from 'react'
// import styled from '@emotion/native'
// import compose from 'recompose/compose'
// import { Animated, StyleSheet } from 'react-native'
// import { createBottomTabNavigator } from '@react-navigation/bottom-tabs'
// import { ScreenContainer } from 'react-native-screens'

// import BottomTabBar from '~features/app-switcher/BottomTabBar/BottomTabBar'
// import withDeviceOrientation from '~helpers/withDeviceOrientation'

// const Container = styled.View(({ orientation }) => ({
//   flex: 1,
//   overflow: 'hidden',
//   // flexDirection: orientation.portrait ? 'column' : 'row'
// }))

// class AnimatedTabNavigationView extends React.Component {
//   static defaultProps = {
//     getAccessibilityRole: () => 'button',
//     getAccessibilityStates: ({ focused }) => (focused ? ['selected'] : []),
//   }

//   static getDerivedStateFromProps(nextProps, prevState) {
//     const { index } = nextProps.navigation.state

//     return {
//       // Set the current tab to be loaded if it was not loaded before
//       loaded: prevState.loaded.includes(index)
//         ? prevState.loaded
//         : [...prevState.loaded, index],
//     }
//   }

//   state = {
//     loaded: [this.props.navigation.state.index],
//     indexesOpacity: this.props.navigation.state.routes.map(
//       (_, index) =>
//         new Animated.Value(this.props.navigation.state.index === index ? 1 : 0)
//     ),
//   }

//   // Animate from previousy selected index to newly selected index. This is
//   // the most simple way to do this, you might want to control each tab visibility
//   // individually with their own animated value for example.
//   componentDidUpdate(prevProps) {
//     if (
//       prevProps.navigation.state.index !== this.props.navigation.state.index
//     ) {
//       Animated.timing(
//         this.state.indexesOpacity[this.props.navigation.state.index],
//         {
//           toValue: 1,
//           duration: 200,
//         }
//       ).start()
//       Animated.timing(
//         this.state.indexesOpacity[prevProps.navigation.state.index],
//         {
//           toValue: 0,
//           duration: 200,
//         }
//       ).start()
//     }
//   }

//   getButtonComponent = ({ route }) => {
//     const { descriptors } = this.props
//     const descriptor = descriptors[route.key]
//     const { options } = descriptor

//     if (options.tabBarButtonComponent) {
//       return options.tabBarButtonComponent
//     }

//     return undefined
//   }

//   jumpTo = key => {
//     const { navigation, onIndexChange } = this.props

//     const index = navigation.state.routes.findIndex(route => route.key === key)

//     onIndexChange(index)
//   }

//   render() {
//     const { loaded } = this.state
//     const { orientation } = this.props

//     return (
//       <Container orientation={orientation}>
//         <ScreenContainer style={{ flex: 1, position: 'relative' }}>
//           {this.props.navigation.state.routes.map((route, index) => {
//             if (!loaded.includes(index)) {
//               // Don't render a screen if we've never navigated to it
//               return null
//             }

//             const { index: activeIndex } = this.props.navigation.state

//             const isFocused = index === activeIndex

//             // Opacity is the easiest thing here to animate
//             const opacity = this.state.indexesOpacity[index]

//             return (
//               <Animated.View
//                 key={route.key}
//                 style={[
//                   StyleSheet.absoluteFillObject,
//                   { backgroundColor: '#fff', opacity },
//                 ]}
//                 pointerEvents={isFocused ? 'auto' : 'none'}
//               >
//                 {this.props.renderScene({ route })}
//               </Animated.View>
//             )
//           })}
//         </ScreenContainer>
//         <TabBar
//           getButtonComponent={this.getButtonComponent}
//           jumpTo={this.jumpTo}
//           orientation={orientation}
//           {...this.props}
//         />
//       </Container>
//     )
//   }
// }

// const TabBar = props => {
//   const {
//     tabBarComponent: TabBarComponent = BottomTabBar,
//     tabBarOptions,
//     navigation,
//     screenProps,
//     getLabelText,
//     getAccessibilityLabel,
//     getAccessibilityRole,
//     getAccessibilityStates,
//     getButtonComponent,
//     getTestID,
//     renderIcon,
//     onTabPress,
//     jumpTo,
//     orientation,
//     descriptors,
//   } = props

//   const { state } = props.navigation
//   const route = state.routes[state.index]
//   const descriptor = descriptors[route.key]
//   const { options } = descriptor

//   if (options.tabBarVisible === false) {
//     return null
//   }

//   return (
//     <TabBarComponent
//       {...tabBarOptions}
//       orientation={orientation}
//       jumpTo={jumpTo}
//       navigation={navigation}
//       screenProps={screenProps}
//       onTabPress={onTabPress}
//       getLabelText={getLabelText}
//       getButtonComponent={getButtonComponent}
//       getAccessibilityLabel={getAccessibilityLabel}
//       getAccessibilityRole={getAccessibilityRole}
//       getAccessibilityStates={getAccessibilityStates}
//       getTestID={getTestID}
//       renderIcon={renderIcon}
//     />
//   )
// }

// export default compose(
//   createBottomTabNavigator,
//   withDeviceOrientation
// )(AnimatedTabNavigationView)
