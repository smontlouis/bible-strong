import React from 'react'
import { useQuery } from '@tanstack/react-query'
import { useAtomValue } from 'jotai/react'
import { useTranslation } from 'react-i18next'
import { useDispatch, useSelector } from 'react-redux'

import Header from '~common/Header'
import type { SheetRef } from '~common/sheet'
import Box, { TouchableBox } from '~common/ui/Box'
import Container from '~common/ui/Container'
import { FeatherIcon } from '~common/ui/Icon'
import Text from '~common/ui/Text'
import StrongMark from '~features/bible/StrongMark'
import { getVersionDisplayName } from '~features/bible/versionCatalog'
import { versions, type Version } from '~helpers/bibleVersions'
import { getDefaultBibleVersion } from '~helpers/languageUtils'
import {
  resolveStrongNavigationVersionId,
  type StrongBibleVersionId,
} from '~helpers/strongBiblePublications'
import { getLanguage } from '~i18n'
import { RootState } from '~redux/modules/reducer'
import { setDefaultBibleVersion, setDefaultStrongBibleVersion } from '~redux/modules/user'
import { downloadCompletionSignalAtom } from '~state/downloadQueue'
import type { VersionCode } from '~state/tabs'
import BibleDefaultSelectorSheet from './BibleDefaultSelectorSheet'
import { localQueryOptions } from '~helpers/queryOptions'
import { useResourceAccess } from '~features/resources/resourceAccess'

type DefaultVersionCardProps = {
  title: string
  description: string
  version: Version
  displayName: string
  strongAvailable?: boolean
  onPress: () => void
}

const DefaultVersionCard = ({
  title,
  description,
  version,
  displayName,
  strongAvailable,
  onPress,
}: DefaultVersionCardProps) => (
  <TouchableBox
    accessibilityRole="button"
    accessibilityLabel={`${title}, ${displayName}`}
    onPress={onPress}
    p={18}
    borderWidth={1}
    borderColor="border"
    borderRadius={14}
    bg="reverse"
  >
    <Box row alignItems="flex-start">
      <Box flex pr={12}>
        <Text fontSize={16} bold>
          {title}
        </Text>
        <Text mt={4} fontSize={12} color="grey" lineHeight={17}>
          {description}
        </Text>
      </Box>
      <Box width={32} height={32} center>
        <FeatherIcon name="chevron-right" size={20} color="tertiary" />
      </Box>
    </Box>

    <Box mt={18} row alignItems="center">
      <Box flex>
        <Text fontSize={12} color="grey" bold>
          {version.id}
        </Text>
        <Box mt={2} row alignItems="center">
          <Text fontSize={18}>{displayName}</Text>
          {typeof strongAvailable === 'boolean' && (
            <Box ml={6}>
              <StrongMark highlighted={strongAvailable} />
            </Box>
          )}
        </Box>
        <Text mt={3} fontSize={10} color="grey" numberOfLines={2}>
          {version.c}
        </Text>
      </Box>
    </Box>
  </TouchableBox>
)

const BibleDefaultsScreen = () => {
  const { t } = useTranslation()
  const resources = useResourceAccess()
  const dispatch = useDispatch()
  const language = getLanguage()
  const readingSheetRef = React.useRef<SheetRef>(null)
  const strongSheetRef = React.useRef<SheetRef>(null)
  const downloadCompletionSignal = useAtomValue(downloadCompletionSignalAtom)

  const preferredVersion = useSelector(
    (state: RootState) =>
      state.user.bible.settings.defaultBibleVersion || getDefaultBibleVersion(language)
  )
  const defaultVersion = versions[preferredVersion]
    ? preferredVersion
    : getDefaultBibleVersion(language)
  const storedDefaultStrongVersion = useSelector(
    (state: RootState) =>
      state.user.bible.settings.defaultStrongBibleVersionId as string | undefined
  )
  const defaultStrongVersion =
    resolveStrongNavigationVersionId(storedDefaultStrongVersion ?? '') ?? 'LSG'
  const selectedVersion = versions[defaultVersion]
  const selectedStrongVersion = versions[defaultStrongVersion]
  const { data: isDefaultStrongAvailable = false } = useQuery({
    queryKey: [
      'default-strong-sidecar-availability',
      defaultStrongVersion,
      downloadCompletionSignal,
    ],
    queryFn: async () =>
      (await resources.strongBible.getAvailability(defaultStrongVersion)).status === 'available',
    ...localQueryOptions,
  })

  const selectReadingVersion = (versionId: VersionCode) => {
    dispatch(setDefaultBibleVersion(versionId))
  }

  const selectStrongVersion = (versionId: VersionCode) => {
    dispatch(setDefaultStrongBibleVersion(versionId as StrongBibleVersionId))
  }

  return (
    <Container flex>
      <Header hasBackButton title={t('bibleDefaults.title')} />

      <Box flex px={20} pt={24} gap={16}>
        <DefaultVersionCard
          title={t('bibleDefaults.defaultReadingTitle')}
          description={t('bibleDefaults.defaultVersionDescription')}
          version={selectedVersion}
          displayName={getVersionDisplayName(selectedVersion, language)}
          onPress={() => readingSheetRef.current?.present()}
        />

        <DefaultVersionCard
          title={t('bibleDefaults.defaultStrongTitle')}
          description={t('bibleDefaults.defaultStrongDescription')}
          version={selectedStrongVersion}
          displayName={getVersionDisplayName(selectedStrongVersion, language)}
          strongAvailable={isDefaultStrongAvailable}
          onPress={() => strongSheetRef.current?.present()}
        />
      </Box>

      <BibleDefaultSelectorSheet
        kind="reading"
        selectedVersionId={defaultVersion}
        sheetRef={readingSheetRef}
        title={t('bibleDefaults.chooseReadingTitle')}
        onSelect={selectReadingVersion}
      />
      <BibleDefaultSelectorSheet
        kind="strong"
        selectedVersionId={defaultStrongVersion}
        sheetRef={strongSheetRef}
        title={t('bibleDefaults.chooseStrongTitle')}
        onSelect={selectStrongVersion}
      />
    </Container>
  )
}

export default BibleDefaultsScreen
