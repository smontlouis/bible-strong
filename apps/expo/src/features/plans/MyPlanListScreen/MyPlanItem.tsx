import { useTheme as useStylingTheme } from '~themes/ThemeProvider'
import { titleFontStyle } from '~themes/styleValues'
import Lottie from 'lottie-react-native'
import React from 'react'
import { ComputedPlanItem } from 'src/common/types'
import Link from '~common/Link'
import Box from '~common/ui/Box'
import { FeatherIcon } from '~common/ui/Icon'
import Text from '~common/ui/Text'
type Props = ComputedPlanItem & {
  onPress?: () => void
}

const PlanItem = ({
  id,
  title,
  image,
  description,
  status,
  progress,
  author,
  type,
  lang,
  onPress,
}: Props) => {
  const stylingTheme = useStylingTheme()

  const isPlanCompleted = status === 'Completed'
  const linkProps = onPress
    ? { onPress }
    : {
        route: 'Plan' as const,
        params: {
          planId: id,
          plan: {
            id,
            title,
            image,
            description,
            status,
            progress,
            author,
            type,
            lang,
          },
        },
      }

  // A row of a list of plans: a completed plan wears its crown, the others a chevron.
  return (
    <Link {...linkProps}>
      <Box className="overflow-hidden border-continuous min-h-[52px] px-[14px] py-[10px] gap-[12px] items-center flex-row">
        <Box className="overflow-hidden border-continuous flex-[1]">
          <Text className="text-[15px]" style={titleFontStyle(stylingTheme)}>
            {title}
          </Text>
        </Box>
        {isPlanCompleted ? (
          <Lottie
            autoPlay
            loop={false}
            style={{ width: 32, height: 32 }}
            source={require('../../../assets/images/crown.json')}
          />
        ) : (
          <FeatherIcon name="chevron-right" color="grey" size={18} />
        )}
      </Box>
    </Link>
  )
}

export default PlanItem
