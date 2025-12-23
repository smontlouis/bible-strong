import React from 'react'
import { StyleSheet, View } from 'react-native'
import RNColorPicker, {
  Panel2,
  BrightnessSlider,
  Swatches,
  ColorFormatsObject,
} from 'reanimated-color-picker'
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
  onCompleteJS?: (color: ColorFormatsObject) => void
  swatchColors?: string[]
}

const ColorPicker = ({
  value = '#ff0000',
  onChangeJS,
  onCompleteJS,
  swatchColors,
}: ColorPickerProps) => {
  const normalizedValue = normalizeColor(value)

  return (
    <View style={styles.container}>
      <RNColorPicker
        value={normalizedValue}
        onChangeJS={onChangeJS}
        onCompleteJS={onCompleteJS}
        style={styles.picker}
      >
        {swatchColors && swatchColors.length > 0 && (
          <Swatches colors={swatchColors} style={styles.swatches} swatchStyle={styles.swatch} />
        )}
        <Panel2 style={styles.panel} boundedThumb />
        <BrightnessSlider adaptSpectrum style={styles.brightnessSlider} boundedThumb />
      </RNColorPicker>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingVertical: 10,
  },
  picker: {
    flex: 1,
    gap: 15,
  },
  swatches: {
    justifyContent: 'center',
    gap: 10,
  },
  swatch: {
    width: 30,
    height: 30,
    borderRadius: 10,
    marginBottom: 0,
    marginTop: 0,
  },
  hueSlider: {
    height: 25,
    borderRadius: 8,
  },
  panel: {
    flex: 1,
    borderRadius: 8,
    marginBottom: 20,
  },
  brightnessSlider: {
    height: 25,
    borderRadius: 8,
  },
})

export default ColorPicker
