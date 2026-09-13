import { useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import Empty from '~common/Empty'
import Box from '~common/ui/Box'
import Button from '~common/ui/Button'
import type { BibleError } from '~helpers/bibleErrors'
import { resourceQueryKeys } from '~helpers/resourceQueryKeys'
const BibleErrorView = ({ error: _error }: { error: BibleError }) => {
  const { t } = useTranslation()
  const queryClient = useQueryClient()

  return (
    <Box className="overflow-hidden border-continuous flex-[1]">
      <Empty message={t('resource.web.connectionRequired')}>
        <Box className="overflow-hidden border-continuous mt-[20px]">
          <Button
            onPress={() =>
              queryClient.invalidateQueries({ queryKey: resourceQueryKeys.bibleContent() })
            }
          >
            {t('bible.error.retry')}
          </Button>
        </Box>
      </Empty>
    </Box>
  )
}

export default BibleErrorView
