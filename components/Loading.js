// @flow
import React from 'react'
import { View, ActivityIndicator, StyleSheet } from 'react-native'
import { pure } from 'recompose'

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center'
  }
})

const Loading = () => (
  <View style={styles.container}>
    <ActivityIndicator />
    {/* <Text>Un petit instant svp...</Text> */}
  </View>
)

export default pure(Loading)
