import type { RefObject } from 'react'
import type { ResourceModalProps } from './ResourceModalContent'

// Runtime-only bridge: the URL retains the passage for reloads; live readers keep their atom/actions.
export const resourceSidebarSources = new Map<string, RefObject<ResourceModalProps>>()
