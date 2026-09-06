import { twMerge } from '~common/ui/classNames'
import { resolveFontFamily } from '~themes/styleValues'
import { useTheme as useStylingTheme } from '~themes/ThemeProvider'
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

  return (
    <Link {...linkProps}>
      <Box
        {...(status === 'Progress' && {
          borderWidth: 2,
          borderColor: 'primary',
        })}
        {...(status === 'Completed' && {
          borderWidth: 2,
          borderColor: 'success',
        })}
        style={{
          shadowColor: 'rgb(89,131,240)',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.1,
          shadowRadius: 7,
          elevation: 1,
          overflow: 'visible',
        }}
        className="overflow-hidden border-continuous px-[13px] py-[10px] rounded-[35px] bg-reverse items-center justify-center flex-row"
      >
        {isPlanCompleted ? (
          <Lottie
            autoPlay
            loop={false}
            style={{
              width: 40,
              height: 40,
            }}
            source={require('../../../assets/images/crown.json')}
          />
        ) : (
          <></>
          // <ProgressCircle
          //   size={40}
          //   progress={progress}
          //   borderWidth={0}
          //   color={
          //     status === 'Completed'
          //       ? theme.colors.success
          //       : theme.colors.primary
          //   }
          //   unfilledColor={theme.colors.lightGrey}
          //   thickness={2}
          //   fill="none"
          // >
          //   <CircleImage center>
          //     {cacheImage && (
          //       <Image
          //         style={{ width: 32, height: 32 }}
          //         source={{
          //           uri: cacheImage,
          //         }}
          //       />
          //     )}
          //   </CircleImage>
          // </ProgressCircle>
        )}
        <Box className="overflow-hidden border-continuous flex-[1] pl-[10px]">
          <Text style={{ fontFamily: resolveFontFamily(stylingTheme.fontFamily.title) }}>
            {title}
          </Text>
        </Box>
        <Box
          className={twMerge(
            'overflow-hidden border-continuous',
            twMerge(
              status === 'Completed' ? 'bg-success' : 'bg-primary',
              'overflow-hidden border-continuous rounded-[15px] items-center justify-center ml-[20px]'
            )
          )}
          style={{ width: 30, height: 30 }}
        >
          <FeatherIcon name="chevron-right" color="reverse" size={17} style={{ marginLeft: 2 }} />
        </Box>
      </Box>
    </Link>
  )
}

export default PlanItem
