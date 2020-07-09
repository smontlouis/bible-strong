import { TFunction } from 'i18next'

export interface Slide {
  title: string
  image?: any
  description: string
}

export const getSlides = (t: TFunction): Slide[] => {
  return [
    {
      title: t('Bienvenue,'),
      description: t(
        'Accédez à un lexique hébreu/grec, un dictionnaire, des thématiques, des commentaires, tout cela depuis votre mobile !'
      ),
      image: require('../../assets/images/Bible_Strong__First_Slide.png'),
    },
    {
      title: t('Votre couteau suisse'),
      description: t(
        'Prenez des notes,  écrivez vos propres études, surlignez, organisez par étiquette, partagez !'
      ),
      image: require('../../assets/images/Bible_Strong__Second_Slide.png'),
    },
    {
      title: t('Personnalisable'),
      description: t(
        "Thèmes jour/nuit, choix de polices, taille du texte... Modifiez l'application à votre convenance ! "
      ),
      image: require('../../assets/images/Bible_Strong__Third_Slide.png'),
    },
    // {
    //   title: 'Vos Études',
    //   description:
    //     'Un éditeur de texte riche et complet\n pour rédiger vos études, vos méditations,\n vos notes...',
    //   image: require('../assets/images/Bible_Strong__Fourth_Slide.png'),
    // },
    {
      title: t('Vos données en sécurité'),
      description: t(
        'Créez un compte pour synchroniser vos données dans le cloud, et cela en tout sécurité !'
      ),
      image: require('../../assets/images/Bible_Strong__Fifth_Slide.png'),
    },
    // {
    //   title: 'Accès hors-ligne',
    //   description:
    //     'Bible Strong a été pensé pour un accès avant tout hors-ligne. \n\nAvant de commencer, rendez-vous\n dans `Plus -> Gestion des téléchargements`\n pour télécharger tout ce dont vous avez\n besoin !',
    // },
  ]
}
