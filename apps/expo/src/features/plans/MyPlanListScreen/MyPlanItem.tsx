import { twMerge } from '~common/ui/classNames'
import { resolveFontFamily } from '~themes/styleValues'
import { useTheme as useStylingTheme } from '~themes/ThemeProvider'
import Lottie from 'lottie-react-native'
import React from 'react'
import { ComputedPlanItem } from 'src/common/types'
import Link from '~common/Link'
import Box from '~common/ui/Box'
import Card from '~common/ui/Card'
import { FeatherIcon } from '~common/ui/Icon'
import Text from '~common/ui/Text'
type Props = ComputedPlanItem & {
  onPress?: () => void
  /** On the plain page ground (a sheet) rather than the canvas: the card takes a tint. */
  onPlainGround?: boolean
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
  onPlainGround = false,
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

  return (
    <Link {...linkProps}>
      <Card
        className={twMerge(
          'min-h-[56px] px-[14px] py-[10px] gap-[12px] items-center flex-row',
          onPlainGround && 'bg-light-grey'
        )}
      >
        {isPlanCompleted && (
          <Lottie
            autoPlay
            loop={false}
            style={{
              width: 40,
              height: 40,
            }}
            source={require('../../../assets/images/crown.json')}
          />
        )}
        <Box className="overflow-hidden border-continuous flex-[1]">
          <Text style={{ fontFamily: resolveFontFamily(stylingTheme.fontFamily.title) }}>
            {title}
          </Text>
        </Box>
        <Box
          className={twMerge(
            status === 'Completed' ? 'bg-success' : 'bg-primary',
            'overflow-hidden border-continuous rounded-full items-center justify-center ml-[8px]'
          )}
          style={{ width: 30, height: 30 }}
        >
          <FeatherIcon name="chevron-right" color="reverse" size={17} style={{ marginLeft: 2 }} />
        </Box>
      </Card>
    </Link>
  )
}

export default PlanItem
