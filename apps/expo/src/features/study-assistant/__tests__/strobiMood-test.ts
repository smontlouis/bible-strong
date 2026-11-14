import type { ToolActivity } from '@bible-strong/ai-contract/contract'
import { failedCalls, runMood } from '../strobiMood'

// Reference formatting is not what is tested here.
jest.mock('~helpers/verseToReference', () => ({ __esModule: true, default: () => '' }))

const tool = (name: string, state: ToolActivity['state'], callId = name): ToolActivity => ({
  callId,
  name,
  request: '{}',
  result: '',
  state,
})

describe("Strobi's state during a run", () => {
  it('listens before the service names a step', () => {
    expect(runMood('', [])).toBe('listening')
    expect(runMood('assistant.preparing', [])).toBe('listening')
  })

  it('shows each step', () => {
    expect(runMood('assistant.steps.analyzing', [])).toBe('curious')
    expect(runMood('assistant.steps.searching', [])).toBe('curious')
    expect(runMood('assistant.searching', [])).toBe('curious')
    expect(runMood('assistant.steps.thinking', [])).toBe('suspicious')
    expect(runMood('assistant.steps.reading', [])).toBe('reading')
    expect(runMood('assistant.steps.reviewing', [])).toBe('suspicious')
    expect(runMood('assistant.steps.composing', [])).toBe('writing')
    expect(runMood('assistant.writing', [])).toBe('writing')
  })

  it('shows the resource being read rather than the step around it', () => {
    expect(runMood('assistant.steps.thinking', [tool('search_library', 'running')])).toBe('curious')
    expect(runMood('assistant.steps.searching', [tool('read_passage', 'running')])).toBe('reading')
    expect(runMood('assistant.steps.thinking', [tool('read_passage', 'complete')])).toBe(
      'suspicious'
    )
  })

  it('writes once the answer shows, whatever is still marked as read', () => {
    expect(runMood('assistant.writing', [tool('read_passage', 'running')])).toBe('writing')
  })

  it('lists the reads that failed', () => {
    expect(
      failedCalls([tool('read_passage', 'error', 'a'), tool('search_library', 'complete', 'b')])
    ).toEqual(['a'])
  })
})
