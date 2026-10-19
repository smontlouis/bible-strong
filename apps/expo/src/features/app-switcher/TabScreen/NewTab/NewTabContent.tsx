import { Platform } from 'react-native'
import { Image, type ImageSource } from 'expo-image'
import type { PrimitiveAtom } from 'jotai/vanilla'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import Box from '~common/ui/Box'
import Text from '~common/ui/Text'
import { useResponsiveWorkspace } from '~features/app-switcher/utils/useResponsiveWorkspace'
import type { TabItem } from '~state/tabs'
import { useTheme } from '~themes/ThemeProvider'
import { resolveFontFamily } from '~themes/styleValues'
import NewTabItem from './NewTabItem'
import NewTabSearch from './NewTabSearch'

const ITEM_GAP = 14
const DENSE_GAP = 10

function SectionHeading({
  title,
  image,
  compact,
  dense = false,
}: {
  title: string
  image?: ImageSource
  compact: boolean
  dense?: boolean
}) {
  const theme = useTheme()
  return (
    <Box
      pointerEvents="box-none"
      className="relative flex-row items-center mb-[10px] overflow-visible z-10"
      style={{ minHeight: 32, paddingRight: image ? (compact ? 102 : 138) : 0 }}
    >
      <Text
        accessibilityRole="header"
        className="shrink text-[23px] leading-[30px]"
        style={{ fontFamily: resolveFontFamily(theme.fontFamily.title) }}
      >
        {title}
      </Text>
      {image && (
        <Image
          source={image}
          contentFit="contain"
          contentPosition="bottom"
          accessible={false}
          pointerEvents="none"
          style={{
            position: 'absolute',
            right: 0,
            // Dense rows have a card under the image on both sides: keep the overlap small.
            bottom: dense ? -8 : -22,
            width: dense ? 78 : compact ? 90 : 126,
            height: dense ? 84 : 110,
          }}
        />
      )}
    </Box>
  )
}

export default function NewTabContent({
  tabAtom,
  onPlanPress,
}: {
  tabAtom: PrimitiveAtom<TabItem>
  onPlanPress: () => void
}) {
  const { t } = useTranslation()
  const theme = useTheme()
  const [width, setWidth] = useState(0)
  const isWide = useResponsiveWorkspace()
  const compact = width < 660
  const sideBySide = width >= 860
  const libraryColumns = sideBySide || width >= 580
  const personalColumns = !sideBySide && width >= 580
  const renderItem = (
    type: TabItem['type'],
    title: string,
    description: string,
    variant: 'card' | 'tile' | 'inline' = 'card'
  ) => (
    <NewTabItem
      type={type}
      title={title}
      description={description}
      newAtom={tabAtom}
      onPlanPress={onPlanPress}
      variant={variant}
    />
  )

  // Phones keep the catalogue to roughly one screen: tighter gaps, three reading tools per row.
  if (compact && Platform.OS !== 'web') {
    return (
      <Box testID="new-tab-content" onLayout={event => setWidth(event.nativeEvent.layout.width)}>
        <Text
          accessibilityRole="header"
          className="mb-[22px] text-[27px] leading-[33px]"
          style={{ fontFamily: resolveFontFamily(theme.fontFamily.title) }}
        >
          {t('newTab.heading')}
        </Text>
        <SectionHeading title={t('newTab.reading')} compact />
        <NewTabItem
          type="bible"
          title={t('Bible')}
          description={t('newTab.bibleDescription')}
          newAtom={tabAtom}
          hero
          variant="tile"
        />
        <Box className="flex-row" style={{ gap: DENSE_GAP, marginTop: DENSE_GAP }}>
          {renderItem('compare', t('tabs.compare'), t('newTab.compareDescription'), 'tile')}
          {renderItem('plan', t('newTab.plan'), t('newTab.planDescription'), 'tile')}
          {renderItem('timeline', t('tabs.timeline'), t('newTab.timelineDescription'), 'tile')}
        </Box>
        <Box className="mt-[30px]">
          <SectionHeading
            title={t('newTab.personal')}
            compact
            dense
            image={require('~assets/images/new-tab/notes-writer.webp')}
          />
          <Box className="flex-row" style={{ gap: DENSE_GAP }}>
            {renderItem('study', t('Études'), t('newTab.studyDescription'), 'inline')}
            {renderItem('notes', t('tabs.notes'), t('newTab.notesDescription'), 'inline')}
          </Box>
        </Box>
        <Box className="mt-[30px]">
          <SectionHeading
            title={t('newTab.library')}
            compact
            dense
            image={require('~assets/images/new-tab/library-reader.webp')}
          />
          <Box style={{ gap: DENSE_GAP }}>
            <Box className="flex-row" style={{ gap: DENSE_GAP }}>
              {renderItem('strong', t('tabs.strong'), t('newTab.strongDescription'), 'inline')}
              {renderItem('nave', t('tabs.nave'), t('newTab.naveDescription'), 'inline')}
            </Box>
            <Box className="flex-row" style={{ gap: DENSE_GAP }}>
              {renderItem(
                'dictionary',
                t('tabs.dictionary'),
                t('newTab.dictionaryDescription'),
                'inline'
              )}
              {renderItem(
                'commentary',
                t('tabs.commentary'),
                t('newTab.commentaryDescription'),
                'inline'
              )}
            </Box>
          </Box>
        </Box>
      </Box>
    )
  }

  return (
    <Box
      testID="new-tab-content"
      className="w-full self-center"
      onLayout={event => setWidth(event.nativeEvent.layout.width)}
    >
      <Text
        accessibilityRole="header"
        className="text-center mb-[28px]"
        style={{
          fontFamily: resolveFontFamily(theme.fontFamily.title),
          fontSize: compact ? 28 : 36,
          lineHeight: compact ? 36 : 46,
        }}
      >
        {t('newTab.heading')}
      </Text>
      {(isWide || Platform.OS === 'web') && (
        <NewTabSearch tabAtom={tabAtom} onPlanPress={onPlanPress} />
      )}
      <Box className={isWide ? 'mt-[38px]' : undefined}>
        <SectionHeading title={t('newTab.reading')} compact={compact} />
        <NewTabItem
          type="bible"
          title={t('Bible')}
          description={t('newTab.bibleDescription')}
          newAtom={tabAtom}
          hero
          compact={compact}
        />
        <Box
          className={compact ? undefined : 'flex-row'}
          style={{ gap: ITEM_GAP, marginTop: ITEM_GAP }}
        >
          <Box className="flex-1">
            {renderItem('compare', t('tabs.compare'), t('newTab.compareDescription'))}
          </Box>
          <Box className="flex-1">
            {renderItem('plan', t('newTab.plan'), t('newTab.planDescription'))}
          </Box>
          <Box className="flex-1">
            {renderItem('timeline', t('tabs.timeline'), t('newTab.timelineDescription'))}
          </Box>
        </Box>
      </Box>
      <Box className={sideBySide ? 'flex-row gap-[28px] mt-[64px]' : 'gap-[64px] mt-[64px]'}>
        <Box style={sideBySide ? { flex: 0.34 } : undefined}>
          <SectionHeading
            title={t('newTab.personal')}
            compact={compact}
            image={require('~assets/images/new-tab/notes-writer.webp')}
          />
          <Box className={personalColumns ? 'flex-row' : undefined} style={{ gap: ITEM_GAP }}>
            <Box className={personalColumns ? 'flex-1' : undefined}>
              {renderItem('study', t('Études'), t('newTab.studyDescription'))}
            </Box>
            <Box className={personalColumns ? 'flex-1' : undefined}>
              {renderItem('notes', t('tabs.notes'), t('newTab.notesDescription'))}
            </Box>
          </Box>
        </Box>
        <Box style={sideBySide ? { flex: 0.66 } : undefined}>
          <SectionHeading
            title={t('newTab.library')}
            compact={compact}
            image={require('~assets/images/new-tab/library-reader.webp')}
          />
          <Box style={{ gap: ITEM_GAP }}>
            <Box className={libraryColumns ? 'flex-row' : undefined} style={{ gap: ITEM_GAP }}>
              <Box className={libraryColumns ? 'flex-1 min-w-0' : undefined}>
                {renderItem('strong', t('tabs.strong'), t('newTab.strongDescription'))}
              </Box>
              <Box className={libraryColumns ? 'flex-1 min-w-0' : undefined}>
                {renderItem('nave', t('tabs.nave'), t('newTab.naveDescription'))}
              </Box>
            </Box>
            <Box className={libraryColumns ? 'flex-row' : undefined} style={{ gap: ITEM_GAP }}>
              <Box className={libraryColumns ? 'flex-1 min-w-0' : undefined}>
                {renderItem('dictionary', t('tabs.dictionary'), t('newTab.dictionaryDescription'))}
              </Box>
              <Box className={libraryColumns ? 'flex-1 min-w-0' : undefined}>
                {renderItem('commentary', t('tabs.commentary'), t('newTab.commentaryDescription'))}
              </Box>
            </Box>
          </Box>
        </Box>
      </Box>
    </Box>
  )
}
