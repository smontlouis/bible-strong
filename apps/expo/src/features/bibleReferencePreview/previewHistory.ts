import { atom } from 'jotai/vanilla'
import type { InlineCommentaryRequest } from '~features/commentaries/InlineCommentaryReader'
import type { ResourcePreviewTarget } from './resourceTarget'
import type { ReferencePreviewTarget } from './referenceTarget'

/** What the web shows in its preview panel, in place of the page of an object. */
export type ReferencePreviewRequest = ReferencePreviewTarget & {
  kind: 'bible'
  version: string
  open: () => void
}
export type PreviewRequest =
  | { kind: 'excerpt'; title: string; text: string; open: () => void }
  | {
      kind: 'commentary'
      title: string
      request: InlineCommentaryRequest
      open: (sectionId?: string) => void
    }
  | { kind: 'link'; linkId: string; title: string; open: () => void }
  | { kind: 'study'; studyId: string; title: string; open: () => void }
  | { kind: 'note'; noteId: string; title: string; open: () => void }
  | ReferencePreviewRequest
  | (ResourcePreviewTarget & { open: () => void })
export const previewHistoryAtom = atom<PreviewRequest[]>([])
