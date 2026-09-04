import { useRouter } from 'expo-router'
import { useTranslation } from 'react-i18next'
import Empty from '~common/Empty'
import Box from '~common/ui/Box'
import Button from '~common/ui/Button'
import Text from '~common/ui/Text'
import verseToReference from '~helpers/verseToReference'

export const BibleReferenceUnavailable = ({ verseKeys }: { verseKeys: string[] }) => {
  const router = useRouter()
  const { t } = useTranslation()
  const reference = verseToReference(verseKeys)

  return (
    <Box flex>
      <Empty
        source={require('~assets/images/empty.json')}
        message={`${reference}\n${t('bibleVerse.textUnavailableInstalled')}`}
      >
        <Box mt={20}>
          <Button onPress={() => router.push('/downloads')}>
            {t('bible.error.goToDownloads')}
          </Button>
        </Box>
      </Empty>
    </Box>
  )
}

export const BiblePartialReferenceNotice = ({ verseKeys }: { verseKeys: string[] }) => {
  const { t } = useTranslation()

  return (
    <Box px={16} py={10} bg="lightGrey">
      <Text color="tertiary" fontSize={12} textAlign="center">
        {`${verseToReference(verseKeys)} — ${t('bibleVerse.textUnavailableInstalled')}`}
      </Text>
    </Box>
  )
}
