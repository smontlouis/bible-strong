import type { ReactNode } from 'react'
import Box from '~common/ui/Box'
import Text from '~common/ui/Text'
import { useTheme } from '~themes/ThemeProvider'
import { resolveFontFamily } from '~themes/styleValues'

/**
 * Title of a home group (« Aujourd’hui », « Ma bibliothèque », « Explorer »…), with an optional
 * action on the right. Groups are spaced more widely than the parts inside them.
 */
const HomeSectionTitle = ({ title, action }: { title: string; action?: ReactNode }) => {
  const theme = useTheme()
  return (
    <Box className="flex-row items-center justify-between gap-[12px] px-[20px] pt-[40px] pb-[12px]">
      <Text
        accessibilityRole="header"
        className="shrink text-[23px]"
        style={{ fontFamily: resolveFontFamily(theme.fontFamily.title) }}
      >
        {title}
      </Text>
      {action}
    </Box>
  )
}

export default HomeSectionTitle
