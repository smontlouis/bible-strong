import { useCallback, useState } from 'react'
import { LayoutChangeEvent, NativeSyntheticEvent, TextLayoutEventData } from 'react-native'

/**
 * A custom hook that automatically adjusts font size based on text layout.
 *
 * @param initialFontSize - The starting font size in pixels.
 * @param maxWidth - The maximum width the text should occupy in pixels.
 * @param minFontSize - The minimum font size allowed in pixels.
 * @returns An object containing the current font size and a callback for text layout events.
 */
export function useAutoFontSize(
  initialFontSize: number,
  maxWidth: number,
  minFontSize: number = 10
) {
  const [fontSize, setFontSize] = useState(initialFontSize)

  const onTextLayout = useCallback(
    (e: LayoutChangeEvent | NativeSyntheticEvent<TextLayoutEventData>) => {
      const { width } = 'layout' in e.nativeEvent ? e.nativeEvent.layout : e.nativeEvent.lines[0]
      if (width > maxWidth) {
        setFontSize(prevSize => Math.max(prevSize * (maxWidth / width), minFontSize))
      } else if (width < maxWidth * 0.9 && fontSize < initialFontSize) {
        setFontSize(prevSize => Math.min(prevSize * 1.1, initialFontSize))
      }
    },
    [fontSize, initialFontSize, maxWidth, minFontSize]
  )

  return { fontSize, onTextLayout }
}
