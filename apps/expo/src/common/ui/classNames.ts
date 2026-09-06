import { extendTailwindMerge } from 'tailwind-merge'

// Uniwind adds these native utilities; they are not border color names.
export const twMerge = extendTailwindMerge<'border-curve'>({
  extend: {
    classGroups: {
      'border-curve': ['border-continuous', 'border-circular'],
    },
  },
})
