import type { ReadingContext } from './conversations'
// Native surfaces do not publish context to the web-only assistant.
export function useAssistantResourceContext(
  _scope: string,
  _context: ReadingContext | null
): void {}
