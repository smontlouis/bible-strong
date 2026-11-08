import Animated, { FadeIn } from 'react-native-reanimated'
import { ThreadPrimitive } from '@assistant-ui/react-native'
import { useTranslation } from 'react-i18next'
import Box from '~common/ui/Box'
import { FeatherIcon } from '~common/ui/Icon'
import Text from '~common/ui/Text'

/** What the reader may ask next, under the last answer: a question picked is asked at once. */
export default function FollowUpQuestions({
  questions,
  disabled,
}: {
  questions: string[]
  disabled: boolean
}) {
  const { t } = useTranslation()
  return (
    <Animated.View entering={FadeIn.duration(220)}>
      <Box
        className="mt-5 gap-2"
        accessibilityRole="list"
        accessibilityLabel={t('assistant.modal.followUps')}
      >
        <Text className="text-grey text-[13px]">{t('assistant.modal.followUps')}</Text>
        {questions.map(question => (
          <ThreadPrimitive.Suggestion
            key={question}
            prompt={question}
            send
            disabled={disabled}
            accessibilityLabel={question}
            accessibilityHint={t('assistant.modal.followUpHint')}
            className="bg-light-grey flex-row items-center gap-3 rounded-[12px] px-4 py-3"
          >
            <FeatherIcon name="corner-down-right" size={15} color="grey" />
            <Text className="flex-1 text-[15px] leading-[20px]">{question}</Text>
          </ThreadPrimitive.Suggestion>
        ))}
      </Box>
    </Animated.View>
  )
}
