import { isStudyStep } from '@bible-strong/ai-contract/contract'

/**
 * The progress line for a status event: the step the service is at (2026-11-12), or resources
 * being read for a service that names no step.
 */
export const statusProgressKey = (message: string) =>
  isStudyStep(message) ? `assistant.steps.${message}` : 'assistant.searching'
