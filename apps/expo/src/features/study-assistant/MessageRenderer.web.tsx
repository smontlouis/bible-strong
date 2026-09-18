import {
  MessagePrimitive,
  useAuiState,
  type ThreadAssistantMessagePart,
  type ThreadUserMessagePart,
} from '@assistant-ui/react'
import { useTranslation } from 'react-i18next'
import type {
  StudySource,
  StudyWidget as StudyWidgetDescriptor,
  ToolActivity,
} from '@bible-strong/ai-contract/contract'
import AssistantMessageMarkdown from './AssistantMessageMarkdown.web'
import ToolTimeline from './ToolTimeline.web'
import StudyWidget from './widgets/StudyWidget.web'
import { type ReadingContext } from './conversations'
import { messagePartNames } from './messageRuntime'

type MessagePart = ThreadAssistantMessagePart | ThreadUserMessagePart

const dataParts = <T,>(parts: readonly MessagePart[], name: string): T[] =>
  parts.flatMap(part => (part.type === 'data' && part.name === name ? [part.data as T] : []))

const contextCaption = (value: ReadingContext) =>
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
    <MessagePrimitive.Root asChild>
      <article className="bs-assistant-message bs-assistant-message-user">
        <MessagePrimitive.Parts>
          {({ part }) => {
            if (part.type === 'text') return <div>{part.text}</div>
            if (part.type === 'data' && part.name === messagePartNames.context)
              return <small>{contextCaption(part.data as ReadingContext)}</small>
            return null
          }}
        </MessagePrimitive.Parts>
      </article>
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
  return (
    <MessagePrimitive.Root asChild>
      <article className="bs-assistant-message bs-assistant-message-assistant">
        {!!tools.length && <ToolTimeline tools={tools} running={streaming} />}
        <MessagePrimitive.Parts>
          {({ part }) => {
            if (part.type === 'text')
              return part.text ? (
                <AssistantMessageMarkdown sources={sources} widgets={widgets} />
              ) : null
            if (part.type === 'tool-call') return <></>
            if (part.type !== 'data') return null
            if (part.name === messagePartNames.widget)
              return <StudyWidget widget={part.data as StudyWidgetDescriptor} />
            return null
          }}
        </MessagePrimitive.Parts>
        {incomplete && !(error && message.id === lastMessageId) && (
          <small className="bs-assistant-incomplete">{t('assistant.modal.incomplete')}</small>
        )}
      </article>
    </MessagePrimitive.Root>
  )
}
