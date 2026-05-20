import React from 'react'

import Box from '~common/ui/Box'
import { Plan, TextSlice as TextSliceProps } from '~common/types'
import { FeatherIcon } from '~common/ui/Icon'
import ReferenceParagraph from './ReferenceParagraph'

type Props = TextSliceProps & {
  planLanguage?: Plan['lang']
}

const TextSlice = ({ description, subType, planLanguage }: Props) => {
  const isDevotional = subType === 'devotional'
  const content = isDevotional
    ? description.replace(/^\n|\n$/g, '')
    : description.replace(/^\n/, '')
  return (
    <Box
      paddingHorizontal={20}
      {...(isDevotional && {
        center: true,
        backgroundColor: 'lightGrey',
        paddingVertical: 20,
        marginBottom: 40,
      })}
    >
      {isDevotional && (
        <FeatherIcon color="primary" name="minus" style={{ marginBottom: 20 }} size={30} />
      )}
      <ReferenceParagraph
        scaleLineHeight={1}
        color={isDevotional ? 'primary' : 'default'}
        textAlign={isDevotional ? 'center' : 'left'}
        planLanguage={planLanguage}
      >
        {content}
      </ReferenceParagraph>
      {isDevotional && (
        <FeatherIcon color="primary" name="minus" style={{ marginTop: 20 }} size={30} />
      )}
    </Box>
  )
}

export default TextSlice
