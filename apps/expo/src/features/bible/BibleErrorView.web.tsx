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
    <Box flex={1}>
      <Empty
        source={require('~assets/images/empty.json')}
        message={t('resource.web.connectionRequired')}
      >
        <Box mt={20}>
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
