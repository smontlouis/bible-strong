import React from 'react'
import type { RelationEndpoint } from '~features/studyRelations/domain'

type Props = {
  type: RelationEndpoint['type']
}

const BookLetterIcon = ({ letter }: { letter: string }) => (
  <svg viewBox="0 0 18 22" aria-hidden="true">
    <path d="M3 1h14v20H4.5A3.5 3.5 0 0 1 1 17.5v-13A3.5 3.5 0 0 1 4.5 1H17M1 17.5A3.5 3.5 0 0 1 4.5 14H17" />
    <text x="9" y="11.5" textAnchor="middle">
      {letter}
    </text>
  </svg>
)

const EntityTypeIcon = ({ type }: Props) => {
  switch (type) {
    case 'verse':
    case 'annotation':
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M2 4.5A3.5 3.5 0 0 1 5.5 1H11v18H5.5A3.5 3.5 0 0 0 2 22.5zM22 4.5A3.5 3.5 0 0 0 18.5 1H13v18h5.5a3.5 3.5 0 0 1 3.5 3.5z" />
        </svg>
      )
    case 'note':
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6M8 13h8M8 17h6" />
        </svg>
      )
    case 'externalLink':
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7" />
        </svg>
      )
    case 'study':
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M20.24 12.24a6 6 0 0 0-8.49-8.49L5 10.5V19h8.5zM16 8 2 22M17.5 15H9" />
        </svg>
      )
    case 'strong':
      return <BookLetterIcon letter="א" />
    case 'dictionary':
    case 'word':
      return <BookLetterIcon letter="A" />
    case 'nave':
      return <BookLetterIcon letter="N" />
  }
}

export default EntityTypeIcon
