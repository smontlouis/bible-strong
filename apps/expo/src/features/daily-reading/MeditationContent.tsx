import { useTranslation } from 'react-i18next'
import { useSelector } from 'react-redux'
import type { Plan, ReadingSlice } from '~common/types'
import Box from '~common/ui/Box'
import Text from '~common/ui/Text'
import { selectFontFamily } from '~redux/selectors/user'
import { resolveFontFamily } from '~themes/styleValues'
import ReferenceParagraph from '~features/plans/PlanSliceScreen/ReferenceParagraph'
import Slice from '~features/plans/PlanSliceScreen/Slice'
import { getMeditationTitle } from '~features/plans/readingCalendar'
import { resolveMeditationOpening } from './meditationPassage'

export default function MeditationContent({
  reading,
  language,
  wide,
}: {
  reading: ReadingSlice
  language: Plan['lang']
  wide: boolean
}) {
  const { t } = useTranslation()
  const fontFamily = resolveFontFamily(useSelector(selectFontFamily))
  const opening = resolveMeditationOpening(reading, language)
  const body = reading.slices.filter(
    slice => !(opening && slice.type === 'Text' && slice.subType === 'devotional')
  )
  return (
    <Box className="gap-[32px]">
      <Text
        accessibilityRole="header"
        className={
          wide
            ? 'text-default font-bold text-[32px] leading-[40px]'
            : 'text-default font-bold text-[26px] leading-[34px]'
        }
      >
        {getMeditationTitle(reading)}
      </Text>
      {opening && (
        <Box className="gap-[16px]">
          <Text className="text-primary text-[11px] font-bold uppercase tracking-[1.5px]">
            {t('dailyReading.verseHeading')}
          </Text>
          <ReferenceParagraph
            planLanguage={language}
            style={{ fontFamily }}
            className="text-default"
          >
            {opening.quote}
          </ReferenceParagraph>
          {opening.reference && (
            <ReferenceParagraph
              planLanguage={language}
              scale={-1}
              style={{ fontFamily }}
              className="text-primary"
            >
              {opening.reference}
            </ReferenceParagraph>
          )}
          {!!opening.editorialCitation && (
            <Text className="text-grey text-[12px]">{opening.editorialCitation}</Text>
          )}
        </Box>
      )}
      {body.length > 0 && (
        <Box className="border-t border-border pt-[28px] gap-[20px]">
          <Text className="text-primary text-[11px] font-bold uppercase tracking-[1.5px]">
            {t('dailyReading.meditationHeading')}
          </Text>
          {body.map((slice, index) =>
            slice.type === 'Text' ? (
              <Box key={`${slice.id}:${index}`} className="gap-[20px]">
                {slice.description
                  .trim()
                  .split(/\n\s*\n/)
                  .map((paragraph, paragraphIndex) => (
                    <ReferenceParagraph
                      key={`${slice.id}:${paragraphIndex}`}
                      planLanguage={language}
                      style={{ fontFamily }}
                      className="text-default"
                    >
                      {paragraph}
                    </ReferenceParagraph>
                  ))}
              </Box>
            ) : (
              <Slice key={`${slice.id}:${index}`} {...slice} planLanguage={language} />
            )
          )}
        </Box>
      )}
    </Box>
  )
}
