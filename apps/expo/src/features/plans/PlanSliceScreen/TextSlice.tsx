import { useSelector } from 'react-redux'
import { selectFontFamily } from '~redux/selectors/user'
import { resolveFontFamily } from '~themes/styleValues'
import { twMerge } from '~common/ui/classNames'

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
  const fontFamily = resolveFontFamily(useSelector(selectFontFamily))
  const content = isDevotional
    ? description.replace(/^\n|\n$/g, '')
    : description.replace(/^\n/, '')
  return (
    <Box
      className={twMerge(
        'overflow-hidden border-continuous px-[20px]',
        isDevotional && 'bg-light-grey py-[20px] mb-[32px]'
      )}
    >
      {isDevotional && (
        <FeatherIcon color="primary" name="minus" style={{ marginBottom: 20 }} size={30} />
      )}
      <ReferenceParagraph
        scaleLineHeight={1}
        planLanguage={planLanguage}
        style={{ textAlign: isDevotional ? 'center' : 'left', fontFamily }}
        className={twMerge(isDevotional ? 'text-primary' : 'text-default')}
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
