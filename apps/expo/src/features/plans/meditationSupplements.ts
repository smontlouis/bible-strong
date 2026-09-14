import type { ReadingSlice } from '~common/types'

interface MeditationSupplement {
  legacyLastUpdate: string
  anchors: { id: string; title: string }[]
  source: string
  corroboration: string
  sourceSha256: string
  retrievedOn: string
  entry: ReadingSlice
}

/** Historical Spurgeon readings; provenance and edition evidence are recorded in the calendar audit. */
export const meditationSupplements: Record<string, MeditationSupplement> = {
  ltdlf: {
    legacyLastUpdate: '1608972308349',
    anchors: [
      {
        id: '100',
        title: 'La première promesse de la Bible',
      },
      {
        id: '464',
        title: 'Aimés à la perfection',
      },
    ],
    source: 'https://godieu.com/doc/meditations/charles-haddon-spurgeon/1231.html',
    corroboration: 'https://www.bibliauniversalis3.com/textes/l.php?f=366.html&l=CHS_TDF',
    sourceSha256: 'b08bfc1fec519ec98c9be2ee093d1e7b69f5f093300b33ab1da4162a33908285',
    retrievedOn: '2026-09-14',
    entry: {
      id: 'ltdlf-12-31',
      calendarDate: '12-31',
      title: 'Aucun étranger dans le ciel, 31 décembre',
      slices: [
        {
          id: '0',
          type: 'Text',
          subType: 'devotional',
          description:
            'Tu me conduiras par ton conseil, et puis tu me recevras dans la gloire. Psaumes 73:24',
        },
        {
          id: '1',
          type: 'Text',
          description:
            "De jour en jour et d'année en année, ma foi se repose, avec une confiance plus entière, sur la sagesse et l'amour de mon Dieu, et je sais que je n'aurai pas cru en vain. Aucune de ses bonnes paroles ne m'a jamais trompé, et je sais qu'aucune d'elles ne tombera jamais à terre.\n\nJe mets ma main dans celle de mon Sauveur, pour qu'il me conduise. Je ne sais pas quel chemin choisir, mais le Seigneur me choisira mon héritage. J'ai besoin de conseil et de direction, car mes devoirs sont difficiles et mon avenir en dépend. Pour cela je regarde au Seigneur, de même que le sacrificateur consultait Urim et Thummim, car je préfère le conseil du Dieu infaillible à celui de mon propre jugement ou à l'avis de mes amis. Éternel! Tu seras toujours mon guide.\n\nBientôt, la fin viendra; encore quelques années, et je quitterai ce monde pour aller à mon Père. Le Seigneur sera alors à mon chevet; il me recevra à la porte des cieux et me donnera la bienvenue dans le séjour de la gloire. Je ne serai point un étranger dans son ciel, mais mon Père et mon Dieu y sera mon éternelle félicité.",
        },
      ],
    },
  },
  'faith-checkbook': {
    legacyLastUpdate: '1608280881176',
    anchors: [
      {
        id: '100',
        title: "The Bible's First Promise",
      },
      {
        id: '464',
        title: 'No Stranger in Heaven',
      },
    ],
    source: 'https://archive.spurgeon.org/fcb/fcb-bod.htm#02/29/AM',
    corroboration:
      'https://www.princeofpreachers.org/uploads/4/8/6/5/48652749/faith-checkbook-spurgeon.pdf',
    sourceSha256: '4411f334a8aea3668329aa5a046fb975cb32d4c8c259b6ab7721a19495581509',
    retrievedOn: '2026-09-14',
    entry: {
      id: 'faith-checkbook-02-29',
      calendarDate: '02-29',
      title: 'What Follows Us, February 29',
      slices: [
        {
          id: '0',
          type: 'Text',
          subType: 'devotional',
          description:
            'Surely goodness and mercy shall follow me all the days of my life. (Psalm 23:6)',
        },
        {
          id: '1',
          type: 'Text',
          description:
            "A devout poet sings\n\nLord, when thou\n\nPuttest in my time a day,\n\nas thou dost now,\n\nUnknown in other years, grant, I entreat,\n\nSuch grace illumine it, that whate'er its phase\n\nIt add to holiness, and lengthen praise!\n\nThis day comes but once in four years.... Up till now goodness and mercy, like two guards, have followed us from day to day, bringing up the rear even as grace leads the van; and as this out-of-the-way day is one of the days of our life, the two guardian angels will be with us today also. Goodness to supply our needs and mercy to blot out our sins—these twain shall attend our every step this day and every day till days shall be no more. Wherefore, let us serve the Lord on this peculiar day with special consecration of heart and sing His praises with more zest and sweetness than ever. Could we not today make an unusual offering to the cause of God or to the poor? By inventiveness of love let us make this twenty-ninth of February a day to be remembered forever.",
        },
      ],
    },
  },
}
