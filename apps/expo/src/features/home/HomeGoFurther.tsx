import { Image } from 'expo-image'
import { useTranslation } from 'react-i18next'
import * as Icon from '~common/ui/classNameIcons'
import { getAppleReviewing } from '~helpers/getAppleReviewing'
import useLanguage from '~helpers/useLanguage'
import HomeRowCard from './HomeRowCard'
import { HomeGrid, useHomeLayout } from './homeLayout'

/** « Aller plus loin »: Audibible and donation rows, side by side on a wide home. */
const HomeGoFurther = () => {
  const { t } = useTranslation()
  const lang = useLanguage()
  const { wide } = useHomeLayout()
  const appleIsReviewing = getAppleReviewing()

  return (
    <HomeGrid columns={wide ? 2 : 1} rowGap={10} style={{ paddingBottom: 32 }}>
      <HomeRowCard
        dark
        href="https://click.audibible.app/5nmN/stephane30"
        title={t('audibible.try')}
        description={t('audibible.description')}
        iconBackground="#FFFFFF"
        icon={
          <Image
            source={require('~assets/images/audibible-icon.png')}
            accessible={false}
            style={{ width: 44, height: 44 }}
          />
        }
      />
      {!appleIsReviewing && (
        <HomeRowCard
          href={`https://bible-strong.app/${lang === 'fr' ? 'fr/' : ''}give`}
          title={t('donation.title')}
          description={t('donation.description')}
          iconBackground="rgba(255,118,117,0.14)"
          icon={<Icon.Feather name="heart" size={22} color="#E05554" />}
        />
      )}
    </HomeGrid>
  )
}

export default HomeGoFurther
