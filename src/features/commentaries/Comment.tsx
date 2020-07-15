import React from 'react'
import FastImage from 'react-native-fast-image'
import Box from '~common/ui/Box'
import Text from '~common/ui/Text'
import StylizedHTMLView from '~common/StylizedHTMLView'
import { Comment as CommentProps, EGWComment } from './types'
import { useFireStorage } from '~features/plans/plan.hooks'

const openLink = (href: string, content: string, type: string) => {
  console.log(href, content, type)
}

const Comment = ({ resource, content }: CommentProps | EGWComment) => {
  const cacheImage = useFireStorage(resource.logo)
  return (
    <Box>
      <Box center width={50} height={50} borderRadius={25} bg="blue">
        <FastImage
          style={{ width: 50, height: 50 }}
          source={{
            uri: cacheImage,
          }}
        />
      </Box>
      <Text title fontSize={20}>
        {resource.author}
      </Text>
      <Box overflow="hidden" height={200}>
        <StylizedHTMLView value={content} onLinkPress={openLink} />
      </Box>
    </Box>
  )
}

export default Comment
