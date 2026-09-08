import { useContext, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { HeaderContentContext } from './HeaderActionContext'
export default function HeaderContent({ children }: { children: ReactNode }) {
  const target = useContext(HeaderContentContext)
  return target ? createPortal(children, target) : null
}
