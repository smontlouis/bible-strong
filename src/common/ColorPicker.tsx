import React from 'react'
import { StyleSheet, View } from 'react-native'
import RNColorPicker, { Panel2, BrightnessSlider, ColorFormatsObject } from 'reanimated-color-picker'
import Color from 'color'

// Normalize color to hex format (handles rgb, hsl with decimals, hex, etc.)
const normalizeColor = (colorValue: string): string => {
  try {
    return Color(colorValue).hex()
  } catch {
    return '#ff0000' // fallback
  }
}

interface ColorPickerProps {
  value?: string
  onChangeJS?: (color: ColorFormatsObject) => void
}

const ColorPicker = ({ value = '#ff0000', onChangeJS }: ColorPickerProps) => {
  const normalizedValue = normalizeColor(value)

  return (
    <View style={styles.container}>
      <RNColorPicker value={normalizedValue} onChangeJS={onChangeJS} style={{ gap: 30 }}>
        <Panel2 style={styles.panel} boundedThumb />
        <BrightnessSlider adaptSpectrum style={styles.brightnessSlider} boundedThumb />
      </RNColorPicker>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    gap: 10,
    padding: 10,
  },
  hueSlider: {
    height: 25,
    borderRadius: 8,
  },
  panel: {
    borderRadius: 8,
  },
  brightnessSlider: {
    height: 25,
    borderRadius: 8,
  },
})

export default ColorPicker
