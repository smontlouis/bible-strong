import { useTheme } from '@emotion/react'
import Lottie from 'lottie-react-native'
import React from 'react'
import ProgressCircle from 'react-native-progress/Circle'

import styled from '@emotion/native'
import { Image } from 'expo-image'
import { ComputedPlanItem } from 'src/common/types'
import Link from '~common/Link'
import Box from '~common/ui/Box'
import { FeatherIcon } from '~common/ui/Icon'
import Text from '~common/ui/Text'
import { Theme } from '~themes'
import { useFireStorage } from '../plan.hooks'

const CircleImage = styled(Box)(({ theme }) => ({
  position: 'absolute',
  top: 4,
  right: 0,
  left: 4,
  bottom: 0,
  width: 32,
  height: 32,
  borderRadius: 16,
  backgroundColor: theme.colors.lightGrey,
}))

const PlanItem = ({
  id,
  title,
  image,
  description,
  status,
  progress,
  author,
}: ComputedPlanItem) => {
  const theme: Theme = useTheme()
  const cacheImage = useFireStorage(image)
  const isPlanCompleted = status === 'Completed'
  return (
    <Link
      route="Plan"
      params={{
        // @ts-ignore
        plan: {
          id,
          title,
          image,
          description,
          status,
          progress,
          author,
        },
      }}
    >
      <Box
        bg="reverse"
        lightShadow
        borderRadius={35}
        paddingHorizontal={13}
        paddingVertical={10}
        row
        center
        {...(status === 'Progress' && {
          borderWidth: 2,
          borderColor: 'primary',
        })}
        {...(status === 'Completed' && {
          borderWidth: 2,
          borderColor: 'success',
        })}
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
        <Box flex paddingLeft={10}>
          <Text title>{title}</Text>
        </Box>
        <Box
          backgroundColor={status === 'Completed' ? 'success' : 'primary'}
          borderRadius={15}
          size={30}
          center
          marginLeft={20}
        >
          <FeatherIcon name="chevron-right" color="reverse" size={17} style={{ marginLeft: 2 }} />
        </Box>
      </Box>
    </Link>
  )
}

export default PlanItem
