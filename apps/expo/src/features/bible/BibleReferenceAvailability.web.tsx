import { useTranslation } from 'react-i18next'

import Empty from '~common/Empty'
import Box from '~common/ui/Box'
import Text from '~common/ui/Text'
import verseToReference from '~helpers/verseToReference'

export const BibleReferenceUnavailable = ({ verseKeys }: { verseKeys: string[] }) => {
  const { t } = useTranslation()
  return (
    <Box flex>
      <Empty
        source={require('~assets/images/empty.json')}
        message={`${verseToReference(verseKeys)}\n${t('resource.web.connectionRequired')}`}
      />
    </Box>
  )
}

export const BiblePartialReferenceNotice = ({ verseKeys }: { verseKeys: string[] }) => {
  const { t } = useTranslation()
  return (
    <Box px={16} py={10} bg="lightGrey">
      <Text color="tertiary" fontSize={12} textAlign="center">
        {`${verseToReference(verseKeys)} — ${t('resource.web.connectionRequired')}`}
      </Text>
    </Box>
  )
}
