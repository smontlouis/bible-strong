import { createContext, useContext } from 'react'

/** Width a page laid out in two columns gives its header, so the header spans them. */
export const PageHeaderWidthContext = createContext<number | undefined>(undefined)

export const usePageHeaderWidth = () => useContext(PageHeaderWidthContext)
