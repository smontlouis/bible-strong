import { Image } from 'expo-image'
import { useTranslation } from 'react-i18next'
import { FeatherIcon } from '~common/ui/Icon'
import { ICON_TILE_SIZE } from '~common/ui/IconTile'
import ListSection, { ListRow } from '~common/ui/ListSection'
import { getAppleReviewing } from '~helpers/getAppleReviewing'
import useLanguage from '~helpers/useLanguage'

/**
 * « Aller plus loin »: Audibible, donation, Follow and FAQ, one line each, grouped in
 * one card at every width.
 */
const HomeGoFurther = () => {
  const { t } = useTranslation()
  const lang = useLanguage()
  const appleIsReviewing = getAppleReviewing()

  const rows = [
    <ListRow
      key="audibible"
      href="https://click.audibible.app/5nmN/stephane30"
      label={t('audibible.try')}
      accessibilityLabel={t('audibible.try')}
      accessibilityHint={t('audibible.description')}
      icon={
        <Image
          source={require('~assets/images/audibible-icon.png')}
          accessible={false}
          style={{ width: ICON_TILE_SIZE, height: ICON_TILE_SIZE }}
        />
      }
    />,
    ...(appleIsReviewing
      ? []
      : [
          <ListRow
            key="donation"
            href={`https://bible-strong.app/${lang === 'fr' ? 'fr/' : ''}give`}
            label={t('donation.title')}
            accessibilityLabel={t('donation.title')}
            accessibilityHint={t('donation.description')}
            icon={<FeatherIcon name="heart" size={18} color="color2" />}
            iconTint="color2"
          />,
        ]),
    <ListRow
      key="follow"
      href="https://www.facebook.com/fr.bible.strong"
      label={t('Suivre')}
      icon={<FeatherIcon name="facebook" size={18} color="grey" />}
    />,
    <ListRow
      key="faq"
      route="FAQ"
      label={t('FAQ')}
      icon={<FeatherIcon name="help-circle" size={18} color="grey" />}
    />,
  ]

  return <ListSection className="mb-[32px]">{rows}</ListSection>
}

export default HomeGoFurther
