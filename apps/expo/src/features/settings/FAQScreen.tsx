import { resolveFontFamily } from '~themes/styleValues'
import { useTheme as useStylingTheme } from '~themes/ThemeProvider'
import { colorWithOpacity } from '~themes/colorValues'
import React, { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Linking } from 'react-native'
import Header from '~common/Header'
import { LinkBox } from '~common/Link'
import Box, { HStack, TouchableBox } from '~common/ui/Box'
import Button from '~common/ui/Button'
import Card from '~common/ui/Card'
import { FeatherIcon } from '~common/ui/Icon'
import Container from '~common/ui/Container'
import IconTile from '~common/ui/IconTile'
import ListSection, { ListRow } from '~common/ui/ListSection'
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

  const selectCategory = (item: (typeof categories)[number]) => {
    setCategoryId(item.id)
    setExpandedId(item.entries[0])
  }

  return (
    <Container className="bg-canvas">
      <Header hasBackButton title="FAQ" />
      <ScrollView backgroundColor="canvas" contentContainerStyle={{ maxWidth: 1120 }}>
        <Box
          onLayout={event => setContentWidth(event.nativeEvent.layout.width)}
          className={wide ? 'pb-[40px]' : 'pb-[32px]'}
        >
          <Box className="px-[24px] mb-[28px]">
            <Text
              accessibilityRole="header"
              className={wide ? 'text-[36px] mb-[12px]' : 'text-[28px] mb-[8px]'}
              style={titleStyle}
            >
              {t('faq.title')}
            </Text>
            <Paragraph className="text-grey max-w-[720px]" scale={-1}>
              {t('faq.intro')}
            </Paragraph>
          </Box>
          <Box className={wide ? 'flex-row items-start' : undefined}>
            {wide ? (
              <ListSection title={t('faq.browse')} className="w-[300px] shrink-0 mr-0">
                {categories.map(item => {
                  const selected = item.id === categoryId
                  return (
                    <ListRow
                      key={item.id}
                      label={item.label}
                      description={item.summary}
                      hasChevron={false}
                      accessibilityState={{ selected }}
                      onPress={() => selectCategory(item)}
                      labelClassName={selected ? 'text-primary font-bold' : 'font-bold'}
                    />
                  )
                })}
              </ListSection>
            ) : (
              <HStack className="flex-wrap gap-[8px] px-[20px] mb-[28px]">
                {categories.map(item => {
                  const selected = item.id === categoryId
                  return (
                    <TouchableBox
                      key={item.id}
                      accessibilityLabel={item.label}
                      accessibilityState={{ selected }}
                      onPress={() => selectCategory(item)}
                      className={
                        selected
                          ? 'rounded-full px-[16px] py-[9px]'
                          : 'rounded-full px-[16px] py-[9px] bg-surface'
                      }
                      style={
                        selected
                          ? { backgroundColor: colorWithOpacity(stylingTheme.colors.primary, 0.14) }
                          : undefined
                      }
                    >
                      <Text
                        className={selected ? 'text-primary font-bold text-[14px]' : 'text-[14px]'}
                      >
                        {item.label}
                      </Text>
                    </TouchableBox>
                  )
                })}
              </HStack>
            )}
            <Box className="flex-1 min-w-0">
              <Box className="px-[24px] mb-[16px]">
                <Text
                  accessibilityRole="header"
                  className={wide ? 'text-[28px] mb-[8px]' : 'text-[22px] mb-[6px]'}
                  style={titleStyle}
                >
                  {category.title}
                </Text>
                <Paragraph className="text-grey" scale={-1}>
                  {category.description}
                </Paragraph>
              </Box>
              <ListSection>
                {questions.map(entry => {
                  const expanded = entry.id === expandedId
                  return (
                    <Box key={entry.id}>
                      <TouchableBox
                        accessibilityLabel={entry.question}
                        accessibilityState={{ expanded }}
                        aria-expanded={expanded}
                        onPress={() => setExpandedId(expanded ? null : entry.id)}
                        className="flex-row items-center gap-[12px] px-[14px] py-[14px]"
                      >
                        <Text className="flex-1 text-[15px] font-bold">{entry.question}</Text>
                        <FeatherIcon
                          name={expanded ? 'chevron-up' : 'chevron-down'}
                          size={18}
                          color="grey"
                        />
                      </TouchableBox>
                      {expanded && (
                        <Box className="px-[14px] pb-[16px]">
                          <Paragraph scale={-1}>{entry.answer}</Paragraph>
                          {entry.link && (
                            <LinkBox
                              href={entry.link.href}
                              className="mt-[10px] py-[6px] self-start flex-row items-center gap-[6px]"
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
              </ListSection>
              <Card
                className="mx-[20px] p-[16px] gap-[16px]"
                style={{
                  flexDirection: wide ? 'row' : 'column',
                  alignItems: wide ? 'center' : undefined,
                }}
              >
                <HStack className="flex-1 items-center gap-[12px]">
                  <IconTile tint="primary" size={40}>
                    <FeatherIcon name="life-buoy" size={20} color="primary" />
                  </IconTile>
                  <Box className="flex-1 gap-[2px]">
                    <Text className="font-bold text-[16px]">{t('faq.needHelp')}</Text>
                    <Text className="text-grey text-[14px]">{t('faq.contactDescription')}</Text>
                  </Box>
                </HStack>
                <Button
                  onPress={() => Linking.openURL('mailto:stephane@lestudio316.com')}
                  rightIcon={
                    <FeatherIcon
                      name="arrow-right"
                      size={16}
                      color="white"
                      style={{ marginLeft: 8 }}
                    />
                  }
                  style={{ paddingLeft: 20, paddingRight: 20 }}
                >
                  {t('faq.contact')}
                </Button>
              </Card>
            </Box>
          </Box>
        </Box>
      </ScrollView>
    </Container>
  )
}
export default FAQScreen
