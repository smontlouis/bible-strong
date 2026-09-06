import { resolveThemeColor, resolveFontFamily } from '~themes/styleValues'
import { useTheme as useStylingTheme } from '~themes/ThemeProvider'
import React from 'react'
import { Sheet, type SheetRef, SheetScrollView } from '~common/sheet'
import { Image } from 'expo-image'
import { useTranslation } from 'react-i18next'
import InlineLink from '~common/InlineLink'
import Box from '~common/ui/Box'
import Paragraph from '~common/ui/Paragraph'
import Text from '~common/ui/Text'
import useLanguage from '~helpers/useLanguage'
import { getLegacyLocalizedField } from '~helpers/languageUtils'
import { wp } from '~helpers/utils'
import { ShallowTimelineSection } from './types'
interface Props extends ShallowTimelineSection {
  modalRef: React.RefObject<SheetRef | null>
}

const width = wp(50, 500)

const SectionDetailsModal = ({
  modalRef,
  image,
  color,
  description,
  descriptionEn,
  title,
  titleEn,
  sectionTitle,
  sectionTitleEn,
  subTitle,
  subTitleEn,
  startYear,
  endYear,
  interval,
}: Props) => {
  const stylingTheme = useStylingTheme()

  const lang = useLanguage()
  const { t } = useTranslation()

  return (
    <Sheet ref={modalRef} snapPoints={[1]}>
      <SheetScrollView>
        <Box className="overflow-hidden border-continuous flex-[1] items-center justify-center px-[50px] py-[60px]">
          <Text
            className="text-[20px]"
            style={{ fontFamily: resolveFontFamily(stylingTheme.fontFamily.title) }}
          >
            {getLegacyLocalizedField(lang, { fr: sectionTitle, en: sectionTitleEn })}
          </Text>

          <Text
            className="py-[30px] text-[35px] text-center"
            style={{ fontFamily: resolveFontFamily(stylingTheme.fontFamily.title) }}
          >
            {getLegacyLocalizedField(lang, { fr: title, en: titleEn }).toUpperCase()}
          </Text>

          <Box className="overflow-hidden border-continuous">
            <Box className="overflow-hidden border-continuous h-[2px] bg-default" />

            <Text
              className="py-[3px] text-center"
              style={{ fontFamily: resolveFontFamily(stylingTheme.fontFamily.title) }}
            >
              {getLegacyLocalizedField(lang, { fr: subTitle, en: subTitleEn })}
            </Text>
            <Box className="overflow-hidden border-continuous h-[2px] bg-default" />
          </Box>
          <Box
            className="overflow-hidden border-continuous flex-row mt-[50px] rounded-[10px]"
            style={{
              width: width,
              shadowColor: 'rgb(89,131,240)',
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.1,
              shadowRadius: 7,
              elevation: 1,
              overflow: 'visible',
            }}
          >
            <Image
              style={{ width, height: width, borderRadius: 10 }}
              source={{
                uri: image,
              }}
            />
          </Box>
          <Box
            className="overflow-hidden border-continuous w-[50px] h-[10px] rounded-[10px] my-[50px]"
            style={{
              backgroundColor: resolveThemeColor(stylingTheme, color),
              shadowColor: 'rgb(89,131,240)',
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.1,
              shadowRadius: 7,
              elevation: 1,
              overflow: 'visible',
            }}
          />
          <Paragraph>
            {getLegacyLocalizedField(lang, { fr: description, en: descriptionEn })}
          </Paragraph>
          <Paragraph className="mt-[80px] text-center" scale={-2}>
            {`${t('Vous souhaitez aller plus loin ?')}\n`}
            <InlineLink
              scale={-2}
              href="https://www.bibleuniverse.com/study-tools/storacles/c/3/l/french"
            >
              {t('Cliquez ici')}
            </InlineLink>
          </Paragraph>
        </Box>
      </SheetScrollView>
    </Sheet>
  )
}

export default SectionDetailsModal
