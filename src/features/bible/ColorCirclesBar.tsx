import React, { useMemo } from 'react'
import { ScrollView } from 'react-native'
import { useNavigation } from '@react-navigation/native'
import { shallowEqual, useSelector } from 'react-redux'

import Box from '~common/ui/Box'
import HighlightTypeIndicator from '~common/HighlightTypeIndicator'
import { wp } from '~helpers/utils'
import useCurrentThemeSelector from '~helpers/useCurrentThemeSelector'
import type { RootState } from '~redux/modules/reducer'
import type { CustomColor } from '~redux/modules/user'
import { makeColorsSelector } from '~redux/selectors/user'
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
  const defaultColorTypes = useSelector(
    (state: RootState) => state.user.bible.settings.defaultColorTypes ?? {},
    shallowEqual
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
        <HighlightTypeIndicator
          color={colors.color1}
          type={defaultColorTypes.color1 || 'background'}
          onPress={() => addHighlight('color1')}
          size={20}
        />
      </Box>
      <Box width={colorItemWidth} height={60} center>
        <HighlightTypeIndicator
          color={colors.color2}
          type={defaultColorTypes.color2 || 'background'}
          onPress={() => addHighlight('color2')}
          size={20}
        />
      </Box>
      <Box width={colorItemWidth} height={60} center>
        <HighlightTypeIndicator
          color={colors.color3}
          type={defaultColorTypes.color3 || 'background'}
          onPress={() => addHighlight('color3')}
          size={20}
        />
      </Box>
      <Box width={colorItemWidth} height={60} center>
        <HighlightTypeIndicator
          color={colors.color4}
          type={defaultColorTypes.color4 || 'background'}
          onPress={() => addHighlight('color4')}
          size={20}
        />
      </Box>
      <Box width={colorItemWidth} height={60} center>
        <HighlightTypeIndicator
          color={colors.color5}
          type={defaultColorTypes.color5 || 'background'}
          onPress={() => addHighlight('color5')}
          size={20}
        />
      </Box>
      {customHighlightColors.map((customColor: CustomColor) => (
        <Box key={customColor.id} width={colorItemWidth} height={60} center>
          <HighlightTypeIndicator
            color={customColor.hex}
            type={customColor.type || 'background'}
            onPress={() => addHighlight(customColor.id)}
            size={20}
          />
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
