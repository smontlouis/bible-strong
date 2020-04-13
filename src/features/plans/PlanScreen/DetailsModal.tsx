import React from 'react'
import { Modalize } from 'react-native-modalize'
import FastImage from 'react-native-fast-image'

import styled from '~styled'
import Paragraph from '~common/ui/Paragraph'
import Box from '~common/ui/Box'
import { ComputedPlanItem } from '~common/types'
import { useTheme } from 'emotion-theming'
import { Theme } from '~themes'

const CircleImage = styled(Box)(({ theme }) => ({
  width: 100,
  height: 100,
  borderRadius: 50,
  backgroundColor: theme.colors.lightGrey,
  borderWidth: 4,
  borderColor: theme.colors.lightGrey,
}))

interface Props {
  modalRefDetails: React.RefObject<Modalize<any, any>>
}

const DetailsModal = ({
  modalRefDetails,
  image,
  title,
  description,
  author,
}: Omit<ComputedPlanItem, 'status' | 'progress'> & Props) => {
  const theme: Theme = useTheme()
  return (
    <Modalize
      ref={modalRefDetails}
      adjustToContentHeight
      modalStyle={{ backgroundColor: theme.colors.lightGrey }}
    >
      <Box paddingHorizontal={20} paddingVertical={50}>
        {image && (
          <Box center marginBottom={20}>
            <CircleImage center>
              <FastImage
                style={{ width: 100, height: 100 }}
                source={{
                  uri: image,
                }}
              />
            </CircleImage>
          </Box>
        )}
        <Paragraph fontFamily="title" scale={2} textAlign="center">
          {title}
        </Paragraph>
        <Paragraph
          marginTop={20}
          fontFamily="text"
          scale={-2}
          textAlign="center"
        >
          {description}
        </Paragraph>
        {author.displayName && (
          <Box center marginTop={40}>
            {author.photoUrl && (
              <Box borderRadius={10} marginBottom={10}>
                <FastImage
                  style={{ width: 50, height: 50 }}
                  source={{
                    uri: author.photoUrl,
                  }}
                />
              </Box>
            )}
            <Paragraph fontFamily="text" scale={-3}>
              Créé par {author.displayName}
            </Paragraph>
          </Box>
        )}
      </Box>
    </Modalize>
  )
}

export default DetailsModal
