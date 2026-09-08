import type { ReactNode } from 'react'
import type { PassageSearchFiltersProps } from './PassageSearchFiltersSheet'
import type { SearchSourceFiltersProps } from './SearchSourceFiltersSheet'

export type SearchFiltersTriggerProps = {
  children: ReactNode
  initialScreen: 'sources' | 'passages'
  activeCount: number
  passages: PassageSearchFiltersProps
  sources: SearchSourceFiltersProps
}

// Native keeps its existing triggers and sheets.
export default function SearchFiltersTrigger({ children }: SearchFiltersTriggerProps) {
  return <>{children}</>
}
