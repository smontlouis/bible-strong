import React from 'react'
import { Modalize } from 'react-native-modalize'

import Box from '~common/ui/Box'
import Text from '~common/ui/Text'
import Paragraph from '~common/ui/Paragraph'
import { useTheme } from 'emotion-theming'
import { Theme } from '~themes'
import { ShallowTimelineSection } from './types'
import { wp } from '~helpers/utils'
import FastImage from 'react-native-fast-image'
import InlineLink from '~common/InlineLink'

interface Props extends ShallowTimelineSection {
  modalRef: React.RefObject<Modalize>
  HeaderComponent?: React.ReactNode
  FooterComponent?: React.ReactNode
}

const width = wp(50, 500)

const SectionDetailsModal = ({
  modalRef,
  FooterComponent,
  HeaderComponent,
  id,
  image,
  color,
  description,
  title,
  sectionTitle,
  subTitle,
  startYear,
  endYear,
  interval,
}: Props) => {
  const theme: Theme = useTheme()

  return (
    <Modalize
      ref={modalRef}
      modalStyle={{
        backgroundColor: theme.colors.lightGrey,
        maxWidth: 600,
        width: '100%',
        marginLeft: 'auto',
        marginRight: 'auto',
      }}
      FooterComponent={FooterComponent}
      HeaderComponent={HeaderComponent}
    >
      <Box flex center px={50} py={60}>
        <Text title fontSize={20}>
          {sectionTitle}
        </Text>

        <Text py={30} fontSize={35} title textAlign="center">
          {title.toUpperCase()}
        </Text>

        <Box>
          <Box height={2} bg="default" />

          <Text py={3} textAlign="center" title>
            {subTitle}
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
          bg={color}
          width={50}
          height={10}
          borderRadius={10}
          my={50}
        />
        <Paragraph>{description}</Paragraph>
        <Paragraph scale={-2} mt={80} textAlign="center">
          {`Vous souhaitez aller plus loin ?\n`}
          <InlineLink
            scale={-2}
            href="https://www.bibleuniverse.com/study-tools/storacles/c/3/l/french"
          >
            Cliquez ici
          </InlineLink>
        </Paragraph>
      </Box>
    </Modalize>
  )
}

export default SectionDetailsModal
