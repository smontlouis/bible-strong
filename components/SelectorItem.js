import React from 'react'
import { Text, TouchableOpacity, StyleSheet } from 'react-native'
import { pure } from 'recompose'

const styles = StyleSheet.create({
  item: {
    width: 50,
    height: 50,
    margin: 3,
    borderRadius: 50,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'flex-start'
  },
  selectedItem: {
    backgroundColor: 'red'
  },
  selectedText: {
    color: 'white'
  },
  text: {
    color: 'black',
    fontSize: 16,
    backgroundColor: 'transparent'
  }
})

const SelectorItem = ({ item, isSelected, onChange }) => (
  <TouchableOpacity
    onPress={() => onChange(item)}
    style={[styles.item, isSelected && styles.selectedItem]}
  >
    <Text style={[styles.text, isSelected && styles.selectedText]}>{item}</Text>
  </TouchableOpacity>
)

export default pure(SelectorItem)
