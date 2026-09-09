import { Image, type ImageSource } from 'expo-image'
import type { PrimitiveAtom } from 'jotai/vanilla'
import { useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import Box from '~common/ui/Box'
import Text from '~common/ui/Text'
import { useResponsiveWorkspace } from '~features/app-switcher/utils/useResponsiveWorkspace'
import type { TabItem } from '~state/tabs'
import { useTheme } from '~themes/ThemeProvider'
import { resolveFontFamily } from '~themes/styleValues'
import NewTabItem from './NewTabItem'
import NewTabSearch from './NewTabSearch'

function SectionHeading({
  title,
  image,
  compact,
}: {
  title: string
  image?: ImageSource
  compact: boolean
}) {
  const theme = useTheme()
  return (
    <Box
      className="relative flex-row items-center gap-[16px] mb-[16px]"
      style={{ minHeight: image ? 104 : 36, paddingRight: image ? (compact ? 90 : 126) : 0 }}
    >
      <Text
        accessibilityRole="header"
        className="shrink text-[23px] leading-[30px]"
        style={{ fontFamily: resolveFontFamily(theme.fontFamily.title) }}
      >
        {title}
      </Text>
      <Box className="flex-1 h-px bg-border" />
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
            bottom: -18,
            width: compact ? 90 : 126,
            height: 110,
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
  const renderItem = (type: TabItem['type'], title: string, description: string) => (
    <NewTabItem
      type={type}
      title={title}
      description={description}
      newAtom={tabAtom}
      onPlanPress={onPlanPress}
    />
  )
  const gridCell = (key: string, child: ReactNode) => (
    <Box key={key} style={{ width: libraryColumns ? '48.5%' : '100%' }}>
      {child}
    </Box>
  )

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
      {isWide && <NewTabSearch tabAtom={tabAtom} />}
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
        <Box className={compact ? 'gap-[12px] mt-[14px]' : 'flex-row gap-[14px] mt-[14px]'}>
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
      <Box className={sideBySide ? 'flex-row gap-[28px] mt-[22px]' : 'gap-[8px] mt-[20px]'}>
        <Box style={sideBySide ? { flex: 0.34 } : undefined}>
          <SectionHeading
            title={t('newTab.personal')}
            compact={compact}
            image={require('~assets/images/new-tab/notes-writer.webp')}
          />
          <Box className={personalColumns ? 'flex-row gap-[14px]' : 'gap-[12px]'}>
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
          <Box className="flex-row flex-wrap justify-between gap-y-[12px]">
            {gridCell(
              'strong',
              renderItem('strong', t('tabs.strong'), t('newTab.strongDescription'))
            )}
            {gridCell('nave', renderItem('nave', t('tabs.nave'), t('newTab.naveDescription')))}
            {gridCell(
              'dictionary',
              renderItem('dictionary', t('tabs.dictionary'), t('newTab.dictionaryDescription'))
            )}
            {gridCell(
              'commentary',
              renderItem('commentary', t('tabs.commentary'), t('newTab.commentaryDescription'))
            )}
          </Box>
        </Box>
      </Box>
    </Box>
  )
}
