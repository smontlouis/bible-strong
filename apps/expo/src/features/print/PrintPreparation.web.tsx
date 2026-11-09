import { useEffect } from 'react'

import { markForPrint } from './markForPrint'
import './print.css'

/**
 * Whoever starts the printing (the browser's own Print, ⌘P, or the desktop app's menu), the page
 * marks the active tab's content just before. Renders nothing.
 */
const PrintPreparation = () => {
  useEffect(() => {
    const prepare = () => {
      markForPrint(document)
    }
    window.addEventListener('beforeprint', prepare)
    return () => window.removeEventListener('beforeprint', prepare)
  }, [])
  return null
}

export default PrintPreparation
