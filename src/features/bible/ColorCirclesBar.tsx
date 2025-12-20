import React, { useMemo } from 'react'
import { ScrollView } from 'react-native'
import { useNavigation } from '@react-navigation/native'
import { useSelector } from 'react-redux'

import Box from '~common/ui/Box'
import { wp } from '~helpers/utils'
import useCurrentThemeSelector from '~helpers/useCurrentThemeSelector'
import type { RootState } from '~redux/modules/reducer'
import type { CustomColor } from '~redux/modules/user'
import { makeColorsSelector } from '~redux/selectors/user'
import TouchableCircle from './TouchableCircle'
import TouchableIcon from './TouchableIcon'

const MIN_ITEM_WIDTH = 40 // Minimum width (circle size + margins)

type Props = {
  isSelectedVerseHighlighted: boolean
  addHighlight: (color: string) => void
  removeHighlight: () => void
  onClose: () => void
}

const ColorCirclesBar = ({
  isSelectedVerseHighlighted,
  addHighlight,
  removeHighlight,
  onClose,
}: Props) => {
  const navigation = useNavigation()
  const { theme: currentTheme } = useCurrentThemeSelector()
  const selectColors = useMemo(() => makeColorsSelector(), [])
  const colors = useSelector((state: RootState) => selectColors(state, currentTheme))
  const customHighlightColors = useSelector(
    (state: RootState) => state.user.bible.settings.customHighlightColors ?? []
  )

  // Calculate dynamic item width for color circles
  const screenWidth = wp(100, 500)
  const colorItemCount = useMemo(() => {
    let count = 5 // 5 default colors
    count += customHighlightColors.length // custom colors
    if (customHighlightColors.length < 5) count += 1 // plus button
    if (isSelectedVerseHighlighted) count += 1 // x button
    return count
  }, [customHighlightColors.length, isSelectedVerseHighlighted])

  const colorItemWidth = Math.max(screenWidth / colorItemCount, MIN_ITEM_WIDTH)

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{
        flexDirection: 'row',
        alignItems: 'center',
      }}
    >
      {isSelectedVerseHighlighted && (
        <Box width={colorItemWidth} height={60} center>
          <TouchableIcon name="x-circle" onPress={removeHighlight} noFlex />
        </Box>
      )}
      <Box width={colorItemWidth} height={60} center>
        <TouchableCircle color={colors.color1} onPress={() => addHighlight('color1')} />
      </Box>
      <Box width={colorItemWidth} height={60} center>
        <TouchableCircle color={colors.color2} onPress={() => addHighlight('color2')} />
      </Box>
      <Box width={colorItemWidth} height={60} center>
        <TouchableCircle color={colors.color3} onPress={() => addHighlight('color3')} />
      </Box>
      <Box width={colorItemWidth} height={60} center>
        <TouchableCircle color={colors.color4} onPress={() => addHighlight('color4')} />
      </Box>
      <Box width={colorItemWidth} height={60} center>
        <TouchableCircle color={colors.color5} onPress={() => addHighlight('color5')} />
      </Box>
      {customHighlightColors.map((customColor: CustomColor) => (
        <Box key={customColor.id} width={colorItemWidth} height={60} center>
          <TouchableCircle color={customColor.hex} onPress={() => addHighlight(customColor.id)} />
        </Box>
      ))}

      <Box width={colorItemWidth} height={60} center>
        <TouchableIcon
          name={customHighlightColors.length < 5 ? 'plus-circle' : 'arrow-right-circle'}
          onPress={() => {
            navigation.navigate('CustomHighlightColors')
          }}
          noFlex
        />
      </Box>
    </ScrollView>
  )
}

export default ColorCirclesBar
