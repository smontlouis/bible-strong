import React from 'react'
import { useRouter } from 'expo-router'

import booksDesc from '~assets/bible_versions/books-desc'
import Paragraph from '~common/ui/Paragraph'
import Text from '~common/ui/Text'
import { BibleReferenceTarget, parseInlineBibleReferences } from '~helpers/bcvParser'

type ParagraphProps = React.ComponentProps<typeof Paragraph>

interface ReferenceParagraphProps extends Omit<ParagraphProps, 'children'> {
  children: string
}

const getBibleViewParams = (target: BibleReferenceTarget) => ({
  isReadOnly: 'true',
  book: JSON.stringify(booksDesc[target.book - 1]),
  chapter: String(target.chapter),
  verse: String(target.verse),
  ...(target.focusVerses ? { focusVerses: JSON.stringify(target.focusVerses) } : {}),
})

const ReferenceParagraph = ({ children, ...props }: ReferenceParagraphProps) => {
  const router = useRouter()
  const references = parseInlineBibleReferences(children)

  if (!references.length) {
    return <Paragraph {...props}>{children}</Paragraph>
  }

  let cursor = 0

  return (
    <Paragraph {...props} selectable={false}>
      {references.map(reference => {
        const before = children.slice(cursor, reference.start)
        cursor = reference.end

        return (
          <React.Fragment key={`${reference.start}-${reference.end}-${reference.target.osis}`}>
            {before}
            <Text
              accessibilityLabel={reference.text}
              accessibilityRole="link"
              color="primary"
              underline
              onPress={() =>
                router.push({
                  pathname: '/bible-view',
                  params: getBibleViewParams(reference.target),
                })
              }
            >
              {reference.text}
            </Text>
          </React.Fragment>
        )
      })}
      {children.slice(cursor)}
    </Paragraph>
  )
}

export default ReferenceParagraph
