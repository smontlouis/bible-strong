import React, { type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import Header from '~common/Header'
import { READING_TEXT_MAX_WIDTH } from '~common/readingLayout'
import Box from '~common/ui/Box'
import Card from '~common/ui/Card'
import Container from '~common/ui/Container'
import { ListSeparator } from '~common/ui/ListSection'
import Paragraph from '~common/ui/Paragraph'
import ScrollView from '~common/ui/ScrollView'
import Text from '~common/ui/Text'
import { titleFontStyle } from '~themes/styleValues'
import { useTheme } from '~themes/ThemeProvider'

const PAGE_PADDING = 24
const ROW_PADDING = 16

const beliefs = [
  'god',
  'creator',
  'jesus',
  'spirit',
  'scriptures',
  'grace',
  'church',
  'return',
] as const
const appParts = ['text', 'context', 'interpretations'] as const
const assistantRules = ['bible', 'sources', 'debated'] as const

/** The paragraphs of a text, split on its blank lines. */
const Paragraphs = ({ text }: { text: string }) => (
  <Box className="gap-[14px]" style={{ paddingHorizontal: PAGE_PADDING }}>
    {text.split('\n\n').map(paragraph => (
      <Paragraph key={paragraph}>{paragraph}</Paragraph>
    ))}
  </Box>
)

/** A list of short statements in one card, split by hairlines. */
const StatementCard = ({ children }: { children: ReactNode[] }) => (
  <Card className="mx-[20px]">
    {children.map((child, index) => (
      <Box key={index}>
        {index > 0 && <ListSeparator inset={ROW_PADDING} />}
        <Box style={{ paddingHorizontal: ROW_PADDING, paddingVertical: 14 }}>{child}</Box>
      </Box>
    ))}
  </Card>
)

/** A part of the manifesto: its heading in the title face, then its content. */
const Section = ({ title, children }: { title: string; children: ReactNode }) => {
  const theme = useTheme()
  return (
    <Box className="mt-[40px] gap-[16px]">
      <Text
        accessibilityRole="header"
        className="text-[22px]"
        style={[titleFontStyle(theme), { paddingHorizontal: PAGE_PADDING }]}
      >
        {title}
      </Text>
      {children}
    </Box>
  )
}

/** The Bible Strong manifesto, the same text as MANIFESTO.md at the root of the repository. */
const ManifestoScreen = () => {
  const { t } = useTranslation()
  const theme = useTheme()
  const titleStyle = titleFontStyle(theme)

  return (
    <Container className="bg-canvas">
      <Header hasBackButton title={t('manifesto.title')} />
      <ScrollView
        backgroundColor="canvas"
        contentContainerStyle={{ maxWidth: READING_TEXT_MAX_WIDTH + 2 * PAGE_PADDING }}
      >
        <Box className="pb-[40px]">
          <Text
            accessibilityRole="header"
            className="text-[30px]"
            style={[titleStyle, { paddingHorizontal: PAGE_PADDING }]}
          >
            {t('manifesto.heading')}
          </Text>

          <Section title={t('manifesto.why.title')}>
            <Paragraphs text={t('manifesto.why.body')} />
          </Section>

          <Section title={t('manifesto.who.title')}>
            <Paragraphs text={t('manifesto.who.body')} />
          </Section>

          <Section title={t('manifesto.beliefs.title')}>
            <StatementCard>
              {beliefs.map(id => (
                <Box key={id} className="gap-[4px]">
                  <Text className="font-bold text-[16px]">
                    {t(`manifesto.beliefs.${id}.title`)}
                  </Text>
                  <Paragraph scale={-2}>{t(`manifesto.beliefs.${id}.text`)}</Paragraph>
                  <Text className="text-grey text-[13px]">
                    {t(`manifesto.beliefs.${id}.references`)}
                  </Text>
                </Box>
              ))}
            </StatementCard>
          </Section>

          <Section title={t('manifesto.app.title')}>
            <StatementCard>
              {appParts.map(id => (
                <Box key={id} className="gap-[4px]">
                  <Text className="font-bold text-[16px]">{t(`manifesto.app.${id}.title`)}</Text>
                  <Paragraph scale={-2}>{t(`manifesto.app.${id}.text`)}</Paragraph>
                </Box>
              ))}
            </StatementCard>
          </Section>

          <Section title={t('manifesto.not.title')}>
            <Paragraphs text={t('manifesto.not.body')} />
          </Section>

          <Section title={t('manifesto.ai.title')}>
            <Paragraphs text={t('manifesto.ai.intro')} />
            <StatementCard>
              {assistantRules.map(id => (
                <Paragraph key={id} scale={-2}>
                  {t(`manifesto.ai.rule.${id}`)}
                </Paragraph>
              ))}
            </StatementCard>
            <Paragraphs text={t('manifesto.ai.outro')} />
          </Section>

          <Section title={t('manifesto.independence.title')}>
            <Paragraphs text={t('manifesto.independence.body')} />
          </Section>

          <Box className="mt-[32px] gap-[2px]" style={{ paddingHorizontal: PAGE_PADDING }}>
            <Text className="font-bold text-[16px]">{t('manifesto.signature.name')}</Text>
            <Text className="text-grey text-[14px]">{t('manifesto.signature.role')}</Text>
          </Box>
        </Box>
      </ScrollView>
    </Container>
  )
}

export default ManifestoScreen
