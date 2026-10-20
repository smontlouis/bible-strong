import { Image } from 'expo-image'
import { useTranslation } from 'react-i18next'
import Card from '~common/ui/Card'
import { FeatherIcon } from '~common/ui/Icon'
import { ICON_TILE_SIZE } from '~common/ui/IconTile'
import ListSection, { ListRow } from '~common/ui/ListSection'
import { getAppleReviewing } from '~helpers/getAppleReviewing'
import useLanguage from '~helpers/useLanguage'
import { HomeGrid, useHomeLayout } from './homeLayout'

/**
 * « Aller plus loin »: Audibible and donation rows. A phone groups them in one card; a wide
 * home sets them side by side, each in its own card.
 */
const HomeGoFurther = () => {
  const { t } = useTranslation()
  const lang = useLanguage()
  const { wide } = useHomeLayout()
  const appleIsReviewing = getAppleReviewing()

  const rows = [
    <ListRow
      key="audibible"
      href="https://click.audibible.app/5nmN/stephane30"
      label={t('audibible.try')}
      description={t('audibible.description')}
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
            description={t('donation.description')}
            accessibilityLabel={t('donation.title')}
            accessibilityHint={t('donation.description')}
            icon={<FeatherIcon name="heart" size={18} color="color2" />}
            iconTint="color2"
          />,
        ]),
  ]

  if (wide)
    return (
      <HomeGrid columns={2} rowGap={10} style={{ paddingBottom: 32 }}>
        {rows.map(row => (
          <Card key={row.key}>{row}</Card>
        ))}
      </HomeGrid>
    )

  return <ListSection className="mb-[32px]">{rows}</ListSection>
}

export default HomeGoFurther
