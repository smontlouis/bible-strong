import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import {
  Annexe as AnnexeProps,
  OpsInlineVerse,
  OpsInlineStrong,
} from './helpers.study'
import { useEffect, useState } from 'react'

interface Props {
  annexe: AnnexeProps
}

const InlineModals = ({ annexe }: Props) => {
  return (
    <>
      {annexe.map((inlineItem, i) => {
        if (inlineItem.type === 'inline-verse') {
          return <VerseModal key={i} inlineItem={inlineItem} />
        }

        if (inlineItem.type === 'inline-strong') {
          return <StrongModal key={i} inlineItem={inlineItem} />
        }

        return <div key={i}>Error</div>
      })}
    </>
  )
}

const VerseModal = ({ inlineItem }: { inlineItem: OpsInlineVerse }) => {
  const [isOpen, setIsOpen] = useState(false)
  const [title, setTitle] = useState<string>()
  const [content, setContent] = useState<string>('')

  useEffect(() => {
    const itemRef: HTMLElement | null = document.querySelector(
      `[data-verses="${inlineItem.id}"]`
    )
    const title = document.querySelector(
      `[data-annexe="${inlineItem.id}"] [data-title]`
    )?.innerHTML
    setTitle(title)

    const content = document.querySelector(
      `[data-annexe="${inlineItem.id}"] [data-content]`
    )?.innerHTML
    setContent(content || '')

    if (itemRef) {
      itemRef.onclick = (e) => {
        e.stopPropagation()
        setIsOpen(true)
      }
    }
    return () => { if (itemRef) itemRef.onclick = null }
  }, [inlineItem.id])

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent>
        <DialogHeader><DialogTitle>{title}</DialogTitle></DialogHeader>
        <div data-modal={inlineItem.id} className="mb-8">
          <div dangerouslySetInnerHTML={{ __html: content }} />
        </div>
      </DialogContent>
    </Dialog>
  )
}

const StrongModal = ({ inlineItem }: { inlineItem: OpsInlineStrong }) => {
  const [isOpen, setIsOpen] = useState(false)
  const [title, setTitle] = useState<string>()
  const [content, setContent] = useState<string>('')

  useEffect(() => {
    const itemRef: HTMLElement | null = document.querySelector(
      `[data-code="${inlineItem.Code}"]`
    )

    const title = document.querySelector(
      `[data-annexe="${inlineItem.Code}"] [data-title]`
    )?.innerHTML
    setTitle(title)

    const content = document.querySelector(
      `[data-annexe="${inlineItem.Code}"] [data-content]`
    )?.innerHTML
    setContent(content || '')

    if (itemRef) {
      itemRef.onclick = (e) => {
        e.stopPropagation()
        setIsOpen(true)
      }
    }
    return () => { if (itemRef) itemRef.onclick = null }
  }, [inlineItem.Code])

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent>
        <DialogHeader><DialogTitle>{title}</DialogTitle></DialogHeader>
        <div data-modal={inlineItem.Code} className="mb-8">
          <div dangerouslySetInnerHTML={{ __html: content }} />
        </div>
      </DialogContent>
    </Dialog>
  )
}

export default InlineModals
