import React from 'react'
import { Text, TouchableOpacity, StyleSheet } from 'react-native'
import { pure } from 'recompose'

const styles = StyleSheet.create({
  text: {
    color: 'black',
    fontSize: 16,
    padding: 15,
    paddingTop: 10,
    paddingBottom: 10
  },
  selected: {
    color: 'red'
  }
})

const BookSelectorItem = ({ book, isSelected, onChange }) => (
  <TouchableOpacity onPress={() => onChange(book)}>
    <Text style={[styles.text, isSelected && styles.selected]}>{book.Nom}</Text>
  </TouchableOpacity>
)

export default pure(BookSelectorItem)
