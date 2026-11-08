import { use } from 'react'
import Animated, { FadeIn } from 'react-native-reanimated'
import { useAui } from '@assistant-ui/react-native'
import { useTranslation } from 'react-i18next'
import Box, { TouchableBox } from '~common/ui/Box'
import { FeatherIcon } from '~common/ui/Icon'
import Text from '~common/ui/Text'
import { ComposerInputContext } from './assistantSheetContext'

/**
 * What the reader may ask next, under the last answer. A question picked goes into the
 * composer, ready to be changed or sent: nothing is asked on the reader's behalf.
 */
export default function FollowUpQuestions({ questions }: { questions: string[] }) {
  const { t } = useTranslation()
  const aui = useAui()
  const input = use(ComposerInputContext)
  return (
    <Animated.View entering={FadeIn.duration(220)}>
      <Box
        className="mt-5 gap-2"
        accessibilityRole="list"
        accessibilityLabel={t('assistant.modal.followUps')}
      >
        <Text className="text-grey text-[13px]">{t('assistant.modal.followUps')}</Text>
        {questions.map(question => (
          <TouchableBox
            key={question}
            accessibilityRole="button"
            accessibilityLabel={question}
            accessibilityHint={t('assistant.modal.followUpHint')}
            onPress={() => {
              aui.composer.setText(question)
              input.current?.focus()
            }}
            className="bg-light-grey flex-row items-center gap-3 rounded-[12px] px-4 py-3"
          >
            <FeatherIcon name="corner-down-right" size={15} color="grey" />
            <Text className="flex-1 text-[15px] leading-[20px]">{question}</Text>
          </TouchableBox>
        ))}
      </Box>
    </Animated.View>
  )
}
