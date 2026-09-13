import { useTranslation } from 'react-i18next'
import Empty from '~common/Empty'
import Box from '~common/ui/Box'
import Text from '~common/ui/Text'
import verseToReference from '~helpers/verseToReference'
export const BibleReferenceUnavailable = ({ verseKeys }: { verseKeys: string[] }) => {
  const { t } = useTranslation()
  return (
    <Box className="overflow-hidden border-continuous flex-[1]">
      <Empty message={`${verseToReference(verseKeys)}\n${t('resource.web.connectionRequired')}`} />
    </Box>
  )
}

export const BiblePartialReferenceNotice = ({ verseKeys }: { verseKeys: string[] }) => {
  const { t } = useTranslation()
  return (
    <Box className="overflow-hidden border-continuous px-[16px] py-[10px] bg-light-grey">
      <Text className="text-tertiary text-[12px] text-center">
        {`${verseToReference(verseKeys)} — ${t('resource.web.connectionRequired')}`}
      </Text>
    </Box>
  )
}
