import React from 'react'
import styled from '@emotion/native'
import { useRouter } from 'expo-router'

import booksDesc from '~assets/bible_versions/books-desc'
import Paragraph from '~common/ui/Paragraph'
import { BcvLanguage, BibleReferenceTarget, parseInlineBibleReferences } from '~helpers/bcvParser'

type ParagraphProps = React.ComponentProps<typeof Paragraph>

interface ReferenceParagraphProps extends Omit<ParagraphProps, 'children'> {
  children: string
  planLanguage?: BcvLanguage
}

const getBibleViewParams = (target: BibleReferenceTarget) => ({
  isReadOnly: 'true',
  book: JSON.stringify(booksDesc[target.book - 1]),
  chapter: String(target.chapter),
  verse: String(target.verse),
  ...(target.focusVerses ? { focusVerses: JSON.stringify(target.focusVerses) } : {}),
})

const ReferenceText = styled.Text(({ theme }) => ({
  color: theme.colors.primary,
  textDecorationLine: 'underline',
}))

const ReferenceParagraph = ({ children, planLanguage, ...props }: ReferenceParagraphProps) => {
  const router = useRouter()
  const references = parseInlineBibleReferences(children, planLanguage)

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
            <ReferenceText
              accessibilityLabel={reference.text}
              accessibilityRole="link"
              onPress={() =>
                router.push({
                  pathname: '/bible-view',
                  params: getBibleViewParams(reference.target),
                })
              }
            >
              {reference.text}
            </ReferenceText>
          </React.Fragment>
        )
      })}
      {children.slice(cursor)}
    </Paragraph>
  )
}

export default ReferenceParagraph
