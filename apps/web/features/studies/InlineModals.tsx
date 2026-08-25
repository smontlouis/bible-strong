import {
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalCloseButton,
  ModalBody,
} from '@chakra-ui/react'
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
  }, [])

  return (
    <Modal isCentered isOpen={isOpen} onClose={() => setIsOpen(false)}>
      <ModalOverlay />
      <ModalContent>
        <ModalHeader>{title}</ModalHeader>
        <ModalCloseButton />
        <ModalBody data-modal={inlineItem.id} mb={8}>
          <div dangerouslySetInnerHTML={{ __html: content }} />
        </ModalBody>
      </ModalContent>
    </Modal>
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
  }, [])

  return (
    <Modal isCentered isOpen={isOpen} onClose={() => setIsOpen(false)}>
      <ModalOverlay />
      <ModalContent>
        <ModalHeader>{title}</ModalHeader>
        <ModalCloseButton />
        <ModalBody data-modal={inlineItem.Code} mb={8}>
          <div dangerouslySetInnerHTML={{ __html: content }} />
        </ModalBody>
      </ModalContent>
    </Modal>
  )
}

export default InlineModals
