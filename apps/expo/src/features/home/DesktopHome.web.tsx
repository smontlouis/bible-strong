import ResourceDiscovery from './ResourceDiscovery'
import { Image, type ImageSource } from 'expo-image'
import { useFonts } from 'expo-font'
import AnimatedVerseHeight from './AnimatedVerseHeight.web'
import { useSetAtom } from 'jotai/react'
import {
  commandPaletteOpenAtom,
  commandPaletteReturnFocusAtom,
} from '~features/app-switcher/commandPalette/state'
import React, { useState } from 'react'
import './desktop-home.css'
import { useTranslation } from 'react-i18next'
import { ScrollView } from 'react-native'
import { LinkBox, type LinkProps } from '~common/Link'
import Box, { HStack } from '~common/ui/Box'
import { FeatherIcon } from '~common/ui/Icon'
import Text from '~common/ui/Text'
import { useComputedPlanItems } from '~features/plans/plan.hooks'
import ProfileStats from '~features/profile/components/ProfileStats'
import useLanguage from '~helpers/useLanguage'
import type { MainStackProps } from '~navigation/type'
import { useTheme } from '~themes/ThemeProvider'
import { resolveFontFamily } from '~themes/styleValues'
import { usePushRouteOnce } from '~navigation/usePushRouteOnce'
import { Events } from './Events'
import OfflineNotice from './OfflineNotice'
import PlanHome from './PlanHome'
import MeditationsHome from './MeditationsHome'
import ResumeBookmark from './ResumeBookmark'
import { LoginPrompt } from './UserWidget'
import VerseOfTheDay from './VerseOfTheDay'
import { VISIBLE_VERSE_OF_THE_DAY_OFFSETS } from './verseOfTheDayPolicy'

const illustrations = {
  audio: require('~assets/images/home/illustrations/audibible-reader.png'),
}

function SectionTitle({ children }: React.PropsWithChildren) {
  const theme = useTheme()
  return (
    <Text
      accessibilityRole="header"
      className="text-[22px] mb-[16px]"
      style={{ fontFamily: resolveFontFamily(theme.fontFamily.title) }}
    >
      {children}
    </Text>
  )
}

function ResourceLink({
  children,
  ...props
}: React.PropsWithChildren<LinkProps<keyof MainStackProps>>) {
  return (
    <LinkBox {...props} className="self-start flex-row items-center gap-[7px] py-[7px]">
      <Text className="text-primary text-[13px] font-bold shrink">{children}</Text>
      <FeatherIcon name="arrow-up-right" size={14} color="primary" />
    </LinkBox>
  )
}

function LearningCard({
  title,
  source,
  ...props
}: {
  title: string
  source: ImageSource
} & LinkProps<keyof MainStackProps>) {
  return (
    <div className="bs-home-learning-card">
      <LinkBox
        {...props}
        className="bg-reverse rounded-[18px] overflow-hidden shadow-[0_2px_7px_rgba(89,131,240,0.1)]"
      >
        <div className="bs-home-learning-body">
          <div className="bs-home-learning-image">
            <Image
              source={source}
              contentFit="cover"
              style={{ width: '100%', height: '100%' }}
              accessible={false}
            />
          </div>
          <HStack className="p-[16px] gap-[10px] items-center">
            <Text className="font-bold text-[16px] flex-1">{title}</Text>
            <Box className="bg-light-primary rounded-full w-[28px] h-[28px] items-center justify-center">
              <FeatherIcon name="chevron-right" size={17} color="primary" />
            </Box>
          </HStack>
        </div>
      </LinkBox>
    </div>
  )
}

function DailyVerse() {
  const { t } = useTranslation()
  const theme = useTheme()
  const [index, setIndex] = useState(VISIBLE_VERSE_OF_THE_DAY_OFFSETS.length - 1)
  const lastIndex = VISIBLE_VERSE_OF_THE_DAY_OFFSETS.length - 1
  const navigation = (
    <HStack className="items-center gap-[6px]">
      <LinkBox
        accessibilityLabel={t('home.desktop.previousVerse')}
        disabled={index === 0}
        accessibilityState={{ disabled: index === 0 }}
        onPress={() => setIndex(i => Math.max(0, i - 1))}
        className="items-center justify-center w-[32px] h-[32px] rounded-full"
        style={{ opacity: index === 0 ? 0.25 : 1 }}
      >
        <FeatherIcon name="chevron-left" size={18} color="grey" />
      </LinkBox>
      {VISIBLE_VERSE_OF_THE_DAY_OFFSETS.map((offset, i) => (
        <LinkBox
          key={offset}
          accessibilityLabel={
            offset === 0 ? t("Aujourd'hui") : t('home.desktop.daysAgo', { count: -offset })
          }
          accessibilityState={{ selected: index === i }}
          onPress={() => setIndex(i)}
          className="items-center justify-center w-[24px] h-[32px]"
        >
          <Box
            className="h-[6px] rounded-full"
            style={{
              width: index === i ? 16 : 6,
              backgroundColor: index === i ? theme.colors.primary : theme.colors.border,
            }}
          />
        </LinkBox>
      ))}
      <LinkBox
        accessibilityLabel={t('home.desktop.nextVerse')}
        disabled={index === lastIndex}
        accessibilityState={{ disabled: index === lastIndex }}
        onPress={() => setIndex(i => Math.min(lastIndex, i + 1))}
        className="items-center justify-center w-[32px] h-[32px] rounded-full"
        style={{ opacity: index === lastIndex ? 0.25 : 1 }}
      >
        <FeatherIcon name="chevron-right" size={18} color="grey" />
      </LinkBox>
    </HStack>
  )

  return (
    <AnimatedVerseHeight>
      <HStack className="rounded-[20px] bg-reverse overflow-hidden">
        <VerseOfTheDay
          addDay={VISIBLE_VERSE_OF_THE_DAY_OFFSETS[index]}
          desktop
          navigation={navigation}
          style={{ minWidth: 0 }}
        />
      </HStack>
    </AnimatedVerseHeight>
  )
}

export default function DesktopHome() {
  useFonts({ 'Literata Book': require('~assets/fonts/LiterataBook-Regular.otf') })
  const { t } = useTranslation()
  const lang = useLanguage()
  const plans = useComputedPlanItems()
  const pushRoute = usePushRouteOnce()
  const openCommandPalette = useSetAtom(commandPaletteOpenAtom)
  const setCommandReturnFocus = useSetAtom(commandPaletteReturnFocusAtom)
  const bibleProjectPlan = plans.find(
    plan => plan.id === (lang === 'fr' ? 'bible-project-plan' : 'bible-project-plan-en')
  )

  return (
    <div className="bs-home-container">
      <ScrollView testID="desktop-home" className="flex-1 bg-light-grey">
        <div className="bs-home-content">
          <Events />
          <OfflineNotice />
          <div className="bs-home-grid">
            <div className="bs-home-search">
              <LoginPrompt className="mx-0 rounded-[20px] px-[16px] py-[16px]" />
              <LinkBox
                onPress={event => {
                  if (event?.currentTarget instanceof HTMLElement)
                    setCommandReturnFocus(event.currentTarget)
                  openCommandPalette(true)
                }}
                accessibilityLabel={t('commandPalette.label')}
                className="flex-row items-center gap-[12px] shadow-[0_2px_7px_rgba(89,131,240,0.1)] bg-reverse rounded-[16px] px-[16px] py-[14px]"
              >
                <FeatherIcon name="search" size={19} color="grey" />
                <Text className="text-grey text-[13px] flex-1 min-w-0" numberOfLines={1}>
                  {t('home.dashboard.search')}
                </Text>
                <kbd className="bs-home-shortcut">
                  {typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform)
                    ? '⌘ K'
                    : 'Ctrl K'}
                </kbd>
              </LinkBox>
            </div>
            <div className="bs-home-main">
              <DailyVerse />
              <Box className="bg-reverse rounded-[18px] p-[4px] shadow-[0_2px_7px_rgba(89,131,240,0.1)]">
                <ProfileStats desktop />
              </Box>
              <Box>
                <SectionTitle>{t('Apprendre')}</SectionTitle>
                <div className="bs-home-learning">
                  <LearningCard
                    title={t('passageMediaLibrary.title')}
                    source={require('~assets/images/home/courses-videos.jpg')}
                    onPress={() => pushRoute({ pathname: '/(library)/passage-media' })}
                  />
                  <LearningCard
                    title={t('home.learning.bibleProjectPlan')}
                    source={require('~assets/images/home/bible-project-plan.jpg')}
                    route={bibleProjectPlan ? 'Plan' : 'Plans'}
                    params={
                      bibleProjectPlan
                        ? { planId: bibleProjectPlan.id, plan: bibleProjectPlan }
                        : undefined
                    }
                  />
                  <LearningCard
                    title={t('home.desktop.timeline')}
                    source={require('~assets/images/home/bible-timeline.jpg')}
                    route="TimelineHome"
                  />
                </div>
              </Box>
              <ResourceDiscovery />
            </div>
            <div className="bs-home-aside">
              <ResumeBookmark card />
              <MeditationsHome />
              <Box className="bg-reverse rounded-[20px] p-[16px] shadow-[0_2px_7px_rgba(89,131,240,0.1)]">
                <PlanHome compact />
              </Box>
              <LinkBox
                href="https://click.audibible.app/5nmN/stephane30"
                className="rounded-[20px] overflow-hidden p-[24px] min-h-[200px]"
                style={{ backgroundColor: '#122B4B' }}
              >
                <HStack className="gap-[12px] items-center z-10">
                  <Box
                    className="w-[54px] h-[54px] rounded-full items-center justify-center"
                    style={{ backgroundColor: '#24447A' }}
                  >
                    <FeatherIcon name="headphones" size={30} color="white" />
                  </Box>
                  <Box className="flex-1 gap-[7px]">
                    <Text className="text-[white] font-bold text-[19px]">{t('audibible.try')}</Text>
                    <Text className="text-[white] text-[13px]">{t('audibible.description')}</Text>
                  </Box>
                </HStack>
                <Image
                  source={illustrations.audio}
                  contentFit="contain"
                  contentPosition="bottom right"
                  style={{ position: 'absolute', right: 0, bottom: 0, width: 240, height: 160 }}
                  accessible={false}
                />
              </LinkBox>
            </div>
          </div>
          <HStack className="items-center flex-wrap gap-[24px] border-t border-border pt-[16px]">
            <ResourceLink href={`https://bible-strong.app/${lang === 'fr' ? 'fr/' : ''}give`}>
              {t('home.desktop.support')}
            </ResourceLink>
            <ResourceLink route="FAQ">{t('FAQ')}</ResourceLink>
            <ResourceLink href="https://www.facebook.com/fr.bible.strong">
              {t('Suivre')}
            </ResourceLink>
            <ResourceLink href="https://bible-strong.app">
              {t('home.desktop.downloadApp')}
            </ResourceLink>
          </HStack>
        </div>
      </ScrollView>
    </div>
  )
}
