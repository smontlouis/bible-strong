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
  const lang = useLanguage()
  const { t } = useTranslation()

  return (
    <Sheet ref={modalRef} snapPoints={[1]}>
      <SheetScrollView>
        <Box flex center px={50} py={60}>
          <Text title fontSize={20}>
            {getLegacyLocalizedField(lang, { fr: sectionTitle, en: sectionTitleEn })}
          </Text>

          <Text py={30} fontSize={35} title textAlign="center">
            {getLegacyLocalizedField(lang, { fr: title, en: titleEn }).toUpperCase()}
          </Text>

          <Box>
            <Box height={2} bg="default" />

            <Text py={3} textAlign="center" title>
              {getLegacyLocalizedField(lang, { fr: subTitle, en: subTitleEn })}
            </Text>
            <Box height={2} bg="default" />
          </Box>
          <Box row width={width} mt={50} lightShadow borderRadius={10}>
            <Image
              style={{ width, height: width, borderRadius: 10 }}
              source={{
                uri: image,
              }}
            />
          </Box>
          <Box lightShadow bg={color} width={50} height={10} borderRadius={10} my={50} />
          <Paragraph>
            {getLegacyLocalizedField(lang, { fr: description, en: descriptionEn })}
          </Paragraph>
          <Paragraph scale={-2} mt={80} textAlign="center">
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
