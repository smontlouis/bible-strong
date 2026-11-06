import {
  MessagePrimitive,
  useAuiState,
  type ThreadAssistantMessagePart,
  type ThreadUserMessagePart,
} from '@assistant-ui/react-native'
import { useTranslation } from 'react-i18next'
import type {
  StudySource,
  StudyWidget as StudyWidgetDescriptor,
  ToolActivity,
} from '@bible-strong/ai-contract/contract'
import Box from '~common/ui/Box'
import Text from '~common/ui/Text'
import AssistantMessageMarkdown from './AssistantMessageMarkdown'
import ToolTimeline from './ToolTimeline'
import StudyWidget from './widgets/StudyWidget'
import { messageSegments, placedWidgetIds } from './widgetSegments'
import { type ReadingContext } from './conversations'
import { messagePartNames } from './messageRuntime'

type MessagePart = ThreadAssistantMessagePart | ThreadUserMessagePart

const dataParts = <T,>(parts: readonly MessagePart[], name: string): T[] =>
  parts.flatMap(part => (part.type === 'data' && part.name === name ? [part.data as T] : []))

export const contextCaption = (value: ReadingContext) =>
  ['passage', 'word'].includes(value.kind) ? value.detail : value.label

const toolActivities = (parts: readonly MessagePart[]): ToolActivity[] =>
  parts.flatMap(part => {
    if (part.type !== 'tool-call') return []
    const savedState =
      part.artifact && typeof part.artifact === 'object' && 'bibleStrongState' in part.artifact
        ? part.artifact.bibleStrongState
        : undefined
    const state: ToolActivity['state'] =
      savedState === 'interrupted'
        ? 'interrupted'
        : part.result === undefined
          ? 'running'
          : part.isError
            ? 'error'
            : 'complete'
    return [
      {
        callId: part.toolCallId,
        name: part.toolName,
        request: part.argsText,
        result: typeof part.result === 'string' ? part.result : '',
        state,
      },
    ]
  })

export function UserMessage() {
  return (
    <MessagePrimitive.Root className="mb-4 max-w-[85%] items-end self-end">
      <MessagePrimitive.Parts>
        {({ part }) => {
          if (part.type === 'text')
            return (
              <Box className="bg-light-grey rounded-[16px] px-4 py-[10px]">
                <Text selectable>{part.text}</Text>
              </Box>
            )
          if (part.type === 'data' && part.name === messagePartNames.context)
            return (
              <Text className="text-grey mt-1 text-[12px]" numberOfLines={1}>
                {contextCaption(part.data as ReadingContext)}
              </Text>
            )
          return null
        }}
      </MessagePrimitive.Parts>
    </MessagePrimitive.Root>
  )
}

export function AssistantMessage({
  busy,
  error,
  lastMessageId,
}: {
  busy: boolean
  error: string
  lastMessageId?: string
}) {
  const { t } = useTranslation()
  const message = useAuiState(s => s.message)
  const sources = dataParts<StudySource>(message.content, messagePartNames.source)
  const widgets = dataParts<StudyWidgetDescriptor>(message.content, messagePartNames.widget)
  const tools = toolActivities(message.content)
  const streaming = message.status?.type === 'running' && busy
  const incomplete = message.status?.type === 'incomplete'
  // Cards the answer places are shown at their link; older answers keep them at the end.
  const widgetIds = new Set(widgets.map(widget => widget.id))
  const text = message.content.find(part => part.type === 'text')?.text || ''
  const placed = placedWidgetIds(text, widgetIds)
  return (
    <MessagePrimitive.Root className="mb-6">
      {!!tools.length && <ToolTimeline tools={tools} running={streaming} />}
      <MessagePrimitive.Parts>
        {({ part }) => {
          if (part.type === 'text')
            return part.text ? (
              <>
                {messageSegments(part.text, widgetIds).map((segment, index) => {
                  if (segment.type === 'markdown')
                    return (
                      <AssistantMessageMarkdown
                        key={`markdown-${index}`}
                        text={segment.text}
                        streaming={streaming}
                        sources={sources}
                        widgets={widgets}
                      />
                    )
                  const widget = widgets.find(item => item.id === segment.id)
                  return widget ? <StudyWidget key={`widget-${widget.id}`} widget={widget} /> : null
                })}
              </>
            ) : null
          if (part.type === 'tool-call') return <></>
          if (part.type !== 'data') return null
          if (part.name === messagePartNames.widget) {
            const widget = part.data as StudyWidgetDescriptor
            return placed.has(widget.id) ? null : <StudyWidget widget={widget} />
          }
          return null
        }}
      </MessagePrimitive.Parts>
      {incomplete && !(error && message.id === lastMessageId) && (
        <Text className="text-grey mt-2 text-[13px]">{t('assistant.modal.incomplete')}</Text>
      )}
    </MessagePrimitive.Root>
  )
}
