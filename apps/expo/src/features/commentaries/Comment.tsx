import { FadeIn, FadeOut, LinearTransition, useReducedMotion } from 'react-native-reanimated'

import Box, { AnimatedBox } from '~common/ui/Box'
import Text from '~common/ui/Text'
import { Comment as CommentProps, EGWComment } from './types'
import CommentaryAvatar from './CommentaryAvatar'

interface Props {
  comment: CommentProps | EGWComment
  passageLabel: string
}

const Comment = ({ comment, passageLabel }: Props) => {
  const { resource, content } = comment
  const reduceMotion = useReducedMotion()

  return (
    <AnimatedBox
      m={20}
      marginBottom={0}
      p={20}
      rounded
      lightShadow
      bg="reverse"
      layout={reduceMotion ? undefined : LinearTransition.duration(220)}
      entering={reduceMotion ? undefined : FadeIn.duration(160)}
      exiting={reduceMotion ? undefined : FadeOut.duration(130)}
    >
      <Box row>
        <CommentaryAvatar
          resourceCode={resource.code}
          author={resource.author}
          fallback={resource.shortName ?? resource.name}
          size={44}
        />
        <Box ml={10} flex>
          <Text title fontSize={20}>
            {resource.name}
          </Text>
          <Text color="grey" fontSize={14}>
            {resource.author === 'Ellen G. White' ? 'EGW' : resource.author}
          </Text>
        </Box>
      </Box>
      <AnimatedBox
        key={comment.id}
        layout={reduceMotion ? undefined : LinearTransition.duration(180)}
        entering={reduceMotion ? undefined : FadeIn.duration(160)}
        exiting={reduceMotion ? undefined : FadeOut.duration(110)}
      >
        <Text mt={14} fontSize={19} lineHeight={29} numberOfLines={5} ellipsizeMode="tail">
          {content}
        </Text>
        <Box mt={14} px={10} py={5} borderRadius={12} bg="lightPrimary" alignSelf="flex-start">
          <Text color="primary" fontSize={12}>
            {passageLabel}
          </Text>
        </Box>
      </AnimatedBox>
    </AnimatedBox>
  )
}

export default Comment
