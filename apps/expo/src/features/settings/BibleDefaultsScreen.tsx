import React from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { useDispatch, useSelector } from 'react-redux'
import Header from '~common/Header'
import type { SheetRef } from '~common/sheet'
import Box, { TouchableBox } from '~common/ui/Box'
import Container from '~common/ui/Container'
import { FeatherIcon } from '~common/ui/Icon'
import ListSection from '~common/ui/ListSection'
import ScrollView from '~common/ui/ScrollView'
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
import type { VersionCode } from '~state/tabs'
import BibleDefaultSelectorSheet from './BibleDefaultSelectorSheet'
import { createOfflineCopyId } from '~helpers/offlineCopyId'
import { useOfflineResourceState } from '~features/resources/useOfflineResourceRegistry'
import { useResourceAccess } from '~features/resources/resourceAccess'
import { localQueryOptions } from '~helpers/queryOptions'
type DefaultVersionSectionProps = {
  title: string
  description: string
  version: Version
  displayName: string
  strongAvailable?: boolean
  onPress: () => void
}

/** One default: its title on the canvas, the chosen version in a card, what it is used for below. */
const DefaultVersionSection = ({
  title,
  description,
  version,
  displayName,
  strongAvailable,
  onPress,
}: DefaultVersionSectionProps) => (
  <ListSection title={title} footer={description}>
    <TouchableBox
      className="flex-row items-center gap-[12px] px-[14px] py-[12px]"
      accessibilityRole="button"
      accessibilityLabel={`${title}, ${displayName}`}
      onPress={onPress}
    >
      <Box className="flex-[1]">
        <Text className="text-[12px] text-grey font-bold">{version.id}</Text>
        <Box className="mt-[2px] flex-row items-center">
          <Text className="text-[17px] shrink" numberOfLines={2}>
            {displayName}
          </Text>
          {typeof strongAvailable === 'boolean' && (
            <Box className="ml-[6px]">
              <StrongMark highlighted={strongAvailable} />
            </Box>
          )}
        </Box>
        <Text className="mt-[3px] text-[11px] text-grey" numberOfLines={2}>
          {version.c}
        </Text>
      </Box>
      <FeatherIcon name="chevron-right" size={18} color="grey" />
    </TouchableBox>
  </ListSection>
)

const BibleDefaultsScreen = () => {
  const { t } = useTranslation()
  const resources = useResourceAccess()
  const dispatch = useDispatch()
  const language = getLanguage()
  const readingSheetRef = React.useRef<SheetRef>(null)
  const strongSheetRef = React.useRef<SheetRef>(null)

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
  const defaultStrongResource = useOfflineResourceState(
    createOfflineCopyId({ kind: 'strong-bible-index', versionId: defaultStrongVersion })
  )
  const { data: isDefaultStrongAvailable = false } = useQuery({
    queryKey: [
      'default-strong-sidecar-availability',
      defaultStrongVersion,
      defaultStrongResource?.availability.status,
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
    <Container className="flex-[1] bg-canvas">
      <Header hasBackButton title={t('bibleDefaults.title')} />

      <ScrollView backgroundColor="canvas" style={{ flex: 1 }}>
        <DefaultVersionSection
          title={t('bibleDefaults.defaultReadingTitle')}
          description={t('bibleDefaults.defaultVersionDescription')}
          version={selectedVersion}
          displayName={getVersionDisplayName(selectedVersion, language)}
          onPress={() => readingSheetRef.current?.present()}
        />

        <DefaultVersionSection
          title={t('bibleDefaults.defaultStrongTitle')}
          description={t('bibleDefaults.defaultStrongDescription')}
          version={selectedStrongVersion}
          displayName={getVersionDisplayName(selectedStrongVersion, language)}
          strongAvailable={isDefaultStrongAvailable}
          onPress={() => strongSheetRef.current?.present()}
        />
      </ScrollView>

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
