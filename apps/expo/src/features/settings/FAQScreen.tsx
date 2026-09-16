import { resolveFontFamily } from '~themes/styleValues'
import { useTheme as useStylingTheme } from '~themes/ThemeProvider'
import { colorWithOpacity } from '~themes/colorValues'
import React, { useState } from 'react'
import { useTranslation } from 'react-i18next'
import Header from '~common/Header'
import { LinkBox } from '~common/Link'
import Box, { HStack, TouchableBox } from '~common/ui/Box'
import { FeatherIcon } from '~common/ui/Icon'
import Container from '~common/ui/Container'
import Paragraph from '~common/ui/Paragraph'
import ScrollView from '~common/ui/ScrollView'
import Text from '~common/ui/Text'

const FAQScreen = () => {
  const stylingTheme = useStylingTheme()
  const { t } = useTranslation()
  const [categoryId, setCategoryId] = useState('start')
  const [expandedId, setExpandedId] = useState<string | null>('availability')
  const [contentWidth, setContentWidth] = useState(0)
  const wide = contentWidth >= 900
  const titleStyle = { fontFamily: resolveFontFamily(stylingTheme.fontFamily.title) }
  const entries = [
    {
      id: 'availability',
      question: t('faq.availabilityQuestion'),
      answer: t('faq.availabilityAnswer'),
      link: { href: 'https://web.bible-strong.app/home', label: t('faq.openWeb') },
    },
    { id: 'free', question: t('faq.freeQuestion'), answer: t('faq.freeAnswer') },
    { id: 'account', question: t('faq.accountQuestion'), answer: t('faq.accountAnswer') },
    { id: 'sync', question: t('faq.syncQuestion'), answer: t('faq.syncAnswer') },
    { id: 'offline', question: t('faq.offlineQuestion'), answer: t('faq.offlineAnswer') },
    { id: 'storage', question: t('faq.storageQuestion'), answer: t('faq.storageAnswer') },
    { id: 'strong', question: t('faq.strongQuestion'), answer: t('faq.strongAnswer') },
    { id: 'versions', question: t('faq.versionsQuestion'), answer: t('faq.versionsAnswer') },
    { id: 'backup', question: t('faq.backupQuestion'), answer: t('faq.backupAnswer') },
    {
      id: 'whiteScreen',
      question: t('faq.whiteScreenQuestion'),
      answer: t('faq.whiteScreenAnswer'),
    },
    {
      id: 'performance',
      question: t('faq.performanceQuestion'),
      answer: t('faq.performanceAnswer'),
    },
    {
      id: 'bugNoticed',
      question: t('faq.bugNoticedQuestion'),
      answer: t('faq.bugNoticedAnswer'),
      link: {
        href: 'https://github.com/smontlouis/bible-strong/issues',
        label: t('faq.openIssues'),
      },
    },
    {
      id: 'idea',
      question: t('faq.ideaQuestion'),
      answer: t('faq.ideaAnswer'),
      link: { href: 'mailto:stephane@lestudio316.com', label: t('faq.contact') },
    },
    {
      id: 'support',
      question: t('faq.supportQuestion'),
      answer: t('faq.supportAnswer'),
      link: { href: 'https://bible-strong.app/give', label: t('faq.donate') },
    },
    { id: 'author', question: t('faq.authorQuestion'), answer: t('faq.authorAnswer') },
  ]

  const categories = [
    {
      id: 'start',
      label: t('faq.category.start'),
      summary: t('faq.category.startSummary'),
      title: t('faq.category.startTitle'),
      description: t('faq.category.startDescription'),
      entries: ['availability', 'free'],
    },
    {
      id: 'account',
      label: t('faq.category.account'),
      summary: t('faq.category.accountSummary'),
      title: t('faq.category.accountTitle'),
      description: t('faq.category.accountDescription'),
      entries: ['sync', 'account', 'backup'],
    },
    {
      id: 'reading',
      label: t('faq.category.reading'),
      summary: t('faq.category.readingSummary'),
      title: t('faq.category.readingTitle'),
      description: t('faq.category.readingDescription'),
      entries: ['offline', 'storage', 'strong', 'versions'],
    },
    {
      id: 'help',
      label: t('faq.category.help'),
      summary: t('faq.category.helpSummary'),
      title: t('faq.category.helpTitle'),
      description: t('faq.category.helpDescription'),
      entries: ['whiteScreen', 'performance', 'bugNoticed', 'idea', 'support', 'author'],
    },
  ]
  const category = categories.find(item => item.id === categoryId) ?? categories[0]
  const questions = category.entries.flatMap(id => {
    const entry = entries.find(item => item.id === id)
    return entry ? [entry] : []
  })

  return (
    <Container>
      <Header hasBackButton title="FAQ" />
      <ScrollView contentContainerStyle={{ maxWidth: 1120 }}>
        <Box
          onLayout={event => setContentWidth(event.nativeEvent.layout.width)}
          className={wide ? 'px-[32px] pt-[20px] pb-[40px]' : 'px-[20px] pb-[32px]'}
        >
          <Text
            accessibilityRole="header"
            className={wide ? 'text-[36px] mb-[16px]' : 'text-[28px] mb-[12px]'}
            style={titleStyle}
          >
            {t('faq.title')}
          </Text>
          <Paragraph className="text-grey max-w-[720px] mb-[36px]" scale={-1}>
            {t('faq.intro')}
          </Paragraph>
          <Box className={wide ? 'flex-row items-start gap-[36px]' : 'gap-[28px]'}>
            <Box
              className={
                wide
                  ? 'w-[220px] shrink-0 border-r border-border pr-[20px]'
                  : 'border-b border-border pb-[20px]'
              }
            >
              <Text className="text-grey text-[12px] uppercase tracking-[1.2px] mb-[16px]">
                {t('faq.browse')}
              </Text>
              <Box className={wide ? 'gap-[12px]' : 'flex-row flex-wrap gap-[8px]'}>
                {categories.map(item => {
                  const selected = item.id === categoryId
                  return (
                    <TouchableBox
                      key={item.id}
                      accessibilityRole="button"
                      accessibilityLabel={item.label}
                      accessibilityState={{ selected }}
                      onPress={() => {
                        setCategoryId(item.id)
                        setExpandedId(item.entries[0])
                      }}
                      className={
                        wide
                          ? 'border-l-[3px] py-[14px] pl-[16px] gap-[6px]'
                          : 'border rounded-[12px] px-[14px] py-[12px]'
                      }
                      style={{
                        borderColor: selected ? stylingTheme.colors.primary : 'transparent',
                        backgroundColor:
                          !wide && selected
                            ? colorWithOpacity(stylingTheme.colors.primary, 0.08)
                            : undefined,
                      }}
                    >
                      <Text
                        className="font-bold text-[15px]"
                        style={{ color: selected ? stylingTheme.colors.primary : undefined }}
                      >
                        {item.label}
                      </Text>
                      {wide && <Text className="text-grey text-[13px]">{item.summary}</Text>}
                    </TouchableBox>
                  )
                })}
              </Box>
            </Box>
            <Box className="flex-1 min-w-0 w-full">
              <HStack className="items-center gap-[8px] mb-[20px]">
                <Text className="text-grey text-[13px]">FAQ /</Text>
                <Text className="text-primary text-[13px]">{category.label}</Text>
              </HStack>
              <Text
                accessibilityRole="header"
                className={wide ? 'text-[30px] mb-[14px]' : 'text-[24px] mb-[12px]'}
                style={titleStyle}
              >
                {category.title}
              </Text>
              <Paragraph className="text-grey mb-[24px]" scale={-1}>
                {category.description}
              </Paragraph>
              <Box className="gap-[12px] border-t border-border pt-[24px]">
                {questions.map(entry => {
                  const expanded = entry.id === expandedId
                  return (
                    <Box
                      key={entry.id}
                      className="border border-border rounded-[14px] overflow-hidden"
                    >
                      <TouchableBox
                        accessibilityRole="button"
                        accessibilityLabel={entry.question}
                        accessibilityState={{ expanded }}
                        aria-expanded={expanded}
                        onPress={() => setExpandedId(expanded ? null : entry.id)}
                        className="flex-row items-center gap-[16px] px-[20px] py-[18px]"
                      >
                        <Text className="flex-1 text-[16px] font-bold">{entry.question}</Text>
                        <FeatherIcon
                          name={expanded ? 'chevron-up' : 'chevron-down'}
                          size={20}
                          color="grey"
                        />
                      </TouchableBox>
                      {expanded && (
                        <Box className="px-[20px] pb-[20px]">
                          <Paragraph scale={-1}>{entry.answer}</Paragraph>
                          {entry.link && (
                            <LinkBox
                              href={entry.link.href}
                              className="mt-[12px] py-[8px] self-start flex-row items-center gap-[8px]"
                            >
                              <Text className="text-primary font-bold shrink">
                                {entry.link.label}
                              </Text>
                              <FeatherIcon name="arrow-up-right" size={16} color="primary" />
                            </LinkBox>
                          )}
                        </Box>
                      )}
                    </Box>
                  )
                })}
              </Box>
              <Box className="border-t border-border mt-[28px] pt-[24px]">
                <Box
                  className="border border-border rounded-[16px] bg-light-grey p-[20px] gap-[16px]"
                  style={{
                    flexDirection: wide ? 'row' : 'column',
                    alignItems: wide ? 'center' : undefined,
                  }}
                >
                  <HStack className="flex-1 items-start gap-[14px]">
                    <Box
                      className="rounded-full p-[10px]"
                      style={{
                        backgroundColor: colorWithOpacity(stylingTheme.colors.primary, 0.08),
                      }}
                    >
                      <FeatherIcon name="life-buoy" size={24} color="primary" />
                    </Box>
                    <Box className="flex-1 gap-[6px]">
                      <Text className="font-bold text-[17px]">{t('faq.needHelp')}</Text>
                      <Text className="text-grey text-[14px]">{t('faq.contactDescription')}</Text>
                    </Box>
                  </HStack>
                  <LinkBox
                    href="mailto:stephane@lestudio316.com"
                    className="self-end flex-row items-center gap-[10px] border border-primary rounded-[10px] px-[16px] py-[12px]"
                    style={{ alignSelf: wide ? 'center' : 'flex-end' }}
                  >
                    <Text className="text-primary font-bold text-[14px]">{t('faq.contact')}</Text>
                    <FeatherIcon name="arrow-right" size={16} color="primary" />
                  </LinkBox>
                </Box>
              </Box>
            </Box>
          </Box>
        </Box>
      </ScrollView>
    </Container>
  )
}
export default FAQScreen
