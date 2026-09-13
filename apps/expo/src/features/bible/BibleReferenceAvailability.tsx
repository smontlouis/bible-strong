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
    <Box className="overflow-hidden border-continuous flex-[1]">
      <Empty message={`${reference}\n${t('bibleVerse.textUnavailableInstalled')}`}>
        <Box className="overflow-hidden border-continuous mt-[20px]">
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
    <Box className="overflow-hidden border-continuous px-[16px] py-[10px] bg-light-grey">
      <Text className="text-tertiary text-[12px] text-center">
        {`${verseToReference(verseKeys)} — ${t('bibleVerse.textUnavailableInstalled')}`}
      </Text>
    </Box>
  )
}
