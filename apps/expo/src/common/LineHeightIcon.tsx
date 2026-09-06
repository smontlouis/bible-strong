import { resolveThemeColor } from '~themes/colorValues'
import { useTheme as useStylingTheme } from '~themes/ThemeProvider'
import Box, { VStack } from './ui/Box'
export const LineHeightIcon = ({ isSelected, gap }: { isSelected: boolean; gap: number }) => {
  const stylingTheme = useStylingTheme()

  const color = isSelected ? 'primary' : 'grey'
  const width = 18
  const height = 2
  return (
    <VStack
      className="overflow-hidden border-continuous items-center justify-center w-[55px] h-[18px]"
      style={{ gap: gap }}
    >
      <Box
        className="overflow-hidden border-continuous rounded-[10px]"
        style={{
          width: width,
          height: height,
          backgroundColor: resolveThemeColor(stylingTheme, color),
        }}
      />
      <Box
        className="overflow-hidden border-continuous rounded-[10px]"
        style={{
          width: width,
          height: height,
          backgroundColor: resolveThemeColor(stylingTheme, color),
        }}
      />
      <Box
        className="overflow-hidden border-continuous rounded-[10px]"
        style={{
          width: width,
          height: height,
          backgroundColor: resolveThemeColor(stylingTheme, color),
        }}
      />
    </VStack>
  )
}
