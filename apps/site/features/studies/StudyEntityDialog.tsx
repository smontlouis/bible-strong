import { useEffect, useState, type RefObject } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  getStudyEntityLink,
  deserializeStudyEntityPayload,
  type StudyEntityEmbedPayload,
} from './study-entities'

type Props = {
  contentRef: RefObject<HTMLDivElement | null>
}

const parseEntity = (element: Element): StudyEntityEmbedPayload | null => {
  const value = element.getAttribute('data-study-entity')
  return value ? deserializeStudyEntityPayload(value) : null
}

export default function StudyEntityDialog({ contentRef }: Props) {
  const [entity, setEntity] = useState<StudyEntityEmbedPayload | null>(null)

  useEffect(() => {
    const content = contentRef.current
    if (!content) return

    const openEntity = (event: MouseEvent) => {
      const target = event.target instanceof Element ? event.target.closest('[data-study-entity]') : null
      if (!target || !content.contains(target)) return
      const payload = parseEntity(target)
      if (!payload) return
      event.preventDefault()
      setEntity(payload)
    }

    content.addEventListener('click', openEntity)
    return () => content.removeEventListener('click', openEntity)
  }, [contentRef])

  const link = entity ? getStudyEntityLink(entity) : undefined

  return (
    <Dialog open={Boolean(entity)} onOpenChange={open => !open && setEntity(null)}>
      {entity && (
        <DialogContent className="max-h-[min(80vh,44rem)] overflow-y-auto sm:max-w-xl">
          <DialogHeader>
            <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-primary">
              {entity.display.typeLabel}
            </div>
            <DialogTitle className="pr-7 text-2xl">{entity.display.title}</DialogTitle>
            <DialogDescription className="flex flex-wrap gap-2 text-sm text-muted-foreground">
              {entity.display.chip && <span>{entity.display.chip}</span>}
              {entity.display.subtitle && <span>{entity.display.subtitle}</span>}
              {!entity.display.chip && !entity.display.subtitle && (
                <span>Détails de cette référence</span>
              )}
            </DialogDescription>
          </DialogHeader>

          {entity.display.description ? (
            <div className="whitespace-pre-wrap font-serif leading-relaxed">
              {entity.display.description}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Aucun détail supplémentaire disponible.</p>
          )}

          {link && (
            <div className="mt-2 flex justify-end">
              <Button asChild>
                <a href={link.href} {...(link.external && { target: '_blank', rel: 'noreferrer' })}>
                  {entity.endpoint.type === 'study' ? 'Ouvrir l’étude' : 'Ouvrir le lien'}
                </a>
              </Button>
            </div>
          )}
        </DialogContent>
      )}
    </Dialog>
  )
}
