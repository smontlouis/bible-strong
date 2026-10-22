import { useTranslation } from 'react-i18next'
import Box from '~common/ui/Box'
import { twMerge } from '~common/ui/classNames'
import Text from '~common/ui/Text'
import type { BibleTestament } from '~helpers/bibleBookCatalog'
import { TESTAMENT_TITLE_HEIGHT } from './bookSelectorScroll'

/** The title over a testament's books, set as the version list titles its groups. */
const TestamentTitle = ({
  testament,
  className,
}: {
  testament: BibleTestament
  className?: string
}) => {
  const { t } = useTranslation()
  return (
    // The sheet's own ground, to cover the rows scrolling under it when it sticks
    <Box
      className={twMerge(
        'overflow-hidden border-continuous pl-[20px] pr-[8px] pt-[10px] flex-row items-center bg-reverse',
        className
      )}
      style={{ height: TESTAMENT_TITLE_HEIGHT }}
    >
      <Text className="flex-[1] text-[13px] text-grey" accessibilityRole="header">
        {testament === 'old' ? t('Ancien Testament') : t('Nouveau Testament')}
      </Text>
    </Box>
  )
}

export default TestamentTitle
