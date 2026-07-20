import React from 'react'
import styled from '@emotion/native'

import { getBook } from '~helpers/bibleBookCatalog'
import Paragraph from '~common/ui/Paragraph'
import { BcvLanguage, BibleReferenceTarget, parseInlineBibleReferences } from '~helpers/bcvParser'
import { usePushRouteOnce } from '~navigation/usePushRouteOnce'

type ParagraphProps = React.ComponentProps<typeof Paragraph>

interface ReferenceParagraphProps extends Omit<ParagraphProps, 'children'> {
  children: string
  planLanguage?: BcvLanguage
}

const getBibleViewParams = (target: BibleReferenceTarget) => ({
  contextDisplayMode: 'focused',
  book: JSON.stringify(getBook(target.book)),
  chapter: String(target.chapter),
  verse: String(target.verse),
  ...(target.focusVerses ? { focusVerses: JSON.stringify(target.focusVerses) } : {}),
})

const ReferenceText = styled.Text(({ theme }) => ({
  color: theme.colors.primary,
  textDecorationLine: 'underline',
}))

const ReferenceParagraph = ({ children, planLanguage, ...props }: ReferenceParagraphProps) => {
  const pushRouteOnce = usePushRouteOnce()
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
                pushRouteOnce({
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
