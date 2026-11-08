import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { SourceGroupWidget as Descriptor } from '@bible-strong/ai-contract/contract'
import Box from '~common/ui/Box'
import Text from '~common/ui/Text'
import { useAssistantSheet } from '../assistantSheetContext'
import { sourceDisplayTitle } from '../sourceNavigation'
import { QuoteBlock, QuoteMore } from './QuoteBlock'

const SHOWN_SOURCES = 2

/** Commentaries and dictionary articles: each excerpt reads as a quotation of its work. */
export default function SourceGroupWidget({ widget }: { widget: Descriptor }) {
  const { t } = useTranslation()
  const { showSource } = useAssistantSheet()
  const [all, setAll] = useState(false)
  const shown = all ? widget.sources : widget.sources.slice(0, SHOWN_SOURCES)
  const rest = widget.sources.length - shown.length
  return (
    <Box className="my-1">
      {shown.map(source => (
        <QuoteBlock
          key={source.id}
          mark={source.kind === 'dictionary' ? 'dictionary' : 'commentary'}
          foot={sourceDisplayTitle(source)}
          onPress={() => showSource(source)}
        >
          <Text className="text-[15px] leading-[23px]" numberOfLines={4}>
            {source.excerpt}
          </Text>
        </QuoteBlock>
      ))}
      {rest > 0 && (
        <QuoteMore
          label={t('assistant.widgets.moreExcerpts', { count: rest })}
          onPress={() => setAll(true)}
        />
      )}
    </Box>
  )
}
