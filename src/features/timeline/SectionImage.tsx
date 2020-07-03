import React from 'react'

import { ShallowTimelineSection } from './types'
import Box from '~common/ui/Box'
import Text from '~common/ui/Text'
import FastImage from 'react-native-fast-image'
import { wp } from '~helpers/utils'
import { FeatherIcon } from '~common/ui/Icon'
import useLanguage from '~helpers/useLanguage'

const width = wp(50, 500)

const SectionImage = ({
  image,
  title,
  titleEn,
  sectionTitle,
  sectionTitleEn,
  color,
  subTitle,
  subTitleEn,
  direction,
}: ShallowTimelineSection & { direction?: 'previous' | 'next' }) => {
  const isFR = useLanguage()

  return (
    <Box flex bg="reverse" row>
      <Box width={60} center>
        {direction === 'previous' && (
          <FeatherIcon name="chevron-left" size={60} />
        )}
      </Box>
      <Box flex center>
        <Text title fontSize={20}>
          {isFR ? sectionTitle : sectionTitleEn}
        </Text>

        <Text py={10} fontSize={30} title textAlign="center">
          {isFR ? title.toUpperCase() : titleEn.toUpperCase()}
        </Text>

        <Box>
          <Box height={2} bg="default" />

          <Text py={3} textAlign="center" title>
            {isFR ? subTitle : subTitleEn}
          </Text>
          <Box height={2} bg="default" />
        </Box>
        <Box row width={width} mt={50} lightShadow borderRadius={10}>
          <FastImage
            style={{ width, height: width, borderRadius: 10 }}
            source={{
              uri: image,
            }}
          />
        </Box>
        <Box
          lightShadow
          mt={50}
          bg={color}
          width={50}
          height={10}
          borderRadius={10}
        />
      </Box>
      <Box width={60} center>
        {direction === 'next' && <FeatherIcon name="chevron-right" size={60} />}
      </Box>
    </Box>
  )
}

export default SectionImage
