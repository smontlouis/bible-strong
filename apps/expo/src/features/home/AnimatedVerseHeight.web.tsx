import { useLayoutEffect, useRef, useState, type PropsWithChildren } from 'react'

/** Measure intrinsic content rather than the animated shell, including async
 * verse/font loads, without creating a resize feedback loop. */
export default function AnimatedVerseHeight({ children }: PropsWithChildren) {
  const content = useRef<HTMLDivElement>(null)
  const [height, setHeight] = useState<number>()
  useLayoutEffect(() => {
    const element = content.current
    if (!element) return
    const measure = () => {
      const nextHeight = Math.ceil(element.getBoundingClientRect().height)
      setHeight(previous => (previous === nextHeight ? previous : nextHeight))
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(element)
    return () => observer.disconnect()
  }, [])
  return (
    <div className="bs-home-verse-height" style={{ height }}>
      <div ref={content} className="bs-home-verse-content">
        {children}
      </div>
    </div>
  )
}
