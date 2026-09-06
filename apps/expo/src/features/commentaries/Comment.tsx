import { resolveFontFamily } from '~themes/styleValues'
import { useTheme as useStylingTheme } from '~themes/ThemeProvider'
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
  const stylingTheme = useStylingTheme()

  const { resource, content } = comment
  const reduceMotion = useReducedMotion()

  return (
    <AnimatedBox
      className="overflow-hidden border-continuous m-[20px] mb-[0px] p-[20px] rounded-[20px] bg-reverse"
      layout={reduceMotion ? undefined : LinearTransition.duration(220)}
      entering={reduceMotion ? undefined : FadeIn.duration(160)}
      exiting={reduceMotion ? undefined : FadeOut.duration(130)}
      style={{
        shadowColor: 'rgb(89,131,240)',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 7,
        elevation: 1,
        overflow: 'visible',
      }}
    >
      <Box className="overflow-hidden border-continuous flex-row">
        <CommentaryAvatar
          resourceCode={resource.code}
          author={resource.author}
          fallback={resource.shortName ?? resource.name}
          size={44}
        />
        <Box className="overflow-hidden border-continuous ml-[10px] flex-[1]">
          <Text
            className="text-[20px]"
            style={{ fontFamily: resolveFontFamily(stylingTheme.fontFamily.title) }}
          >
            {resource.name}
          </Text>
          <Text className="text-grey text-[14px]">
            {resource.author === 'Ellen G. White' ? 'EGW' : resource.author}
          </Text>
        </Box>
      </Box>
      <AnimatedBox
        key={comment.id}
        layout={reduceMotion ? undefined : LinearTransition.duration(180)}
        entering={reduceMotion ? undefined : FadeIn.duration(160)}
        exiting={reduceMotion ? undefined : FadeOut.duration(110)}
        className="overflow-hidden border-continuous"
      >
        <Text
          className="mt-[14px] text-[19px] leading-[29px]"
          numberOfLines={5}
          ellipsizeMode="tail"
        >
          {content}
        </Text>
        <Box className="overflow-hidden border-continuous mt-[14px] px-[10px] py-[5px] rounded-[12px] bg-light-primary self-start">
          <Text className="text-primary text-[12px]">{passageLabel}</Text>
        </Box>
      </AnimatedBox>
    </AnimatedBox>
  )
}

export default Comment
