import type { Feather } from '@expo/vector-icons'
import type { BibleResource, StudyNavigateBibleType, VerseIds } from '~common/types'
import type { VersionCode } from '../../../state/tabs'

export type FeatherIconName = React.ComponentProps<typeof Feather>['name']

export type TabType = 'annotate' | 'study' | 'share'

export interface TabButtonProps {
  label: string
  isActive: boolean
  onPress: () => void
}

export interface ActionItemProps {
  name?: FeatherIconName
  Icon?: React.FC<{ size?: number }>
  svgSource?: number
  tintColor?: string
  label: string
  onPress: () => void
  disabled?: boolean
  isActive?: boolean
  variant?: 'default' | 'emphasized'
}

export interface VerseActiveStates {
  hasNote: boolean
  hasTags: boolean
  hasLink: boolean
  hasBookmark: boolean
  hasFocus: boolean
}

export interface SelectedVersesModalProps {
  ref?: React.RefObject<import('@gorhom/bottom-sheet').default | null>
  isSelectionMode: StudyNavigateBibleType | undefined
  selectedVerseHighlightColor: string | null
  onChangeResourceType: (type: BibleResource) => void
  onCreateNoteClick: () => void
  onCreateLinkClick: () => void
  addHighlight: (color: string) => void
  addTag: () => void
  removeHighlight: () => void
  clearSelectedVerses: () => void
  selectedVerses: VerseIds
  selectAllVerses: () => void
  version: VersionCode
  onAddToStudy: () => void
  onAddBookmark: () => void
  onPinVerses: () => void
  onEnterAnnotationMode?: () => void
  focusVerses?: (string | number)[]
}
