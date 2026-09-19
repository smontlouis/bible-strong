import { atom } from 'jotai'
import type { ReadingContext } from './conversations'
export const resourceContextsAtom = atom<
  Record<string, { scope: string; path: string; context: ReadingContext }>
>({})
