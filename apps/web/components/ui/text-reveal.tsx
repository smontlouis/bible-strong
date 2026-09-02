import { useRef, type ComponentPropsWithoutRef, type FC, type ReactNode } from 'react'
import { motion, useScroll, useTransform, type MotionValue } from 'motion/react'

import { cn } from '@/src/lib/utils'

export interface TextRevealProps extends ComponentPropsWithoutRef<'span'> {
  children: string
}

export const TextReveal: FC<TextRevealProps> = ({ children, className, ...props }) => {
  const sectionRef = useRef<HTMLSpanElement | null>(null)
  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ['start 78%', 'start 32%'],
  })

  if (typeof children !== 'string') {
    throw new Error('TextReveal: children must be a string')
  }

  const words = [...children.matchAll(/\S+/g)]

  return (
    <span
      ref={sectionRef}
      className={cn('text-reveal', className)}
      aria-label={children}
      {...props}
    >
      {words.map((wordMatch, index) => {
        const start = index / words.length
        const end = start + 1 / words.length

        return (
          <span key={`${wordMatch.index}-${wordMatch[0]}`}>
            <Word progress={scrollYProgress} range={[start, end]}>
              {wordMatch[0]}
            </Word>
            {index < words.length - 1 ? ' ' : null}
          </span>
        )
      })}
    </span>
  )
}

interface WordProps {
  children: ReactNode
  progress: MotionValue<number>
  range: [number, number]
}

const Word: FC<WordProps> = ({ children, progress, range }) => {
  const opacity = useTransform(progress, range, [0, 1])
  return (
    <span className="text-reveal__word" aria-hidden="true">
      <span className="text-reveal__word-muted">{children}</span>
      <motion.span style={{ opacity }} className="text-reveal__word-visible">
        {children}
      </motion.span>
    </span>
  )
}
