import { useEffect, useRef, useState } from 'react'
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, TextInput } from 'react-native'
import { useSelector } from 'react-redux'
import { selectUserLoginInfo } from '~redux/selectors/user'
import { useTranslation } from 'react-i18next'
import { useLocalSearchParams } from 'expo-router'
import Box, { HStack } from '~common/ui/Box'
import Text from '~common/ui/Text'
import Header from '~common/Header'
import { useTheme } from '~themes/ThemeProvider'
import AssistantMarkdown from './AssistantMarkdown'
import { askAssistant } from './client'
import { assistantAccessible, assistantAvailable } from './assistantConfig'
import type { HistoryMessage } from '@bible-strong/ai-contract/contract'

type Turn = { question: string; answer: string }
export default function StudyAssistantScreen() {
  const { t } = useTranslation()
  const { id: userId } = useSelector(selectUserLoginInfo)
  const { colors } = useTheme()
  const params = useLocalSearchParams<{ context?: string }>()
  const [question, setQuestion] = useState('')
  const [turns, setTurns] = useState<Turn[]>([])
  const [answer, setAnswer] = useState('')
  const [activeQuestion, setActiveQuestion] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [progress, setProgress] = useState('')
  const active = useRef<AbortController | null>(null)
  const assistantAccess = assistantAccessible(userId)
  useEffect(
    () => () => {
      active.current?.abort()
      active.current = null
    },
    []
  )
  useEffect(() => {
    active.current?.abort()
    active.current = null
    setBusy(false)
    setProgress('')
    setQuestion('')
    setTurns([])
    setAnswer('')
    setActiveQuestion('')
    setError('')
  }, [userId])
  const stop = () => {
    active.current?.abort()
  }
  const send = async () => {
    if (active.current || !question.trim()) return
    const current = question.trim(),
      controller = new AbortController()
    active.current = controller
    const deadline = setTimeout(() => controller.abort(), 130000)
    setBusy(true)
    setError('')
    setAnswer('')
    setActiveQuestion(current)
    setQuestion('')
    setProgress(t('assistant.preparing'))
    let generated = '',
      completed = false,
      failure = ''
    const history: HistoryMessage[] = turns.slice(-3).flatMap(turn => [
      { role: 'user' as const, content: turn.question },
      { role: 'assistant' as const, content: turn.answer },
    ])
    while (history.reduce((size, m) => size + m.content.length, 0) > 32000) history.splice(0, 2)
    try {
      await askAssistant(
        {
          question: current,
          history,
          readingContext: typeof params.context === 'string' ? params.context.slice(0, 500) : '',
        },
        controller.signal,
        event => {
          if (controller.signal.aborted || active.current !== controller) return
          if (event.type === 'status') setProgress(t('assistant.searching'))
          if (event.type === 'reset') {
            generated = ''
            setAnswer('')
          }
          if (event.type === 'delta') {
            generated += event.text
            setAnswer(generated)
            setProgress(t('assistant.writing'))
          }
          if (event.type === 'error') {
            failure = event.code
            throw new Error(event.code)
          }
          if (event.type === 'done') completed = true
        }
      )
      if (active.current !== controller) return
      if (controller.signal.aborted) throw new Error('INTERRUPTED')
      if (!completed) throw new Error('INCOMPLETE_STREAM')
      setTurns(previous => [...previous, { question: current, answer: generated }])
      setAnswer('')
      setActiveQuestion('')
    } catch (cause) {
      if (active.current !== controller) return
      const code = controller.signal.aborted
        ? 'INTERRUPTED'
        : failure || (cause instanceof Error ? cause.message : 'AI_UNAVAILABLE')
      const keys: Record<string, string> = {
        SIGN_IN_REQUIRED: 'assistant.signIn',
        BETA_ACCESS_REQUIRED: 'assistant.betaOnly',
        DAILY_LIMIT: 'assistant.limit',
        INTERRUPTED: 'assistant.interrupted',
      }
      setError(t(keys[code] || 'assistant.unavailable'))
    } finally {
      clearTimeout(deadline)
      if (active.current === controller) {
        active.current = null
        setBusy(false)
        setProgress('')
      }
    }
  }
  return (
    <Box className="flex-1 bg-reverse">
      <Header
        title={t('assistant.title')}
        hasBackButton
        rightComponent={
          <Pressable
            disabled={busy}
            onPress={() => {
              setTurns([])
              setAnswer('')
              setActiveQuestion('')
              setError('')
            }}
          >
            <Text className="text-primary">{t('assistant.new')}</Text>
          </Pressable>
        }
      />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{
            padding: 20,
            paddingBottom: 32,
            maxWidth: 860,
            width: '100%',
            alignSelf: 'center',
          }}
        >
          <Text className="mb-5 text-sm text-grey">{t('assistant.notice')}</Text>
          {!turns.length && !activeQuestion && (
            <Box className="py-8">
              <Text className="mb-3 text-2xl font-bold">{t('assistant.heading')}</Text>
              <Text className="text-grey">{t('assistant.intro')}</Text>
            </Box>
          )}
          {turns.map((turn, index) => (
            <Box key={index} className="mb-8">
              <Box className="mb-4 self-end rounded-2xl bg-light-grey p-4">
                <Text>{turn.question}</Text>
              </Box>
              <AssistantMarkdown text={turn.answer} streaming={false} />
            </Box>
          ))}
          {!!activeQuestion && (
            <Box className="mb-4 self-end rounded-2xl bg-light-grey p-4">
              <Text>{activeQuestion}</Text>
            </Box>
          )}
          {!!answer && <AssistantMarkdown text={answer} streaming={busy} />}
          {!!progress && (
            <Text className="mt-3 text-sm text-grey" accessibilityLiveRegion="polite">
              {progress}
            </Text>
          )}
          {!!error && (
            <Text className="mt-4 text-grey" accessibilityRole="alert">
              {error}
            </Text>
          )}
          {!assistantAvailable ? (
            <Text className="mt-4 text-grey">{t('assistant.unavailable')}</Text>
          ) : !userId ? (
            <Text className="mt-4 text-grey">{t('assistant.signIn')}</Text>
          ) : !assistantAccess ? (
            <Text className="mt-4 text-grey">{t('assistant.betaOnly')}</Text>
          ) : null}
        </ScrollView>
        <HStack className="items-end gap-3 border-t border-border p-4">
          <TextInput
            multiline
            maxLength={4000}
            value={question}
            onChangeText={setQuestion}
            placeholder={t('assistant.placeholder')}
            placeholderTextColor={colors.grey}
            accessibilityLabel={t('assistant.placeholder')}
            editable={assistantAccess}
            style={{
              flex: 1,
              color: colors.default,
              backgroundColor: colors.lightGrey,
              borderRadius: 16,
              padding: 14,
              minHeight: 48,
              maxHeight: 160,
            }}
          />
          <Pressable
            accessibilityRole="button"
            disabled={!busy && (!assistantAccess || !question.trim())}
            onPress={
              busy
                ? stop
                : () => {
                    void send()
                  }
            }
            className="rounded-xl bg-primary px-4 py-3"
          >
            <Text className="font-bold text-white">
              {t(busy ? 'assistant.stop' : 'assistant.send')}
            </Text>
          </Pressable>
        </HStack>
      </KeyboardAvoidingView>
    </Box>
  )
}
