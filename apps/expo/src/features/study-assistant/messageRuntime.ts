import type { ThreadMessageLike } from '@assistant-ui/react'
import type { ToolActivity } from '@bible-strong/ai-contract/contract'
import type { ReadonlyJSONObject } from 'assistant-stream/utils'
import type { LocalMessage } from './conversations'

export const messagePartNames = {
  context: 'bible-strong-context',
  routing: 'bible-strong-routing',
  source: 'bible-strong-source',
  widget: 'bible-strong-widget',
} as const

const toolArgs = (tool: ToolActivity): ReadonlyJSONObject => {
  try {
    const value: unknown = JSON.parse(tool.request)
    return value && typeof value === 'object' && !Array.isArray(value)
      ? (value as ReadonlyJSONObject)
      : { input: tool.request }
  } catch {
    return { input: tool.request }
  }
}

const status = (state: LocalMessage['state']): ThreadMessageLike['status'] => {
  if (state === 'streaming') return { type: 'running' }
  if (state === 'complete') return { type: 'complete', reason: 'stop' }
  return {
    type: 'incomplete',
    reason: state === 'interrupted' ? 'cancelled' : 'error',
  }
}

export function convertMessage(message: LocalMessage): ThreadMessageLike {
  const content: Exclude<ThreadMessageLike['content'], string> = [
    ...(message.tools || []).map(tool => ({
      type: 'tool-call' as const,
      toolCallId: tool.callId,
      toolName: tool.name,
      args: toolArgs(tool),
      argsText: tool.request,
      ...(tool.state === 'running' ? {} : { result: tool.result }),
      ...(tool.state === 'error' || tool.state === 'interrupted' ? { isError: true } : {}),
      artifact: { bibleStrongState: tool.state },
    })),
    ...(message.routing || []).map(data => ({
      type: 'data' as const,
      name: messagePartNames.routing,
      data,
    })),
    ...(message.sources || []).map(data => ({
      type: 'data' as const,
      name: messagePartNames.source,
      data,
    })),
    { type: 'text', text: message.text },
    ...(message.context
      ? [{ type: 'data' as const, name: messagePartNames.context, data: message.context }]
      : []),
    ...(message.widgets || []).map(data => ({
      type: 'data' as const,
      name: messagePartNames.widget,
      data,
    })),
  ]
  return {
    id: message.id,
    role: message.role,
    content,
    ...(message.role === 'assistant' ? { status: status(message.state) } : {}),
    createdAt: new Date(message.createdAt),
  }
}
