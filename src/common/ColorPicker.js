import React, { useState } from 'react'
import { View, StyleSheet, TouchableOpacity } from 'react-native'
import Color from 'color'

const colors = [
  '#f50057',
  '#db0A5b',
  '#c51162',
  '#9c27b0',
  '#673ab7',
  '#4b77be',
  '#2196f3',
  '#03a9f4',
  '#00bcd4',
  '#1bbc9b',
  '#009688',
  '#4caf50',
  '#8bc34a',
  '#cddc39',
  '#ffeb3b',
  '#ffc107',
  '#ff9800',
  '#ff5722',
  '#f44336',
  '#e00032',
]
const colorsRow1 = colors.slice(0, 10)
const colorsRow2 = colors.slice(10, 20)
function CromaColorPicker(props) {
  const [primarySelectedColor, setPrimarySelectedColor] = useState('#db0a5b')
  const [selectedColor, _setSelectedColor] = useState('#db0A5b')

  const setSelectedColor = color => {
    if (props.onChangeColor && color !== selectedColor) {
      props.onChangeColor(...Color(color).color)
    }
    _setSelectedColor(color)
  }
  function renderShades(h) {
    let w = 100
    let b
    const colors = []

    for (let i = 0; i < 8; i++) {
      b = 10
      const rows = []
      for (let j = 0; j < 10; j++) {
        const color = Color(`hsl(${h},${w}%,${b}%)`).string()
        rows.push(color)
        b += 9
      }
      colors.push(rows)

      w -= 12
    }

    return colors.map((row, i) => (
      <View key={i} style={styles.shadesView}>
        {row.map(color => (
          <ColorBox
            key={color}
            style={[styles.shadesColorBox]}
            onPress={() => setSelectedColor(color)}
            color={color}
          />
        ))}
      </View>
    ))
  }
  return (
    <View props={props} style={styles.container}>
      <View style={styles.primaryColorsView}>
        {colorsRow1.map(color => (
          <ColorBox
            key={color}
            onPress={() => {
              setPrimarySelectedColor(color)
              setSelectedColor(color)
            }}
            color={color}
            style={[styles.primaryColorBox]}
          />
        ))}
      </View>
      <View style={styles.primaryColorsView}>
        {colorsRow2.map(color => (
          <ColorBox
            key={color}
            onPress={() => {
              setPrimarySelectedColor(color)
              setSelectedColor(color)
            }}
            color={color}
            style={[styles.primaryColorBox]}
          />
        ))}
      </View>

      {renderShades(Color(primarySelectedColor).hsl().color[0])}
    </View>
  )
}
function ColorBox(props) {
  return (
    <TouchableOpacity
      onPress={props.onPress}
      style={[props.style, styles.colorBox, { backgroundColor: props.color }]}
    >
      <View />
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'column',
    flex: 1,
  },
  primaryColorsView: {
    flex: 1,
    flexDirection: 'row',
  },
  shadesView: {
    flex: 1,
    flexDirection: 'row',
  },
  selectedColorView: {
    marginTop: 8,
    flexDirection: 'row',
    flex: 1,
  },
  colorBox: {
    flex: 1,
  },
  primaryColorBox: {},
  shadesColorBox: {},
  selectedColor: {
    width: '50%',
  },
})

export default CromaColorPicker
