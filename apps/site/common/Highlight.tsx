import { connectHighlight } from 'react-instantsearch-dom'
import { HighlightProps } from 'react-instantsearch-core'
import type { HTMLAttributes } from 'react'

const Highlight = ({
  highlight,
  attribute,
  hit,
  prefix,
  ...props
}: HTMLAttributes<HTMLSpanElement> & HighlightProps & { prefix?: string }) => {
  const parsedHit = highlight({
    highlightProperty: '_highlightResult',
    attribute,
    hit,
  })

  return (
    <div>
      {parsedHit && (
        <span {...props}>
          {prefix}
        </span>
      )}
      {parsedHit.map((part, index) =>
        part.isHighlighted ? (
          <span className="font-bold" key={index} {...props}>
            {part.value}
          </span>
        ) : (
          <span className="text-foreground" key={index} {...props}>
            {part.value}
          </span>
        )
      )}
    </div>
  )
}

export default connectHighlight(Highlight)
