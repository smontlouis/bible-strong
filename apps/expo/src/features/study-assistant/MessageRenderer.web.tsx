import { useState } from 'react'
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
import WidgetReveal from './widgets/WidgetReveal.web'
import { messageSegments, placedWidgetIds } from './widgetSegments'
import { type ReadingContext } from './conversations'
import { contextCaption } from './contextDisplay'
import ContextMarkIcon from './ContextMarkIcon.web'
import { messagePartNames } from './messageRuntime'

type MessagePart = ThreadAssistantMessagePart | ThreadUserMessagePart

const dataParts = <T,>(parts: readonly MessagePart[], name: string): T[] =>
  parts.flatMap(part => (part.type === 'data' && part.name === name ? [part.data as T] : []))

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
              return (
                <small>
                  <ContextMarkIcon context={part.data as ReadingContext} size={11} />
                  {contextCaption(part.data as ReadingContext)}
                </small>
              )
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
  // Cards of an answer seen being written come in as it is written; older ones show at once.
  const [live] = useState(streaming)
  const incomplete = message.status?.type === 'incomplete'
  // Cards the answer places are shown at their link; older answers keep them at the end.
  const widgetIds = new Set(widgets.map(widget => widget.id))
  const text = message.content.find(part => part.type === 'text')?.text || ''
  const placed = placedWidgetIds(text, widgetIds)
  return (
    <MessagePrimitive.Root asChild>
      <article className="bs-assistant-message bs-assistant-message-assistant">
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
                          sources={sources}
                          widgets={widgets}
                          segment={index}
                        />
                      )
                    const widget = widgets.find(item => item.id === segment.id)
                    return widget ? (
                      <WidgetReveal key={`widget-${widget.id}`} animate={live}>
                        <StudyWidget widget={widget} />
                      </WidgetReveal>
                    ) : null
                  })}
                </>
              ) : null
            if (part.type === 'tool-call') return <></>
            if (part.type !== 'data') return null
            if (part.name === messagePartNames.widget) {
              const widget = part.data as StudyWidgetDescriptor
              // While the answer is written, a card waits for its place in the text.
              return placed.has(widget.id) || streaming ? null : (
                <WidgetReveal animate={live}>
                  <StudyWidget widget={widget} />
                </WidgetReveal>
              )
            }
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
