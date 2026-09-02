import { useRef } from 'react'
import Annexe from '../../../features/studies/Annexe'
import InlineModals from '../../../features/studies/InlineModals'
import StudyEntityDialog from '../../../features/studies/StudyEntityDialog'
import type { StudyPageData } from '../../../features/studies/helpers.study'

export default function Study({ data }: { data: StudyPageData }) {
  const { title, html, annexe = [], user } = data
  const contentRef = useRef<HTMLDivElement>(null)
  return (
    <main className="mx-auto max-w-[700px] px-5 py-4 md:py-12">
      <h1 className="mb-10 text-4xl font-bold leading-tight md:mb-16">{title}</h1>
      <div ref={contentRef} className="study-content" dangerouslySetInnerHTML={{ __html: html }} />
      <StudyEntityDialog contentRef={contentRef} />
      {!!annexe.length && (
        <>
          <hr className="references-divider my-12" />
          <section>
            <h2 className="mb-4 text-xl">Références</h2>
            <InlineModals annexe={annexe} />
            <Annexe annexe={annexe} />
          </section>
        </>
      )}
      <hr className="my-12" />
      <footer className="flex flex-col items-center justify-center text-xs text-muted-foreground">
        <p className="flex items-center gap-2">Étude rédigée par {user.displayName} avec <img src="/images/svg/logo.svg" alt="Bible Strong" className="inline-block h-6 w-[100px]" /></p>
        <a className="mt-4 text-primary" href="https://bible-strong.app">bible-strong.app</a>
      </footer>
    </main>
  )
}
